'use strict';
import { expect, assert } from 'chai';

import * as ast from '../../../server/parser/node';
import * as astVisitor from '../../../server/ast/visitor';
import * as analyze from '../../../server/ast/analyzer';
import * as local from '../../../server/local';
import * as error from '../../../server/lexer/static_error';
import * as lexer from '../../../server/lexer/lexer';
import * as parser from '../../../server/parser/parser';
import * as testWorkspace from '../test_workspace';

class LocatedSpec {
  constructor(
    public locatedCheck: ast.NodeKind | null = null,
  ) {}
}

class AnalyzableFailedLocatedSpec extends LocatedSpec {
  constructor(
    public locatedCheck: ast.NodeKind | null = null,
  ) {
    super(locatedCheck);
  }
}

class UnanalyzableFailedLocatedSpec extends LocatedSpec {
  constructor() {
    super();
  }
}

const isFailedLocatedSpec = (
  spec
): spec is AnalyzableFailedLocatedSpec | UnanalyzableFailedLocatedSpec => {
  return spec instanceof AnalyzableFailedLocatedSpec ||
    spec instanceof UnanalyzableFailedLocatedSpec;
}

const isAnalyzableFailedLocatedSpec = (
  spec
): spec is AnalyzableFailedLocatedSpec => {
  return spec instanceof AnalyzableFailedLocatedSpec;
}

const isUnAnalyzableFailedLocatedSpec = (
  spec
): spec is UnanalyzableFailedLocatedSpec => {
  return spec instanceof UnanalyzableFailedLocatedSpec;
}

class ResolvedSpec<TResolved extends ast.Node | ast.IndexedObjectFields> extends LocatedSpec {
  constructor(
    public locatedCheck: ast.NodeKind | null = null,
    public resolvedTypeCheck: ast.NodeKind | null = null,
    public assertions: (node: TResolved) => void = (node) => {}
  ) {
    super(locatedCheck);
  }
}

const isResolvedSpec = <T1>(spec): spec is ResolvedSpec<T1> => {
  return spec instanceof ResolvedSpec;
}

class FailedResolvedSpec<TResolveFailure extends ast.ResolveFailure> extends LocatedSpec {
  constructor(
    public assertions: (node: TResolveFailure) => void = (node) => {}
  ) {
    super();
  }
}

const isFailedResolvedSpec = <T1>(spec): spec is FailedResolvedSpec<T1> => {
  return spec instanceof FailedResolvedSpec;
}

class RangeSpec<TLocated extends ast.Node, TResolved extends ast.Node> {
  constructor(
    public name: string,
    public line: number,
    public beginCol: number,
    public endCol: number,
    public spec: LocatedSpec | ResolvedSpec<TResolved>,
  ) {
    if (beginCol > endCol) {
      throw new Error(`Invalid range spec: begin column '${beginCol}' can't be less than end column '${endCol}'`);
    }
  }

  public verifyRangeSpec = (root: ast.Node): void => {
    for (let col = this.beginCol; col < this.endCol; col++) {
      const coords = `(line: ${this.line}, col: ${col})`;

      const spec = this.spec;
      let found = analyze.getNodeAtPositionFromAst(
        root, new error.Location(this.line, col));

      if (isAnalyzableFailedLocatedSpec(spec)) {
        if (astVisitor.isAnalyzableFindFailure(found)) {
          found = found.kind === "AfterLineEnd"
            ? <ast.Node>found.terminalNodeOnCursorLine
            : found.tightestEnclosingNode;
        } else {
          throw new Error(`Expected analyzable failure to locate node ${coords}`);
        }
      } else if (isUnAnalyzableFailedLocatedSpec(spec)) {
        if (!astVisitor.isUnanalyzableFindFailure(found)) {
          throw new Error(`Expected to unanalyzable failure to locate node ${coords}`);
        }
      }

      if (spec.locatedCheck != null) {
        if (astVisitor.isFindFailure(found)) {
          throw new Error(`Expected to find a node ${coords}`);
        }
        assert.equal(found.type, spec.locatedCheck);
      }

      if (isResolvedSpec(spec)) {
        if (astVisitor.isFindFailure(found)) {
          throw new Error(`Expected to resolve node, but could not locate ${coords}`);
        }
        if (!ast.isResolvable(found)) {
          throw new Error(`Expected to resolve node, but was not resolvable ${coords}`);
        }
        const resolved = found.resolve(ctx);
        if (ast.isResolveFailure(resolved)) {
          throw new Error(`Expected to resolve node, but failed ${coords}`);
        }

        if (spec.resolvedTypeCheck != null) {
          if (ast.isIndexedObjectFields(resolved.value)) {
            throw new Error(`Expected to resolve to node, but resolved object fields failed ${coords}`);
          }
          assert.equal(resolved.value.type, spec.resolvedTypeCheck);
        }
        spec.assertions(resolved.value)
      } else if (isFailedResolvedSpec(spec)) {
        if (astVisitor.isFindFailure(found)) {
          throw new Error(`Expected to resolve node, but could not locate ${coords}`);
        }
        if (!ast.isResolvable(found)) {
          throw new Error(`Expected to find resolvable node, whose resolution fails, but node was not resolvable ${coords}`);
        }

        const resolved = found.resolve(ctx);
        if (!ast.isResolveFailure(resolved)) {
          throw new Error(`Expected to fail to resolve node, but resolve succeeded ${coords}`);
        }
        spec.assertions(resolved);
      }
    }
  }
}

const source = `
{
  local localVal1 = 3,
  field1: localVal1,
  local localVal2(param1) = param1,
  field2:: localVal2,
  local mixin1 = {foo: "bar"} + {bar: "baz"},
  field3: mixin1,
  local mixin2 = mixin1 + {foo: "foobar"},
  field4: mixin2,
  local object1 = {baz: "bat"},
  local mixin3 = mixin2 + object1,
  field5: mixin3,
  local mixin4 = mixin3 + {foo+: "baz"},
  field6: mixin4,
}`;

const ranges = [
  new RangeSpec(
    "locate failed when cursor before any nodes",
    1, 1, 2, new UnanalyzableFailedLocatedSpec()),
  new RangeSpec(
    "locate failed when cursor before any nodes, and after range of text line",
    1, 1, 2, new UnanalyzableFailedLocatedSpec()),
  new RangeSpec(
    "located `local` node in object",
    3, 3, 9, new AnalyzableFailedLocatedSpec("ObjectFieldNode")),
  new RangeSpec(
    "resolved `localVal1` to number 3",
    4, 11, 21,
    new ResolvedSpec(
      "IdentifierNode",
      "LiteralNumberNode",
      (node: ast.LiteralNumber) => node.originalString === "3")),
  new RangeSpec(
    "failed to find `localVal1` for location after end of line",
    4, 22, 23, new AnalyzableFailedLocatedSpec("IdentifierNode")),
  new RangeSpec(
    "failed to resolve value for field2; resolve to function `localVal2`",
    6, 12, 21,
    new FailedResolvedSpec(
      (fn: ast.ResolvedFunction) => {
        ast.isObjectField(fn.functionNode) &&
        fn.functionNode.id != null &&
        fn.functionNode.id.name == "localVal2"
      })),
  new RangeSpec(
    "resolved `mixin1` to fields",
    8, 11, 17,
    new ResolvedSpec<ast.IndexedObjectFields>(
      null, null,
      (fields: ast.IndexedObjectFields) => {
        const foo = fields.get("foo");
        assert.isTrue(foo && foo.expr2 && ast.isLiteralString(foo.expr2) &&
          foo.expr2.value === "bar");
        const bar = fields.get("bar");
        assert.isTrue(bar && bar.expr2 && ast.isLiteralString(bar.expr2) &&
          bar.expr2.value === "baz");
      })),
  new RangeSpec(
    "recursively resolve `mixin2` to fields",
    10, 11, 17,
    new ResolvedSpec<ast.IndexedObjectFields>(
      null, null,
      (fields: ast.IndexedObjectFields) => {
        const foo = fields.get("foo");
        assert.isTrue(foo && foo.expr2 && ast.isLiteralString(foo.expr2) &&
          foo.expr2.value === "foobar");

        const bar = fields.get("bar");
        assert.isTrue(bar && bar.expr2 && ast.isLiteralString(bar.expr2) &&
          bar.expr2.value === "baz");
      })),
  new RangeSpec(
    "recursively resolve `mixin3` to fields",
    13, 11, 17,
    new ResolvedSpec<ast.IndexedObjectFields>(
      null, null,
      (fields: ast.IndexedObjectFields) => {
        const foo = fields.get("foo");
        assert.isTrue(foo && foo.expr2 && ast.isLiteralString(foo.expr2) &&
          foo.expr2.value === "foobar");

        const bar = fields.get("bar");
        assert.isTrue(bar && bar.expr2 && ast.isLiteralString(bar.expr2) &&
          bar.expr2.value === "baz");

        const baz = fields.get("baz");
        assert.isTrue(baz && baz.expr2 && ast.isLiteralString(baz.expr2) &&
          baz.expr2.value === "bat");
      })),

  // NOTE: This test will fail until we add support for super sugar in
  // our resolution code. See comment in `analyzer.ts`.
  // new RangeSpec(
  //   "resolve `mixin3` to fields, with super sugar",
  //   15, 11, 17,
  //   new ResolvedSpec<ast.IndexedObjectFields>(
  //     null, null,
  //     (fields: ast.IndexedObjectFields) => {
  //       const foo = fields.get("foo");
  //       assert.isTrue(foo && foo.expr2 && ast.isLiteralString(foo.expr2) &&
  //         foo.expr2.value === "foobarbaz");
  //     })),
];

//
// Setup.
//

const documents =
  new testWorkspace.FsDocumentManager(new local.VsPathResolver());
const compiler = new local.VsCompilerService();
const analyzer = new analyze.Analyzer(documents, compiler);
const ctx = new ast.ResolutionContext(compiler, documents, "");

const tokens = lexer.Lex("test string", source);
if (error.isStaticError(tokens)) {
  throw new Error(`Failed to lex test source`);
}

const root = parser.Parse(tokens);
if (error.isStaticError(root)) {
  throw new Error(`Failed to parse test source`);
}

//
// Tests
//

describe("Finding nodes by position", () => {
  ranges.forEach(range => {
    it(range.name, () => {
      range.verifyRangeSpec(root);
    });
  })
});

//
// Utilities
//

const resolveAt = (
  root: ast.Node, line: number, column: number
): ast.Node | null => {
  const loc = new error.Location(line, column);
  let node = analyze.getNodeAtPositionFromAst(root, loc);
  if (astVisitor.isAnalyzableFindFailure(node)) {
    node = node.tightestEnclosingNode;
  } else if (astVisitor.isUnanalyzableFindFailure(node)) {
    return null;
  }

  if (ast.isResolvable(node)) {
    const resolved = node.resolve(ctx);
    if (
      ast.isResolveFailure(resolved) ||
      ast.isIndexedObjectFields(resolved.value)
    ) {
      return null;
    }
    return resolved.value;
  }
  return null;
}

const assertResolvesTo = <T extends ast.Node>(
  line: number, column: number, isType: (node: ast.Node) => node is T,
  assertions: (node: T) => void
) => {
  const resolved = <ast.Node>resolveAt(root, line, column);
  assert.isNotNull(resolved);
  assert.isTrue(isType(resolved));
  assertions(<T>resolved);
}
