'use strict';
import * as vs from 'vscode';
import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as yaml from "js-yaml";
import * as client from 'vscode-languageclient';

export const activate = (context: vs.ExtensionContext) => {
  // The server is implemented in node
  let languageClient = jsonnet.languageClient(
  context.asAbsolutePath(path.join('out', 'server', 'server.js')));

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(languageClient.start());

  workspace.configure(vs.workspace.getConfiguration('jsonnet'));

  // Create Jsonnet provider, register it to provide for documents
  // with `PREVIEW_SCHEME` URI scheme.
  const provider = new jsonnet.DocumentProvider();
  const registration = vs.workspace.registerTextDocumentContentProvider(
  jsonnet.PREVIEW_SCHEME, provider);

  // Subscribe to document updates. This allows us to detect (e.g.)
  // when a document was saved.
  context.subscriptions.push(registration);

  // Register commands.
  context.subscriptions.push(vs.commands.registerCommand(
  'jsonnet.previewToSide', () => display.previewJsonnet(true)));
  context.subscriptions.push(vs.commands.registerCommand(
  'jsonnet.preview', () => display.previewJsonnet(false)));

  // Register workspace events.
  context.subscriptions.push(vs.workspace.onDidSaveTextDocument(
  (document) => {
    provider.update(jsonnet.canonicalPreviewUri(document.uri))
  }));
}

export const deactivate = () => { }

namespace workspace {
  const extStrsProp = "extStrs";
  const execPathProp = "executablePath";

  export const extStrs = (): string => {
    const extStrsObj = vs.workspace.getConfiguration('jsonnet')[extStrsProp];
    return extStrsObj == null
      ? ""
      : Object.keys(extStrsObj)
          .map(key => `--ext-str ${key}="${extStrsObj[key]}"`)
          .join(" ");
  }

  export const libPaths = (): string => {
    const libPaths = vs.workspace.getConfiguration('jsonnet')["libPaths"];
    if (libPaths == null) {
       return "";
    }

    // Add executable to the beginning of the library paths, because
    // the Jsonnet CLI will look there first.
    //
    // TODO(hausdorff): Consider adding support for Jsonnet's
    // (undocumented) search paths `/usr/share/{jsonnet version}` and
    // `/usr/local/share/{jsonnet version}`. We don't support them
    // currently because (1) they're undocumented and therefore not
    // widely-used, and (2) it requires shelling out to the Jsonnet
    // command line, which complicates the extension.
    const jsonnetExecutable = vs.workspace.getConfiguration[execPathProp];
    if (jsonnetExecutable != null) {
      (<string[]>libPaths).unshift(jsonnetExecutable);
    }

    return libPaths
      .map(path => `-J ${path}`)
      .join(" ");
  }

  export const outputFormat = (): "json" | "yaml" => {
    return vs.workspace.getConfiguration('jsonnet')["outputFormat"];
  }

  export const configure = (config: vs.WorkspaceConfiguration): boolean => {
    if (os.type() === "Windows_NT") {
      return configureWindows(config);
    } else {
      return configureUnix(config);
    }
  }

  const configureUnix = (config: vs.WorkspaceConfiguration): boolean => {
    if (config[execPathProp] != null) {
      jsonnet.executable = config[execPathProp];
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

  const configureWindows = (config: vs.WorkspaceConfiguration): boolean => {
    if (config[execPathProp] == null) {
      alert.jsonnetCommandIsNull();
      return false;
    }

    jsonnet.executable = config[execPathProp];
    return true;
  }
}

namespace alert {
  const alert = vs.window.showErrorMessage;

  export const noActiveWindow = () => {
    alert("Can't open Jsonnet preview because there is no active window");
  }

  export const documentNotJsonnet = (languageId) => {
    alert(`Can't generate Jsonnet document preview for document with language id '${languageId}'`);
  }

  export const couldNotRenderJsonnet = (reason) => {
    alert(`Error: Could not render Jsonnet; ${reason}`);
  }

  export const jsonnetCommandNotOnPath = () => {
    alert(`Error: could not find 'jsonnet' command on path`);
  }

  export const jsonnetCommandIsNull = () => {
    alert(`Error: 'jsonnet.executablePath' must be set in vscode settings`);
  }
}

namespace html {
  export const body = (body: string): string => {
    return `<html><body>${body}</body></html>`
  }

  export const codeLiteral = (code: string): string => {
    return `<pre><code>${code}</code></pre>`
  }

  export const errorMessage = (message: string): string => {
    return `<i><pre>${message}</pre></i>`;
  }

  export const prettyPrintObject = (
    json: string, outputFormat: "json" | "yaml"
  ): string => {
    if (outputFormat == "yaml") {
      return codeLiteral(yaml.safeDump(JSON.parse(json)));
    } else {
      return codeLiteral(JSON.stringify(JSON.parse(json), null, 4));
    }
  }
}

namespace jsonnet {
  export let executable = "jsonnet";
  export const PREVIEW_SCHEME = "jsonnet-preview";
  export const DOCUMENT_FILTER = {
    language: 'jsonnet',
    scheme: 'file'
  };

  export const languageClient = (serverModule: string) => {
    // The debug options for the server
    let debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };

    // If the extension is launched in debug mode then the debug
    // server options are used. Otherwise the run options are used
    let serverOptions: client.ServerOptions = {
      run : {
        module: serverModule,
        transport: client.TransportKind.ipc,
      },
      debug: {
        module: serverModule,
        transport: client.TransportKind.ipc,
        options: debugOptions
      }
    }

    // Options to control the language client
    let clientOptions: client.LanguageClientOptions = {
      // Register the server for plain text documents
      documentSelector: [jsonnet.DOCUMENT_FILTER.language],
      synchronize: {
        // Synchronize the workspace/user settings sections
        // prefixed with 'jsonnet' to the server.
        configurationSection: DOCUMENT_FILTER.language,
        // Notify the server about file changes to '.clientrc
        // files contain in the workspace.
        fileEvents: vs.workspace.createFileSystemWatcher('**/.clientrc')
      }
    }

    // Create the language client and start the client.
    return new client.LanguageClient(
    "JsonnetLanguageServer",
    'Jsonnet Language Server',
    serverOptions,
    clientOptions);
  }

  export const canonicalPreviewUri = (fileUri: vs.Uri) => {
    return fileUri.with({
      scheme: jsonnet.PREVIEW_SCHEME,
      path: `${fileUri.path}.rendered`,
      query: fileUri.toString(),
    });
  }

  export class DocumentProvider implements vs.TextDocumentContentProvider {
    public provideTextDocumentContent = (uri: vs.Uri): Thenable<string> => {
      const sourceUri = vs.Uri.parse(uri.query);
      return vs.workspace.openTextDocument(sourceUri)
        .then(this.renderDocument);
    }

    //
    // Document update API.
    //

    get onDidChange(): vs.Event<vs.Uri> {
      return this._onDidChange.event;
    }

    public update = (uri: vs.Uri) => {
      this._onDidChange.fire(uri);
    }

    //
    // Private members.
    //

    private renderDocument = (document: vs.TextDocument): string => {
      try {
        const extStrs = workspace.extStrs();
        const libPaths = workspace.libPaths();
        const outputFormat = workspace.outputFormat();
        const jsonOutput = execSync(
        `${jsonnet.executable} ${libPaths} ${extStrs} ${document.fileName}`
        ).toString();
        return html.body(html.prettyPrintObject(jsonOutput, outputFormat));
      } catch (e) {
        return html.body(html.errorMessage(e.message));
      }
    }

    private _onDidChange = new vs.EventEmitter<vs.Uri>();

  }
}

namespace display {
  export const previewJsonnet = (sideBySide: boolean) => {
    const editor = vs.window.activeTextEditor;
    if (editor == null) {
      alert.noActiveWindow();
      return;
    }

    const languageId = editor.document.languageId;
    if (!(editor.document.languageId === "jsonnet")) {
      alert.documentNotJsonnet(languageId);
      return;
    }

    return vs.commands.executeCommand(
    'vscode.previewHtml',
    jsonnet.canonicalPreviewUri(editor.document.uri),
    getViewColumn(sideBySide),
    `Jsonnet preview '${path.basename(editor.document.fileName)}'`
    ).then((success) => { }, (reason) => {
      alert.couldNotRenderJsonnet(reason);
    });
  }

  export const getViewColumn = (
    sideBySide: boolean
  ): vs.ViewColumn | undefined => {
    const active = vs.window.activeTextEditor;
    if (!active) {
      return vs.ViewColumn.One;
    }

    if (!sideBySide) {
      return active.viewColumn;
    }

    switch (active.viewColumn) {
      case vs.ViewColumn.One:
      return vs.ViewColumn.Two;
      case vs.ViewColumn.Two:
      return vs.ViewColumn.Three;
    }

    return active.viewColumn;
  }
}
