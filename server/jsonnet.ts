'use strict';
import * as os from 'os';
import * as server from 'vscode-languageserver';
import * as url from 'url';

import * as analyze from './ast/analyzer';
import * as ast from './ast/schema';

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
  position: server.TextDocumentPositionParams
): Promise<server.CompletionItem[]> => {
  const completion =
  (label, kind, data): server.CompletionItem => <server.CompletionItem>{
    label: label,
    kind: kind,
    data: data,
  };

  // The pass parameter contains the position of the text
  // document in which code complete got requested. For the
  // example we ignore this info and always provide the same
  // completion items.
  return Promise.resolve().then(
  () => [
    completion('TypeScript', server.CompletionItemKind.Text, 1),
    completion('JavaScript', server.CompletionItemKind.Text, 2),
    completion('xzyzx', server.CompletionItemKind.Text, 3),
  ])
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

  let commentText: string | null = null;
  if (resolved != null) {
    switch (resolved.nodeType) {
      case "ObjectFieldNode": {
        const field = (<ast.ObjectField>resolved);
        if (field.id != null && field.expr2 != null) {
          line = `${field.id.name}:\n\n${ast.renderAsJson(field.expr2)}`;
        }
        if (field.headingComments != null) {
          commentText = field.headingComments
          .reduce((acc: string[], curr) => {
            acc.push(curr.text);
            return acc;
          }, [])
          .join("\n");
        }
        break;
      }
      default: {
        // throw new Error(`Resolved symbol must be of type object field to get docs, but was:\n${ast.renderAsJson(resolved)}`);
      }
    }
  }

  return Promise.resolve().then(
  () => <server.Hover> {
    contents: <server.MarkedString[]> [
      {language: 'jsonnet', value: line},
      commentText
      // `${JSON.stringify(posParams.position)}\n\n${json}`
    ]
  });
};

const positionToLocation = (
  posParams: server.TextDocumentPositionParams
): ast.Location => {
  return {
    line: posParams.position.line + 1,
    column: posParams.position.character + 1,
  };
}
