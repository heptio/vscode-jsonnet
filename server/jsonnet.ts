'use strict';
import * as server from 'vscode-languageserver';
import * as os from 'os';

export function initializer(
    documents: server.TextDocuments,
    params: server.InitializeParams,
): server.InitializeResult {
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

export function completionProvider(
    position: server.TextDocumentPositionParams
): Promise<server.CompletionItem[]> {
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

export function hoverProvider(
    documents: server.TextDocuments,
    position: server.TextDocumentPositionParams,
): Promise<server.Hover> {
    const doc = documents.get(position.textDocument.uri);
    const line = doc.getText().split(os.EOL)[position.position.line].trim();

    return Promise.resolve().then(
        () => <server.Hover> {
            contents: <server.MarkedString[]> [
                {language: 'jsonnet', value: line},
                `You have highlighted line \`${position.position.line}\``
            ]
        });
};
