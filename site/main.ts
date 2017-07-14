import * as url from 'url';

import * as im from 'immutable';

import * as ast from '../compiler/lexical-analysis/ast';
import * as editor from '../compiler/editor';
import * as lexer from '../compiler/lexical-analysis/lexer';
import * as lexical from '../compiler/lexical-analysis/lexical';
import * as parser from '../compiler/lexical-analysis/parser';
import * as _static from '../compiler/static';

import * as data from "./data";

declare var global: any;

const backsplicePrefix = `file:///`;
const windowDocUri = `${backsplicePrefix}window`;


export class BrowserDocumentManager implements editor.DocumentManager {
  get = (
    fileUri: string,
  ): {text: string, version?: number, resolvedPath: string} => {
    if (fileUri === `${backsplicePrefix}apps.v1beta1.libsonnet`) {
      return {
        text: data.appsV1Beta1File,
        version: 0,
        resolvedPath: fileUri,
      };
    } else if (fileUri === `${backsplicePrefix}core.v1.libsonnet`) {
      return {
        text: data.coreV1File,
        version: 0,
        resolvedPath: fileUri,
      };
    } else if (fileUri === `${backsplicePrefix}extensions.v1beta1.libsonnet`) {
      return {
        text: data.extensionsV1Beta1File,
        version: 0,
        resolvedPath: fileUri,
      };
    } else if (fileUri === `${backsplicePrefix}k.libsonnet`) {
      return {
        text: data.kBeta1File,
        version: 0,
        resolvedPath: fileUri,
      };
    } else if (fileUri === `${backsplicePrefix}util.libsonnet`) {
      return {
        text: data.utilFile,
        version: 0,
        resolvedPath: fileUri,
      };
    } else if (fileUri === windowDocUri) {
      return {
        text: this.windowText,
        version: this.version,
        resolvedPath: fileUri,
      };
    }

    throw new Error(`Unrecognized file ${fileUri}`);
  }

  public setWindowText = (text: string, version?: number) => {
    this.windowText = text;
    this.version = version;
  }

  private windowText: string = "";
  private version?: number = undefined;
}

export class BrowserCompilerService implements _static.LexicalAnalyzerService {
  //
  // CompilerService implementation.
  //

  public cache = (
    fileUri: string, text: string, version?: number
  ): _static.ParsedDocument | _static.FailedParsedDocument => {
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
    if (lexical.isStaticError(lex)) {
      // TODO: emptyTokens is not right. Fill it in.
      const fail = new _static.LexFailure(lexer.emptyTokens, lex);
      return new _static.FailedParsedDocument(text, fail, version);
    }

    const parse = parser.Parse(lex);
    if (lexical.isStaticError(parse)) {
      const fail = new _static.ParseFailure(lex, parse);
      return new _static.FailedParsedDocument(text, fail, version);
    }

    const parsedDoc = new _static.ParsedDocument(text, lex, parse, version);
    this.docCache = this.docCache.set(fileUri, parsedDoc);
    return parsedDoc;
  }

  public getLastSuccess = (
    fileUri: string
  ): _static.ParsedDocument | null => {
    return this.docCache.has(fileUri) && this.docCache.get(fileUri) || null;
  }

  public delete = (fileUri: string): void => {
    this.docCache = this.docCache.delete(fileUri);
  }

  //
  // Private members.
  //

  private docCache = im.Map<string, _static.ParsedDocument>();
}

const docs = new BrowserDocumentManager();
const cs = new BrowserCompilerService();
const analyzer = new _static.Analyzer(docs, cs);

interface AcePosition {
  row: number,
  column: number,
};

global.docOnChange = (text: string, version?: number) => {
  docs.setWindowText(text, version);
  cs.cache(windowDocUri, text, version);
}

global.onComplete = (
  text: string, position: AcePosition
): Promise<editor.CompletionInfo[]> => {
  return analyzer
    .onComplete(
      windowDocUri, new lexical.Location(position.row + 1, position.column));
}
