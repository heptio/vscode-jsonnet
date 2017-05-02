'use strict';
import * as im from 'immutable';

import * as ast from '../parser/node';
import * as error from '../lexer/static_error';
import * as lexer from '../lexer/lexer';

// ---------------------------------------------------------------------------

const makeLiteralString = (
  value: string, kind: ast.LiteralStringKind, loc: error.LocationRange, blockIndent: string
): ast.LiteralString => {
  return {
    type:        "LiteralStringNode",
    loc:         loc,
    value:       value,
    kind:        kind,
    blockIndent: blockIndent,
    freeVars:    im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
};

const makeIdentifier = (
  name: string, loc: error.LocationRange
): ast.Identifier => {
  return {
    type:     "IdentifierNode",
    loc:      loc,
    name:     name,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeObject = (
  fields: ast.ObjectFields, trailingComma: boolean,
  headingComments: ast.Comments, loc: error.LocationRange,
): ast.ObjectNode => {
  return {
    type: "ObjectNode",
    loc: loc,
    fields:          fields,
    trailingComma:   trailingComma,
    headingComments: headingComments,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeArray = (
  elements: ast.Nodes, trailingComma: boolean, headingComment: ast.Comment | null,
  trailingComment: ast.Comment | null, loc: error.LocationRange,
): ast.Array => {
  return {
    type:            "ArrayNode",
    loc:             loc,
    elements:        elements,
    trailingComma:   trailingComma,
    headingComment:  headingComment,
    trailingComment: trailingComment,
    freeVars:        im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeArrayComp = (
  body: ast.Node, trailingComma: boolean, specs: ast.CompSpecs,
  loc: error.LocationRange,
): ast.ArrayComp => {
  return {
    type:          "ArrayCompNode",
    body:          body,
    trailingComma: trailingComma,
    specs:         specs,
    loc:           loc,
    freeVars:      im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeLiteralNumber = (
  value: number, originalString: string, loc: error.LocationRange
): ast.LiteralNumber => {
  return {
    type:           "LiteralNumberNode",
    value:          value,
    originalString: originalString,
    loc: loc,
    freeVars:      im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeLiteralBoolean = (
  value: boolean, loc: error.LocationRange
): ast.LiteralBoolean => {
  return {
    type:     "LiteralBooleanNode",
    value:    value,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeLiteralNull = (loc: error.LocationRange): ast.LiteralNull => {
  return {
    type:     "LiteralNullNode",
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  };
}

const makeDollar = (loc: error.LocationRange): ast.Dollar => {
  return {
    type:     "DollarNode",
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  };
}

const makeSelf = (loc: error.LocationRange): ast.Self => {
  return {
    type:     "SelfNode",
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  };
}

const makeVar = (id: ast.Identifier, loc: error.LocationRange): ast.Var => {
  return {
    type:     "VarNode",
    id:       id,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  };
}

const makeSuperIndex = (
  index: ast.Node | null, id: ast.Identifier | null, loc: error.LocationRange
): ast.SuperIndex => {
  return {
    type:     "SuperIndexNode",
    index:    index,
    id:       id,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeAssert = (
  cond: ast.Node, message: ast.Node | null, rest: ast.Node,
  loc: error.LocationRange,
): ast.Assert => {
  return {
    type:     "AssertNode",
    cond:     cond,
    message:  message,
    rest:     rest,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeError = (expr: ast.Node, loc: error.LocationRange): ast.Error => {
  return {
    type:     "ErrorNode",
    expr:     expr,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeConditional = (
  cond: ast.Node, branchTrue: ast.Node, branchFalse: ast.Node | null,
  loc: error.LocationRange,
): ast.Conditional => {
  return {
    type:        "ConditionalNode",
    cond:        cond,
    branchTrue:  branchTrue,
    branchFalse: branchFalse,
    loc:         loc,
    freeVars:    im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeImport = (file: string, loc: error.LocationRange): ast.Import => {
  return {
    type:     "ImportNode",
    file:     file,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeImportStr = (
  file: string, loc: error.LocationRange
): ast.ImportStr => {
  return {
    type:     "ImportStrNode",
    file:     file,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeLocal = (
  binds: ast.LocalBinds, body: ast.Node, loc: error.LocationRange
): ast.Local => {
  return {
    type:     "LocalNode",
    binds:    binds,
    body:     body,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeUnary = (
  op: ast.UnaryOp, expr: ast.Node, loc: error.LocationRange,
): ast.Unary => {
  return {
    type:     "UnaryNode",
    op:       op,
    expr:     expr,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeIndex = (
  target: ast.Node, index: ast.Node | null, id: ast.Identifier | null,
  loc: error.LocationRange,
): ast.Index => {
  return {
    type:     "IndexNode",
    target:   target,
    index:    index,
    id:       id,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeApply = (
  target: ast.Node, args: ast.Nodes, trailingComma: boolean,
  tailStrict: boolean, loc: error.LocationRange,
): ast.Apply => {
  return {
    type:          "ApplyNode",
    target:        target,
    arguments:     args,
    trailingComma: trailingComma,
    tailStrict:    tailStrict,
    loc:           loc,
    freeVars:      im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeApplyBrace = (
  left: ast.Node, right: ast.Node, loc: error.LocationRange
): ast.ApplyBrace => {
  return {
    type:     "ApplyBraceNode",
    left:     left,
    right:    right,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeBinary = (
  left: ast.Node, op: ast.BinaryOp, right: ast.Node, loc: error.LocationRange,
): ast.Binary => {
  return {
    type:     "BinaryNode",
    left:     left,
    op:       op,
    right:    right,
    loc:      loc,
    freeVars: im.List<ast.IdentifierName>(),

    parent: null,
    env: null,
  }
}

const makeLocalBind = (
  variable: ast.Identifier, body: ast.Node, functionSugar: boolean,
  params: ast.IdentifierNames, trailingComma: boolean,
): ast.LocalBind => {
  return {
    variable:      variable,
    body:          body,
    functionSugar: functionSugar,
    params:        params, // if functionSugar is true
    trailingComma: trailingComma,
  }
}

type precedence = number;

const applyPrecedence: precedence = 2,  // Function calls and indexing.
      unaryPrecedence: precedence = 4,  // Logical and bitwise negation, unary + -
      maxPrecedence:   precedence = 16; // Local, If, Import, Function, Error

var bopPrecedence = im.Map<ast.BinaryOp, precedence>({
  "BopMult":            5,
  "BopDiv":             5,
  "BopPercent":         5,
  "BopPlus":            6,
  "BopMinus":           6,
  "BopShiftL":          7,
  "BopShiftR":          7,
  "BopGreater":         8,
  "BopGreaterEq":       8,
  "BopLess":            8,
  "BopLessEq":          8,
  "BopManifestEqual":   9,
  "BopManifestUnequal": 9,
  "BopBitwiseAnd":      10,
  "BopBitwiseXor":      11,
  "BopBitwiseOr":       12,
  "BopAnd":             13,
  "BopOr":              14,
});

// ---------------------------------------------------------------------------

const makeUnexpectedError = (
  t: lexer.Token, during: string
): error.StaticError => {
  return error.MakeStaticError(
    `Unexpected: ${t} while ${during}`,
    t.loc);
}

const locFromTokens = (
  begin: lexer.Token, end: lexer.Token
): error.LocationRange => {
  return error.MakeLocationRange(begin.loc.fileName, begin.loc.begin, end.loc.end)
}

const locFromTokenAST = (
  begin: lexer.Token, end: ast.Node
): error.LocationRange => {
  return error.MakeLocationRange(
    begin.loc.fileName, begin.loc.begin, end.loc.end)
}

// ---------------------------------------------------------------------------

class parser {
  private currT: number = 0;

  constructor(
    readonly t: lexer.Tokens
  ) {}

  public pop = (): lexer.Token => {
    const p = this;
    const t = p.t.get(p.currT);
    p.currT++
    return t
  };

  public popExpect = (
    tk: lexer.TokenKind
  ): lexer.Token | error.StaticError => {
    const p = this;
    const t = p.pop();
    if (t.kind !== tk) {
      return error.MakeStaticError(
        `Expected token ${lexer.TokenKindStrings.get(tk)} but got ${t}`,
        t.loc);
    }
    return t;
  };

  public popExpectOp = (
    op: string
  ): lexer.Token | error.StaticError => {
    const p = this;
    const t = p.pop();
    if (t.kind !== "TokenOperator" || t.data != op) {
      return error.MakeStaticError(
        `Expected operator ${op} but got ${t}`, t.loc);
    }
    return t
  };

  public peek = (): lexer.Token => {
    const p = this;
    return p.t.get(p.currT);
  };

  // parseOptionalComments parses a block of comments if they exist at
  // the current position in the token stream (as measured by
  // `p.peek()`), and has no effect if they don't.
  public parseOptionalComments = (): ast.Comments => {
    const p = this;
    let comments = im.List<ast.Comment>();
    while (true) {
      const next = p.peek();
      if (next.kind === "TokenCommentCpp") {
        p.pop();
        comments = comments.push(ast.MakeCppComment(next.loc, next.data));
      } else {
        break;
      }
    }

    return comments
  };

  public parseCommaList = (
    end: lexer.TokenKind, elementKind: string
  ): {next: lexer.Token, exprs: ast.Nodes, gotComma: boolean} | error.StaticError => {
    const p = this;
    let exprs = im.List<ast.Node>();
    let gotComma = false;
    let first = true;
    while (true) {
      let next = p.peek();
      if (!first && !gotComma) {
        if (next.kind === "TokenComma") {
          p.pop();
          next = p.peek();
          gotComma = true;
        }
      }
      if (next.kind === end) {
        // gotComma can be true or false here.
        return {next: p.pop(), exprs: exprs, gotComma: gotComma};
      }

      if (!first && !gotComma) {
        return error.MakeStaticError(
          `Expected a comma before next ${elementKind}.`, next.loc);
      }

      const expr = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(expr)) {
        return expr;
      }
      exprs = exprs.push(expr);
      gotComma = false;
      first = false;
    }
  }

  public parseIdentifierList = (
    elementKind: string
  ): {ids: ast.IdentifierNames, gotComma: boolean} | error.StaticError => {
    const p = this;
    const result = p.parseCommaList("TokenParenR", elementKind);
    if (error.isStaticError(result)) {
      return result;
    }

    let ids = im.List<ast.IdentifierName>();
    for (let n of result.exprs.toArray()) {
      if (!ast.isVar(n)) {
        return error.MakeStaticError(
          `Expected simple identifier but got a complex expression.`,
          n.loc);
      }
      ids = ids.push(n.id.name);
    }
    return {ids: ids, gotComma: result.gotComma};
  };

  public parseBind = (
    binds: ast.LocalBinds
  ): ast.LocalBinds | error.StaticError => {
    const p = this;
    const varID = p.popExpect("TokenIdentifier");
    if (error.isStaticError(varID)) {
      return varID;
    }

    for (let b of binds.toArray()) {
      if (b.variable.name === varID.data) {
        return error.MakeStaticError(
          `Duplicate local var: ${varID.data}`, varID.loc);
      }
    }

    if (p.peek().kind === "TokenParenL") {
      p.pop();
      const result = p.parseIdentifierList("function parameter");
      if (error.isStaticError(result)) {
        return result;
      }

      const pop = p.popExpectOp("=")
      if (error.isStaticError(pop)) {
        return pop;
      }

      const body = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(body)) {
        return body;
      }
      const id = makeIdentifier(varID.data, varID.loc);
      const {ids: params, gotComma: gotComma} = result;
      const bind = makeLocalBind(id, body, true, params, gotComma);
      binds = binds.push(bind);
    } else {
      const pop = p.popExpectOp("=");
      if (error.isStaticError(pop)) {
        return pop;
      }
      const body = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(body)) {
        return body;
      }
      const id = makeIdentifier(varID.data, varID.loc);
      const bind = makeLocalBind(id, body, false, im.List<string>(), false)
      binds = binds.push(bind);
    }

    return binds;
  };

  public parseObjectAssignmentOp = (
  ): {plusSugar: boolean, hide: ast.ObjectFieldHide} | error.StaticError => {
    const p = this;

    let plusSugar = false;
    let hide: ast.ObjectFieldHide | null = null;

    const op = p.popExpect("TokenOperator");
    if (error.isStaticError(op)) {
      return op;
    }

    let opStr = op.data;
    if (opStr[0] === '+') {
      plusSugar = true;
      opStr = opStr.slice(1);
    }

    let numColons = 0
    while (opStr.length > 0) {
      if (opStr[0] !== ':') {
        return error.MakeStaticError(
          `Expected one of :, ::, :::, +:, +::, +:::, got: ${op.data}`,
          op.loc);
      }
      opStr = opStr.slice(1);
      numColons++
    }

    switch (numColons) {
      case 1:
        hide = "ObjectFieldInherit";
        break;
      case 2:
        hide = "ObjectFieldHidden"
        break;
      case 3:
        hide = "ObjectFieldVisible"
        break;
      default:
        return error.MakeStaticError(
          `Expected one of :, ::, :::, +:, +::, +:::, got: ${op.data}`,
          op.loc);
      }

    return {plusSugar: plusSugar, hide: hide};
  };

  // parseObjectCompRemainder parses the remainder of an object as an
  // object comprehension. This function is meant to act in conjunction
  // with `parseObjectCompRemainder`, and is meant to be called
  // immediately after the `for` token is encountered, since this is
  // typically the first indication that we are in an object
  // comprehension. Partially to enforce this condition, this function
  // takes as an argument the token representing the `for` keyword.
  public parseObjectCompRemainder = (
    first: lexer.Token, forTok: lexer.Token, gotComma: boolean,
    fields: ast.ObjectFields,
  ): {comp: ast.Node, last: lexer.Token} | error.StaticError => {
    const p = this;

    let numFields = 0;
    let numAsserts = 0;
    let field = fields.first();
    for (field of fields.toArray()) {
      if (field.kind === "ObjectLocal") {
        continue;
      }
      if (field.kind === "ObjectAssert") {
        numAsserts++;
        continue;
      }
      numFields++;
    }

    if (numAsserts > 0) {
      return error.MakeStaticError(
        "Object comprehension cannot have asserts.", forTok.loc);
    }
    if (numFields != 1) {
      return error.MakeStaticError(
        "Object comprehension can only have one field.", forTok.loc);
    }
    if (field.hide != "ObjectFieldInherit") {
      return error.MakeStaticError(
        "Object comprehensions cannot have hidden fields.", forTok.loc);
    }
    if (field.kind !== "ObjectFieldExpr") {
      return error.MakeStaticError(
        "Object comprehensions can only have [e] fields.", forTok.loc);
    }
    const result = p.parseCompSpecs("TokenBraceR");
    if (error.isStaticError(result)) {
      return result;
    }

    const comp: ast.ObjectComp = {
      type:          "ObjectCompNode",
      loc:           locFromTokens(first, result.maybeIf),
      fields:        fields,
      trailingComma: gotComma,
      specs:         result.compSpecs,
      freeVars:      im.List<string>(),

      parent: null,
      env: null,
    }
    return {comp: comp, last: result.maybeIf};
  };

  // parseObjectField will parse a single field in an object.
  public parseObjectField = (
    headingComments: ast.Comments, next: lexer.Token,
    literalFields: im.Set<literalField>,
  ): {field: ast.ObjectField, literals: im.Set<literalField>} | error.StaticError => {
    const p = this;

    let kind: ast.ObjectFieldKind;
    let expr1: ast.Node | null = null;
    let id: ast.Identifier | null = null;

    switch (next.kind) {
      case "TokenIdentifier": {
        kind = "ObjectFieldID";
        id = makeIdentifier(next.data, next.loc);
        break;
      }
      case "TokenStringDouble": {
        kind = "ObjectFieldStr";
        expr1 = makeLiteralString(next.data, "StringDouble", next.loc, "");
        break;
      }
      case "TokenStringSingle": {
        kind = "ObjectFieldStr";
        expr1 = makeLiteralString(next.data, "StringSingle", next.loc, "");
        break;
      }
      case "TokenStringBlock": {
        kind = "ObjectFieldStr"
        expr1 = makeLiteralString(
          next.data, "StringBlock", next.loc, next.stringBlockIndent);
        break;
      }
      default: {
        kind = "ObjectFieldExpr"
        const expr1 = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(expr1)) {
          return expr1;
        }
        const pop = p.popExpect("TokenBracketR");
        if (error.isStaticError(pop)) {
          return pop;
        }
        break;
      }
    }

    let isMethod = false;
    let methComma = false;
    let params = im.List<ast.IdentifierName>();
    if (p.peek().kind === "TokenParenL") {
      p.pop();
      const result = p.parseIdentifierList("method parameter");
      if (error.isStaticError(result)) {
        return result;
      }
      isMethod = true
    }

    const result /*[plusSugar, hide, parseAssignErr]*/ = p.parseObjectAssignmentOp();
    if (error.isStaticError(result)) {
      return result;
    }

    if (result.plusSugar && isMethod) {
      return error.MakeStaticError(
        `Cannot use +: syntax sugar in a method: ${next.data}`, next.loc);
    }

    if (kind !== "ObjectFieldExpr") {
      if (literalFields.contains(next.data)) {
        return error.MakeStaticError(
          `Duplicate field: ${next.data}`, next.loc);
      }
      literalFields = literalFields.add(next.data);
    }

    const body = p.parse(maxPrecedence, im.List<ast.Comment>());
    if (error.isStaticError(body)) {
      return body;
    }

    // TODO: The location range here is probably not quite correct.
    // For example, in cases where `body` is a string literal, the
    // location range will only reflect the string contents, not the
    // ending quote.
    return {
      field: {
        type:            "ObjectFieldNode",
        kind:            kind,
        loc:             locFromTokenAST(next, body),
        hide:            result.hide,
        superSugar:      result.plusSugar,
        methodSugar:     isMethod,
        expr1:           expr1,
        id:              id,
        ids:             params,
        trailingComma:   methComma,
        expr2:           body,
        expr3:           null,
        headingComments: headingComments,
        freeVars:        im.List<ast.IdentifierName>(),

        parent: null,
        env: null,
      },
      literals: literalFields
    };
  }

  // parseObjectLocal parses a `local` definition that appears in an
  // object, as an object field. `assertToken` is required to allow the
  // object to create an appropriate location range for the field.
  public parseObjectLocal = (
    assertToken: lexer.Token, binds: ast.IdentifierSet,
  ): {field: ast.ObjectField, binds: ast.IdentifierSet} | error.StaticError => {
    const p = this;

    const varID = p.popExpect("TokenIdentifier");
    if (error.isStaticError(varID)) {
      return varID;
    }
    const id = makeIdentifier(varID.data, varID.loc);
    if (binds.contains(id.name)) {
      return error.MakeStaticError(
        `Duplicate local var: ${id.name}`, varID.loc);
    }

    let isMethod = false;
    let funcComma = false;
    let params = im.List<ast.IdentifierName>();
    if (p.peek().kind === "TokenParenL") {
      p.pop();
      isMethod = true;
      const result = p.parseIdentifierList("function parameter");
      if (error.isStaticError(result)) {
        return result;
      }
    }
    const pop = p.popExpectOp("=");
    if (error.isStaticError(pop)) {
      return pop;
    }

    const body = p.parse(maxPrecedence, im.List<ast.Comment>());
    if (error.isStaticError(body)) {
      return body;
    }

    binds = binds.add(id.name);

    return {
      field: {
        type:            "ObjectFieldNode",
        kind:            "ObjectLocal",
        loc:             locFromTokenAST(assertToken, body),
        hide:            "ObjectFieldVisible",
        superSugar:      false,
        methodSugar:     isMethod,
        id:              id,
        ids:             params,
        trailingComma:   funcComma,
        expr1:           null,
        expr2:           body,
        expr3:           null,
        headingComments: im.List<ast.Comment>(),
        freeVars:        im.List<ast.IdentifierName>(),

        parent: null,
        env: null,
      },
      binds: binds,
    };
  };

  // parseObjectLocal parses an `assert` that appears as an object
  // field. `localToken` is required to allow the object to create an
  // appropriate location range for the field.
  public parseObjectAssert = (
    localToken: lexer.Token,
  ): ast.ObjectField | error.StaticError => {
    const p = this;
    const cond = p.parse(maxPrecedence, im.List<ast.Comment>())
    if (error.isStaticError(cond)) {
      return cond;
    }
    let msg: ast.Node | null = null;
    if (p.peek().kind === "TokenOperator" && p.peek().data == ":") {
      p.pop();
      const result = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(result)) {
        return result;
      }
      msg = result;
    }

    // Message is optional, so location range changes based on whether
    // it's present.
    const loc: error.LocationRange = msg == null
      ?  locFromTokenAST(localToken, cond)
      : locFromTokenAST(localToken, msg);

    return {
      type:     "ObjectFieldNode",
      loc:      loc,
      kind:     "ObjectAssert",
      hide:     "ObjectFieldVisible",
      expr2:    cond,
      expr3:    msg,
      freeVars: im.List<ast.IdentifierName>(),

      superSugar:      false,
      methodSugar:     false,
      expr1:           null,
      id:              null,
      ids:             im.List<ast.IdentifierName>(),
      trailingComma:   false,
      headingComments: im.List<ast.Comment>(),

      parent: null,
      env: null,
    };
  };

  // parseObjectRemainder parses "the rest" of an object, typically
  // immediately after we encounter the '{' character.
  public parseObjectRemainder = (
    tok: lexer.Token, heading: im.List<ast.Comment>,
  ): {objRemainder: ast.Node, next: lexer.Token} | error.StaticError => {
    const p = this;
    let fields = im.List<ast.ObjectField>();
    let literalFields = im.Set<literalField>();
    let binds = im.Set<ast.IdentifierName>()

    let gotComma = false
    let first = true

    while (true) {
      // Comments for an object field are allowed to be of either of
      // these forms:
      //
      //     // Explains `foo`.
      //     foo: "bar",
      //
      // or (note the leading comma before the field):
      //
      //     // Explains `foo`.
      //     , foo: "bar"
      //
      // To accomodate both styles, we attempt to parse comments before
      // and after the comma. If there are comments after, that is
      // becomes the heading comment for that field; if not, then we use
      // any comments that happen after the line that contains the last
      // field, but before the comma. So, for example, we ignore the
      // following comment:
      //
      //     , foo: "value1" // This comment is not a heading comment.
      //     // But this one is.
      //     , bar: "value2"
      let headingComments = p.parseOptionalComments();

      let next = p.peek();
      if (!gotComma && !first) {
        if (next.kind === "TokenComma") {
          p.pop();
          next = p.peek();
          gotComma = true
        }
      }

      if (p.peek().kind === "TokenCommentCpp") {
        headingComments = p.parseOptionalComments();
      }
      next = p.pop();

      // Done parsing the object. Return.
      if (next.kind === "TokenBraceR") {
        return {
          objRemainder: makeObject(
            fields, gotComma, heading, locFromTokens(tok, next)),
          next: next
        };
      }

      // Object comprehension.
      if (next.kind === "TokenFor") {
        const result = p.parseObjectCompRemainder(tok, next, gotComma, fields)
        if (error.isStaticError(result)) {
          return result;
        }
        return {objRemainder: result.comp, next: result.last};
      }

      if (!gotComma && !first) {
        return error.MakeStaticError(
          "Expected a comma before next field.", next.loc);
      }
      first = false;

      // Start to parse an object field. There are basically 3 valid
      // cases:
      // 1. An object field. The key is a string, an identifier, or a
      //    computed field.
      // 2. A `local` definition.
      // 3. An `assert`.
      switch (next.kind) {
        case "TokenBracketL":
        case "TokenIdentifier":
        case "TokenStringDouble":
        case "TokenStringSingle":
        case "TokenStringBlock": {
          const result = p.parseObjectField(
            headingComments, next, literalFields);
          if (error.isStaticError(result)) {
            return result;
          }
          literalFields = result.literals;
          fields = fields.push(result.field);
          break;
        }

        case "TokenLocal": {
          const result = p.parseObjectLocal(next, binds);
          if (error.isStaticError(result)) {
            return result;
          }
          binds = result.binds;
          fields = fields.push(result.field);
          break;
        }

        case "TokenAssert": {
          const field = p.parseObjectAssert(next);
          if (error.isStaticError(field)) {
            return field;
          }
          fields = fields.push(field);
          break;
        }

        default: {
          return makeUnexpectedError(next, "parsing field definition");
        }
      }
      gotComma = false;
    }
  };


  // parseCompSpecs parses expressions of the form (e.g.) `for x in expr
  // for y in expr if expr for z in expr ...`
  public parseCompSpecs = (
    end: lexer.TokenKind
  ): {compSpecs: ast.CompSpecs, maybeIf: lexer.Token} | error.StaticError => {
    const p = this;

    let specs = im.List<ast.CompSpec>();
    while (true) {
      const varID = p.popExpect("TokenIdentifier");
      if (error.isStaticError(varID)) {
        return varID;
      }

      const id: ast.Identifier = makeIdentifier(varID.data, varID.loc);
      const pop = p.popExpect("TokenIn");
      if (error.isStaticError(pop)) {
        return pop;
      }
      const arr = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(arr)) {
        return arr;
      }
      specs = specs.push({
        kind:    "CompFor",
        varName: id,
        expr:    arr,
      });

      let maybeIf = p.pop();
      for (; maybeIf.kind === "TokenIf"; maybeIf = p.pop()) {
        const cond = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(cond)) {
          return cond;
        }
        specs = specs.push({
          kind:    "CompIf",
          varName: null,
          expr:    cond,
        });
      }
      if (maybeIf.kind === end) {
        return {compSpecs: specs, maybeIf: maybeIf};
      }

      if (maybeIf.kind !== "TokenFor") {
        const tokenKind = lexer.TokenKindStrings.get(end);
        return error.MakeStaticError(
          `Expected for, if or ${tokenKind} after for clause, got: ${maybeIf}`, maybeIf.loc);
      }

    }
  };

  // parseArrayRemainder parses "the rest" of an array literal,
  // typically immediately after we encounter the '[' character.
  public parseArrayRemainder = (
    tok: lexer.Token
  ): ast.Node | error.StaticError => {
    const p = this;

    let next = p.peek();
    if (next.kind === "TokenBracketR") {
      p.pop();
      return makeArray(
        im.List<ast.Node>(), false, null, null, locFromTokens(tok, next));
    }

    const first = p.parse(maxPrecedence, im.List<ast.Comment>());
    if (error.isStaticError(first)) {
      return first;
    }
    let gotComma = false;
    next = p.peek();
    if (next.kind === "TokenComma") {
      p.pop();
      next = p.peek();
      gotComma = true;
    }

    if (next.kind === "TokenFor") {
      // It's a comprehension
      p.pop();
      const result = p.parseCompSpecs("TokenBracketR");
      if (error.isStaticError(result)) {
        return result;
      }

      return makeArrayComp(
        first, gotComma, result.compSpecs, locFromTokens(tok, result.maybeIf));
    }
    // Not a comprehension: It can have more elements.
    let elements = im.List<ast.Node>([first]);

    while (true) {
      if (next.kind === "TokenBracketR") {
        // TODO(dcunnin): SYNTAX SUGAR HERE (preserve comma)
        p.pop();
        break;
      }
      if (!gotComma) {
        return error.MakeStaticError(
          "Expected a comma before next array element.", next.loc);
      }
      const nextElem = p.parse(maxPrecedence, im.List<ast.Comment>());
      if (error.isStaticError(nextElem)) {
        return nextElem;
      }
      elements = elements.push(nextElem);

      // Throw away comments before the comma.
      p.parseOptionalComments();

      next = p.peek();
      if (next.kind === "TokenComma") {
        p.pop();
        next = p.peek();
        gotComma = true;
      } else {
        gotComma = false;
      }

      // Throw away comments after the comma.
      p.parseOptionalComments();
    }

    // TODO: Remove trailing whitespace here after we emit newlines from
    // the lexer. If we don't do that, we might accidentally kill
    // comments that correspond to, e.g., the next field of an object.

    return makeArray(elements, gotComma, null, null, locFromTokens(tok, next));
  };

  public parseTerminal = (
    heading: im.List<ast.Comment>
  ): ast.Node | error.StaticError => {
    const p = this;

    let tok = p.pop();
    switch (tok.kind) {
      case "TokenAssert":
      case "TokenBraceR":
      case "TokenBracketR":
      case "TokenComma":
      case "TokenDot":
      case "TokenElse":
      case "TokenError":
      case "TokenFor":
      case "TokenFunction":
      case "TokenIf":
      case "TokenIn":
      case "TokenImport":
      case "TokenImportStr":
      case "TokenLocal":
      case "TokenOperator":
      case "TokenParenR":
      case "TokenSemicolon":
      case "TokenTailStrict":
      case "TokenThen":
        return makeUnexpectedError(tok, "parsing terminal");

      case "TokenEndOfFile":
        return error.MakeStaticError("Unexpected end of file.", tok.loc);

      case "TokenBraceL": {
        const result = p.parseObjectRemainder(tok, heading);
        if (error.isStaticError(result)) {
          return result;
        }
        return result.objRemainder;
      }

      case "TokenBracketL":
        return p.parseArrayRemainder(tok);

      case "TokenParenL": {
        const inner = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(inner)) {
          return inner;
        }
        const pop = p.popExpect("TokenParenR");
        if (error.isStaticError(pop)) {
          return pop;
        }
        // TODO: Don't cast me bro.
        return <ast.Node>inner;
      }

      // Literals
      case "TokenNumber": {
        // This shouldn't fail as the lexer should make sure we have good input but
        // we handle the error regardless.
        const num = Number(tok.data);
        // TODO: Figure out whether this is correct.
        if (isNaN(num) && tok.data !== "NaN") {
          return error.MakeStaticError(
            "Could not parse floating point number.", tok.loc);
        }
        return makeLiteralNumber(num, tok.data, tok.loc);
      }
      case "TokenStringSingle":
        return makeLiteralString(tok.data, "StringSingle", tok.loc, "");
      case "TokenStringDouble":
        return makeLiteralString(tok.data, "StringDouble", tok.loc, "");
      case "TokenStringBlock":
        return makeLiteralString(
          tok.data, "StringBlock", tok.loc, tok.stringBlockIndent);
      case "TokenFalse":
        return makeLiteralBoolean(false, tok.loc);
      case "TokenTrue":
        return makeLiteralBoolean(true, tok.loc);
      case "TokenNullLit":
        return makeLiteralNull(tok.loc);

      // Variables
      case "TokenDollar":
        return makeDollar(tok.loc);
      case "TokenIdentifier": {
        const id = makeIdentifier(tok.data, tok.loc);
        return makeVar(id, tok.loc);
      }
      case "TokenSelf":
        return makeSelf(tok.loc);
      case "TokenSuper": {
        const next = p.pop();
        let index: ast.Node | null = null;
        let id: ast.Identifier | null = null;
        switch (next.kind) {
          case "TokenDot": {
            const fieldID = p.popExpect("TokenIdentifier");
            if (error.isStaticError(fieldID)) {
              return fieldID;
            }
            id = makeIdentifier(fieldID.data, fieldID.loc);
            break;
          }
          case "TokenBracketL": {
            let parseErr: error.StaticError | null;
            const result = p.parse(maxPrecedence, im.List<ast.Comment>());
            if (error.isStaticError(result)) {
              return result;
            }
            index = result;
            const pop = p.popExpect("TokenBracketR");
            if (error.isStaticError(pop)) {
              return pop;
            }
            break;
          }
        default:
          return error.MakeStaticError(
            "Expected . or [ after super.", tok.loc);
        }
        return makeSuperIndex(index, id, tok.loc);
      }
    }

    return error.MakeStaticError(
      `INTERNAL ERROR: Unknown tok kind: ${tok.kind}`, tok.loc);
  }

  // parse is the main parsing routine.
  public parse = (
    prec: precedence, heading: ast.Comments
  ): ast.Node | error.StaticError => {
    const p = this;

    let begin = p.peek();

    if (begin.kind === "TokenCommentCpp") {
      p.pop();

      // Get the CPP comment block
      heading = im.List<ast.Comment>(ast.MakeCppComment(begin.loc, begin.data))
      while (true) {
        begin = p.peek();
        if (begin.kind === "TokenCommentCpp") {
          p.pop();
          heading = heading.push(ast.MakeCppComment(begin.loc, begin.data));
        } else {
          break;
        }
      }
    }

    switch (begin.kind) {
      // These cases have effectively maxPrecedence as the first
      // call to parse will parse them.
      case "TokenAssert": {
        p.pop();
        const cond = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(cond)) {
          return cond;
        }
        let msg: ast.Node | null = null;
        if (p.peek().kind === "TokenOperator" && p.peek().data === ":") {
          p.pop();
          const result = p.parse(maxPrecedence, im.List<ast.Comment>());
          if (error.isStaticError(result)) {
            return result;
          }
          msg = result;
        }
        const pop = p.popExpect("TokenSemicolon");
        if (error.isStaticError(pop)) {
          return pop;
        }
        const rest = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(rest)) {
          return rest;
        }
        return makeAssert(cond, msg, rest, locFromTokenAST(begin, rest));
      }

      case "TokenError": {
        p.pop();
        const expr = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(expr)) {
          return expr;
        }
        return makeError(expr, locFromTokenAST(begin, expr));
      }

      case "TokenIf": {
        p.pop();
        const cond = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(cond)) {
          return cond;
        }
        const pop = p.popExpect("TokenThen");
        if (error.isStaticError(pop)) {
          return pop;
        }
        const branchTrue = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(branchTrue)) {
          return branchTrue;
        }
        let branchFalse: ast.Node | null = null;
        let lr = locFromTokenAST(begin, branchTrue);
        if (p.peek().kind === "TokenElse") {
          p.pop();
          const branchFalse = p.parse(maxPrecedence, im.List<ast.Comment>());
          if (error.isStaticError(branchFalse)) {
            return branchFalse;
          }
          lr = locFromTokenAST(begin, branchFalse)
        }
        return makeConditional(cond, branchTrue, branchFalse, lr);
      }

      case "TokenFunction": {
        p.pop();
        const next = p.pop();
        if (next.kind === "TokenParenL") {
          const result = p.parseIdentifierList("function parameter");
          if (error.isStaticError(result)) {
            return result;
          }

          const body = p.parse(maxPrecedence, im.List<ast.Comment>());
          if (error.isStaticError(body)) {
            return body;
          }
          const fn: ast.Function = {
            type:            "FunctionNode",
            parameters:      result.ids,
            trailingComma:   result.gotComma,
            body:            body,
            loc:             locFromTokenAST(begin, body),
            headingComment:  im.List<ast.Comment>(),
            trailingComment: im.List<ast.Comment>(),
            freeVars:        im.List<ast.IdentifierName>(),

            parent: null,
            env: null,
          };
          return fn;
        }
        return error.MakeStaticError(`Expected ( but got ${next}`, next.loc);
      }

      case "TokenImport": {
        p.pop();
        const body = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(body)) {
          return body;
        }
        if (ast.isLiteralString(body)) {
          return makeImport(body.value, locFromTokenAST(begin, body));
        }
        return error.MakeStaticError(
          "Computed imports are not allowed", body.loc);
      }

      case "TokenImportStr": {
        p.pop();
        const body = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(body)) {
          return body;
        }
        if (ast.isLiteralString(body)) {
          return makeImportStr(body.value, locFromTokenAST(begin, body));
        }
        return error.MakeStaticError(
          "Computed imports are not allowed", body.loc);
      }

      case "TokenLocal": {
        p.pop();
        let binds = im.List<ast.LocalBind>();
        while (true) {
          const newBinds = p.parseBind(binds);
          if (error.isStaticError(newBinds)) {
            return newBinds;
          }
          binds = newBinds;
          const delim = p.pop();
          if (delim.kind !== "TokenSemicolon" && delim.kind !== "TokenComma") {
            return error.MakeStaticError(
              `Expected , or ; but got ${delim}`, delim.loc);
          }
          if (delim.kind === "TokenSemicolon") {
            break;
          }
        }
        const body = p.parse(maxPrecedence, im.List<ast.Comment>());
        if (error.isStaticError(body)) {
          return body;
        }
        return makeLocal(binds, body, locFromTokenAST(begin, body));
      }

      default: {
        // Unary operator
        if (begin.kind === "TokenOperator") {
          const uop = ast.UopMap.get(begin.data);
          if (uop == undefined) {
            return error.MakeStaticError(
              `Not a unary operator: ${begin.data}`, begin.loc);
          }
          if (prec == unaryPrecedence) {
            const op = p.pop();
            const expr = p.parse(prec, im.List<ast.Comment>());
            if (error.isStaticError(expr)) {
              return expr;
            }
            return makeUnary(uop, expr, locFromTokenAST(op, expr));
          }
        }

        // Base case
        if (prec == 0) {
          return p.parseTerminal(heading);
        }

        let lhs = p.parse(prec-1, heading);
        if (error.isStaticError(lhs)) {
          return lhs;
        }

        while (true) {
          // Then next token must be a binary operator.

          let bop: ast.BinaryOp | null = null;

          // Check precedence is correct for this level.  If we're parsing operators
          // with higher precedence, then return lhs and let lower levels deal with
          // the operator.
          switch (p.peek().kind) {
            case "TokenOperator": {
              // _ = "breakpoint"
              if (p.peek().data === ":") {
                // Special case for the colons in assert. Since COLON is no-longer a
                // special token, we have to make sure it does not trip the
                // op_is_binary test below.  It should terminate parsing of the
                // expression here, returning control to the parsing of the actual
                // assert AST.
                return lhs;
              }
              bop = ast.BopMap.get(p.peek().data);
              if (bop == undefined) {
                return error.MakeStaticError(
                  `Not a binary operator: ${p.peek().data}`, p.peek().loc);
              }

              if (bopPrecedence.get(bop) != prec) {
                return lhs;
              }
              break;
            }

            case "TokenDot":
            case "TokenBracketL":
            case "TokenParenL":
            case "TokenBraceL": {
              if (applyPrecedence != prec) {
                return lhs;
              }
              break;
            }
            default:
              return lhs;
          }

          const op = p.pop();
          switch (op.kind) {
            case "TokenBracketL": {
              const index = p.parse(maxPrecedence, im.List<ast.Comment>());
              if (error.isStaticError(index)) {
                return index;
              }
              const end = p.popExpect("TokenBracketR");
              if (error.isStaticError(end)) {
                return end;
              }

              lhs = makeIndex(lhs, index, null, locFromTokens(begin, end));
              break;
            }
            case "TokenDot": {
              const fieldID = p.popExpect("TokenIdentifier");
              if (error.isStaticError(fieldID)) {
                return fieldID;
              }
              const id = makeIdentifier(fieldID.data, fieldID.loc);
              lhs = makeIndex(lhs, null, id, locFromTokens(begin, fieldID));
              break;
            }
            case "TokenParenL": {
              const result = p.parseCommaList(
                "TokenParenR", "function argument");
              if (error.isStaticError(result)) {
                return result;
              }

              const {next: end, exprs: args, gotComma: gotComma} = result;
              let tailStrict = false
              if (p.peek().kind === "TokenTailStrict") {
                p.pop();
                tailStrict = true;
              }
              lhs = makeApply(
                lhs, args, gotComma, tailStrict, locFromTokens(begin, end));
              break;
            }
            case "TokenBraceL": {
              const result = p.parseObjectRemainder(op, heading);
              if (error.isStaticError(result)) {
                return result;
              }
              lhs = makeApplyBrace(
                lhs, result.objRemainder, locFromTokens(begin, result.next));
              break;
            }
            default: {
              const rhs = p.parse(prec-1, im.List<ast.Comment>());
              if (error.isStaticError(rhs)) {
                return rhs;
              }
              if (bop == null) {
                throw new Error("INTERNAL ERROR: `parse` can't return a null node unless an `error` is populated");
              }
              lhs = makeBinary(lhs, bop, rhs, locFromTokenAST(begin, rhs));
              break;
            }
          }
        }
      }
    }
  }
}

type literalField = string;

// ---------------------------------------------------------------------------

export const Parse = (
  t: lexer.Tokens
): ast.Node | error.StaticError => {
  const p = new parser(t);
  const expr = p.parse(maxPrecedence, im.List<ast.Comment>());
  if (error.isStaticError(expr)) {
    return expr;
  }

  // Get rid of any trailing comments.
  p.parseOptionalComments();

  if (p.peek().kind !== "TokenEndOfFile") {
    return error.MakeStaticError(`Did not expect: ${p.peek()}`, p.peek().loc);
  }

  // TODO: Don't cast me bro.
  return <ast.Node>expr;
}

