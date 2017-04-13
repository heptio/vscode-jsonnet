'use strict';
import { execSync } from 'child_process';
import * as url from 'url';
import * as server from 'vscode-languageserver';

import * as ast from './schema';
import * as astVisitor from './visitor';

const command = `/Users/alex/src/go/src/github.com/google/go-jsonnet/main`;
const base = `/Users/alex/src/vscode-jsonnet/testData`;

export function getProperties(filePath): {[key: string]: ast.ObjectField} {
    return parseJsonnetFile(filePath)
        .fields
        .reduce((acc, field) => {
            acc[field.id] = field;
            return acc;
        }, {});
}

export function getNodeAtPosition(
    doc: server.TextDocument, pos: server.Position,
): ast.Node {
    const filePath = url.parse(doc.uri).path;
    const rootNode = parseJsonnetFile(filePath);
    return new astVisitor.CursorVisitor(doc, pos).Visit(rootNode);
    // return parseJsonnetFile(filePath);
}

function parseJsonnetFile(filePath: string): ast.ObjectNode {
    const result = execSync(`${command} ast ${filePath}`);

    return <ast.ObjectNode>JSON.parse(result.toString());
}
