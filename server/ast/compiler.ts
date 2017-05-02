'use strict';
import * as fs from 'fs';
import * as proc from 'child_process';

import * as immutable from 'immutable';

import * as ast from '../parser/node';
import * as astVisitor from './visitor';
import * as error from '../lexer/static_error';
import * as parser from '../parser/parser';
import * as lexer from '../lexer/lexer';

// ParsedDocument represents a successfully-parsed document.
export class ParsedDocument {
  constructor(
    readonly text: string,
    readonly lex: lexer.Tokens,
    readonly parse: ast.Node,
    readonly version?: number,
  ) {}
}

export const isParsedDocument = (testMe: any): testMe is ParsedDocument => {
    return testMe instanceof ParsedDocument;
}

// FailedParsedDocument represents a document that failed to parse.
export class FailedParsedDocument {
  constructor(
    readonly text: string,
    readonly parse: LexFailure | ParseFailure,
    readonly version?: number,
  ) {}
}

export const isFailedParsedDocument = (
  testMe: any
): testMe is FailedParsedDocument => {
    return testMe instanceof FailedParsedDocument;
}

// LexFailure represents a failure to lex a document.
export class LexFailure {
  constructor(
    readonly lex: lexer.Tokens,
    readonly lexError: error.StaticError,
  ) {}
}

export const isLexFailure = (testMe: any): testMe is LexFailure => {
    return testMe instanceof LexFailure;
}

// ParseFailure represents a failure to parse a document.
export class ParseFailure {
  constructor(
    readonly lex: lexer.Tokens,
    // TODO: Enable this.
    // readonly parse: ast.Node,
    readonly parseError: error.StaticError,
  ) {}
}

export const isParseFailure = (testMe: any): testMe is ParseFailure => {
    return testMe instanceof ParseFailure;
}

// CompilerService represents the core service for parsing and caching
// parses of documents.
export interface CompilerService {
  // TODO: Make sure we're actually propagating the correct version to
  // the cache from `TextDocuments`.
  //
  // TODO: Fix `cache` to only take the fileUri.
  cache: (
    fileUri: string, text: string, version?: number
  ) => ParsedDocument | FailedParsedDocument
  getLastSuccess: (fileUri: string) => ParsedDocument | null
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
