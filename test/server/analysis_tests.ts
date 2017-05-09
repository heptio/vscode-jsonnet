'use strict';
import { expect, assert } from 'chai';
import * as fs from 'fs';
import * as mocha from 'mocha';
import * as os from 'os';
import * as url from 'url';

import * as analyze from '../../server/ast/analyzer';
import * as ast from '../../server/parser/node';
import * as compiler from "../../server/ast/compiler";
import * as error from '../../server/lexer/static_error';
import * as lexer from '../../server/lexer/lexer';
import * as local from '../../server/local';
import * as workspace from '../../server/ast/workspace';

const dataDir = `${__dirname}/../../../test/data`;
const jsonnetServer =
  "/Users/alex/src/go/src/github.com/google/go-jsonnet/jsonnet";

const makeLocation = (line: number, column: number): error.Location => {
  return new error.Location(line, column);
}

class FsDocumentManager implements workspace.DocumentManager {
  public get = (fileUri: string) => {
      const parsed = url.parse(fileUri);
      if (parsed && parsed.path) {
        // TODO: Perhaps make this a promise?
        return {text: fs.readFileSync(parsed.path).toString(), version: -1};
      }

      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
  }

  public pathToUri = (uri: string): string => {
    return uri;
  }
}

const assertLocationRange = (
  lr: error.LocationRange, startLine: number, startCol: number,
  endLine: number, endCol: number
): void => {
  assert.equal(lr.begin.line, startLine);
  assert.equal(lr.begin.column, startCol);
  assert.equal(lr.end.line, endLine);
  assert.equal(lr.end.column, endCol);
}

describe("Searching an AST by position", () => {
  const compilerService = new local.VsCompilerService();
  const documents = new FsDocumentManager()
  const analyzer = new analyze.Analyzer(documents, compilerService);
  compilerService.command = jsonnetServer;

  const file = `${dataDir}/simple-nodes.jsonnet`;
  const doc = documents.get(file);
  const compiled = compilerService.cache(file, doc.text, doc.version);
  if (compiler.isFailedParsedDocument(compiled)) {
    throw new Error(`Failed to parse document '${file}'`);
  }

  const rootNode = compiled.parse;

  it("Object field assigned value of `local` symbol", () => {
    // Property.
    {
      const property1Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(2, 5));
      assert.isNotNull(property1Id);
      assert.equal(property1Id.type, "IdentifierNode");
      assert.equal(property1Id.name, "property1");
      assert.isNotNull(property1Id.parent);
      assertLocationRange(property1Id.loc, 2, 3, 2, 12);

      const property1Parent = <ast.ObjectField>property1Id.parent;
      assert.equal(property1Parent.type, "ObjectFieldNode");
      assert.equal(property1Parent.kind, "ObjectFieldID");
      assertLocationRange(property1Parent.loc, 2, 3, 2, 17);
    }

    // Target.
    {
      const target1Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(2, 14));
      assert.isNotNull(target1Id);
      assert.equal(target1Id.type, "IdentifierNode");
      assert.equal(target1Id.name, "foo");
      assert.isNotNull(target1Id.parent);
      assertLocationRange(target1Id.loc, 2, 14, 2, 17);

      const target1Parent = <ast.Var>target1Id.parent;
      assert.equal(target1Parent.type, "VarNode");
      assert.isNotNull(target1Parent.parent);
      assertLocationRange(target1Parent.loc, 2, 14, 2, 17);

      const target1Grandparent = <ast.ObjectField>target1Parent.parent;
      assert.equal(target1Grandparent.type, "ObjectFieldNode");
      assert.equal(target1Grandparent.kind, "ObjectFieldID");
      assertLocationRange(target1Grandparent.loc, 2, 3, 2, 17);
    }
  });

  it("Object field assigned literal number", () => {
    // Target.

    const target2Id = <ast.LiteralNumber>analyzer.getNodeAtPositionFromAst(
      rootNode, makeLocation(3, 15));
    assert.isNotNull(target2Id);
    assert.equal(target2Id.type, "LiteralNumberNode");
    assert.equal(target2Id.originalString, "2");
    assert.isNotNull(target2Id.parent);
    assertLocationRange(target2Id.loc, 3, 14, 3, 15);

    const target2Parent = <ast.ObjectField>target2Id.parent;
    assert.equal(target2Parent.type, "ObjectFieldNode");
    assert.equal(target2Parent.kind, "ObjectFieldID");
    assertLocationRange(target2Parent.loc, 3, 3, 3, 15);
  });

  it("`local` object field assigned value", () => {
    // Property.
    {
      const property3Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(4, 9));
      assert.isNotNull(property3Id);
      assert.equal(property3Id.type, "IdentifierNode");
      assert.equal(property3Id.name, "foo");
      assert.isNotNull(property3Id.parent);
      assertLocationRange(property3Id.loc, 4, 9, 4, 12);

      const property3Parent = <ast.ObjectField>property3Id.parent;
      assert.equal(property3Parent.type, "ObjectFieldNode");
      assert.equal(property3Parent.kind, "ObjectLocal");
      assertLocationRange(property3Parent.loc, 4, 3, 4, 16);
    }

    // Target.
    {
      const target3Id = <ast.LiteralNumber>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(4, 15));
      assert.isNotNull(target3Id);
      assert.equal(target3Id.type, "LiteralNumberNode");
      assert.equal(target3Id.originalString, "3");
      assert.isNotNull(target3Id.parent);
      assertLocationRange(target3Id.loc, 4, 15, 4, 16);

      const target3Parent = <ast.ObjectField>target3Id.parent;
      assert.equal(target3Parent.type, "ObjectFieldNode");
      assert.equal(target3Parent.kind, "ObjectLocal");
      assertLocationRange(target3Parent.loc, 4, 3, 4, 16);
    }
  });

  it("Resolution of `local` object fields is order-independent", () => {
    // This location points at the `baz` symbol in the expression
    // `bar.baz`, where `bar` is a `local` field that's declared below
    // the current field. This tests that we correctly resolve that
    // reference, even though it occurs after the current object
    // field.
    const property4Id = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
      rootNode, makeLocation(5, 20));
    assert.isNotNull(property4Id);
    assert.equal(property4Id.type, "IdentifierNode");
    assert.equal(property4Id.name, "baz");

    const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(property4Id);
    assert.isNotNull(resolved);
    assert.equal(resolved.type, "LiteralNumberNode");
    assert.equal(resolved.originalString, "3");
  });

  it("Can resolve identifiers that refer to mixins", () => {
    // merged1.b
    {
      const merged1 = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(11, 23));
      assert.isNotNull(merged1);
      assert.equal(merged1.type, "IdentifierNode");
      assert.equal(merged1.name, "b");

      const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(merged1);
      assert.isNotNull(resolved);
      assert.equal(resolved.type, "LiteralNumberNode");
      assert.equal(resolved.originalString, "3");
    }

    // merged2.a
    {
      const merged2 = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(11, 34));
      assert.isNotNull(merged2);
      assert.equal(merged2.type, "IdentifierNode");
      assert.equal(merged2.name, "a");

      const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(merged2);
      assert.isNotNull(resolved);
      assert.equal(resolved.type, "LiteralNumberNode");
      assert.equal(resolved.originalString, "99");
    }

    // merged3.a
    {
      const merged3 = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(11, 45));
      assert.isNotNull(merged3);
      assert.equal(merged3.type, "IdentifierNode");
      assert.equal(merged3.name, "a");

      const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(merged3);
      assert.isNotNull(resolved);
      assert.equal(resolved.type, "LiteralNumberNode");
      assert.equal(resolved.originalString, "1");
    }

    // merged4.a
    {
      const merged4 = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(11, 56));
      assert.isNotNull(merged4);
      assert.equal(merged4.type, "IdentifierNode");
      assert.equal(merged4.name, "a");

      const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(merged4);
      assert.isNotNull(resolved);
      assert.equal(resolved.type, "LiteralNumberNode");
      assert.equal(resolved.originalString, "99");
    }

    // merged4.a
    {
      const merged5 = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
        rootNode, makeLocation(15, 28));
      assert.isNotNull(merged5);
      assert.equal(merged5.type, "IdentifierNode");
      assert.equal(merged5.name, "a");

      const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(merged5);
      assert.isNotNull(resolved);
      assert.equal(resolved.type, "LiteralNumberNode");
      assert.equal(resolved.originalString, "99");
    }
  });

  it("Can resolve identifiers that point to identifiers", () => {
    // Regression test. Tests that we can resolve a variable that
    // points to another variable. In this case, `numberVal2` refers
    // to `numberVal1`.

    const node = <ast.Identifier>analyzer.getNodeAtPositionFromAst(
      rootNode, makeLocation(18, 19));
    assert.isNotNull(node);
    assert.equal(node.type, "IdentifierNode");
    assert.equal(node.name, "numberVal2");

    const resolved = <ast.LiteralNumber>analyzer.resolveIdentifier(node);
    assert.isNotNull(resolved);
    assert.equal(resolved.type, "LiteralNumberNode");
    assert.equal(resolved.originalString, "1");
  });
});

describe("Imported symbol resolution", () => {
  const compilerService = new local.VsCompilerService();
  const documents = new FsDocumentManager();
  const analyzer = new analyze.Analyzer(documents, compilerService);
  compilerService.command = jsonnetServer;

  const file = `${dataDir}/simple-import.jsonnet`;
  const document = documents.get(file);
  const compile = compilerService.cache(file, document.text, document.version);

  if (compiler.isFailedParsedDocument(compile)) {
    throw new Error(`Failed to parse document '${file}'`);
  }

  const rootNode = compile.parse;

  it("Can dereference the object that is imported", () => {
    const importedSymbol =
      <ast.Local>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(4, 8));
    assert.isNotNull(importedSymbol);
    assert.equal(importedSymbol.type, "LocalNode");
    assert.isNull(importedSymbol.parent);
    assertLocationRange(importedSymbol.loc, 1, 1, 12, 2);
  });

  it("Can dereference fields from an imported module", () => {
    // This location points at the `foo` symbol in the expression
    // `fooModule.foo`. This tests that we correctly resolve the
    // `fooModule` symbol as an import, then load the relevant file,
    // then resolve the `foo` symbol.
    const valueofObjectField =
      <ast.LiteralNumber>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(5, 19));
    assert.isNotNull(valueofObjectField);
    assert.equal(valueofObjectField.type, "LiteralNumberNode");
    assert.equal(valueofObjectField.originalString, "99");
    assertLocationRange(valueofObjectField.loc, 4, 8, 4, 10);
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

  it("Can find comments for a nested field in an imported module", () => {
    // This location points at the `bat` symbol in the expression
    // `fooModule.baz.bat`, where `fooModule` is an imported module.
    // This tests that we can correctly obtain the documentation for
    // a symbol that lies in a multiply-nested index node.
    const valueOfObjectField =
      <ast.LiteralString>analyzer.resolveSymbolAtPositionFromAst(
        rootNode, makeLocation(7, 23));
    assert.isNotNull(valueOfObjectField);
    assert.equal(valueOfObjectField.type, "LiteralStringNode");
    assert.equal(valueOfObjectField.value, "batVal");

    const comments = analyzer.resolveComments(valueOfObjectField);
    assert.isNotNull(comments);
    assert.equal(comments, " `bat` contains a fancy value, `batVal`.");
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
