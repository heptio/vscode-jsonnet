'use strict';
import * as proc from 'child_process';

import * as immutable from 'immutable';

import * as ast from './node';
import * as astVisitor from './visitor';
import * as token from './token';

export interface PartialParsedDocument {
  text: string
  lex: immutable.List<token.Token>
  version?: number
}

export interface FullParsedDocument {
  text: string
  lex: immutable.List<token.Token>
  parse: ast.Node
  version?: number
};

export interface CompilerService {
  // TODO: Make sure we're actually propagating the correct version to
  // the cache from `TextDocuments`.
  //
  // TODO: We probably want to deprecate `parseUntil` when we properly
  // implement the `Hole` node type in the AST.
  //
  // TODO: Fix `cache` to only take the fileUri.
  cache: (
    fileUri: string, text: string, version?: number
  ) => FullParsedDocument | null
  parseUntil: (
    fileUri: string, text: string, cursor: token.Location, version?: number
  ) => PartialParsedDocument | null
  getLastSuccess: (fileUri: string) => FullParsedDocument | null
  delete: (fileUri: string) => void
}

// shell contains a collection of static utility functions for
// shelling out to the language server. Currently this is necessary
// because the language server is written in Go; eventually we may be
// able to transition away and have a pure TypeScript implementation.
export namespace shell {
  export const lexJsonnetFile = (
    jsonnetCommand: string, filePath: string, range?: token.Location
  ): immutable.List<token.Token> => {
    if (jsonnetCommand == null) {
      throw new Error("Can't lex Jsonnet file if command is not specified");
    }

    const result = range
      ? proc.execSync(
        `${jsonnetCommand} lex -to ${range.line},${range.column} ${filePath}`)
      : proc.execSync(`${jsonnetCommand} lex ${filePath}`);
    return immutable.List<token.Token>(
      <token.Token[]>JSON.parse(result.toString()));
  }

  export const lexJsonnetText = (
    jsonnetCommand: string, fileId: string, documentText: string,
    range?: token.Location
  ): immutable.List<token.Token> => {
    if (jsonnetCommand == null) {
      throw new Error("Can't lex Jsonnet text if command is not specified");
    }

    // Pass document text into jsonnet language server from stdin.
    const lexInputOpts = {
      input: documentText
    };
    const result = range
      ? proc.execSync(
          `${jsonnetCommand} lex -fileId ${fileId} -to ${range.line},${range.column} -stdin`,
          lexInputOpts)
      : proc.execSync(`${jsonnetCommand} lex -stdin`, lexInputOpts);
    return immutable.List<token.Token>(
      <token.Token[]>JSON.parse(result.toString()));
  }

  export const parseJsonnetFile = (
    jsonnetCommand: string, filePath: string, tokenStream?: boolean
  ): ast.Node => {
    if (jsonnetCommand == null) {
      throw new Error("Can't parse Jsonnet file if command is not specified");
    }

    const command = tokenStream
      ? `${jsonnetCommand} parse -tokens ${filePath}`
      : `${jsonnetCommand} parse ${filePath}`;

    const result = proc.execSync(command);
    const rootNode = <ast.Node>JSON.parse(result.toString());
    new astVisitor.DeserializingVisitor()
      .Visit(rootNode, null, ast.emptyEnvironment);
    return rootNode;
  }

  export const parseJsonnetText = (
    jsonnetCommand: string, fileId: string, documentText: string,
    tokenStream?: boolean
  ): ast.Node => {
    if (jsonnetCommand == null) {
      throw new Error("Can't parse Jsonnet text if command is not specified");
    }

    const command = tokenStream
      ? `${jsonnetCommand} parse -fileId ${fileId} -tokens -stdin`
      : `${jsonnetCommand} parse -fileId ${fileId} -stdin`

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
