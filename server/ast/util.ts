'use strict';
import { execSync } from 'child_process';
import * as url from 'url';
import * as server from 'vscode-languageserver';

import * as ast from './schema';
import * as astVisitor from './visitor';

export function getProperties(
    command: string, filePath: string
): {[key: string]: ast.ObjectField} {
    return parseJsonnetFile(command, filePath)
        .fields
        .reduce((acc, field) => {
            acc[field.id] = field;
            return acc;
        }, {});
}

export function getNodeAtPosition(
    command: string, doc: server.TextDocument, pos: server.Position,
): ast.Node {
    const filePath = url.parse(doc.uri).path;
    const rootNode = parseJsonnetFile(command, filePath);
    return new astVisitor.CursorVisitor(doc, pos).Visit(rootNode);
    // return parseJsonnetFile(filePath);
}

function parseJsonnetFile(command: string, filePath: string): ast.ObjectNode {
    const result = execSync(`${command} ast ${filePath}`);

    return <ast.ObjectNode>JSON.parse(result.toString());
}
