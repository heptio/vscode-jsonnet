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
  ): compiler.FullParsedDocument | null => {
    const command = this.command;
    if (command == null) {
      return null;
    }

    const parsed = url.parse(fileUri);
    if (!parsed || !parsed.path) {
      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
    }

    const lex = lexer.Lex(parsed.path, text);
    if (error.isStaticError(lex)) {
      return null;
    }

    const parse = parser.Parse(lex);
    if (error.isStaticError(parse)) {
      return null;
    }
    const rootNode = <ast.Node>parse;
    new astVisitor.DeserializingVisitor()
      .Visit(rootNode, null, ast.emptyEnvironment);

    const cache = <compiler.FullParsedDocument>{
      text: text,
      lex: lex,
      parse: rootNode,
      version: version,
    };

    this.docCache = this.docCache.set(fileUri, cache);

    return cache;
  }

  public parseUntil = (
    fileUri: string, text: string, cursor: error.Location, version: number
  ): compiler.PartialParsedDocument | null => {
    const command = this.command;
    if (command == null) {
      return null;
    }

    const parsed = url.parse(fileUri);
    if (!parsed || !parsed.path) {
      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
    }

    const lex = lexer.LexRange(parsed.path, text, cursor);
    if (error.isStaticError(lex)) {
      return null;
    }

    const partial = <compiler.PartialParsedDocument>{
      text: text,
      lex: lex,
      version: version,
    };

    return partial;
  }

  public getLastSuccess = (
    fileUri: string
  ): compiler.FullParsedDocument | null => {
    return this.docCache.has(fileUri) && this.docCache.get(fileUri) || null;
  }

  public delete = (fileUri: string): void => {
    this.docCache = this.docCache.delete(fileUri);
  }

  //
  // Private members.
  //

  private docCache = immutable.Map<string, compiler.FullParsedDocument>();
}
