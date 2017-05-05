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
    const doc = this.documents.get(fileUri);
    let line = doc.text.split(os.EOL)[cursorLoc.line - 1].trim();

    // Get symbol we're hovering over.
    const resolved = this.resolveSymbolAtPosition(fileUri, cursorLoc);

    const commentText: string | null = this.resolveComments(resolved);
    return Promise.resolve().then(
      () => <service.HoverInfo> {
        contents: <service.LanguageString[]> [
          {language: 'jsonnet', value: line},
          commentText
        ]
      });
  }

  public onComplete = (
    fileUri: string, cursorLoc: error.Location
  ): Promise<service.CompletionInfo[]> => {
    const doc = this.documents.get(fileUri);

    return new Promise<service.CompletionInfo[]>(
      (resolve, reject) => {
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

        const parse = this.compilerService.cache(
          fileUri, doc.text, doc.version);
        if (compiler.isFailedParsedDocument(parse)) {
          // TODO: Fix me.
          const msg = `Failed to do a partial parse document at '${fileUri}'`;
          reject(msg);
          return;
        }

        const nodeAtPos = this.getNodeAtPositionFromAst(
          parse.parse, cursorLoc);

        const completions = this.completionsFromNode(nodeAtPos);
        resolve(completions);
      });
  }

  //
  // Utilities.
  //

  private completionsFromNode = (
    node: ast.Node,
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

    // Identifier is a variable.
    let index: ast.Index | null = null;
    if (ast.isVar(parent)) {
      // Identifier is a variable that is part of an index expression,
      // e.g., the `b` in `a.b`.
      if (parent.parent != null && ast.isIndex(parent.parent)) {
        index = parent.parent;
      } else {
        // Identifier is just a variable. Suggest completions from
        // environment.
        return node.env && envToSuggestions(node.env) || [];
      }
    } else if (ast.isIndex(parent)) {
      // Identifier is part of an index expression.
      index = parent;
    } else {
      // Identifier part of a completable expression.
      return [];
    }

    // Index target is a variable. e.g., this is `a` in `a.b`.
    //
    // TODO: We're not handling the case where the cursor is inside
    // the target, and not the index. We should!
    if(!ast.isVar(index.target)) {
      const target = ast.renderAsJson(index.target);
      throw new Error(`Target of index must be a var node:\n${target}`);
    }

    // Resolve the target, get public fields we could reference,
    // return as completion items.
    const resolved = this.resolveVar(index.target);
    if (resolved == null || !ast.isObjectNode(resolved)) {
      return [];
    }

    return resolved.fields
      .filter((field: ast.ObjectField) =>
        field != null && field.id != null && field.expr2 != null)
      .map((field: ast.ObjectField) => {
        if (field == null || field.id == null || field.expr2 == null) {
          throw new Error(
            `INTERNAL ERROR: Filtered out null fields, but found field null`);
        }
        const comments = this.getComments(field);
        const kind: service.CompletionType = "Field";
        return {
          label: field.id.name,
          kind: kind,
          documentation: comments || undefined,
        };
      })
      .toArray();
  }

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

  //
  // The rest.
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
    while(true) {
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

    switch(node.type) {
      case "IdentifierNode": {
        return this.resolveIdentifier(<ast.Identifier>node);
      }
      // TODO: This case should be null.
      default: { return node; }
    }
  }

  public resolveIdentifier = (id: ast.Identifier): ast.Node | null => {
    if (id.parent == null) {
      // An identifier with no parent is not a valid Jsonnet file.
      return null;
    }

    switch (id.parent.type) {
      case "VarNode": { return this.resolveVar(<ast.Var>id.parent); }
      case "IndexNode": { return this.resolveIndex(<ast.Index>id.parent); }
      default: {
        // TODO: Support other node types as we need them.
        return null;
      }
    }
  }

  public resolveIndex = (index: ast.Index): ast.Node | null => {
    if (index.target == null) {
      throw new Error(
        `INTERNAL ERROR: Index node must have a target:\n${index}`);
    } else if (index.id == null) {
      throw new Error(
        `INTERNAL ERROR: Index node must have a name:\n${index}`);
    }

    // Find root target, look up in environment.
    let resolvedTarget: ast.Node;
    switch (index.target.type) {
      case "VarNode": {
        const nullableResolved = this.resolveVar(<ast.Var>index.target);
        if (nullableResolved == null) {
          return null;
        }

        resolvedTarget = nullableResolved;
        break;
      }
      case "IndexNode": {
        const nullableResolved = this.resolveIndex(<ast.Index>index.target);
        if (nullableResolved == null) {
          return null;
        }

        resolvedTarget = nullableResolved;
        break;
      }
      default: {
        throw new Error(
          `INTERNAL ERROR: Index node can't have node target of type '${index.target.type}':\n${index.target}`);
      }
    }

    switch (resolvedTarget.type) {
      case "ObjectNode": {
        const objectNode = <ast.ObjectNode>resolvedTarget;
        for (let field of objectNode.fields.toArray()) {
          // We're looking for either a field with the id
          if (field.id != null && field.id.name == index.id.name) {
            return field.expr2;
          } else if (field.expr1 == null) {
            // Object field must be identified by an `Identifier` or a
            // string. If those aren't present, skip.
            continue;
          }

          throw new Error(
            `INTERNAL ERROR: Object field is identified by string, but we don't support that yet`);
        }

        return null;
      }
      default: {
        throw new Error(
          `INTERNAL ERROR: Index node currently requires resolved var to be an object type, but was'${resolvedTarget.type}':\n${resolvedTarget}`);
      }
    }
  }

  public resolveVar = (varNode: ast.Var): ast.Node | null => {
    // Look up in the environment, get docs for that definition.
    if (varNode.env == null) {
      throw new Error(
        `INTERNAL ERROR: AST improperly set up, property 'env' can't be null:\n${ast.renderAsJson(varNode)}`);
    } else if (!varNode.env.has(varNode.id.name)) {
      return null;
    }

    return this.resolveFromEnv(varNode.id.name, varNode.env);
  }

  public resolveFromEnv = (
    idName: string, env: ast.Environment
  ): ast.Node | null => {
    const bind = env.get(idName);
    if (bind == null) {
      return null;
    }

    if (bind.body == null) {
      throw new Error(`INTERNAL ERROR: Bind can't have null body:\n${bind}`);
    }

    switch(bind.body.type) {
      case "ImportNode": {
        const importNode = <ast.Import>bind.body;
        const fileToImport =
          filePathToUri(importNode.file, importNode.loc.fileName);
        const {text: docText, version: version} =
          this.documents.get(fileToImport);
        const cached =
          this.compilerService.cache(fileToImport, docText, version);
        if (compiler.isFailedParsedDocument(cached)) {
          return null;
        }

        return cached.parse;
      }
      default: {
        throw new Error(
          `INTERNAL ERROR: Bind currently requires an import node as body ${bind}`);
      }
    }
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

// TODO: Replace this with some sort of URL provider.
const filePathToUri = (filePath: string, currentPath: string): string => {
  let resource = filePath;
  if (!path.isAbsolute(resource)) {
    const resolved = path.resolve(currentPath);
    const absDir = path.dirname(resolved);
    resource = path.join(absDir, filePath);
  }
  return `file://${resource}`;
}
