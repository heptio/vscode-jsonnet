'use strict';
import * as im from 'immutable';

import * as error from '../lexer/static_error';

// ---------------------------------------------------------------------------

export type Environment = im.Map<string, LocalBind>;

export const emptyEnvironment = im.Map<string, LocalBind>();

export const environmentFromLocal = (local: Local): Environment => {
  const defaultLocal: {[key: string]: LocalBind} = {};
  const binds = local.binds
    .reduce(
      (acc, bind) => {
        if (acc == undefined || bind == undefined) {
          throw new Error(`INTERNAL ERROR: Local binds can't be undefined during a \`reduce\``);
        }
        acc[bind.variable.name] = bind;
        return acc;
      },
      defaultLocal);
  return im.Map(binds);
}

export const renderAsJson = (node: Node): string => {
  return "```\n" + JSON.stringify(
  node,
  (k, v) => {
    if (k === "parent") {
      return (<Node>v).type;
    } else if (k === "env") {
      // TODO: Calling `.has` on this causes us to claim that
      // we can't find function. That's weird.
      return `${Object.keys(v).join(", ")}`;
    } else {
      return v;
    }
  },
  "  ") + "\n```";
}

// ---------------------------------------------------------------------------

export type NodeKind =
  "CommentNode" |
  "CompSpecNode" |
  "ApplyNode" |
  "ApplyBraceNode" |
  "ApplyParamAssignmentNode" |
  "ArrayNode" |
  "ArrayCompNode" |
  "AssertNode" |
  "BinaryNode" |
  "BuiltinNode" |
  "ConditionalNode" |
  "DollarNode" |
  "ErrorNode" |
  "FunctionNode" |
  "FunctionParamNode" |
  "IdentifierNode" |
  "ImportNode" |
  "ImportStrNode" |
  "IndexNode" |
  "LocalBindNode" |
  "LocalNode" |
  "LiteralBooleanNode" |
  "LiteralNullNode" |
  "LiteralNumberNode" |
  "LiteralStringNode" |
  "ObjectFieldNode" |
  "ObjectNode" |
  "DesugaredObjectFieldNode" |
  "DesugaredObjectNode" |
  "ObjectCompNode" |
  "ObjectComprehensionSimpleNode" |
  "SelfNode" |
  "SuperIndexNode" |
  "UnaryNode" |
  "VarNode";

// ---------------------------------------------------------------------------

export interface Node {
  readonly type:     string
  readonly loc:      error.LocationRange
  readonly freeVars: IdentifierNames

  parent: Node | null;     // Filled in by the visitor.
  env: Environment | null; // Filled in by the visitor.
}
export type Nodes = im.List<Node>

// ---------------------------------------------------------------------------

// IdentifierName represents a variable / parameter / field name.
//+gen set
export type IdentifierName = string
export type IdentifierNames = im.List<IdentifierName>
export type IdentifierSet = im.Set<IdentifierName>;

export interface Identifier extends Node {
  readonly type: "IdentifierNode";
  readonly name: IdentifierName
}

export const isIdentifier = (node: Node): node is Identifier => {
  const nodeType: NodeKind = "IdentifierNode";
  return node.type === nodeType;
}

export const makeIdentifier = (
  name: string, loc: error.LocationRange
): Identifier => {
  return {
    type:     "IdentifierNode",
    loc:      loc,
    name:     name,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// TODO(jbeda) implement interning of IdentifierNames if necessary.  The C++
// version does so.

// ---------------------------------------------------------------------------

export type CommentKind =
  "CppStyle" |
  "CStyle" |
  "HashStyle";

export interface Comment extends Node {
  // TODO: This Kind/Type part seems wrong, as it does in
  // `ObjectField`.
  readonly type: "CommentNode";
  readonly kind: CommentKind
  readonly text: string
};
export type Comments = im.List<Comment>;

export const isComment = (node: Node): node is Comment => {
  const nodeType: NodeKind = "CommentNode";
  return node.type === nodeType;
}

export const MakeCppComment = (
  loc: error.LocationRange, text: string
): Comment => {
  return {
    type:     "CommentNode",
    loc:      loc,
    freeVars: im.List<IdentifierName>(),
    kind:     "CppStyle",
    text:     text,

    parent: null,
    env: null,
  }
}


// ---------------------------------------------------------------------------

export type CompKind =
  "CompFor" |
  "CompIf";

export interface CompSpec extends Node {
  readonly type:    "CompSpecNode"
  readonly kind:    CompKind
  readonly varName: Identifier | null // null when kind != compSpecFor
  readonly expr:    Node
};
export type CompSpecs = im.List<CompSpec>;

export const isCompSpec = (node: Node): node is CompSpec => {
  const nodeType: NodeKind = "CompSpecNode";
  return node.type === nodeType;
}

export const makeCompSpec = (
  kind: CompKind, varName: Identifier | null, expr: Node,
  loc: error.LocationRange,
): CompSpec => {
  return {
    type:     "CompSpecNode",
    kind:     kind,
    varName:  varName,
    expr:     expr,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
}

// ---------------------------------------------------------------------------

// Apply represents a function call
export interface Apply extends Node {
  readonly type:          "ApplyNode"
  readonly target:        Node
  readonly arguments:     Nodes
  readonly trailingComma: boolean
  readonly tailStrict:    boolean
}

export const isApply = (node: Node): node is Apply => {
  const nodeType: NodeKind = "ApplyNode";
  return node.type === nodeType;
}

export const makeApply = (
  target: Node, args: Nodes, trailingComma: boolean,
  tailStrict: boolean, loc: error.LocationRange,
): Apply => {
  return {
    type:          "ApplyNode",
    target:        target,
    arguments:     args,
    trailingComma: trailingComma,
    tailStrict:    tailStrict,
    loc:           loc,
    freeVars:      im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

export interface ApplyParamAssignment extends Node {
  readonly type:  "ApplyParamAssignmentNode"
  readonly id:    IdentifierName
  readonly right: Node
}
export type ApplyParamAssignments = im.List<ApplyParamAssignment>

export const isApplyParamAssignment = (
  node: Node
): node is ApplyParamAssignment => {
  const nodeType: NodeKind = "ApplyParamAssignmentNode";
  return node.type === nodeType;
};

export const makeApplyParamsAssignment = (
  id: IdentifierName, right: Node, loc: error.LocationRange
): ApplyParamAssignment => {
  return {
    type:     "ApplyParamAssignmentNode",
    id:       id,
    right:    right,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// ApplyBrace represents e { }.  Desugared to e + { }.
export interface ApplyBrace extends Node {
  readonly type:  "ApplyBraceNode"
  readonly left:  Node
  readonly right: Node
}

export const isApplyBrace = (node: Node): node is ApplyBrace => {
  const nodeType: NodeKind = "ApplyBraceNode";
  return node.type === nodeType;
}

export const makeApplyBrace = (
  left: Node, right: Node, loc: error.LocationRange
): ApplyBrace => {
  return {
    type:     "ApplyBraceNode",
    left:     left,
    right:    right,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Array represents array constructors [1, 2, 3].
export interface Array extends Node {
  readonly type:            "ArrayNode"
  readonly elements:        Nodes
  readonly trailingComma:   boolean
  readonly headingComment:  Comment | null
  readonly trailingComment: Comment | null
}

export const isArray = (node: Node): node is Array => {
  const nodeType: NodeKind = "ArrayNode";
  return node.type === nodeType;
}

export const makeArray = (
  elements: Nodes, trailingComma: boolean, headingComment: Comment | null,
  trailingComment: Comment | null, loc: error.LocationRange,
): Array => {
  return {
    type:            "ArrayNode",
    loc:             loc,
    elements:        elements,
    trailingComma:   trailingComma,
    headingComment:  headingComment,
    trailingComment: trailingComment,
    freeVars:        im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// ArrayComp represents array comprehensions (which are like Python list
// comprehensions)
export interface ArrayComp extends Node {
  readonly type:          "ArrayCompNode"
  readonly body:          Node
  readonly trailingComma: boolean
  readonly specs:         CompSpecs
}

export const isArrayComp = (node: Node): node is ArrayComp => {
  const nodeType: NodeKind = "ArrayCompNode";
  return node.type === nodeType;
}

export const makeArrayComp = (
  body: Node, trailingComma: boolean, specs: CompSpecs,
  loc: error.LocationRange,
): ArrayComp => {
  return {
    type:          "ArrayCompNode",
    body:          body,
    trailingComma: trailingComma,
    specs:         specs,
    loc:           loc,
    freeVars:      im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Assert represents an assert expression (not an object-level assert).
//
// After parsing, message can be nil indicating that no message was
// specified. This AST is elimiated by desugaring.
export interface Assert extends Node {
  readonly type:    "AssertNode"
  readonly cond:    Node
  readonly message: Node | null
  readonly rest:    Node
}

export const isAssert = (node: Node): node is Assert => {
  const nodeType: NodeKind = "AssertNode";
  return node.type === nodeType;
}

export const makeAssert = (
  cond: Node, message: Node | null, rest: Node,
  loc: error.LocationRange,
): Assert => {
  return {
    type:     "AssertNode",
    cond:     cond,
    message:  message,
    rest:     rest,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

export type BinaryOp =
  "BopMult" |
  "BopDiv" |
  "BopPercent" |

  "BopPlus" |
  "BopMinus" |

  "BopShiftL" |
  "BopShiftR" |

  "BopGreater" |
  "BopGreaterEq" |
  "BopLess" |
  "BopLessEq" |

  "BopManifestEqual" |
  "BopManifestUnequal" |

  "BopBitwiseAnd" |
  "BopBitwiseXor" |
  "BopBitwiseOr" |

  "BopAnd" |
  "BopOr";

const BopStrings = {
  BopMult:    "*",
  BopDiv:     "/",
  BopPercent: "%",

  BopPlus:  "+",
  BopMinus: "-",

  BopShiftL: "<<",
  BopShiftR: ">>",

  BopGreater:   ">",
  BopGreaterEq: ">=",
  BopLess:      "<",
  BopLessEq:    "<=",

  BopManifestEqual:   "==",
  BopManifestUnequal: "!=",

  BopBitwiseAnd: "&",
  BopBitwiseXor: "^",
  BopBitwiseOr:  "|",

  BopAnd: "&&",
  BopOr:  "||",
};

export const BopMap = im.Map<string, BinaryOp>({
  "*": "BopMult",
  "/": "BopDiv",
  "%": "BopPercent",

  "+": "BopPlus",
  "-": "BopMinus",

  "<<": "BopShiftL",
  ">>": "BopShiftR",

  ">":  "BopGreater",
  ">=": "BopGreaterEq",
  "<":  "BopLess",
  "<=": "BopLessEq",

  "==": "BopManifestEqual",
  "!=": "BopManifestUnequal",

  "&": "BopBitwiseAnd",
  "^": "BopBitwiseXor",
  "|": "BopBitwiseOr",

  "&&": "BopAnd",
  "||": "BopOr",
});

// Binary represents binary operators.
export interface Binary extends Node {
  readonly type:  "BinaryNode"
  readonly left:  Node
  readonly op:    BinaryOp
  readonly right: Node
}

export const isBinary = (node: Node): node is Binary => {
  const nodeType: NodeKind = "BinaryNode";
  return node.type === nodeType;
}

export const makeBinary = (
  left: Node, op: BinaryOp, right: Node, loc: error.LocationRange,
): Binary => {
  return {
    type:     "BinaryNode",
    left:     left,
    op:       op,
    right:    right,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Builtin represents built-in functions.
//
// There is no parse rule to build this AST.  Instead, it is used to build the
// std object in the interpreter.
export interface Builtin extends Node {
  readonly type:   "BuiltinNode"
  readonly id:     number
  readonly params: IdentifierNames
}

export const isBuiltin = (node: Node): node is Builtin => {
  const nodeType: NodeKind = "BuiltinNode";
  return node.type === nodeType;
}

// ---------------------------------------------------------------------------

// Conditional represents if/then/else.
//
// After parsing, branchFalse can be nil indicating that no else branch
// was specified.  The desugarer fills this in with a LiteralNull
export interface Conditional extends Node {
  readonly type:        "ConditionalNode"
  readonly cond:        Node
  readonly branchTrue:  Node
  readonly branchFalse: Node | null
}

export const isConditional = (node: Node): node is Conditional => {
  const nodeType: NodeKind = "ConditionalNode";
  return node.type === nodeType;
}

export const makeConditional = (
  cond: Node, branchTrue: Node, branchFalse: Node | null,
  loc: error.LocationRange,
): Conditional => {
  return {
    type:        "ConditionalNode",
    cond:        cond,
    branchTrue:  branchTrue,
    branchFalse: branchFalse,
    loc:         loc,
    freeVars:    im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Dollar represents the $ keyword
export interface Dollar extends Node { readonly type: "DollarNode" };

export const isDollar = (node: Node): node is Dollar => {
  const nodeType: NodeKind = "DollarNode";
  return node.type === nodeType;
}

export const makeDollar = (loc: error.LocationRange): Dollar => {
  return {
    type:     "DollarNode",
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  };
};

// ---------------------------------------------------------------------------

// Error represents the error e.
export interface Error extends Node {
  readonly type: "ErrorNode"
  readonly expr: Node
}

export const isError = (node: Node): node is Error => {
  const nodeType: NodeKind = "ErrorNode";
  return node.type === nodeType;
}

export const makeError = (expr: Node, loc: error.LocationRange): Error => {
  return {
    type:     "ErrorNode",
    expr:     expr,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Function represents a function call. (jbeda: or is it function defn?)
export interface Function extends Node {
  readonly type:            "FunctionNode"
  readonly parameters:      FunctionParams
  readonly trailingComma:   boolean
  readonly body:            Node
  readonly headingComment:  Comments
  readonly trailingComment: Comments
}

export const isFunction = (node: Node): node is Function => {
  const nodeType: NodeKind = "FunctionNode";
  return node.type === nodeType;
}

export interface FunctionParam extends Node {
  readonly type:         "FunctionParamNode"
  readonly id:           IdentifierName
  readonly defaultValue: Node | null
}
export type FunctionParams = im.List<FunctionParam>

export const isFunctionParam = (node: Node): node is FunctionParam => {
  const nodeType: NodeKind = "FunctionParamNode";
  return node.type === nodeType;
}

export const makeFunctionParam = (
  id: IdentifierName, loc: error.LocationRange,
  defaultValue: Node | null = null,
): FunctionParam => {
  return {
    type:         "FunctionParamNode",
    id:           id,
    loc:          loc,
    defaultValue: defaultValue,
    freeVars:     im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Import represents import "file".
export interface Import extends Node {
  readonly type: "ImportNode"
  readonly file: string
}

export const isImport = (node: Node): node is Import => {
  const nodeType: NodeKind = "ImportNode";
  return node.type === nodeType;
}

export const makeImport = (file: string, loc: error.LocationRange): Import => {
  return {
    type:     "ImportNode",
    file:     file,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// ImportStr represents importstr "file".
export interface ImportStr extends Node {
  readonly type: "ImportStrNode"
  readonly file: string
}

export const isImportStr = (node: Node): node is ImportStr => {
  const nodeType: NodeKind = "ImportStrNode";
  return node.type === nodeType;
}

export const makeImportStr = (
  file: string, loc: error.LocationRange
): ImportStr => {
  return {
    type:     "ImportStrNode",
    file:     file,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Index represents both e[e] and the syntax sugar e.f.
//
// One of index and id will be nil before desugaring.  After desugaring id
// will be nil.
export interface Index extends Node {
  readonly type:   "IndexNode"
  readonly target: Node
  readonly index:  Node | null
  readonly id:     Identifier | null
}

export const isIndex = (node: Node): node is Index => {
  const nodeType: NodeKind = "IndexNode";
  return node.type === nodeType;
}

export const makeIndex = (
  target: Node, index: Node | null, id: Identifier | null,
  loc: error.LocationRange,
): Index => {
  return {
    type:     "IndexNode",
    target:   target,
    index:    index,
    id:       id,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// LocalBind is a helper struct for Local
export interface LocalBind {
  readonly variable:      Identifier
  readonly body:          Node
  readonly functionSugar: boolean
  readonly params:        FunctionParams // if functionSugar is true
  readonly trailingComma: boolean
}
export type LocalBinds = im.List<LocalBind>

export const makeLocalBind = (
  variable: Identifier, body: Node, functionSugar: boolean,
  params: FunctionParams, trailingComma: boolean,
): LocalBind => {
  return {
    variable:      variable,
    body:          body,
    functionSugar: functionSugar,
    params:        params, // if functionSugar is true
    trailingComma: trailingComma,
  }
};

// Local represents local x = e; e.  After desugaring, functionSugar is false.
export interface Local extends Node {
  readonly type:  "LocalNode"
  readonly binds: LocalBinds
  readonly body:  Node
}

export const isLocal = (node: Node): node is Local => {
  const nodeType: NodeKind = "LocalNode";
  return node.type === nodeType;
}

export const makeLocal = (
  binds: LocalBinds, body: Node, loc: error.LocationRange
): Local => {
  return {
    type:     "LocalNode",
    binds:    binds,
    body:     body,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// LiteralBoolean represents true and false
export interface LiteralBoolean extends Node {
  readonly type: "LiteralBooleanNode"
  readonly value: boolean
}

export const isLiteralBoolean = (node: Node): node is LiteralBoolean => {
  const nodeType: NodeKind = "LiteralBooleanNode";
  return node.type === nodeType;
}

export const makeLiteralBoolean = (
  value: boolean, loc: error.LocationRange
): LiteralBoolean => {
  return {
    type:     "LiteralBooleanNode",
    value:    value,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// LiteralNull represents the null keyword
export interface LiteralNull extends Node { readonly type: "LiteralNullNode" }

export const isLiteralNull = (node: Node): node is LiteralNull => {
  const nodeType: NodeKind = "LiteralNullNode";
  return node.type === nodeType;
}

export const makeLiteralNull = (loc: error.LocationRange): LiteralNull => {
  return {
    type:     "LiteralNullNode",
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  };
};

// ---------------------------------------------------------------------------

// LiteralNumber represents a JSON number
export interface LiteralNumber extends Node {
  readonly type:           "LiteralNumberNode"
  readonly value:          number
  readonly originalString: string
}

export const isLiteralNumber = (node: Node): node is LiteralNumber => {
  const nodeType: NodeKind = "LiteralNumberNode";
  return node.type === nodeType;
}

export const makeLiteralNumber = (
  value: number, originalString: string, loc: error.LocationRange
): LiteralNumber => {
  return {
    type:           "LiteralNumberNode",
    value:          value,
    originalString: originalString,
    loc: loc,
    freeVars:      im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

export type LiteralStringKind =
  "StringSingle" |
  "StringDouble" |
  "StringBlock";

// LiteralString represents a JSON string
export interface LiteralString extends Node {
  readonly type: "LiteralStringNode"
  readonly value:       string
  readonly kind:        LiteralStringKind
  readonly blockIndent: string
}

export const isLiteralString = (node: Node): node is LiteralString => {
  const nodeType: NodeKind = "LiteralStringNode";
  return node.type === nodeType;
}

export const makeLiteralString = (
  value: string, kind: LiteralStringKind, loc: error.LocationRange, blockIndent: string
): LiteralString => {
  return {
    type:        "LiteralStringNode",
    loc:         loc,
    value:       value,
    kind:        kind,
    blockIndent: blockIndent,
    freeVars:    im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};


// ---------------------------------------------------------------------------

export type ObjectFieldKind =
  "ObjectAssert" |    // assert expr2 [: expr3]  where expr3 can be nil
  "ObjectFieldID" |   // id:[:[:]] expr2
  "ObjectFieldExpr" | // '['expr1']':[:[:]] expr2
  "ObjectFieldStr" |  // expr1:[:[:]] expr2
  "ObjectLocal";      // local id = expr2

export type ObjectFieldHide =
  "ObjectFieldHidden" |  // f:: e
  "ObjectFieldInherit" | // f: e
  "ObjectFieldVisible";  // f::: e

export interface ObjectField extends Node {
  readonly type:            "ObjectFieldNode"
  readonly kind:            ObjectFieldKind
  readonly hide:            ObjectFieldHide // (ignore if kind != astObjectField*)
  readonly superSugar:      boolean         // +:  (ignore if kind != astObjectField*)
  readonly methodSugar:     boolean         // f(x, y, z): ...  (ignore if kind  == astObjectAssert)
  readonly expr1:           Node | null     // Not in scope of the object
  readonly id:              Identifier | null
  readonly ids:             FunctionParams  // If methodSugar == true then holds the params.
  readonly trailingComma:   boolean         // If methodSugar == true then remembers the trailing comma
  readonly expr2:           Node | null     // In scope of the object (can see self).
  readonly expr3:           Node | null     // In scope of the object (can see self).
  readonly headingComments: Comments
}

export const isObjectField = (node: Node): node is ObjectField => {
  const nodeType: NodeKind = "ObjectFieldNode";
  return node.type === nodeType;
}

// TODO(jbeda): Add the remaining constructor helpers here

export type ObjectFields = im.List<ObjectField>;

// Object represents object constructors { f: e ... }.
//
// The trailing comma is only allowed if len(fields) > 0.  Converted to
// DesugaredObject during desugaring.
export interface ObjectNode extends Node {
  readonly type:            "ObjectNode"
  readonly fields:          ObjectFields
  readonly trailingComma:   boolean
  readonly headingComments: Comments
}

export const isObjectNode = (node: Node): node is ObjectNode => {
  const nodeType: NodeKind = "ObjectNode";
  return node.type === nodeType;
}

export const makeObject = (
  fields: ObjectFields, trailingComma: boolean,
  headingComments: Comments, loc: error.LocationRange,
): ObjectNode => {
  return {
    type: "ObjectNode",
    loc: loc,
    fields:          fields,
    trailingComma:   trailingComma,
    headingComments: headingComments,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

export interface DesugaredObjectField extends Node {
  readonly type: "DesugaredObjectFieldNode"
  readonly hide: ObjectFieldHide
  readonly name: Node
  readonly body: Node
}
export type DesugaredObjectFields = im.List<DesugaredObjectField>;

// DesugaredObject represents object constructors { f: e ... } after
// desugaring.
//
// The assertions either return true or raise an error.
export interface DesugaredObject extends Node {
  readonly type:    "DesugaredObjectNode"
  readonly asserts: Nodes
  readonly fields:  DesugaredObjectFields
}

export const isDesugaredObject = (node: Node): node is DesugaredObject => {
  const nodeType: NodeKind = "DesugaredObjectNode";
  return node.type === nodeType;
}

// ---------------------------------------------------------------------------

// ObjectComp represents object comprehension
//   { [e]: e for x in e for.. if... }.
export interface ObjectComp extends Node {
  readonly type: "ObjectCompNode"
  readonly fields:        ObjectFields
  readonly trailingComma: boolean
  readonly specs:         CompSpecs
}

export const isObjectComp = (node: Node): node is ObjectComp => {
  const nodeType: NodeKind = "ObjectCompNode";
  return node.type === nodeType;
}

// ---------------------------------------------------------------------------

// ObjectComprehensionSimple represents post-desugaring object
// comprehension { [e]: e for x in e }.
//
// TODO: Rename this to `ObjectCompSimple`
export interface ObjectComprehensionSimple extends Node {
  readonly type: "ObjectComprehensionSimpleNode"
  readonly field: Node
  readonly value: Node
  readonly id:    Identifier
  readonly array: Node
}

export const isObjectComprehensionSimple = (
  node: Node
): node is ObjectComprehensionSimple => {
  const nodeType: NodeKind = "ObjectComprehensionSimpleNode";
  return node.type === nodeType;
}

// ---------------------------------------------------------------------------

// Self represents the self keyword.
export interface Self extends Node { readonly type: "SelfNode" };

export const isSelf = (node: Node): node is Self => {
  const nodeType: NodeKind = "SelfNode";
  return node.type === nodeType;
}

export const makeSelf = (loc: error.LocationRange): Self => {
  return {
    type:     "SelfNode",
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  };
};

// ---------------------------------------------------------------------------

// SuperIndex represents the super[e] and super.f constructs.
//
// Either index or identifier will be set before desugaring.  After desugaring, id will be
// nil.
export interface SuperIndex extends Node {
  readonly type: "SuperIndexNode"
  readonly index: Node | null
  readonly id:    Identifier | null
}

export const isSuperIndex = (node: Node): node is SuperIndex => {
  const nodeType: NodeKind = "SuperIndexNode";
  return node.type === nodeType;
}

export const makeSuperIndex = (
  index: Node | null, id: Identifier | null, loc: error.LocationRange
): SuperIndex => {
  return {
    type:     "SuperIndexNode",
    index:    index,
    id:       id,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

export type UnaryOp =
  "UopNot" |
  "UopBitwiseNot" |
  "UopPlus" |
  "UopMinus";

export const UopStrings = {
  UopNot:        "!",
  UopBitwiseNot: "~",
  UopPlus:       "+",
  UopMinus:      "-",
};

export const UopMap = im.Map<string, UnaryOp>({
  "!": "UopNot",
  "~": "UopBitwiseNot",
  "+": "UopPlus",
  "-": "UopMinus",
});

// Unary represents unary operators.
export interface Unary extends Node {
  readonly type: "UnaryNode"
  readonly op:   UnaryOp
  readonly expr: Node
}

export const isUnary = (node: Node): node is Unary => {
  const nodeType: NodeKind = "UnaryNode";
  return node.type === nodeType;
}

export const makeUnary = (
  op: UnaryOp, expr: Node, loc: error.LocationRange,
): Unary => {
  return {
    type:     "UnaryNode",
    op:       op,
    expr:     expr,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  }
};

// ---------------------------------------------------------------------------

// Var represents variables.
export interface Var extends Node {
  readonly type: "VarNode"
  readonly id: Identifier
}

export const isVar = (node: Node): node is Var => {
  const nodeType: NodeKind = "VarNode";
  return node.type === nodeType;
}

export const makeVar = (id: Identifier, loc: error.LocationRange): Var => {
  return {
    type:     "VarNode",
    id:       id,
    loc:      loc,
    freeVars: im.List<IdentifierName>(),

    parent: null,
    env: null,
  };
};

// ---------------------------------------------------------------------------
