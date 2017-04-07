'use strict';
import * as vscode from 'vscode';
import { execSync } from 'child_process';
import * as os from 'os';
import * as yaml from "js-yaml";

const previewScheme = "jsonnet-preview";
let jsonnetExecutable = "jsonnet";

const JSONNET_MODE: vscode.DocumentFilter = { language: 'jsonnet', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {
    workspace.configure(vscode.workspace.getConfiguration('jsonnet'));

    // Create Jsonnet provider, register it to provide for documents
    // with `previewScheme` URI scheme.
    const provider = new jsonnet.DocumentProvider();
    const registration = vscode.workspace.registerTextDocumentContentProvider(
        previewScheme, provider);

    // Subscribe to document updates.
    context.subscriptions.push(registration);

    // Register commands.
    context.subscriptions.push(vscode.commands.registerCommand(
        'jsonnet.previewToSide', () => display.previewJsonnet(true)));
    context.subscriptions.push(vscode.commands.registerCommand(
        'jsonnet.preview', () => display.previewJsonnet(false)));

    // Register workspace events.
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(
        (document) => {
            provider.update(jsonnet.canonicalPreviewUri(document.uri))
        }));

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            JSONNET_MODE, new jsonnet.CompletionProvider(), '.', '\"'));
}

export function deactivate() {
}

namespace workspace {
    export function extStrs(): string {
        const extStrsObj =
            vscode.workspace.getConfiguration('jsonnet')["extStrs"];
        return extStrsObj == null
            ? ""
            : Object.keys(extStrsObj)
                .map(key => `--ext-str ${key}="${extStrsObj[key]}"`)
                .join(" ");
    }

    export function outputFormat(): "json" | "yaml" {
        return vscode.workspace.getConfiguration('jsonnet')["outputFormat"];
    }

    export function configure(config: vscode.WorkspaceConfiguration): boolean {
        if (os.type() === "Windows_NT") {
            return configureWindows(config);
        } else {
            return configureUnix(config);
        }
    }

    function configureUnix(config: vscode.WorkspaceConfiguration): boolean {
        if (config["executablePath"] != null) {
            jsonnetExecutable = config["executablePath"];
        } else {
            try {
                // If this doesn't throw, 'jsonnet' was found on
                // $PATH.
                //
                // TODO: Probably should find a good non-shell way of
                // doing this.
                execSync(`which jsonnet`);
            } catch (e) {
                alert.jsonnetCommandNotOnPath();
                return false;
            }
        }

        return true;
    }

    function configureWindows(config: vscode.WorkspaceConfiguration): boolean {
        if (config["executablePath"] == null) {
            alert.jsonnetCommandIsNull();
            return false;
        }

        jsonnetExecutable = config["executablePath"];
        return true;
    }
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

    export function jsonnetCommandNotOnPath() {
        alert(`Error: could not find 'jsonnet' command on path`);
    }

    export function jsonnetCommandIsNull() {
        alert(`Error: 'jsonnet.executablePath' must be set in vscode settings`);
    }
}

namespace html {
    export function body(body: string): string {
        return `<html><body>${body}</body></html>`
    }

    export function codeLiteral(code: string): string {
        return `<pre><code>${code}</code></pre>`
    }

    export function errorMessage(message: string): string {
        return `<i><pre>${message}</pre></i>`;
    }

    export function prettyPrintObject(json: string, outputFormat: "json" | "yaml"): string {
        if (outputFormat == "yaml") {
            return codeLiteral(yaml.safeDump(JSON.parse(json)));
        } else {
            return codeLiteral(JSON.stringify(JSON.parse(json), null, 4));
        }
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

    export class CompletionProvider implements vscode.CompletionItemProvider {
        public provideCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            token: vscode.CancellationToken):
            Thenable<vscode.CompletionItem[]> {
            const candidate = new vscode.CompletionItem("xzyzx");
            return Promise.all([]);
        }
    }

    export class DocumentProvider implements vscode.TextDocumentContentProvider {
        public provideTextDocumentContent =
        (uri: vscode.Uri): Thenable<string> => {
            const sourceUri = vscode.Uri.parse(uri.query);
            return vscode.workspace.openTextDocument(sourceUri)
                .then(this.renderDocument);
        }

        //
        // Document update API.
        //

        get onDidChange(): vscode.Event<vscode.Uri> {
            return this._onDidChange.event;
        }

        public update(uri: vscode.Uri) {
            this._onDidChange.fire(uri);
        }

        //
        // Private members.
        //

        private renderDocument(document: vscode.TextDocument): string {
            try {
                const extStrs = workspace.extStrs();
                const outputFormat = workspace.outputFormat();
                const jsonOutput = execSync(
                    `${jsonnetExecutable} ${extStrs} ${document.fileName}`
                ).toString();
                return html.body(html.prettyPrintObject(jsonOutput, outputFormat));
            } catch (e) {
                return html.body(html.errorMessage(e.message));
            }
        }

        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

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
        ).then((success) => { }, (reason) => {
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
