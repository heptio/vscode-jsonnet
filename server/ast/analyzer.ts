'use strict';
import * as os from 'os';
import * as path from 'path';

import * as immutable from 'immutable';

import * as ast from '../parser/node';
import * as astVisitor from './visitor';
import * as compiler from './compiler';
import * as error from '../lexer/static_error';
import * as lexer from '../lexer/lexer';
import * as workspace from './workspace';
import * as service from './service';

//
// Analyzer.
//

export interface EventedAnalyzer
  extends workspace.DocumentEventListener, service.UiEventListener { }

// TODO: Rename this to `EventedAnalyzer`.
export class Analyzer implements EventedAnalyzer {
  constructor(
    private documents: workspace.DocumentManager,
    private compilerService: compiler.CompilerService,
  ) { }

  //
  // WorkspaceEventListener implementation.
  //

  public onDocumentOpen = this.compilerService.cache;

  public onDocumentSave = this.compilerService.cache;

  public onDocumentClose = this.compilerService.delete;

  //
  // AnalysisEventListener implementation.
  //

  public onHover = (
    fileUri: string, cursorLoc: error.Location
  ): Promise<service.HoverInfo> => {
    const onHoverPromise = (node: ast.Node): Promise<service.HoverInfo> => {
      return Promise.resolve().then(
        () => <service.HoverInfo> {
          contents: this.renderOnhoverMessage(node),
        });
    }

    // Get symbol we're hovering over.
    const nodeAtPos = this.getNodeAtPosition(fileUri, cursorLoc);
    if (nodeAtPos.parent != null && ast.isFunctionParam(nodeAtPos.parent)) {
      // A function parameter is a free variable, so we can't resolve
      // it. Simply return.
      return onHoverPromise(nodeAtPos.parent);
    }

    const resolved = this.resolveSymbol(nodeAtPos);
    if (resolved == null) {
      return Promise.resolve().then(
        () => <service.HoverInfo> {
          contents: [],
        });
    }

    // Handle the special cases. If we hover over a symbol that points
    // at a function of some sort (i.e., a `function` literal, a
    // `local` that has a bind that is a function, or an object field
    // that is a function), then we want to render the name and
    // parameters that function takes, rather than the definition of
    // the function itself.
    if (ast.isFunctionParam(resolved) || resolved.parent == null) {
      return onHoverPromise(resolved);
    } else {
      switch (resolved.parent.type) {
        case "FunctionNode":
        case "LocalNode":
        case "ObjectFieldNode": {
          return onHoverPromise(resolved.parent);
        }
        default: {
          return onHoverPromise(resolved);
        }
      }
    }
  }

  public onComplete = (
    fileUri: string, cursorLoc: error.Location
  ): Promise<service.CompletionInfo[]> => {
    const doc = this.documents.get(fileUri);

    return Promise.resolve().then(
      (): service.CompletionInfo[] => {
        //
        // Generate suggestions. This process follows three steps:
        //
        // 1. Try to parse the document text.
        // 2. If we succeed, go to cursor, select that node, and if
        //    it's an identifier that can be completed, then return
        //    the environment.
        // 3. If we fail, go try to go to the "hole" where the
        //    identifier exists.
        //

        try {
          const parse = this.compilerService.cache(
            fileUri, doc.text, doc.version);
          let completions: service.CompletionInfo[] = [];
          if (compiler.isFailedParsedDocument(parse)) {
            // HACK. We should really be propagating the environment
            // down through the parser, not through the visitor
            // afterwards. If we did that, we would be able to use the
            // env of the `rest` node below.
            const lastParse = this.compilerService.getLastSuccess(fileUri);
            if (lastParse == null || compiler.isLexFailure(parse.parse) || parse.parse.parseError.rest == null) {
              return [];
            }

            const nodeAtPos = this.getNodeAtPositionFromAst(
              lastParse.parse, cursorLoc);

            // Hook up `parent` and `env` into `rest` node.
            const rest = parse.parse.parseError.rest;
            const v = new astVisitor.DeserializingVisitor();
            v.Visit(rest, nodeAtPos, <ast.Environment>nodeAtPos.env);

            const resolved = ast.resolveIndirections(
              rest, this.compilerService, this.documents);
            if (resolved == null) {
              return [];
            } else {
              return this.completableFields(resolved);
            }
          } else {
            const nodeAtPos = this.getNodeAtPositionFromAst(
              parse.parse, cursorLoc);

            return this.completionsFromIdentifier(nodeAtPos);
          }
        } catch (err) {
          console.log(err);
          return [];
        }
      });
  }

  //
  // Utilities.
  //

  private renderOnhoverMessage = (node: ast.Node): service.LanguageString[] => {
    const commentText: string | null = this.resolveComments(node);

    const doc = this.documents.get(node.loc.fileName);
    let line: string = doc.text.split(os.EOL)
      .slice(node.loc.begin.line - 1, node.loc.end.line)
      .join("\n");

    if (ast.isFunctionParam(node)) {
      // A function parameter is either a free variable, or a free
      // variable with a default value. Either way, there's not more
      // we can know statically, so emit that.
      line = node.prettyPrint();
    }

    line = node.prettyPrint();

    return <service.LanguageString[]>[
      {language: 'jsonnet', value: line},
      commentText,
    ];
  }

  private completionsFromIdentifier = (
    node: ast.Node
  ): service.CompletionInfo[] => {
    //
    // We suggest completions only for `Identifier` nodes that are in
    // specific places in the AST. In particular, we would suggest a
    // completion if the identifier is a:
    //
    // 1. Variable references, i.e., identifiers that reference
    //    specific variables, that are in scope.
    // 2. Identifiers that are part of an index expression, e.g.,
    //    `foo.bar`.
    //
    // Note that requiring `node` to be an `Identifier` does
    // disqualify autocompletions in places like comments or strings.
    //

    // Only suggest completions if the node is an identifier.
    if (!ast.isIdentifier(node)) {
      return [];
    }

    // Document root. Give suggestions from the environment if we have
    // them. In a well-formed Jsonnet AST, this should not return
    // valid responses, but return from the environment in case the
    // tree parent was garbled somehow.
    const parent = node.parent;
    if (parent == null) {
      return node.env && envToSuggestions(node.env) || [];
    }

    let resolved: ast.Node | null = null;
    if (ast.isIndex(parent)) {
      resolved = ast.resolveIndirections(
        parent.target, this.compilerService, this.documents);
    } else {
      resolved = ast.resolveIndirections(
        parent, this.compilerService, this.documents);
    }

    if (resolved != null) {
      return this.completableFields(resolved);
    }

    return node.env && envToSuggestions(node.env) || [];
  }

  private completableFields = (
    resolved: ast.Node
  ): service.CompletionInfo[] => {
    // Attempt to get all the possible fields we could suggest. If the
    // resolved item is an `ObjectNode`, just use its fields; if it's
    // a mixin of two objects, merge them and use the merged fields
    // instead.
    const fieldSet = ast.isFieldsResolvable(resolved)
      ? resolved.resolveFields(this.compilerService, this.documents)
      : immutable.Map<string, ast.ObjectField>();

    const fields = fieldSet == null
      ? immutable.List()
      : immutable.List(fieldSet.values())

    return fields
      .filter((field: ast.ObjectField) =>
        field != null && field.id != null && field.expr2 != null && field.kind !== "ObjectLocal")
      .map((field: ast.ObjectField) => {
        if (field == null || field.id == null || field.expr2 == null) {
          throw new Error(
            `INTERNAL ERROR: Filtered out null fields, but found field null`);
        }

        let kind: service.CompletionType = "Field";
        if (field.methodSugar) {
          kind = "Method";
        }

        const comments = this.getComments(field);
        return {
          label: field.id.name,
          kind: kind,
          documentation: comments || undefined,
        };
      })
      .toArray();
  }

  //
  // Symbol resolution.
  //

  public resolveSymbolAtPosition = (
    fileUri: string, pos: error.Location,
  ): ast.Node | null => {
    const nodeAtPos = this.getNodeAtPosition(fileUri, pos);
    return this.resolveSymbol(nodeAtPos);
  }

  public resolveSymbolAtPositionFromAst = (
    rootNode: ast.Node, pos: error.Location,
  ): ast.Node | null => {
    const nodeAtPos = this.getNodeAtPositionFromAst(rootNode, pos);
    return this.resolveSymbol(nodeAtPos);
  }

  // resolveComments takes a node as argument, and attempts to find the
  // comments that correspond to that node. For example, if the node
  // passed in exists inside an object field, we will explore the parent
  // nodes until we find the object field, and return the comments
  // associated with that (if any).
  public resolveComments = (node: ast.Node | null): string | null => {
    while (true) {
      if (node == null) { return null; }

      switch (node.type) {
        case "ObjectFieldNode": {
          // Only retrieve comments for.
          const field = <ast.ObjectField>node;
          if (field.kind != "ObjectFieldID" && field.kind == "ObjectFieldStr") {
            return null;
          }

          // Convert to field object, pull comments out.
          return this.getComments(field);
        }
        default: {
          node = node.parent;
          continue;
        }
      }
    }
  }

  private resolveSymbol = (node: ast.Node): ast.Node | null => {
    if (node == null ) {
      return null;
    }

    if (node.parent && ast.isObjectField(node.parent)) {
      return node.parent;
    }

    switch(node.type) {
      case "IdentifierNode": {
        return (<ast.Identifier>node).resolve(
          this.compilerService, this.documents);
      }
      case "LocalNode": {
        return node;
      }
      default: {
        return null;
      }
    }
  }

  //
  // Utilities.
  //

  private getComments = (field: ast.ObjectField): string | null => {
    // Convert to field object, pull comments out.
    const comments = field.headingComments;
    if (comments == null || comments.count() == 0) {
      return null;
    }

    return comments
      .reduce((acc: string[], curr) => {
        if (curr == undefined) {
          throw new Error(`INTERNAL ERROR: element was undefined during a reduce call`);
        }
        acc.push(curr.text);
        return acc;
      }, [])
      .join("\n");
  }

  public getNodeAtPosition = (
    fileUri: string, pos: error.Location,
  ): ast.Node => {
    const {text: docText, version: version} = this.documents.get(fileUri);
    const cached = this.compilerService.cache(fileUri, docText, version);
    if (compiler.isFailedParsedDocument(cached)) {
      // TODO: Handle this error without an exception.
      const err = compiler.isLexFailure(cached.parse)
        ? cached.parse.lexError.Error()
        : cached.parse.parseError.Error()
      throw new Error(
        `INTERNAL ERROR: Could not cache analysis of file ${fileUri}:\b${err}`);
    }

    return this.getNodeAtPositionFromAst(cached.parse, pos);
  }

  public getNodeAtPositionFromAst = (
    rootNode: ast.Node, pos: error.Location
  ): ast.Node => {
    const visitor = new astVisitor.CursorVisitor(pos);
    visitor.Visit(rootNode, null, ast.emptyEnvironment);
    return visitor.NodeAtPosition;
  }
}

//
// Utilities.
//

const envToSuggestions = (env: ast.Environment): service.CompletionInfo[] => {
    return env.map((value, key) => {
      if (value == null) {
        throw new Error(`INTERNAL ERROR: Value in environment is null`);
      }
      return <service.CompletionInfo>{
        label: key,
        kind: "Variable",
        // TODO: Fill in documentaiton later.
      };
    })
    .toArray();
}
