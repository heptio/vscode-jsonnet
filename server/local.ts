'use strict';
import * as fs from 'fs';
import * as path from 'path';
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
  constructor(
    private readonly documents: server.TextDocuments,
    private readonly libResolver: workspace.LibPathResolver,
  ) { }

  get = (
    fileSpec: workspace.FileUri | ast.Import | ast.ImportStr,
  ): {text: string, version?: number, resolvedPath: string} => {
    const parsedFileUri = this.libResolver.resolvePath(fileSpec);
    if (parsedFileUri == null) {
      throw new Error(`Could not open file`);
    }

    const fileUri = parsedFileUri.href;
    const filePath = parsedFileUri.path;
    if (fileUri == null || filePath == null) {
      throw new Error(`INTERNAL ERROR: ill-formed, null href or path`);
    }

    const doc = this.documents.get(fileUri);
    if (doc == null) {
      const doc = this.fsCache.get(fileUri);
      if (doc != null) {
        // TODO(hausdorff): Decide where to use fscache. This code
        // assumes users are using vscode to change all Jsonnet
        // library code, but it may be better to only assume this is
        // true of the current workspace (and perhaps places like
        // `/usr`).
        return {
          text: doc.text,
          version: doc.version,
          resolvedPath: fileUri,
        };
      }

      const text = fs.readFileSync(filePath).toString();
      const stat = fs.statSync(filePath);
      const cached = {
        text: text,
        version: stat.atime.valueOf(),
        resolvedPath: fileUri
      };
      this.fsCache = this.fsCache.set(fileUri, cached);
      return cached;
    } else {
      // Delete from `fsCache` just in case we were `import`'ing a
      // file and have since opened it.
      this.fsCache = this.fsCache.delete(fileUri);
      return {
        text: doc.getText(),
        version: doc.version,
        resolvedPath: fileUri,
      }
    }
  }

  private fsCache = immutable.Map<string, {text: string, version: number}>();
}

export class VsCompilerService implements compiler.CompilerService {
  //
  // CompilerService implementation.
  //

  public cache = (
    fileUri: string, text: string, version?: number
  ): compiler.ParsedDocument | compiler.FailedParsedDocument => {
    //
    // There are 3 possible outcomes:
    //
    // 1. We successfully parse the document. Cache.
    // 2. We successfully lex but fail to parse. Return
    //    `PartialParsedDocument`.
    // 3. We fail to lex. Return `PartialParsedDocument`.
    //

    // Attempt to retrieve cached parse if document versions are the
    // same. If version is undefined, it comes from a source that
    // doesn't track document version, and we always re-parse.
    const tryGet = this.docCache.get(fileUri);
    if (tryGet !== undefined && tryGet.version !== undefined &&
      tryGet.version === version
    ) {
      return tryGet;
    }

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

export class VsPathResolver extends workspace.LibPathResolver {
  protected pathExists = (path: string): boolean => {
    try {
      return fs.existsSync(path);
    } catch (err) {
      return false;
    }
  }
}
