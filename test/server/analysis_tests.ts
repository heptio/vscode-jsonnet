'use strict';
import { expect, assert } from 'chai';
import * as mocha from 'mocha';
import * as os from 'os';

import * as analyze from '../../server/ast/analyzer';
import * as ast from '../../server/ast/node';
import * as token from '../../server/ast/token';
import * as workspace from '../../server/ast/workspace';

const dataDir = `${__dirname}/../../../test/data`;
const jsonnetServer =
  "/Users/alex/src/go/src/github.com/google/go-jsonnet/jsonnet";

const makeLocation = (line: number, column: number): token.Location => {
  return { line: line, column: column };
}

class MockDocumentManager implements workspace.DocumentManager {
  public get = (fileUri: string) => {
    throw new Error("Invoked `get` method on `MockDocumentManager`");
  }
}

const assertLocationRange = (
  lr: token.LocationRange, startLine: number, startCol: number,
  endLine: number, endCol: number
): void => {
  assert.equal(lr.begin.line, startLine);
  assert.equal(lr.begin.column, startCol);
  assert.equal(lr.end.line, endLine);
  assert.equal(lr.end.column, endCol);
}

describe("Searching an AST by position", () => {
  const analyzer = new analyze.Analyzer(new MockDocumentManager());
  analyzer.command = jsonnetServer;

  const rootNode = analyzer.parseJsonnetFile(
    `${dataDir}/simple-nodes.jsonnet`);

  it("Object field assigned value of `local` symbol", () => {
    // Property.
    {
      const property1Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(2, 5));
      assert.equal(property1Id.nodeType, "IdentifierNode");
      assert.equal(property1Id.name, "property1");
      assert.isNotNull(property1Id.parent);
      assertLocationRange(property1Id.locationRange, 2, 3, 2, 12);

      const property1Parent = <ast.ObjectField>property1Id.parent;
      assert.equal(property1Parent.nodeType, "ObjectFieldNode");
      assert.equal(property1Parent.kind, "ObjectFieldID");
      assertLocationRange(property1Parent.locationRange, 2, 3, 2, 17);
    }

    // Target.
    {
      const target1Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(2, 14));
      assert.equal(target1Id.nodeType, "IdentifierNode");
      assert.equal(target1Id.name, "foo");
      assert.isNotNull(target1Id.parent);
      assertLocationRange(target1Id.locationRange, 2, 14, 2, 17);

      const target1Parent = <ast.Var>target1Id.parent;
      assert.equal(target1Parent.nodeType, "VarNode");
      assert.isNotNull(target1Parent.parent);
      assertLocationRange(target1Parent.locationRange, 2, 14, 2, 17);

      const target1Grandparent = <ast.ObjectField>target1Parent.parent;
      assert.equal(target1Grandparent.nodeType, "ObjectFieldNode");
      assert.equal(target1Grandparent.kind, "ObjectFieldID");
      assertLocationRange(target1Grandparent.locationRange, 2, 3, 2, 17);
    }
  });

  it("Object field assigned literal number", () => {
    // Target.

    const target2Id = <ast.LiteralNumber>analyzer.getNodeAtPositionFromAst(
      rootNode, makeLocation(3, 15));
    assert.equal(target2Id.nodeType, "LiteralNumberNode");
    assert.equal(target2Id.originalString, "2");
    assert.isNotNull(target2Id.parent);
    assertLocationRange(target2Id.locationRange, 3, 14, 3, 15);

    const target2Parent = <ast.ObjectField>target2Id.parent;
    assert.equal(target2Parent.nodeType, "ObjectFieldNode");
    assert.equal(target2Parent.kind, "ObjectFieldID");
    assertLocationRange(target2Parent.locationRange, 3, 3, 3, 15);
  });

  it("`local` object field assigned value", () => {
    // Property.
    {
      const property3Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(4, 9));
      assert.equal(property3Id.nodeType, "IdentifierNode");
      assert.equal(property3Id.name, "foo");
      assert.isNotNull(property3Id.parent);
      assertLocationRange(property3Id.locationRange, 4, 9, 4, 12);

      const property3Parent = <ast.ObjectField>property3Id.parent;
      assert.equal(property3Parent.nodeType, "ObjectFieldNode");
      assert.equal(property3Parent.kind, "ObjectLocal");
      assertLocationRange(property3Parent.locationRange, 4, 3, 4, 16);
    }

    // Target.
    {
      const target3Id = <ast.LiteralNumber>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(4, 15));
      assert.equal(target3Id.nodeType, "LiteralNumberNode");
      assert.equal(target3Id.originalString, "3");
      assert.isNotNull(target3Id.parent);
      assertLocationRange(target3Id.locationRange, 4, 15, 4, 16);

      const target3Parent = <ast.ObjectField>target3Id.parent;
      assert.equal(target3Parent.nodeType, "ObjectFieldNode");
      assert.equal(target3Parent.kind, "ObjectLocal");
      assertLocationRange(target3Parent.locationRange, 4, 3, 4, 16);
    }
  });
});

describe("Imported symbol resolution", () => {
  const analyzer = new analyze.Analyzer(new MockDocumentManager());
  analyzer.command = jsonnetServer;

  const rootNode = analyzer.parseJsonnetFile(
    `${dataDir}/simple-import.jsonnet`);

  it("Can dereference the object that is imported", () => {
    const importedSymbol =
      <ast.ObjectNode>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(4, 8));
    assert.equal(importedSymbol.nodeType, "ObjectNode");
    assert.isNull(importedSymbol.parent);
    assert.equal(importedSymbol.headingComments.length, 0);
    assertLocationRange(importedSymbol.locationRange, 1, 1, 7, 2);
  });

  it("Can dereference fields from an imported module", () => {
    // This location points at the `foo` symbol in the expression
    // `fooModule.foo`. This tests that we correctly resolve the
    // `fooModule` symbol as an import, then load the relevant file,
    // then resolve the `foo` symbol.
    const valueofObjectField =
      <ast.LiteralNumber>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(5, 19));
    assert.equal(valueofObjectField.nodeType, "LiteralNumberNode");
    assert.equal(valueofObjectField.originalString, "99");
    assertLocationRange(valueofObjectField.locationRange, 3, 8, 3, 10);
  });

  it("Can find comments for a field in an imported module", () => {
    // This location points at the `foo` symbol in the expression
    // `fooModule.foo`, where `fooModule` is an imported module. This
    // tests that we can correctly obtain the documentation for this
    // symbol.
    const valueOfObjectField =
      <ast.LiteralNumber>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(5, 19));
    assert.isNotNull(valueOfObjectField);
    const comments = analyzer.resolveComments(valueOfObjectField);
    assert.isNotNull(comments);
    assert.equal(
      comments, " `foo` is a property that has very useful data.");
  });

  it("Cannot find comments for `local` field in an imported module", () => {
    // This location points at the `bar` symbol in the expression
    // `fooModule.bar`, where `fooModule` is an imported module. This
    // tests that we do not report documentation for this symbol, as
    // it is a `local` field.
    const valueOfObjectField =
      <ast.LiteralNumber>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(6, 10));
    assert.isNotNull(valueOfObjectField);
    const comments = analyzer.resolveComments(valueOfObjectField);
    assert.isNull(comments);
  });
});
