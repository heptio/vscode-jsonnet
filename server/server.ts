'use strict';
import * as server from 'vscode-languageserver';

import * as jsonnet from './jsonnet';

// Create a connection for the server. The connection uses Node's IPC
// as a transport
const connection: server.IConnection = server.createConnection(
    new server.IPCMessageReader(process),
    new server.IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new server.TextDocuments();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

connection.onInitialize((params) => jsonnet.initializer(documents, params));
connection.onDidChangeConfiguration(jsonnet.configUpdateProvider);
connection.onCompletion(jsonnet.completionProvider);
connection.onHover((position) => jsonnet.hoverProvider(documents, position));

// Listen on the connection
connection.listen();
