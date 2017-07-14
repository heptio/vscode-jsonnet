import { expect, assert } from 'chai';

import * as im from 'immutable';

import * as ast from '../../../compiler/lexical-analysis/ast';
import * as local from '../../../server/local';
import * as lexical from '../../../compiler/lexical-analysis/lexical';
import * as lexer from '../../../compiler/lexical-analysis/lexer';
import * as parser from '../../../compiler/lexical-analysis/parser';
import * as _static from '../../../compiler/static';
import * as testWorkspace from '../test_workspace';

class SuccessfulParseCompletionTest {
  private readonly completionSet: im.Set<string>;
  constructor(
    public readonly name: string,
    public readonly source: string,
    public readonly loc: lexical.Location,
    readonly completions: string[],
  ) {
    this.completionSet = im.Set<string>(completions);
  }

  public runTest = async () => {
    const documents =
      new testWorkspace.FsDocumentManager(new local.VsPathResolver())
    const compiler = new local.VsCompilerService();
    const analyzer = new _static.Analyzer(documents, compiler)

    const tokens = lexer.Lex("test name", this.source);
    if (lexical.isStaticError(tokens)) {
      throw new Error(`Failed to lex test source`);
    }

    const root = parser.Parse(tokens);
    if (lexical.isStaticError(root)) {
      throw new Error(`Failed to parse test source`);
    }

    const parse = new _static.ParsedDocument(
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
    new lexical.Location(1, 25),
    ["foo"]),
  new SuccessfulParseCompletionTest(
    "Simple local completion",
    `local foo = "3"; local bar = f; {}`,
    new lexical.Location(1, 31),
    ["foo", "bar"]),
  new SuccessfulParseCompletionTest(
    "Simple end-of-document completion",
    `local foo = "3"; f`,
    new lexical.Location(1, 19),
    ["foo"]),
  new SuccessfulParseCompletionTest(
    "Suggest nothing when identifier resolves",
    `local foo = "3"; local bar = 4; foo`,
    new lexical.Location(1, 36),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest both variables in environment",
    `local foo = "3"; local bar = 4; f`,
    new lexical.Location(1, 36),
    ["foo", "bar"]),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside the `local` keyword",
    `local foo = "3"; {}`,
    new lexical.Location(1, 3),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a string literal",
    `local foo = "3"; {bar: "f"}`,
    new lexical.Location(1, 26),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a number literal",
    `local foo = "3"; {bar: 32}`,
    new lexical.Location(1, 25),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest from inside a comment",
    `{} // This is a comment`,
    new lexical.Location(1, 14),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest nothing if index ID resolves to object field",
    `local foo = {bar: "bar", baz: "baz"}; foo.bar`,
    new lexical.Location(1, 46),
    []),
  new SuccessfulParseCompletionTest(
    "Suggest only name of index ID if it resolves to object field",
    `local foo = {bar: "bar", baz: "baz"}; foo.ba`,
    new lexical.Location(1, 45),
    ["bar", "baz"]),
  new SuccessfulParseCompletionTest(
    "Suggest name if ID resolves to object",
    `local foo = {bar: "bar", baz: "baz"}; foo`,
    new lexical.Location(1, 42),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest completions for members that aren't completable",
    `local foo = {bar: "bar", baz: "baz"}; foo.bar.b`,
    new lexical.Location(1, 48),
    []),
  new SuccessfulParseCompletionTest(
    "Don't suggest completions when target is index with invalid id",
    `local foo = {bar: "bar", baz: "baz"}; foo.bat.b`,
    new lexical.Location(1, 48),
    []),
  new SuccessfulParseCompletionTest(
    "Follow mixins for suggestions",
    `local foo = {bar: "bar"} + {baz: "baz"}; foo.ba`,
    new lexical.Location(1, 48),
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
const analyzer = new _static.Analyzer(documents, compiler);

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
