'use strict';
import { expect, assert } from 'chai';

import * as im from 'immutable';

import * as error from '../../../server/lexer/static_error';
import * as lexer from '../../../server/lexer/lexer';

interface lexTest {
  name:      string
  input:     string
  tokens:    lexer.Token[]
  errString: string
};

const makeLexTest =
  (name: string, input: string, tokens: lexer.Token[], errString: string) => <lexTest>{
    name: name,
    input: input,
    tokens: tokens,
    errString: errString,
  };

const emptyTokenArray = (): lexer.Token[] => [];

const tEOF = new lexer.Token(
  "TokenEndOfFile", [], "", "", "", error.MakeLocationRangeMessage(""));

const makeToken =
  (kind: lexer.TokenKind, data: string, locRange: error.LocationRange) =>
    new lexer.Token(kind, [], data, "", "", locRange);

const makeLocRange =
  (beginLine: number, beginCol: number, endLine: number, endCol : number) =>
    <error.LocationRange>{
      begin: new error.Location(beginLine, beginCol),
      end:   new error.Location(endLine, endCol),
    }

const lexTests = <lexTest[]>[
  makeLexTest("empty", "", emptyTokenArray(), ""),
  makeLexTest("whitespace", "  \t\n\r\r\n", emptyTokenArray(), ""),

  makeLexTest("brace L", "{", [makeToken("TokenBraceL", "{", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("brace R", "}", [makeToken("TokenBraceR", "}", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("bracket L", "[", [makeToken("TokenBracketL", "[", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("bracket R", "]", [makeToken("TokenBracketR", "]", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("colon", ":", [makeToken("TokenOperator", ":", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("colon2", "::", [makeToken("TokenOperator", "::", makeLocRange(1, 1, 1, 3))], ""),
  makeLexTest("colon3", ":::", [makeToken("TokenOperator", ":::", makeLocRange(1, 1, 1, 4))], ""),
  makeLexTest("arrow right", "->", [makeToken("TokenOperator", "->", makeLocRange(1, 1, 1, 3))], ""),
  makeLexTest("less than minus", "<-", [makeToken("TokenOperator", "<", makeLocRange(1, 1, 1, 2)),
    makeToken("TokenOperator", "-", makeLocRange(1, 2, 1, 3))], ""),
  makeLexTest("comma", ",", [makeToken("TokenComma", ",", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("dollar", "$", [makeToken("TokenDollar", "$", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("dot", ".", [makeToken("TokenDot", ".", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("paren L", "(", [makeToken("TokenParenL", "(", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("paren R", ")", [makeToken("TokenParenR", ")", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("semicolon", ";", [makeToken("TokenSemicolon", ";", makeLocRange(1, 1, 1, 2))], ""),

  makeLexTest("not 1", "!", [makeToken("TokenOperator", "!", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("not 2", "! ", [makeToken("TokenOperator", "!", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("not equal", "!=", [makeToken("TokenOperator", "!=", makeLocRange(1, 1, 1, 3))], ""),
  makeLexTest("tilde", "~", [makeToken("TokenOperator", "~", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("plus", "+", [makeToken("TokenOperator", "+", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("minus", "-", [makeToken("TokenOperator", "-", makeLocRange(1, 1, 1, 2))], ""),

  makeLexTest("number 0", "0", [makeToken("TokenNumber", "0", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("number 1", "1", [makeToken("TokenNumber", "1", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("number 1.0", "1.0", [makeToken("TokenNumber", "1.0", makeLocRange(1, 1, 1, 4))], ""),
  makeLexTest("number 0.10", "0.10", [makeToken("TokenNumber", "0.10", makeLocRange(1, 1, 1, 5))], ""),
  makeLexTest("number 0e100", "0e100", [makeToken("TokenNumber", "0e100", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("number 1e100", "1e100", [makeToken("TokenNumber", "1e100", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("number 1.1e100", "1.1e100", [makeToken("TokenNumber", "1.1e100", makeLocRange(1, 1, 1, 8))], ""),
  makeLexTest("number 1.1e-100", "1.1e-100", [makeToken("TokenNumber", "1.1e-100", makeLocRange(1, 1, 1, 9))], ""),
  makeLexTest("number 1.1e+100", "1.1e+100", [makeToken("TokenNumber", "1.1e+100", makeLocRange(1, 1, 1, 9))], ""),
  makeLexTest("number 0100", "0100", [
		makeToken("TokenNumber", "0", makeLocRange(1, 1, 1, 2)),
		makeToken("TokenNumber", "100", makeLocRange(1, 2, 1, 5)),
  ], ""),
  makeLexTest("number 10+10", "10+10", [
		makeToken("TokenNumber", "10", makeLocRange(1, 1, 1, 3)),
		makeToken("TokenOperator", "+", makeLocRange(1, 3, 1, 4)),
		makeToken("TokenNumber", "10", makeLocRange(1, 4, 1, 6)),
  ], ""),
  makeLexTest("number 1.+3", "1.+3", emptyTokenArray(), "number 1.+3:1:3 Couldn't lex number, junk after decimal point: '+'"),
  makeLexTest("number 1e!", "1e!", emptyTokenArray(), "number 1e!:1:3 Couldn't lex number, junk after 'E': '!'"),
  makeLexTest("number 1e+!", "1e+!", emptyTokenArray(), "number 1e+!:1:4 Couldn't lex number, junk after exponent sign: '!'"),

  makeLexTest("double string \"hi\"", "\"hi\"", [makeToken("TokenStringDouble", "hi", makeLocRange(1, 2, 1, 4))], ""),
  makeLexTest("double string \"hi nl\"", "\"hi\n\"", [makeToken("TokenStringDouble", "hi\n", makeLocRange(1, 2, 2, 1))], ""),
  makeLexTest("double string \"hi\\\"\"", "\"hi\\\"\"", [makeToken("TokenStringDouble", "hi\\\"", makeLocRange(1, 2, 1, 6))], ""),
  makeLexTest("double string \"hi\\nl\"", "\"hi\\\n\"", [makeToken("TokenStringDouble", "hi\\\n", makeLocRange(1, 2, 2, 1))], ""),
  makeLexTest("double string \"hi", "\"hi", emptyTokenArray(), "double string \"hi:1:1 Unterminated String"),

  makeLexTest("single string 'hi'", "'hi'", [makeToken("TokenStringSingle", "hi", makeLocRange(1, 2, 1, 4))], ""),
  makeLexTest("single string 'hi nl'", "'hi\n'", [makeToken("TokenStringSingle", "hi\n", makeLocRange(1, 2, 2, 1))], ""),
  makeLexTest("single string 'hi\\''", "'hi\\''", [makeToken("TokenStringSingle", "hi\\'", makeLocRange(1, 2, 1, 6))], ""),
  makeLexTest("single string 'hi\\nl'", "'hi\\\n'", [makeToken("TokenStringSingle", "hi\\\n", makeLocRange(1, 2, 2, 1))], ""),
  makeLexTest("single string 'hi", "'hi", emptyTokenArray(), "single string 'hi:1:1 Unterminated String"),

  makeLexTest("assert", "assert", [makeToken("TokenAssert", "assert", makeLocRange(1, 1, 1, 7))], ""),
  makeLexTest("else", "else", [makeToken("TokenElse", "else", makeLocRange(1, 1, 1, 5))], ""),
  makeLexTest("error", "error", [makeToken("TokenError", "error", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("false", "false", [makeToken("TokenFalse", "false", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("for", "for", [makeToken("TokenFor", "for", makeLocRange(1, 1, 1, 4))], ""),
  makeLexTest("function", "function", [makeToken("TokenFunction", "function", makeLocRange(1, 1, 1, 9))], ""),
  makeLexTest("if", "if", [makeToken("TokenIf", "if", makeLocRange(1, 1, 1, 3))], ""),
  makeLexTest("import", "import", [makeToken("TokenImport", "import", makeLocRange(1, 1, 1, 7))], ""),
  makeLexTest("importstr", "importstr", [makeToken("TokenImportStr", "importstr", makeLocRange(1, 1, 1, 10))], ""),
  makeLexTest("in", "in", [makeToken("TokenIn", "in", makeLocRange(1, 1, 1, 3))], ""),
  makeLexTest("local", "local", [makeToken("TokenLocal", "local", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("null", "null", [makeToken("TokenNullLit", "null", makeLocRange(1, 1, 1, 5))], ""),
  makeLexTest("self", "self", [makeToken("TokenSelf", "self", makeLocRange(1, 1, 1, 5))], ""),
  makeLexTest("super", "super", [makeToken("TokenSuper", "super", makeLocRange(1, 1, 1, 6))], ""),
  makeLexTest("tailstrict", "tailstrict", [makeToken("TokenTailStrict", "tailstrict", makeLocRange(1, 1, 1, 11))], ""),
  makeLexTest("then", "then", [makeToken("TokenThen", "then", makeLocRange(1, 1, 1, 5))], ""),
  makeLexTest("true", "true", [makeToken("TokenTrue", "true", makeLocRange(1, 1, 1, 5))], ""),

  makeLexTest("identifier", "foobar123", [makeToken("TokenIdentifier", "foobar123", makeLocRange(1, 1, 1, 10))], ""),
  makeLexTest("identifier", "foo bar123", [makeToken("TokenIdentifier", "foo", makeLocRange(1, 1, 1, 4)), makeToken("TokenIdentifier", "bar123", makeLocRange(1, 5, 1, 11))], ""),

  makeLexTest("c++ comment", "// hi", [makeToken("TokenCommentCpp", " hi", makeLocRange(1, 3, 1, 6))], ""),
  makeLexTest("hash comment", "# hi", [makeToken("TokenCommentHash", " hi", makeLocRange(1, 2, 1, 5))], ""),
  makeLexTest("c comment", "/* hi */", [makeToken("TokenCommentC", " hi ", makeLocRange(1, 3, 1, 7))], ""),
  makeLexTest("c comment no term", "/* hi", emptyTokenArray(), "c comment no term:1:1 Multi-line comment has no terminating */"),

  makeLexTest(
    "block string spaces",
    "|||\
\n  test\
\n    more\
\n  |||\
\n    foo\
\n|||",
    [
      new lexer.Token(
        "TokenStringBlock",
        [],
        "test\n  more\n|||\n  foo\n",
        "  ",
        "",
        makeLocRange(1, 1, 6, 4))
    ],
    "",
  ),

  makeLexTest(
    "block string tabs",
    "|||\
\n	test\
\n	  more\
\n	|||\
\n	  foo\
\n|||",
    [
      new lexer.Token(
        "TokenStringBlock",
        [],
        "test\n  more\n|||\n  foo\n",
        "\t",
        "",
        makeLocRange(1, 1, 6, 4))
    ],
    ""
  ),

  makeLexTest(
    "block string mixed",
    "|||\
\n	  	test\
\n	  	  more\
\n	  	|||\
\n	  	  foo\
\n|||",
    [
      new lexer.Token(
        "TokenStringBlock",
        [],
        "test\n  more\n|||\n  foo\n",
        "\t  \t",
        "",
        makeLocRange(1, 1, 6, 4))
    ],
    ""
  ),

  makeLexTest(
    "block string blanks",
    "|||\
\n\
\n  test\
\n\
\n\
\n    more\
\n  |||\
\n    foo\
\n|||",
    [
      new lexer.Token(
        "TokenStringBlock",
        [],
        "\ntest\n\n\n  more\n|||\n  foo\n",
        "  ",
        "",
        makeLocRange(1, 1, 9, 4))
    ],
    ""
  ),

  makeLexTest(
    "block string bad indent",
    "|||\
\n  test\
\n foo\
\n|||",
    [],
    "block string bad indent:1:1 Text block not terminated with |||"
  ),

  makeLexTest(
    "block string eof",
    "|||\
\n  test",
    [],
    "block string eof:1:1 Unexpected EOF"
  ),

  makeLexTest(
    "block string not term",
    "|||\
\n  test\
\n",
    [],
    "block string not term:1:1 Text block not terminated with |||"
  ),

  makeLexTest(
    "block string no ws",
    "|||\
\ntest\
\n|||",
    [],
    "block string no ws:1:1 Text block's first line must start with whitespace"
  ),

  makeLexTest(
    "Invalid multiline object",
    "{\
\nbar\
\n}",
    [
      makeToken("TokenBraceL", "{", makeLocRange(1, 1, 1, 2)),
      makeToken("TokenIdentifier", "bar", makeLocRange(2, 1, 2, 4)),
      makeToken("TokenBraceR", "}", makeLocRange(3, 1, 3, 2)),
    ],
    ""
  ),

  makeLexTest("op *", "*", [makeToken("TokenOperator", "*", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op /", "/", [makeToken("TokenOperator", "/", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op %", "%", [makeToken("TokenOperator", "%", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op &", "&", [makeToken("TokenOperator", "&", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op |", "|", [makeToken("TokenOperator", "|", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op ^", "^", [makeToken("TokenOperator", "^", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op =", "=", [makeToken("TokenOperator", "=", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op <", "<", [makeToken("TokenOperator", "<", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op >", ">", [makeToken("TokenOperator", ">", makeLocRange(1, 1, 1, 2))], ""),
  makeLexTest("op >==|", ">==|", [makeToken("TokenOperator", ">==|", makeLocRange(1, 1, 1, 5))], ""),

  makeLexTest("junk", "💩", emptyTokenArray(), "junk:1:1 Could not lex the character '💩'"),
];

const locationsEqual = (t1: lexer.Token, t2: lexer.Token): boolean => {
  if (t1.loc.begin.line != t2.loc.begin.line) {
    return false
  }
  if (t1.loc.begin.column != t2.loc.begin.column) {
    return false
  }
  if (t1.loc.end.line != t2.loc.end.line) {
    return false
  }
  if (t1.loc.end.column != t2.loc.end.column) {
    return false
  }

  return true
}

const tokensStreamsEqual = (ts1: lexer.Token[], ts2: lexer.Token[]): boolean => {
  if (ts1.length != ts2.length) {
    return false
  }
  for (let i in ts1) {
    const t1 = ts1[i];
    const t2 = ts2[i];
    if (t1.kind != t2.kind) {
      return false
    }
    if (t1.data != t2.data) {
      return false
    }
    if (t1.stringBlockIndent != t2.stringBlockIndent) {
      return false
    }
    if (t1.stringBlockTermIndent != t2.stringBlockTermIndent) {
      return false
    }

    // EOF token is appended in the test loop, so we ignore its
    // location.
    if (t1.kind != "TokenEndOfFile" && !locationsEqual(t1, t2)) {
      return false
    }
  }
  return true
}

describe("Lexer tests", () => {
  for (let test of lexTests) {
    it(test.name, () => {
      // Copy the test tokens and append an EOF token
      const testTokens = im.List<lexer.Token>(test.tokens).push(tEOF);
      const tokens = lexer.Lex(test.name, test.input);
      var errString = "";
      if (error.isStaticError(tokens)) {
        errString = tokens.Error();
      }
      assert.equal(errString, test.errString);

      if (!error.isStaticError(tokens)) {
        const tokenStreamText = tokens
          .map(token => {
            if (token === undefined) {
              throw new Error(`Tried to pretty-print token stream, but there was an undefined token`);
            }
            return token.toString();
          })
          .join(", ");

        const testTokensText = testTokens
          .map(token => {
            if (token === undefined) {
              throw new Error(`Tried to pretty-print token stream, but there was an undefined token`);
            }
            return token.toString();
          })
          .join(", ");
        assert.isTrue(
          tokensStreamsEqual(tokens.toArray(), testTokens.toArray()),
          `got\n\t${tokenStreamText}\nexpected\n\t${testTokensText}`);
      }
    });
  }
});

describe("UTF-8 lexer tests", () => {
  it("Correctly advances when given a UTF-8 string", () => {
    const l = new lexer.lexer("tests", "日本語");

    let r = l.next();
    assert.equal(r.data, "日");
    assert.equal(r.data.length, 1);
    assert.equal(r.codePoint, 26085);

    r = l.next();
    assert.equal(r.data, "本");
    assert.equal(r.data.length, 1);
    assert.equal(r.codePoint, 26412);

    r = l.next();
    assert.equal(r.data, "語");
    assert.equal(r.data.length, 1);
    assert.equal(r.codePoint, 35486);
  });

  it("Correctly advances when given multi-byte UTF-8 characters", () => {
    const l = new lexer.lexer("tests", "𝟘𝟙");

    let r = l.next();
    assert.equal(r.data, "𝟘");
    assert.equal(r.data.length, 2);
    assert.equal(r.codePoint, 120792);

    r = l.next();
    assert.equal(r.data, "𝟙");
    assert.equal(r.data.length, 2);
    assert.equal(r.codePoint, 120793);
  });

  it("Runes correctly parse multi-byte UTF-8 characters", () => {
    const unicodeRune0 = lexer.runeFromString("𝟘𝟙", 0);
    assert.equal(unicodeRune0.data, "𝟘");

    const unicodeRune1 = lexer.runeFromString("𝟘𝟙", 1);
    assert.equal(unicodeRune1.data, "𝟙");
  });
});

describe("Lexer helper tests", () => {
  const toRunes = (str: string): lexer.rune[] => {
    const codePoints = lexer.makeCodePoints(str);
    return codePoints
      .map((char, i) => {
        if (i === undefined) {
          throw new Error("Index can't be undefined in a `map`");
        }
        return lexer.runeFromCodePoints(codePoints, i)
      })
      .toArray();
  }

  const upperAlpha = toRunes("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const lowerAlpha = toRunes("abcdefghijklmnopqrstuvwxyz");
  const digits = toRunes("0123456789");

  it("`isUpper` correctly reports if character is in [A-Z]", () => {
    for (let char of upperAlpha) {
      assert.isTrue(lexer.isUpper(char));
    }

    for (let char of lowerAlpha) {
      assert.isFalse(lexer.isUpper(char));
    }

    // The character right before range `[A-Z]` in ASCII table.
    assert.isFalse(lexer.isUpper(lexer.runeFromString("@", 0)));

    // The character right after range `[A-Z]` in ASCII table.
    assert.isFalse(lexer.isUpper(lexer.runeFromString("[", 0)));
  });

  it("`isLower` correctly reports if character is in [a-z]", () => {
    for (let char of lowerAlpha) {
      assert.isTrue(lexer.isLower(char));
    }

    for (let char of upperAlpha) {
      assert.isFalse(lexer.isLower(char));
    }

    // The character right before range `[a-z]` in ASCII table.
    assert.isFalse(lexer.isLower(lexer.runeFromString("`", 0)));

    // The character right after range `[a-z]` in ASCII table.
    assert.isFalse(lexer.isLower(lexer.runeFromString("{", 0)));
  });

  it("`isNumber` correctly reports if character is in [0-9]", () => {
    for (let char of digits) {
      assert.isTrue(lexer.isNumber(char));
    }

    for (let char of upperAlpha) {
      assert.isFalse(lexer.isNumber(char));
    }

    // The character right before range `[0-9]` in ASCII table.
    assert.isFalse(lexer.isNumber(lexer.runeFromString("/", 0)));

    // The character right after range `[0-9]` in ASCII table.
    assert.isFalse(lexer.isNumber(lexer.runeFromString(":", 0)));
  });
});

describe("Jsonnet error location parsing", () => {
  const testSuccessfulParse = (loc: string): error.LocationRange => {
    const lr = error.LocationRange.fromString("", loc);
    assert.isNotNull(lr);
    return <error.LocationRange>lr;
  }

  const testFailedParse = (loc: string): void => {
    const lr = error.LocationRange.fromString("", loc);
    assert.isNull(lr);
  }

  it("Correctly parse simple range", () => {
    const lr = testSuccessfulParse("(8:15)-(10:1)");
    assert.isNotNull(lr);
    assert.equal(lr.begin.line, 8);
    assert.equal(lr.begin.column, 15);
    assert.equal(lr.end.line, 10);
    assert.equal(lr.end.column, 1);
  });

  it("Correctly parse simple single-line range", () => {
    const lr = testSuccessfulParse("9:10-19");
    assert.isNotNull(lr);
    assert.equal(lr.begin.line, 9);
    assert.equal(lr.begin.column, 10);
    assert.equal(lr.end.line, 9);
    assert.equal(lr.end.column, 19);
  });

  it("Correctly parse simple single-character range", () => {
    const lr = testSuccessfulParse("100:2");
    assert.isNotNull(lr);
    assert.equal(lr.begin.line, 100);
    assert.equal(lr.begin.column, 2);
    assert.equal(lr.end.line, 100);
    assert.equal(lr.end.column, 2);
  });

  it("Correctly parse simple single-character range with parens", () => {
    const lr = testSuccessfulParse("(112:21)");
    assert.isNotNull(lr);
    assert.equal(lr.begin.line, 112);
    assert.equal(lr.begin.column, 21);
    assert.equal(lr.end.line, 112);
    assert.equal(lr.end.column, 21);
  });
});
