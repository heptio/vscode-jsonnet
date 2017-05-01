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

    return new Promise<immutable.List<lexer.Token>>(
      (resolve, reject) => {
        const partialParse = this.compilerService.parseUntil(
          fileUri, doc.text, cursorLoc, doc.version);
        if (partialParse == null) {
          reject(`Failed to do a partial parse document at '${fileUri}'`);
          return;
        }
        resolve(findCompletionTokens(partialParse.lex, cursorLoc));
      })
      .then(tokens => {
        const lastSavedDoc = this.compilerService.getLastSuccess(fileUri);
        const parseLastDocument = new Promise<ast.Node | null>(
          (resolve, reject) => {
            resolve(lastSavedDoc && lastSavedDoc.parse || null);
          });

          return Promise.all([tokens, parseLastDocument]);
      })
      .then(([tokens, lastDocumentRoot]) => {
        if (lastDocumentRoot == null) { return []; }

        const nodeAtPos =
          this.getNodeAtPositionFromAst(lastDocumentRoot, cursorLoc);

        return (nodeAtPos && nodeAtPos.env &&
          this.completeTokens(tokens, nodeAtPos.env)) || [];
      });
  }

  //
  // Utilities.
  //

  private completeTokens = (
    tokens: immutable.List<lexer.Token>,
    env: ast.Environment,
  ): service.CompletionInfo[] => {
    const completion =
      (label, kind, data): service.CompletionInfo => <service.CompletionInfo>{
        label: label,
        kind: kind,
        data: data,
      };

    const tokenCount = tokens.count();
    if (tokenCount == 0) {
      return []
    }
    if (tokenCount == 1 || tokenCount == 2) {
      // It's a `local` value. Autocomplete suggestions.
      return envToSuggestions(env);
    } else {
      // Repeatedly consume tokens and attempt to populate autocomplete
      // suggestions.
      let tokenStream = tokens;
      let currEnv = env;
      let tokenCount = tokenStream.count();
      let lastResolved: ast.Node | null = null;

      while (true) {
        const nextToken = tokens.first();
        tokenStream = tokens.shift();
        tokenCount--;

        if (tokenCount == 1) {
          // Last token. Autocomplete suggestions.
          if (lastResolved == null) {
            throw new Error("INTERNAL ERROR: lastResolved can't be null");
          }
          return getCompletableFields(lastResolved);
        }

        if (nextToken.kind == "TokenIdentifier") {
          // Attempt to lookup identifier.
          const node = this.resolveFromEnv(nextToken.data, currEnv);
          if (node == null) { return []; }
          if (node.env == null) {
            throw new Error(`INTERNAL ERROR: A node environment should never be null ${ast.renderAsJson(node)}`);
          }

          if (lastResolved != null) {
            return getCompletableFields(lastResolved);
          }
          lastResolved = node;
          continue;
        } else if (nextToken.kind == "TokenOperator") {
          // Currently only `.` operator allowed.
          if (nextToken.data !== ".") { return []; }
          continue;
        }
      }
    }
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
      throw new Error(`Index node must have a target:\n${index}`);
    } else if (index.id == null) {
      throw new Error(`Index node must have a name:\n${index}`);
    }

    // Find root target, look up in environment.
    let resolvedVar: ast.Node;
    switch (index.target.type) {
      case "VarNode": {
        const nullableResolved = this.resolveVar(<ast.Var>index.target);
        if (nullableResolved == null) {
          return null;
        }

        resolvedVar = nullableResolved;
        break;
      }
      default: {
        throw new Error(`Index node can't have node target of type '${index.target.type}':\n${index.target}`);
      }
    }

    switch (resolvedVar.type) {
      case "ObjectNode": {
        const objectNode = <ast.ObjectNode>resolvedVar;
        for (let field of objectNode.fields.toArray()) {
          // We're looking for either a field with the id
          if (field.id != null && field.id.name == index.id.name) {
            return field.expr2;
          } else if (field.expr1 == null) {
            // Object field must be identified by an `Identifier` or a
            // string. If those aren't present, skip.
            continue;
          }

          throw new Error(`Object field is identified by string, but we don't support that yet`);
        }

        return null;
      }
      default: {
        throw new Error(`Index node currently requires resolved var to be an object type, but was'${resolvedVar.type}':\n${resolvedVar}`);
      }
    }
  }

  public resolveVar = (varNode: ast.Var): ast.Node | null => {
    // Look up in the environment, get docs for that definition.
    if (varNode.env == null) {
      throw new Error(`AST improperly set up, property 'env' can't be null:\n${ast.renderAsJson(varNode)}`);
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
      throw new Error(`Bind can't have null body:\n${bind}`);
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

        return cached && cached.parse;
      }
      default: {
        throw new Error(
          `Bind currently requires an import node as body ${bind}`);
      }
    }
  }

  public getNodeAtPosition = (
    fileUri: string, pos: error.Location,
  ): ast.Node => {
    const {text: docText, version: version} = this.documents.get(fileUri);
    const cached = this.compilerService.cache(fileUri, docText, version);
    if (cached == null) {
      // TODO: Handle this error without an exception.
      throw new Error(
        `INTERNAL ERROR: Could not cache analysis of file ${fileUri}`);
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

// findCompletionTokens finds all "completable" tokens starting from
// the end of the token stream.
const findCompletionTokens = (
  tokens: immutable.List<lexer.Token>, loc: error.Location
): immutable.List<lexer.Token> => {
  let stop = false;
  const completionTokens = tokens
    .reverse()
    // TODO: We might want to skip a terminal EOF here. It's not clear
    // that autocomplete will work if the last token is an EOF.
    .takeUntil(token => {
      // TODO: This should be handled by the partial-parser, not us.

      if (token == null || stop) {
        return true;
      }
      switch (token.kind) {
        case "TokenIdentifier": {
          // Two subsequent identifier tokens are always separated by
          // whitespace. We want only the last of these tokens.
          if (token.fodder && token.fodder.length > 0) {
            stop = true;
          }
          return false;
        }
        case "TokenDot": {
          return false;
        }
        default: return true;
      }
    })
    .reverse()
    .toList();

  // Append an EOF token if we don't have one, to avoid choking
  // the parser.
  const lastElement = completionTokens.last();
  if (lastElement == null || lastElement.kind != "TokenEndOfFile") {
    const eofToken: lexer.Token = new lexer.Token(
      "TokenEndOfFile",
      null,
      ".",
      "",
      "",
      new error.LocationRange(
        "",
        new error.Location(-1, -1),
        new error.Location(-1, -1)),
    );
    return completionTokens.push(eofToken);
  } else {
    return completionTokens;
  }
};

const getCompletableFields = (node: ast.Node): service.CompletionInfo[] => {
  if (node.type != "ObjectNode") {
    return []
  }

  const objNode = <ast.ObjectNode>node;
  return objNode.fields.map(field => {
    let id: string | null = null;
    if (field == undefined) {
      throw new Error(`INTERNAL ERROR: element was undefined during a map call`);
    }
    if (field.id != null) {
      id = field.id.name;
    } else {
      console.log(`Only fields with ids are currently supported for autocomplete:\n${ast.renderAsJson(field)}`);
    }
    const docs = field.headingComments == null
      ? null
      : field.headingComments.map(comment => {
          if (comment == undefined) {
            throw new Error(`INTERNAL ERROR: element was undefined during a map call`);
          }
          return comment.text;
        }).join("\n\n");
    return <service.CompletionInfo>{
      label: id,
      kind: "Field",
      documentation: docs,
    };
  }).toArray();
}

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
