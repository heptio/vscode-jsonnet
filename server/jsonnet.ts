'use strict';
import * as server from 'vscode-languageserver';
import * as os from 'os';

import * as ast from './ast/schema';
import * as astUtil from './ast/util';

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
    posParams: server.TextDocumentPositionParams,
): Promise<server.Hover> {
    const doc = documents.get(posParams.textDocument.uri);
    const line = doc.getText().split(os.EOL)[posParams.position.line].trim();

    // Get symbol we're hovering over.
    const nodeAtCursor = astUtil.getNodeAtPosition(doc, posParams.position);

    // TODO: Resolve symbol to some import or member.
    const id = "foo";

    // TODO: If import, look up filename
    const library = `/Users/alex/src/vscode-jsonnet/testData/test.libsonnet`;

    // TODO: Get documentation for library.
    const importedMembers = astUtil.getProperties(library);
    let commentText: string;
    if (id in importedMembers) {
        const field = importedMembers[id];
        if (field.headingComments != null) {
            commentText = field.headingComments
                .reduce((acc, curr) => {
                    acc.push(curr.text);
                    return acc;
                }, [])
                .join("\n");
        }
    }

    return Promise.resolve().then(
        () => <server.Hover> {
            contents: <server.MarkedString[]> [
                {language: 'jsonnet', value: line},
                // commentText
                // JSON.stringify(nodeAtCursor)
                // JSON.stringify(posParams.position)
                `${JSON.stringify(posParams.position)}\n\n${JSON.stringify((<ast.NodeBase>nodeAtCursor))}`
            ]
        });
};
