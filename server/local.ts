'use strict';
import * as fs from 'fs';
import * as proc from 'child_process';
import * as url from 'url';

import * as immutable from 'immutable';
import * as server from 'vscode-languageserver';

import * as ast from './parser/node';
import * as astVisitor from './ast/visitor';
import * as compiler from "./ast/compiler";
import * as error from './lexer/static_error';
import * as lexer from './lexer/lexer';
import * as parser from './parser/parser';
import * as workspace from './ast/workspace';

export class VsDocumentManager implements workspace.DocumentManager {
  constructor(private documents: server.TextDocuments) { }

  get = (fileUri: string): {text: string, version: number} => {
    const doc = this.documents.get(fileUri);
    if (doc == null) {
      const parsed = url.parse(fileUri);
      if (parsed && parsed.path) {
        // TODO: Perhaps make this a promise?
        return {text: fs.readFileSync(parsed.path).toString(), version: -1};
      }

      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
    } else {
      return {
        text: doc.getText(),
        version: doc.version,
      }
    }
  }
}

export class VsCompilerService implements compiler.CompilerService {
  public command: string | null;

  //
  // CompilerService implementation.
  //

  public cache = (
    fileUri: string, text: string, version: number
  ): compiler.ParsedDocument | compiler.FailedParsedDocument => {
    //
    // There are 3 possible outcomes:
    //
    // 1. We successfully parse the document. Cache.
    // 2. We successfully lex but fail to parse. Return
    //    `PartialParsedDocument`.
    // 3. We fail to lex. Return `PartialParsedDocument`.
    //


    // TODO: Replace this with a URL provider abstraction.
    const parsedUrl = url.parse(fileUri);
    if (!parsedUrl || !parsedUrl.path) {
      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
    }

    const lex = lexer.Lex(parsedUrl.path, text);
    if (error.isStaticError(lex)) {
      // TODO: emptyTokens is not right. Fill it in.
      const fail = new compiler.LexFailure(lexer.emptyTokens, lex);
      return new compiler.FailedParsedDocument(text, fail, version);
    }

    const parse = parser.Parse(lex);
    if (error.isStaticError(parse)) {
      const fail = new compiler.ParseFailure(lex, parse);
      return new compiler.FailedParsedDocument(text, fail, version);
    }
    new astVisitor.DeserializingVisitor()
      .Visit(parse, null, ast.emptyEnvironment);

    const parsedDoc = new compiler.ParsedDocument(text, lex, parse, version);
    this.docCache = this.docCache.set(fileUri, parsedDoc);
    return parsedDoc;
  }

  public getLastSuccess = (
    fileUri: string
  ): compiler.ParsedDocument | null => {
    return this.docCache.has(fileUri) && this.docCache.get(fileUri) || null;
  }

  public delete = (fileUri: string): void => {
    this.docCache = this.docCache.delete(fileUri);
  }

  //
  // Private members.
  //

  private docCache = immutable.Map<string, compiler.ParsedDocument>();
}
