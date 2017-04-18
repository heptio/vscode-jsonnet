'use strict';
import { expect, assert } from 'chai';
import * as mocha from 'mocha';
import * as os from 'os';

import * as analyze from '../../server/ast/analyzer';
import * as ast from '../../server/ast/schema';

const dataDir = `${__dirname}/../../../test/data`;
const jsonnetServer = "/Users/alex/src/go/src/github.com/google/go-jsonnet/main";

const makeLocation = (line: number, column: number): ast.Location => {
  return { line: line, column: column };
}

describe("Jsonnet docs", () => {
  it("Get nodes at position", () => {
    const analyzer = new analyze.Analyzer();
    analyzer.command = jsonnetServer;

    const property1Id = <ast.Identifier>analyzer.getNodeAtPosition(
      `${dataDir}/simple-nodes.jsonnet`,
      makeLocation(2, 5));
    assert.isNotNull(property1Id);
    assert.equal(property1Id.nodeType, "IdentifierNode");
    assert.equal(property1Id.name, "property1");

    const target1Id = <ast.Identifier>analyzer.getNodeAtPosition(
      `${dataDir}/simple-nodes.jsonnet`,
      makeLocation(2, 14));
    assert.isNotNull(target1Id);
    assert.equal(target1Id.nodeType, "IdentifierNode");
    assert.equal(target1Id.name, "foo");
  });
});
