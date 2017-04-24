'use strict';
import * as ast from './node';

// DocumentEventListener listens to events emitted by a
// `DocumentManager` in response to changes to documents that it
// manages. For example, if a document is saved, an `Save` event
// would be fired by the `DocumentManager`, and subsequently processed
// by a hook registered with the `DocumentEventListener`.
export interface DocumentEventListener {
  onDocumentOpen: (uri: string, text: string, version: number) => void
  onDocumentSave: (uri: string, text: string, version: number) => void
  onDocumentClose: (uri: string) => void
};

// DocumentManager typically provides 2 important pieces of
// functionality:
//
// 1. It is the system of record for documents managed in a
//   "workspace"; if a document exists in the workspace, it should be
//   possible to `get` it by providing a `fileUri`. For example, in
//   the context of vscode, this should wrap an instance of
//   `TextDocuments`, which manages changes for all documents in a
//   vscode workspace.
// 2. When a document that is managed by the `DocumentManager` is
//   changed, we should be firing off an event, so that the
//   `DocumentEventListener` can call the appropriate hook. This is
//   important, as it allows users to (e.g.) update parse caches,
//   which allows the client to provide efficient support for
//   features like autocomplete.
export interface DocumentManager {
  get: (fileUri: string) => {text: string, version: number}

  // TODO: Add interface hooks for things like `onDidSave`, etc.
}
