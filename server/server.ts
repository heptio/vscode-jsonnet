'use strict';
import * as os from 'os';
import * as server from 'vscode-languageserver';
import * as url from 'url';

import * as immutable from 'immutable';

import * as analyze from './ast/analyzer';
import * as token from './ast/token';
import * as ast from './ast/node';

class VsDocumentManager {
  constructor(private documents: server.TextDocuments) { }
  get = (fileUri: string): {text: string, version: number} => {
    const doc = this.documents.get(fileUri);
    return {
      text: doc.getText(),
      version: doc.version,
    }
  }
}

// Create a connection for the server. The connection uses Node's IPC
// as a transport
const connection: server.IConnection = server.createConnection(
  new server.IPCMessageReader(process),
  new server.IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
const docs = new server.TextDocuments();

const analyzer = new analyze.Analyzer(new VsDocumentManager(docs));

//
// TODO: We should find a way to move these hooks to a "init doc
// manager" method, or something.
//

docs.onDidOpen(openEvent => {
  const doc = openEvent.document;
  analyzer.onDocumentOpen(doc.uri, doc.getText(), doc.version);
});
docs.onDidSave(saveEvent => {
  // TODO: relay once we can get the "last good" parse, we can check
  // the env of the position, and then evaluate that identifier, or
  // splice it into the tree. We can perhaps split changes into those
  // that are single-line, and those that are multi-line.
  const doc = saveEvent.document;
  analyzer.onDocumentOpen(doc.uri, doc.getText(), doc.version);
});
docs.onDidClose(closeEvent => {
  // TODO: This is a bit simplistic. We'll need to have a graph of
  // files, eventually, so that we can reload any previews whose
  // dependencies we save.
  analyzer.onDocumentClose(closeEvent.document.uri);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
docs.listen(connection);

connection.onInitialize((params) => initializer(docs, params));
connection.onDidChangeConfiguration(params => configUpdateProvider(params));
connection.onCompletion(position => {
  const documentText = docs.get(position.textDocument.uri).getText();
  return completionProvider(documentText, position);
});
connection.onHover(position => {
  const fileUri = position.textDocument.uri;
  return analyzer.onHover(fileUri, positionToLocation(position));
});

// Listen on the connection
connection.listen();


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
      const parseLastDocument = new Promise<ast.Node | null>(
        (resolve, reject) => {
          const lastSavedDoc =
            analyzer.getFromCache(position.textDocument.uri);
          resolve(lastSavedDoc && lastSavedDoc.parse || null);
        });

        return Promise.all([tokens, parseLastDocument]);
    })
    .then(([tokens, lastDocumentRoot]) => {
      if (lastDocumentRoot == null) { return []; }

      const nodeAtPos = analyzer.getNodeAtPositionFromAst(
        lastDocumentRoot, docLocation);

      if (nodeAtPos == null || nodeAtPos.env == null) { return []; }
      return completeTokens(tokens, nodeAtPos.env);
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

const completeTokens = (
  tokens: immutable.List<token.Token>,
  env: ast.Environment,
): server.CompletionItem[] => {
  const completion =
    (label, kind, data): server.CompletionItem => <server.CompletionItem>{
      label: label,
      kind: kind,
      data: data,
    };

  const tokenCount = tokens.count();
  if (tokenCount == 0) {
    return []
  }
  if (tokenCount == 1 || tokenCount == 2) {
    // It's a `local` value. Autocomplete suggestions.
    return envToSuggestions(env).toArray();
  } else {
    // Repeatedly consume tokens and attempt to populate autocomplete
    // suggestions.
    let tokenStream = tokens;
    let currEnv = env;
    let tokenCount = tokenStream.count();
    let lastResolved: ast.Node | null = null;

    while (true) {
      const nextToken = tokens.first();
      tokenStream = tokens.shift();
      tokenCount--;

      if (tokenCount == 1) {
        // Last token. Autocomplete suggestions.
        if (lastResolved == null) {
          throw new Error("INTERNAL ERROR: lastResolved can't be null");
        }
        return getCompletableFields(lastResolved);
      }

      if (nextToken.kind == "TokenIdentifier") {
        // Attempt to lookup identifier.
        const node = analyzer.resolveFromEnv(nextToken.data, currEnv);
        if (node == null) { return []; }
        if (node.env == null) {
          throw new Error(`INTERNAL ERROR: A node environment should never be null ${ast.renderAsJson(node)}`);
        }

        if (lastResolved != null) {
          return getCompletableFields(lastResolved);
        }
        lastResolved = node;
        continue;
      } else if (nextToken.kind == "TokenOperator") {
        // Currently only `.` operator allowed.
        if (nextToken.data !== ".") { return []; }
        continue;
      }
    }
  }
}

const getCompletableFields = (node: ast.Node): server.CompletionItem[] => {
  if (node.nodeType != "ObjectNode") {
    return []
  }

  const objNode = <ast.ObjectNode>node;
  return objNode.fields.map(field => {
    let id: string | null = null;
    if (field.id != null) {
      id = field.id.name;
    } else {
      console.log(`Only fields with ids are currently supported for autocomplete:\n${ast.renderAsJson(field)}`);
    }
    const docs = field.headingComments == null
      ? null
      : field.headingComments.map(comment => comment.text).join("\n\n");
    return <server.CompletionItem>{
      label: id,
      kind: server.CompletionItemKind.Field,
      documentation: docs,
    };
  });
}

const envToSuggestions = (env: ast.Environment) => {
    return env.map((value, key) => {
      if (value == null) {
        throw new Error(`INTERNAL ERROR: Value in environment is null`);
      }
      return <server.CompletionItem>{
        label: key,
        kind: server.CompletionItemKind.Variable,
        // TODO: Fill in documentaiton later.
      };
    });
}

