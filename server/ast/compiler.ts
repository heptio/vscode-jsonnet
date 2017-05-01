'use strict';
import * as fs from 'fs';
import * as proc from 'child_process';

import * as immutable from 'immutable';

import * as ast from '../parser/node';
import * as astVisitor from './visitor';
import * as error from '../lexer/static_error';
import * as parser from '../parser/parser';
import * as lexer from '../lexer/lexer';

export interface PartialParsedDocument {
  text: string
  lex: immutable.List<lexer.Token>
  version?: number
}

export interface FullParsedDocument {
  text: string
  lex: immutable.List<lexer.Token>
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
    fileUri: string, text: string, cursor: error.Location, version?: number
  ) => PartialParsedDocument | null
  getLastSuccess: (fileUri: string) => FullParsedDocument | null
  delete: (fileUri: string) => void
}

// util contains a collection of static utility functions for lexing
// and parsing Jsonnet code.
export namespace util {
  export const lexJsonnetFile = (
    filePath: string, range?: error.Location
  ): immutable.List<lexer.Token> => {
    const text = fs.readFileSync(filePath).toString();
    return lexJsonnetText(filePath, text, range);
  }

  export const lexJsonnetText = (
    fileId: string, documentText: string,
    range?: error.Location
  ): immutable.List<lexer.Token> => {
    const lex = lexer.Lex(fileId, documentText);
    if (error.isStaticError(lex)) {
      throw new Error(lex.Error());
    }
    return lex;
  }

  export const parseJsonnetFile = (filePath: string): ast.Node => {
    const text = fs.readFileSync(filePath).toString();
    return parseJsonnetText(filePath, text);
  }

  export const parseJsonnetText = (
    fileId: string, documentText: string
  ): ast.Node => {
    const lex = lexJsonnetText(fileId, documentText);
    const parse = parser.Parse(lex);
    if (error.isStaticError(parse)) {
      throw new Error(parse.Error());
    }
    const rootNode = <ast.Node>parse;
    new astVisitor.DeserializingVisitor()
      .Visit(rootNode, null, ast.emptyEnvironment);

    return rootNode;
  }
}
