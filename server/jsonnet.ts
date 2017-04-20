'use strict';
import * as os from 'os';
import * as server from 'vscode-languageserver';
import * as url from 'url';

import * as immutable from 'immutable';

import * as analyze from './ast/analyzer';
import * as token from './ast/token';
import * as ast from './ast/node';

const analyzer = new analyze.Analyzer();

export const initializer = (
  documents: server.TextDocuments,
  params: server.InitializeParams,
): server.InitializeResult => {
  let workspaceRoot = params.rootPath;
  return {
    capabilities: {
      // Tell the client that the server works in FULL text
      // document sync mode
      textDocumentSync: documents.syncKind,
      // Tell the client that the server support code complete
      completionProvider: {
        resolveProvider: true
      },
      hoverProvider: true,
    }
  }
}

export const configUpdateProvider = (
  change: server.DidChangeConfigurationParams,
): void => {
  if ("server" in change.settings.jsonnet) {
    analyzer.command = change.settings.jsonnet["server"];
  }
  console.log(JSON.stringify(change.settings.jsonnet));
  console.log(analyzer.command);
}

export const completionProvider = (
  documentText: string,
  position: server.TextDocumentPositionParams,
): Promise<server.CompletionItem[]> => {
  const completion =
    (label, kind, data): server.CompletionItem => <server.CompletionItem>{
      label: label,
      kind: kind,
      data: data,
    };

  const docLocation = positionToLocation(position);
  const tokens = analyzer.lexJsonnetText(documentText, docLocation);

  // The pass parameter contains the position of the text
  // document in which code complete got requested. For the
  // example we ignore this info and always provide the same
  // completion items.
  return new Promise<immutable.List<token.Token>>(
    (resolve, reject) => {
      try {
        const tokens = analyzer.lexJsonnetText(documentText, docLocation);
        resolve(findCompletionTokens(tokens, docLocation));
      } catch (err) {
        reject(err);
      }
    })
    .then(tokens => {
      const elements = tokens
        .map(token => {
          const serializedTok = JSON.stringify(token);
          return serializedTok
        })
        .join("," + os.EOL + "  ");
      const serialized = `[\n  ${elements}\n]`;

      return new Promise<ast.Node>(
        (resolve, reject) => {
          try {
            resolve(analyzer.parseJsonnetText(serialized, true));
          } catch (err) {
            reject(err);
          }
        });
    })
    .then((rootNode) => {
      return [
        completion('TypeScript', server.CompletionItemKind.Text, 1),
        completion('JavaScript', server.CompletionItemKind.Text, 2),
        completion('xzyzx', server.CompletionItemKind.Text, 3),
      ];
    });
};

export const hoverProvider = (
  documents: server.TextDocuments,
  posParams: server.TextDocumentPositionParams,
): Promise<server.Hover> => {
  if (analyzer.command == null) {
    return Promise.resolve().then(() => <server.Hover>{});
  }

  const doc = documents.get(posParams.textDocument.uri);
  let line = doc.getText().split(os.EOL)[posParams.position.line].trim();

  // Parse the file path out of the doc uri.
  const filePath = url.parse(doc.uri).path;
  if (filePath == null) {
    throw Error(`Failed to parse doc URI '${doc.uri}'`)
  }

  // Get symbol we're hovering over.
  const location = positionToLocation(posParams);
  const resolved = analyzer.resolveSymbolAtPosition(filePath, location);

  const commentText: string | null = analyzer.resolveComments(resolved);
  return Promise.resolve().then(
    () => <server.Hover> {
      contents: <server.MarkedString[]> [
        {language: 'jsonnet', value: line},
        commentText
      ]
    });
};

const positionToLocation = (
  posParams: server.TextDocumentPositionParams
): token.Location => {
  return {
    line: posParams.position.line + 1,
    column: posParams.position.character + 1,
  };
}

// findCompletionTokens finds all "completable" tokens starting from
// the end of the token stream.
const findCompletionTokens = (
  tokens: immutable.List<token.Token>, loc: token.Location
): immutable.List<token.Token> => {
  let stop = false;
  const completionTokens = tokens
    .reverse()
    // TODO: We might want to skip a terminal EOF here. It's not clear
    // that autocomplete will work if the last token is an EOF.
    .takeUntil(token => {
      // TODO: This should be handled by the partial-parser, not us.

      if (token == null || stop) {
        return true;
      }
      switch (token.kind) {
        case "TokenIdentifier": {
          // Two subsequent identifier tokens are always separated by
          // whitespace. We want only the last of these tokens.
          if (token.fodder && token.fodder.length > 0) {
            stop = true;
          }
          return false;
        }
        case "TokenDot": {
          return false;
        }
        default: return true;
      }
    })
    .reverse()
    .toList();

  // Append an EOF token if we don't have one, to avoid choking
  // the parser.
  const lastElement = completionTokens.last();
  if (lastElement == null || lastElement.kind != "TokenEndOfFile") {
    const eofToken: token.Token = {
      kind: "TokenEndOfFile",
      data: ".",
      fodder: null,
      loc: {
        fileName: "",
        begin: {line: -1, column: -1},
        end: {line: -1, column: -1},
      },
    };
    return completionTokens.push(eofToken);
  } else {
    return completionTokens;
  }
}
