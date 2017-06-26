'use strict';
import { expect, assert } from 'chai';

import * as im from 'immutable';

import * as ast from '../../../server/parser/node';
import * as astVisitor from '../../../server/ast/visitor';
import * as analyze from '../../../server/ast/analyzer';
import * as compilerService from '../../../server/ast/compiler';
import * as local from '../../../server/local';
import * as error from '../../../server/lexer/static_error';
import * as lexer from '../../../server/lexer/lexer';
import * as parser from '../../../server/parser/parser';
import * as service from '../../../server/ast/service';
import * as testWorkspace from '../test_workspace';

class SuccessfulParseCompletionTest {
  private readonly completionSet: im.Set<string>;
  constructor(
    public readonly name: string,
    public readonly source: string,
    public readonly loc: error.Location,
    readonly completions: string[],
  ) {
    this.completionSet = im.Set<string>(completions);
  }

  public runTest = async () => {
    const documents =
      new testWorkspace.FsDocumentManager(new local.VsPathResolver())
    const compiler = new local.VsCompilerService();
    const analyzer = new analyze.Analyzer(documents, compiler)

    const tokens = lexer.Lex("test name", this.source);
    if (error.isStaticError(tokens)) {
      throw new Error(`Failed to lex test source`);
    }

    const root = parser.Parse(tokens);
    if (error.isStaticError(root)) {
      throw new Error(`Failed to parse test source`);
    }

    const parse = new compilerService.ParsedDocument(
      this.source, tokens, root, 0);

    const cis = await analyzer.completionsFromParse("", parse, this.loc, false);
    const completionSet = cis.reduce(
      (acc, ci): im.Set<string> => {
        return acc.add(ci.label);
      },
      im.Set<string>());

    assert.isTrue(completionSet.equals(this.completionSet));
  }
}

//
// Autocomplete tests for successful parses.
//

const parsedCompletionTests = [
  new SuccessfulParseCompletionTest(
    "Simple object completion",
    `local foo = "3"; {bar: f}`,
    new error.Location(1, 25),
    ["foo"]),
  new SuccessfulParseCompletionTest(
    "Simple local completion",
    `local foo = "3"; local bar = f; {}`,
    new error.Location(1, 31),
    ["foo", "bar"]),
  new SuccessfulParseCompletionTest(
    "Simple end-of-document completion",
    `local foo = "3"; f`,
    new error.Location(1, 19),
    ["foo"]),
  new SuccessfulParseCompletionTest(
    "Suggest nothing when identifier resolves",
    `local foo = "3"; local bar = 4; foo`,
    new error.Location(1, 36),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest both variables in environment",
    `local foo = "3"; local bar = 4; f`,
    new error.Location(1, 36),
    ["foo", "bar"]),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside the `local` keyword",
    `local foo = "3"; {}`,
    new error.Location(1, 3),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a string literal",
    `local foo = "3"; {bar: "f"}`,
    new error.Location(1, 26),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a number literal",
    `local foo = "3"; {bar: 32}`,
    new error.Location(1, 25),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a comment",
    `{} // This is a comment`,
    new error.Location(1, 14),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest nothing if index ID resolves to object field",
    `local foo = {bar: "bar", baz: "baz"}; foo.bar`,
    new error.Location(1, 46),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest only name of index ID if it resolves to object field",
    `local foo = {bar: "bar", baz: "baz"}; foo.ba`,
    new error.Location(1, 45),
    ["bar", "baz"]),
  new SuccessfulParseCompletionTest(
    "Suggest name if ID resolves to object",
    `local foo = {bar: "bar", baz: "baz"}; foo`,
    new error.Location(1, 42),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest completions for members that aren't completable",
    `local foo = {bar: "bar", baz: "baz"}; foo.bar.b`,
    new error.Location(1, 48),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest completions when target is index with invalid id",
    `local foo = {bar: "bar", baz: "baz"}; foo.bat.b`,
    new error.Location(1, 48),
    []),
  new SuccessfulParseCompletionTest(
    "Follow mixins for suggestions",
    `local foo = {bar: "bar"} + {baz: "baz"}; foo.ba`,
    new error.Location(1, 48),
    ["bar", "baz"]),

  // Tests that will work as `onComplete` becomes more feature-ful.
  // new CompletionTest(
  //   "Don't get hung up when references form an infinite loop",
  //   `local foo = foo; foo`,
  //   new error.Location(1, 25),
  //   []),
  // new CompletionTest(
  //   "Simple suggestion through `self`",
  //   `{bar: 42, foo: self.b}`,
  //   new error.Location(1, 22),
  //   ["bar", "foo"]),
  // new CompletionTest(
  //   "Simple suggestion through `self`",
  //   `{bar: 42} + {foo: super.b}`,
  //   new error.Location(1, 22),
  //   ["bar", "foo"]),
  // new SuccessfulParseCompletionTest(
  //   "Failed to complete from field name",
  //   `local foo = "3"; {f: 4}`,
  //   new error.Location(1, 20),
  //   []),

  // May or may not make sense.
  // new CompletionTest(
  //   "Suggest only the name in an apply",
  //   `local foo() = 3; local bar = 4; foo()`,
  //   new error.Location(1, 21),
  //   ["foo"]),
  // new SuccessfulParseCompletionTest(
  //   "Don't suggest completions from within index",
  //   `local foo = {bar: "bar", baz: "baz"}; foo.bar.b`,
  //   new error.Location(1, 45),
  //   []),
];

//
// Setup.
//

const documents =
  new testWorkspace.FsDocumentManager(new local.VsPathResolver());
const compiler = new local.VsCompilerService();
const analyzer = new analyze.Analyzer(documents, compiler);

//
// Tests
//

describe("Suggestions for successful parses", () => {
  parsedCompletionTests.forEach(range => {
    it(range.name, async () => {
      await range.runTest();
    });
  })
});
