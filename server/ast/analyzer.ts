'use strict';
import * as proc from 'child_process';
import * as path from 'path';

import * as immutable from 'immutable';

import * as ast from './node';
import * as token from './token';
import * as astVisitor from './visitor';

export interface CachedDocument {
  text: string | null
  parse: ast.Node | null
  version: number
};

export interface WorkspaceEventListener {
  onDocumentOpen: (uri: string, text: string, version: number) => void
  onDocumentSave: (uri: string, text: string, version: number) => void
  onDocumentClose: (uri: string) => void
};

export interface AnalysisEventListener {
  // OnHover, OnComplete, etc.
}

export interface Compiler {
  // Lex, Parse, etc.
  Parse(fileId: string, )
}

// TODO: Rename this to `EventedAnalyzer`.
export class Analyzer implements WorkspaceEventListener {
  public command: string | null;
  private docCache = immutable.Map<string, CachedDocument>();

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
  // The rest.
  //

  public getFromCache(docUri: string): CachedDocument | null {
    return this.docCache.has(docUri)
      ? this.docCache.get(docUri)
      : null;
  }

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
