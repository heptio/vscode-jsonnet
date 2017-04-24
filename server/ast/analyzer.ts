'use strict';
import * as os from 'os';
import * as path from 'path';
import * as proc from 'child_process';
import * as url from 'url';

import * as immutable from 'immutable';

import * as ast from './node';
import * as astVisitor from './visitor';
import * as token from './token';
import * as workspace from './workspace';

//
// Interfaces.
//

interface CachedDocument {
  text: string | null
  parse: ast.Node | null
  version: number
};

export interface AnalysisEventListener {
  // Allows us to mock vscode events, e.g., OnHover, OnComplete, etc.

  onHover: (fileUri: string, cursorLoc: token.Location) => Promise<HoverInfo>
  onComplete: (
    fileUri: string, docText: string, cursorLoc: token.Location
  ) => Promise<CompletionInfo[]>
}

export interface CompilerService {
  // Allows us to mock or remote a compiler. Stuff like Lex, Parse,
  // etc., either locally or over the network.
}

export interface LanguageString {
  language: string
  value: string
}

export interface HoverInfo {
  contents: LanguageString | LanguageString[]
}

export type CompletionType = "Field" | "Variable";

export interface CompletionInfo {
  label: string
  kind: CompletionType
  documentation?: string
}

//
// Analyzer.
//

export interface EventedAnalyzer extends workspace.DocumentEventListener,
AnalysisEventListener { }

// TODO: Rename this to `EventedAnalyzer`.
export class Analyzer implements EventedAnalyzer {
  public command: string | null;
  private docCache = immutable.Map<string, CachedDocument>();

  constructor(private documents: workspace.DocumentManager) { }

  //
  // WorkspaceEventListener implementation.
  //

  private cacheDocument = (
    uri: string, text: string, version: number
  ): void => {
    let parse: ast.Node | null;
    try {
      parse = this.parseJsonnetText(text);
    } catch (err) {
      parse = null;
    }

    const cache = <CachedDocument>{
      text: text,
      parse: parse,
      version: version,
    };

    this.docCache = this.docCache.set(uri, cache);
  }

  public onDocumentOpen = this.cacheDocument;
  public onDocumentSave = this.cacheDocument;
  public onDocumentClose = (uri: string): void => {
    this.docCache = this.docCache.delete(uri);
  }

  //
  // AnalysisEventListener implementation.
  //

  public onHover = (
    fileUri: string, cursorLoc: token.Location
  ): Promise<HoverInfo> => {
    // TODO: Move this out to the compiler service.
    if (this.command == null) {
      return Promise.reject("Tried to process `onHover` event, but Jsonnet language server command was null");
    }

    const doc = this.documents.get(fileUri);
    let line = doc.text.split(os.EOL)[cursorLoc.line - 1].trim();

    // Parse the file path out of the doc uri.
    const filePath = url.parse(fileUri).path;
    if (filePath == null) {
      throw Error(`Failed to parse doc URI '${fileUri}'`)
    }

    // Get symbol we're hovering over.
    const resolved = this.resolveSymbolAtPosition(filePath, cursorLoc);

    const commentText: string | null = this.resolveComments(resolved);
    return Promise.resolve().then(
      () => <HoverInfo> {
        contents: <LanguageString[]> [
          {language: 'jsonnet', value: line},
          commentText
        ]
      });
  }

  public onComplete = (
    fileUri: string, docText: string, cursorLoc: token.Location
  ): Promise<CompletionInfo[]> => {
    const tokens = this.lexJsonnetText(docText, cursorLoc);

    // The pass parameter contains the position of the text
    // document in which code complete got requested. For the
    // example we ignore this info and always provide the same
    // completion items.
    return new Promise<immutable.List<token.Token>>(
      (resolve, reject) => {
        try {
          const tokens = this.lexJsonnetText(docText, cursorLoc);
          resolve(findCompletionTokens(tokens, cursorLoc));
        } catch (err) {
          reject(err);
        }
      })
      .then(tokens => {
        const parseLastDocument = new Promise<ast.Node | null>(
          (resolve, reject) => {
            const lastSavedDoc = this.docCache.has(fileUri)
              ? this.docCache.get(fileUri)
              : null
            resolve(lastSavedDoc && lastSavedDoc.parse || null);
          });

          return Promise.all([tokens, parseLastDocument]);
      })
      .then(([tokens, lastDocumentRoot]) => {
        if (lastDocumentRoot == null) { return []; }

        const nodeAtPos = this.getNodeAtPositionFromAst(
          lastDocumentRoot, cursorLoc);

        if (nodeAtPos == null || nodeAtPos.env == null) { return []; }
        return this.completeTokens(tokens, nodeAtPos.env);
      });
  }

  //
  // Utilities.
  //

  private completeTokens = (
    tokens: immutable.List<token.Token>,
    env: ast.Environment,
  ): CompletionInfo[] => {
    const completion =
      (label, kind, data): CompletionInfo => <CompletionInfo>{
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
    filePath: string, pos: token.Location,
  ): ast.Node | null => {
    const nodeAtPos = this.getNodeAtPosition(filePath, pos);
    return this.resolveSymbol(nodeAtPos);
  }

  public resolveSymbolAtPositionFromAst = (
    rootNode: ast.Node, pos: token.Location,
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

      switch (node.nodeType) {
        case "ObjectFieldNode": {
          // Only retrieve comments for.
          const field = <ast.ObjectField>node;
          if (field.kind != "ObjectFieldID" && field.kind == "ObjectFieldStr") {
            return null;
          }

          // Convert to field object, pull comments out.
          const comments = field.headingComments;
          if (comments == null || comments.length == 0) {
            return null;
          }

          return comments
            .reduce((acc: string[], curr) => {
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

    switch(node.nodeType) {
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

    switch (id.parent.nodeType) {
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
    switch (index.target.nodeType) {
      case "VarNode": {
        const nullableResolved = this.resolveVar(<ast.Var>index.target);
        if (nullableResolved == null) {
          return null;
        }

        resolvedVar = nullableResolved;
        break;
      }
      default: {
        throw new Error(`Index node can't have node target of type '${index.target.nodeType}':\n${index.target}`);
      }
    }

    switch (resolvedVar.nodeType) {
      case "ObjectNode": {
        const objectNode = <ast.ObjectNode>resolvedVar;
        for (let field of objectNode.fields) {
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
        throw new Error(`Index node currently requires resolved var to be an object type, but was'${resolvedVar.nodeType}':\n${resolvedVar}`);
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

    switch(bind.body.nodeType) {
      case "ImportNode": {
        const importNode = <ast.Import>bind.body;

        let fileToImport = importNode.file;
        if (!path.isAbsolute(fileToImport)) {
          const resolved = path.resolve(importNode.locationRange.fileName);
          const absDir = path.dirname(resolved);
          fileToImport = path.join(absDir, importNode.file);
        }

        return this.parseJsonnetFile(fileToImport);
      }
      default: {
        throw new Error(
          `Bind currently requires an import node as body ${bind}`);
      }
    }
  }

  public getNodeAtPosition = (
    filePath: string, pos: token.Location,
  ): ast.Node => {
    const rootNode = this.parseJsonnetFile(filePath);
    return this.getNodeAtPositionFromAst(rootNode, pos);
  }

  public getNodeAtPositionFromAst = (
    rootNode: ast.Node, pos: token.Location
  ): ast.Node => {
    const visitor = new astVisitor.CursorVisitor(pos);
    visitor.Visit(rootNode, null, ast.emptyEnvironment);
    return visitor.NodeAtPosition;
  }

  public lexJsonnetFile = (
    filePath: string, range?: token.Location
  ): immutable.List<token.Token> => {
    if (this.command == null) {
      throw new Error("Can't lex Jsonnet file if command is not specified");
    }

    const result = range
      ? proc.execSync(
        `${this.command} lex -to ${range.line},${range.column} ${filePath}`)
      : proc.execSync(`${this.command} lex ${filePath}`);
    return immutable.List<token.Token>(
      <token.Token[]>JSON.parse(result.toString()));
  }

  public lexJsonnetText = (
    documentText: string, range?: token.Location
  ): immutable.List<token.Token> => {
    if (this.command == null) {
      throw new Error("Can't lex Jsonnet text if command is not specified");
    }

    // Pass document text into jsonnet language server from stdin.
    const lexInputOpts = {
      input: documentText
    };
    const result = range
      ? proc.execSync(
          `${this.command} lex -to ${range.line},${range.column} -stdin`,
          lexInputOpts)
      : proc.execSync(`${this.command} lex -stdin`, lexInputOpts);
    return immutable.List<token.Token>(
      <token.Token[]>JSON.parse(result.toString()));
  }

  public parseJsonnetFile = (
    filePath: string, tokenStream?: boolean
  ): ast.Node => {
    if (this.command == null) {
      throw new Error("Can't parse Jsonnet file if command is not specified");
    }

    const command = tokenStream
      ? `${this.command} parse -tokens ${filePath}`
      : `${this.command} parse ${filePath}`;

    const result = proc.execSync(command);
    const rootNode = <ast.Node>JSON.parse(result.toString());
    new astVisitor.DeserializingVisitor()
      .Visit(rootNode, null, ast.emptyEnvironment);
    return rootNode;
  }

  public parseJsonnetText = (
    documentText: string, tokenStream?: boolean
  ): ast.Node => {
    if (this.command == null) {
      throw new Error("Can't parse Jsonnet text if command is not specified");
    }

    const command = tokenStream
      ? `${this.command} parse -tokens -stdin`
      : `${this.command} parse -stdin`

    // Pass document text into jsonnet language server from stdin.
    const result = proc.execSync(command, {
      input: documentText
    });

    const rootNode = <ast.Node>JSON.parse(result.toString());
    new astVisitor.DeserializingVisitor()
      .Visit(rootNode, null, ast.emptyEnvironment);
    return rootNode;
  }
}

//
// Utilities.
//

// findCompletionTokens finds all "completable" tokens starting from
// the end of the token stream.
const findCompletionTokens = (
  tokens: immutable.List<token.Token>, loc: token.Location
): immutable.List<token.Token> => {
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
    const eofToken: token.Token = {
      kind: "TokenEndOfFile",
      data: ".",
      fodder: null,
      loc: {
        fileName: "",
        begin: {line: -1, column: -1},
        end: {line: -1, column: -1},
      },
    };
    return completionTokens.push(eofToken);
  } else {
    return completionTokens;
  }
};

const getCompletableFields = (node: ast.Node): CompletionInfo[] => {
  if (node.nodeType != "ObjectNode") {
    return []
  }

  const objNode = <ast.ObjectNode>node;
  return objNode.fields.map(field => {
    let id: string | null = null;
    if (field.id != null) {
      id = field.id.name;
    } else {
      console.log(`Only fields with ids are currently supported for autocomplete:\n${ast.renderAsJson(field)}`);
    }
    const docs = field.headingComments == null
      ? null
      : field.headingComments.map(comment => comment.text).join("\n\n");
    return <CompletionInfo>{
      label: id,
      kind: "Field",
      documentation: docs,
    };
  });
}

const envToSuggestions = (env: ast.Environment): CompletionInfo[] => {
    return env.map((value, key) => {
      if (value == null) {
        throw new Error(`INTERNAL ERROR: Value in environment is null`);
      }
      return <CompletionInfo>{
        label: key,
        kind: "Variable",
        // TODO: Fill in documentaiton later.
      };
    })
    .toArray();
}

