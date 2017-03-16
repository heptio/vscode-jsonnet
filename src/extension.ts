'use strict';
import * as vscode from 'vscode';
import { execSync } from 'child_process';

const previewScheme = "jsonnet-preview";

export function activate(context: vscode.ExtensionContext) {
    // Create Jsonnet provider.
    const provider = new jsonnet.DocumentProvider();
    const registration = vscode.workspace.registerTextDocumentContentProvider(
        previewScheme, provider);

    // Subscribe to document updates.
    context.subscriptions.push(registration);

    // Register commands.
    context.subscriptions.push(vscode.commands.registerCommand(
        'extension.previewJsonnetToSide', () => display.previewJsonnet(true)));
    context.subscriptions.push(vscode.commands.registerCommand(
        'extension.previewJsonnet', () => display.previewJsonnet(false)));

    // Register workspace events.
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(
        (document) => {
            provider.update(jsonnet.canonicalPreviewUri(document.uri))
        }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(
        (e) => {}));
}

export function deactivate() {
}

namespace alert {
    const alert = vscode.window.showErrorMessage;

    export function noActiveWindow() {
        alert("Can't open Jsonnet preview because there is no active window");
    }

    export function documentNotJsonnet(languageId) {
        alert(`Can't generate Jsonnet document preview for document with language id '${languageId}'`);
    }

    export function couldNotRenderJsonnet(reason) {
        alert(`Error: Could not render Jsonnet; ${reason}`);
    }
}

namespace html {
    export function body(body: string): string {
        return `<html><body>${body}</body></html>`
    }

    export function codeLiteral(code: string): string {
        return `<pre><code>${code}</code></pre>`
    }

    export function prettyPrintObject(json): string {
        const prettyJson = JSON.stringify(JSON.parse(json), null, 4);
        return codeLiteral(prettyJson);
    }
}

namespace jsonnet {
    export function canonicalPreviewUri(fileUri: vscode.Uri) {
        return fileUri.with({
            scheme: previewScheme,
            path: `${fileUri.path}.rendered`,
            query: fileUri.toString(),
        });
    }

    export class DocumentProvider implements vscode.TextDocumentContentProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

        get onDidChange(): vscode.Event<vscode.Uri> {
            return this._onDidChange.event;
        }

        public update(uri: vscode.Uri) {
            this._onDidChange.fire(uri);
        }

        public provideTextDocumentContent(uri: vscode.Uri): Thenable<string> {
            const sourceUri = vscode.Uri.parse(uri.query);
            return vscode.workspace.openTextDocument(sourceUri)
                .then(document => {
                    const jsonOutput = execSync(`jsonnet ${document.fileName}`)
                        .toString();
                    return html.body(html.prettyPrintObject(jsonOutput));
                });
        }
    }
}

namespace display {
    export function previewJsonnet(sideBySide: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (editor == null) {
            alert.noActiveWindow();
            return;
        }

        const languageId = editor.document.languageId;
        if (!(editor.document.languageId === "jsonnet")) {
            alert.documentNotJsonnet(languageId);
            return;
        }

        return vscode.commands.executeCommand(
            'vscode.previewHtml',
            jsonnet.canonicalPreviewUri(editor.document.uri),
            getViewColumn(sideBySide),
            "Jsonnet property preview"
        ).then((success) => {}, (reason) => {
            alert.couldNotRenderJsonnet(reason);
        });
    }

    function getViewColumn(sideBySide: boolean): vscode.ViewColumn | undefined {
        const active = vscode.window.activeTextEditor;
        if (!active) {
            return vscode.ViewColumn.One;
        }

        if (!sideBySide) {
            return active.viewColumn;
        }

        switch (active.viewColumn) {
            case vscode.ViewColumn.One:
                return vscode.ViewColumn.Two;
            case vscode.ViewColumn.Two:
                return vscode.ViewColumn.Three;
        }

        return active.viewColumn;
    }
}
