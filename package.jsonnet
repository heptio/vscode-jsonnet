{
  "name": "jsonnet",
  "displayName": "Jsonnet",
  "description": "Language support for Jsonnet",
  "version": "0.0.5",
  "publisher": "heptio",
  "license": "SEE LICENSE IN 'LICENSE' file",
  "engines": {
    "vscode": "^1.10.0"
  },
  "categories": [
    "Languages"
  ],
  "activationEvents": [
    "onCommand:jsonnet.previewToSide",
    "onCommand:jsonnet.preview"
  ],
  "main": "./out/src/extension",
  "homepage": "https://github.com/heptio/vscode-jsonnet/blob/master/README.md",
  "repository": {
    "type": "git",
    "url": "https://github.com/heptio/vscode-jsonnet.git"
  },
  "contributes": {
    "configuration": {
        "type": "object",
        "title": "Jsonnet configuration",
        "properties": {
            "jsonnet.executablePath": {
                "type": "string",
                "default": null,
                "description": "Location of the `jsonnet` executable."
            }
        }
    },
    "languages": [{
      "id": "jsonnet",
      "aliases": ["Jsonnet", "jsonnet"],
      "extensions": [".jsonnet",".libsonnet"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "jsonnet",
      "scopeName": "source.jsonnet",
      "path": "./syntaxes/jsonnet.tmLanguage.json"
    }],
    "commands": [
      {
        "command": "jsonnet.previewToSide",
        "title": "Jsonnet: Open Preview to the Side"
      },
      {
        "command": "jsonnet.preview",
        "title": "Jsonnet: Open Preview"
      }],
    "keybindings": [
      {
        "command": "jsonnet.previewToSide",
        "key": "shift+ctrl+i",
        "mac": "shift+cmd+i",
        "when": "editorFocus"
      }]
  },
  "scripts": {
    "vscode:prepublish": "tsc -p ./",
    "compile": "tsc -watch -p ./",
    "postinstall": "node ./node_modules/vscode/bin/install",
    "test": "node ./node_modules/vscode/bin/test"
  },
  "devDependencies": {
    "typescript": "^2.0.3",
    "vscode": "^1.0.0",
    "mocha": "^2.3.3",
    "@types/node": "^6.0.40",
    "@types/mocha": "^2.2.32"
  }
}