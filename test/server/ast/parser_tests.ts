'use strict';
import { expect, assert } from 'chai';

import * as lexer from '../../../server/lexer/lexer';
import * as error from '../../../server/lexer/static_error';
import * as parser from '../../../server/parser/parser';

const tests = [
  `true`,
  `1`,
  `1.2e3`,
  `!true`,
  `null`,

  `$.foo.bar`,
  `self.foo.bar`,
  `super.foo.bar`,
  `super[1]`,
  `error "Error!"`,

  `"world"`,
  `'world'`,
  "|||\
\n   world\
\n|||",

  `foo(bar)`,
  `foo(bar=99)`,
  `foo(bar) tailstrict`,
  `foo.bar`,
  `foo[bar]`,

  `true || false`,
  `0 && 1 || 0`,
  `0 && (1 || 0)`,

  `local foo = "bar"; foo`,
  `local foo(bar) = bar; foo(1)`,
  `local foo(bar=4) = bar; foo(1)`,
  `{ local foo = "bar", baz: 1}`,
  `{ local foo(bar) = bar, baz: foo(1)}`,
  `{ local foo(bar=[1]) = bar, baz: foo(1)}`,

  `{ foo(bar, baz): bar+baz }`,
  `{ foo(bar={a:1}):: bar }`,

  `{ ["foo" + "bar"]: 3 }`,
  `{ ["field" + x]: x for x in [1, 2, 3] }`,
  `{ local y = x, ["field" + x]: x for x in [1, 2, 3] }`,
  `{ ["field" + x]: x for x in [1, 2, 3] if x <= 2 }`,
  `{ ["field" + x + y]: x + y for x in [1, 2, 3] if x <= 2 for y in [4, 5, 6]}`,

  `[]`,
  `[a, b, c]`,
  `[x for x in [1,2,3] ]`,
  `[x for x in [1,2,3] if x <= 2]`,
  `[x+y for x in [1,2,3] if x <= 2 for y in [4, 5, 6]]`,

  `{}`,
  `{ hello: "world" }`,
  `{ hello +: "world" }`,
  "{\
\n  hello: \"world\",\
\n	\"name\":: joe,\
\n	'mood'::: \"happy\",\
\n	|||\
\n	  key type\
\n|||: \"block\",\
\n}",

  `assert true: 'woah!'; true`,
  `{ assert true: 'woah!', foo: bar }`,

  `if n > 1 then 'foos' else 'foo'`,

  `local foo = function(x) x + 1; true`,

  `import 'foo.jsonnet'`,
  `importstr 'foo.text'`,

  `{a: b} + {c: d}`,
  `{a: b}{c: d}`,
]

describe("Successfully parsing text", () => {
  for (let s of tests) {
    it(`${JSON.stringify(s)}`, () => {
      const tokens = lexer.Lex("test", s);
      if (error.isStaticError(tokens)) {
        throw new Error(`Unexpected lexer to emit tokens\n  input: ${s}`);
      }

      const parse = parser.Parse(<lexer.Tokens>tokens);
      if (error.isStaticError(parse)) {
        throw new Error(
          `Unexpected parse error\n  input: ${s}\n  error: ${parse.Error()}`);
      }
    });
  }
});

interface testError {
  readonly input: string
  readonly err:   string
}

const makeTestError = (input: string, err: string): testError => {
  return <testError>{
    input: input,
    err: err,
  };
}

const errorTests: testError[] = [
  makeTestError(`function(a, b c)`, `test:1:15-16 Expected a comma before next function parameter.`),
  makeTestError(`function(a, 1)`, `test:1:13-14 Expected simple identifier but got a complex expression.`),
  makeTestError(`a b`, `test:1:3-4 Did not expect: (IDENTIFIER, "b")`),
  makeTestError(`foo(a, bar(a b))`, `test:1:14-15 Expected a comma before next function argument.`),

  makeTestError(`local`, `test:1:6 Expected token IDENTIFIER but got end of file`),
  makeTestError(`local foo = 1, foo = 2; true`, `test:1:16-19 Duplicate local var: foo`),
  makeTestError(`local foo(a b) = a; true`, `test:1:13-14 Expected a comma before next function parameter.`),
  makeTestError(`local foo(a): a; true`, `test:1:13-14 Expected operator = but got ":"`),
  makeTestError(`local foo(a) = bar(a b); true`, `test:1:22-23 Expected a comma before next function argument.`),
  makeTestError(`local foo: 1; true`, `test:1:10-11 Expected operator = but got ":"`),
  makeTestError(`local foo = bar(a b); true`, `test:1:19-20 Expected a comma before next function argument.`),

  makeTestError(`{a b}`, `test:1:4-5 Expected token OPERATOR but got (IDENTIFIER, "b")`),
  makeTestError(`{a = b}`, `test:1:4-5 Expected one of :, ::, :::, +:, +::, +:::, got: =`),
  makeTestError(`{a :::: b}`, `test:1:4-8 Expected one of :, ::, :::, +:, +::, +:::, got: ::::`),

  makeTestError(`{assert x for x in [1, 2, 3]}`, `test:1:11-14 Object comprehension cannot have asserts.`),
  makeTestError(`{['foo' + x]: true, [x]: x for x in [1, 2, 3]}`, `test:1:28-31 Object comprehension can only have one field.`),
  makeTestError(`{foo: x for x in [1, 2, 3]}`, `test:1:9-12 Object comprehensions can only have [e] fields.`),
  makeTestError(`{[x]:: true for x in [1, 2, 3]}`, `test:1:13-16 Object comprehensions cannot have hidden fields.`),
  makeTestError(`{[x]: true for 1 in [1, 2, 3]}`, `test:1:16-17 Expected token IDENTIFIER but got (NUMBER, "1")`),
  makeTestError(`{[x]: true for x at [1, 2, 3]}`, `test:1:18-20 Expected token in but got (IDENTIFIER, "at")`),
  makeTestError(`{[x]: true for x in [1, 2 3]}`, `test:1:27-28 Expected a comma before next array element.`),
  makeTestError(`{[x]: true for x in [1, 2, 3] if (a b)}`, `test:1:37-38 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`{[x]: true for x in [1, 2, 3] if a b}`, `test:1:36-37 Expected for, if or "}" after for clause, got: (IDENTIFIER, "b")`),

  makeTestError(`{a: b c:d}`, `test:1:7-8 Expected a comma before next field.`),

  makeTestError(`{[(x y)]: z}`, `test:1:6-7 Expected token ")" but got (IDENTIFIER, "y")`),
  makeTestError(`{[x y]: z}`, `test:1:5-6 Expected token "]" but got (IDENTIFIER, "y")`),

  makeTestError(`{foo(x y): z}`, `test:1:8-9 Expected a comma before next method parameter.`),
  makeTestError(`{foo(x)+: z}`, `test:1:2-5 Cannot use +: syntax sugar in a method: foo`),
  makeTestError(`{foo: 1, foo: 2}`, `test:1:10-13 Duplicate field: foo`),
  makeTestError(`{foo: (1 2)}`, `test:1:10-11 Expected token ")" but got (NUMBER, "2")`),

  makeTestError(`{local 1 = 3, true}`, `test:1:8-9 Expected token IDENTIFIER but got (NUMBER, "1")`),
  makeTestError(`{local foo = 1, local foo = 2, true}`, `test:1:23-26 Duplicate local var: foo`),
  makeTestError(`{local foo(a b) = 1, a: true}`, `test:1:14-15 Expected a comma before next function parameter.`),
  makeTestError(`{local foo(a): 1, a: true}`, `test:1:14-15 Expected operator = but got ":"`),
  makeTestError(`{local foo(a) = (a b), a: true}`, `test:1:20-21 Expected token ")" but got (IDENTIFIER, "b")`),

  makeTestError(`{assert (a b), a: true}`, `test:1:12-13 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`{assert a: (a b), a: true}`, `test:1:15-16 Expected token ")" but got (IDENTIFIER, "b")`),

  makeTestError(`{function(a, b) a+b: true}`, `test:1:2-10 Unexpected: (function, "function") while parsing field definition`),

  makeTestError(`[(a b), 2, 3]`, `test:1:5-6 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`[1, (a b), 2, 3]`, `test:1:8-9 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`[a for b in [1 2 3]]`, `test:1:16-17 Expected a comma before next array element.`),

  makeTestError(`for`, `test:1:1-4 Unexpected: (for, "for") while parsing terminal`),
  makeTestError(``, `test:1:1 Unexpected end of file.`),
  makeTestError(`((a b))`, `test:1:5-6 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`a.1`, `test:1:3-4 Expected token IDENTIFIER but got (NUMBER, "1")`),
  makeTestError(`super.1`, `test:1:7-8 Expected token IDENTIFIER but got (NUMBER, "1")`),
  makeTestError(`super[(a b)]`, `test:1:10-11 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`super[a b]`, `test:1:9-10 Expected token "]" but got (IDENTIFIER, "b")`),
  makeTestError(`super`, `test:1:1-6 Expected . or [ after super.`),

  makeTestError(`assert (a b); true`, `test:1:11-12 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`assert a: (a b); true`, `test:1:14-15 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`assert a: 'foo', true`, `test:1:16-17 Expected token ";" but got (",", ",")`),
  makeTestError(`assert a: 'foo'; (a b)`, `test:1:21-22 Expected token ")" but got (IDENTIFIER, "b")`),

  makeTestError(`error (a b)`, `test:1:10-11 Expected token ")" but got (IDENTIFIER, "b")`),

  makeTestError(`if (a b) then c`, `test:1:7-8 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`if a b c`, `test:1:6-7 Expected token then but got (IDENTIFIER, "b")`),
  makeTestError(`if a then (b c)`, `test:1:14-15 Expected token ")" but got (IDENTIFIER, "c")`),
  makeTestError(`if a then b else (c d)`, `test:1:21-22 Expected token ")" but got (IDENTIFIER, "d")`),

  makeTestError(`function(a) (a b)`, `test:1:16-17 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`function a a`, `test:1:10-11 Expected ( but got (IDENTIFIER, "a")`),

  makeTestError(`import (a b)`, `test:1:11-12 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`import (a+b)`, `test:1:9-12 Computed imports are not allowed`),
  makeTestError(`importstr (a b)`, `test:1:14-15 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`importstr (a+b)`, `test:1:12-15 Computed imports are not allowed`),

  makeTestError(`local a = b ()`, `test:1:15 Expected , or ; but got end of file`),
  makeTestError(`local a = b; (a b)`, `test:1:17-18 Expected token ")" but got (IDENTIFIER, "b")`),

  makeTestError(`1+ <<`, `test:1:4-6 Not a unary operator: <<`),
  makeTestError(`-(a b)`, `test:1:5-6 Expected token ")" but got (IDENTIFIER, "b")`),
  makeTestError(`1~2`, `test:1:2-3 Not a binary operator: ~`),

  makeTestError(`a[(b c)]`, `test:1:6-7 Expected token ")" but got (IDENTIFIER, "c")`),
  makeTestError(`a[b c]`, `test:1:5-6 Expected token "]" but got (IDENTIFIER, "c")`),

  makeTestError(`a{b c}`, `test:1:5-6 Expected token OPERATOR but got (IDENTIFIER, "c")`),
]

describe("Parsing from text", () => {
  for (let s of errorTests) {
    it(`${JSON.stringify(s.input)}`, () => {
      const tokens = lexer.Lex("test", s.input);
      if (error.isStaticError(tokens)) {
        throw new Error(
          `Unexpected lex error\n  input: ${s}\n  error: ${tokens.Error()}`);
      }

      const parse = parser.Parse(tokens);
      if (!error.isStaticError(parse)) {
        throw new Error(
          `Expected parse error but got success\n  input: ${s.input}`);
      }

      assert.equal(parse.Error(), s.err);
    });
  }
});

// func TestAST(t *testing.T) {
// 	files, _ := ioutil.ReadDir("./test_data/ast")
// 	for _, f := range files {
// 		if strings.HasSuffix(f.Name(), ".ast") {
// 			continue
// 		}

// 		assertParse(
// 			t,
// 			"./test_data/ast/"+f.Name(),
// 			"./test_data/ast/"+f.Name()+".ast")
// 	}
// }

// func assertParse(t *testing.T, sourceFile string, targetFile string) {
// 	// Parse source document into a JSON string.
// 	sourceBytes, err := ioutil.ReadFile(sourceFile)
// 	if err != nil {
// 		t.Errorf("Failed to read test file\n  file name: %s\n  error: %v", sourceFile, err)
// 	}
// 	source := string(sourceBytes)

// 	sourceTokens, err := Lex("stdin", source)
// 	if err != nil {
// 		log.Fatalf("Unexpected lex error\n  filename: %s\n  input: %v\n  error: %v", sourceFile, source, err)
// 	}

// 	node, err := Parse(sourceTokens)
// 	if err != nil {
// 		log.Fatalf("Unexpected parse error\n  filename: %s\n  input: %v\n  error: %v", sourceFile, sourceTokens, err)
// 	}

// 	sourceAstBytes, err := json.MarshalIndent(node, "", "  ")
// 	if err != nil {
// 		log.Fatalf("Unexpected serialization error\n  input: %v\n  error: %v", source, err)
// 	}

// 	sourceAstString := strings.TrimSpace(string(sourceAstBytes))

// 	// Get target source as a JSON string.
// 	targetAstBytes, err := ioutil.ReadFile(targetFile)
// 	if err != nil {
// 		t.Errorf("Failed to read test file\n  file name: %s\n  error: %v", sourceFile, err)
// 	}
// 	targetAstString := strings.TrimSpace(string(targetAstBytes))

// 	// Compare.
// 	if sourceAstString != targetAstString {
// 		t.Errorf(
// 			"Parsed AST does not match target AST\n  filename: %s\n  parsed output:\n%s",
// 			sourceFile,
// 			sourceAstString)
// 	}
// }
