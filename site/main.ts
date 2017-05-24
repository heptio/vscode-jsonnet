import * as url from 'url';

import * as im from 'immutable';

import * as analyze from '../server/ast/analyzer';
import * as ast from '../server/parser/node';
import * as astVisitor from '../server/ast/visitor';
import * as compiler from "../server/ast/compiler";
import * as service from '../server/ast/service';
import * as error from '../server/lexer/static_error';
import * as lexer from '../server/lexer/lexer';
import * as parser from '../server/parser/parser';
import * as workspace from "../server/ast/workspace";

import * as data from "./data";

declare var global: any;

const backsplicePrefix = `file:///`;
const windowDocUri = `${backsplicePrefix}window`;


export class BrowserDocumentManager implements workspace.DocumentManager {
  get = (fileUri: string): {text: string, version?: number} => {
    if (fileUri === `${backsplicePrefix}apps.v1beta1.libsonnet`) {
      return {
        text: data.appsV1Beta1File,
        version: undefined,
      };
    } else if (fileUri === `${backsplicePrefix}core.v1.libsonnet`) {
      return {
        text: data.coreV1File,
        version: undefined,
      };
    } else if (fileUri === `${backsplicePrefix}extensions.v1beta1.libsonnet`) {
      return {
        text: data.extensionsV1Beta1File,
        version: undefined,
      };
    } else if (fileUri === `${backsplicePrefix}k.libsonnet`) {
      return {
        text: data.kBeta1File,
        version: undefined,
      };
    } else if (fileUri === `${backsplicePrefix}util.libsonnet`) {
      return {
        text: data.utilFile,
        version: undefined,
      };
    } else if (fileUri === windowDocUri) {
      return {
        text: this.windowText,
        version: this.version,
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

export class BrowserCompilerService implements compiler.CompilerService {
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

  private docCache = im.Map<string, compiler.ParsedDocument>();
}

const docs = new BrowserDocumentManager();
const cs = new BrowserCompilerService();
const analyzer = new analyze.Analyzer(docs, cs);

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
): Promise<service.CompletionInfo[]> => {
  return analyzer
    .onComplete(
      windowDocUri, new error.Location(position.row + 1, position.column));
}
