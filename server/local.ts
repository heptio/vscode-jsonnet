'use strict';
import * as fs from 'fs';
import * as proc from 'child_process';
import * as url from 'url';

import * as immutable from 'immutable';
import * as server from 'vscode-languageserver';

import * as ast from './ast/node';
import * as astVisitor from './ast/visitor';
import * as compiler from "./ast/compiler";
import * as token from './ast/token';
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

    let lex: immutable.List<token.Token>;
    let parse: ast.Node;
    try {
      lex = compiler.shell.lexJsonnetText(command, parsed.path, text);
      parse = compiler.shell.parseJsonnetText(command, parsed.path, text);
    } catch (err) {
      return null;
    }

    const cache = <compiler.FullParsedDocument>{
      text: text,
      lex: lex,
      parse: parse,
      version: version,
    };

    this.docCache = this.docCache.set(fileUri, cache);

    return cache;
  }

  public parseUntil = (
    fileUri: string, text: string, cursor: token.Location, version: number
  ): compiler.PartialParsedDocument | null => {
    const command = this.command;
    if (command == null) {
      return null;
    }

    const parsed = url.parse(fileUri);
    if (!parsed || !parsed.path) {
      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
    }

    let lex: immutable.List<token.Token>;
    try {
      lex = compiler.shell.lexJsonnetText(command, parsed.path, text, cursor);
    } catch (err) {
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
