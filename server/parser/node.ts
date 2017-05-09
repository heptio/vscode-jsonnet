'use strict';
import * as im from 'immutable';

import * as error from '../lexer/static_error';

// ---------------------------------------------------------------------------

export type Environment = im.Map<string, LocalBind | FunctionParam>;

export const emptyEnvironment = im.Map<string, LocalBind | FunctionParam>();

export const envFromLocalBinds = (
  local: Local | ObjectField | FunctionParam
): Environment => {
  if (isLocal(local)) {
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
  } else if (isObjectField(local)) {
    if (local.expr2 == null || local.id == null) {
      throw new Error(`INTERNAL ERROR: Object local fields can't have a null expr2 or id field`);
    }

    const bind: LocalBind = {
      variable:      local.id,
      body:          local.expr2,
      functionSugar: local.methodSugar,
      params:        local.ids,
      trailingComma: local.trailingComma,
    };
    return im.Map<string, LocalBind>().set(local.id.name, bind);
  }

  // Else, it's a `FunctionParam`, i.e., a free parameter (or a free
  // parameter with a default value). Either way, emit that.
  return im.Map<string, LocalBind | FunctionParam>().set(local.id, local);
}

export const envFromParams = (
  params: FunctionParams
): Environment => {
  return params
    .reduce(
      (acc: Environment, field: FunctionParam) => {
        return acc.merge(envFromLocalBinds(field));
      },
      emptyEnvironment
    );
}

export const envFromFields = (
  fields: ObjectFields,
): Environment => {
  return fields
    .filter((field: ObjectField) => {
      const localKind: ObjectFieldKind = "ObjectLocal";
      return field.kind === localKind;
    })
    .reduce(
      (acc: Environment, field: ObjectField) => {
        return acc.merge(envFromLocalBinds(field));
      },
      emptyEnvironment
    );
}

export const renderAsJson = (node: Node): string => {
  return "```\n" + JSON.stringify(
  node,
  (k, v) => {
    if (k === "parent") {
      return v == null
        ? "null"
        : (<Node>v).type;
    } else if (k === "env") {
      return v == null
        ? "null"
        : `${Object.keys(v).join(", ")}`;
    } else if (k === "rootObject") {
      return v == null
        ? "null"
        : (<Node>v).type;
    } else {
      return v;
    }
  },
  "  ") + "\n```";
}

// ---------------------------------------------------------------------------

// NodeKind captures the type of the node. Implementing this as a
// union of specific strings allows us to `switch` on node type.
// Additionally, specific nodes can specialize and restrict the `type`
// field to be something like `type: "ObjectNode" = "ObjectNode"`,
// which will cause a type error if something tries to instantiate on
// `ObjectNode` with a `type` that is not this specific string.
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
  readonly type:     NodeKind
  readonly loc:      error.LocationRange

  prettyPrint(): string

  rootObject: Node | null;
  parent: Node | null;     // Filled in by the visitor.
  env: Environment | null; // Filled in by the visitor.
}
export type Nodes = im.List<Node>

// NodeBase is a simple abstract base class that makes sure we're
// initializing the parent and env members to null. It is not exposed
// to the public because it is meant to be a transparent base blass
// for all `Node` implementations.
abstract class NodeBase implements Node {
  readonly type:     NodeKind
  readonly loc:      error.LocationRange

  constructor() {
    this.rootObject = null;
    this.parent = null;
    this.env = null;
  }

  abstract prettyPrint;

  rootObject: Node | null;
  parent: Node | null;     // Filled in by the visitor.
  env: Environment | null; // Filled in by the visitor.
}

// ---------------------------------------------------------------------------

// IdentifierName represents a variable / parameter / field name.
//+gen set
export type IdentifierName = string
export type IdentifierNames = im.List<IdentifierName>
export type IdentifierSet = im.Set<IdentifierName>;

export class Identifier extends NodeBase {
  readonly type: "IdentifierNode" = "IdentifierNode";

  constructor(
    readonly name: IdentifierName,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return this.name;
  }
}

export const isIdentifier = (node: Node): node is Identifier => {
  return node instanceof Identifier;
}

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

export class CppComment extends NodeBase implements Comment {
  readonly type: "CommentNode" = "CommentNode";
  readonly kind: "CppStyle"    = "CppStyle";

  constructor(
    readonly text: string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return this.text;
  }
}

export const isCppComment = (node: Node): node is Identifier => {
  return node instanceof CppComment;
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

export class CompSpecIf extends NodeBase implements CompSpec {
  readonly type:    "CompSpecNode" = "CompSpecNode";
  readonly kind:    "CompIf"       = "CompIf";
  readonly varName: Identifier | null = null // null when kind != compSpecFor

  constructor(
    readonly expr: Node,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `if ${this.expr.prettyPrint()}`;
  }
}

export const isCompSpecIf = (node: Node): node is CompSpec => {
  return node instanceof CompSpecIf;
}

export class CompSpecFor extends NodeBase implements CompSpec {
  readonly type:    "CompSpecNode" = "CompSpecNode";
  readonly kind:    "CompFor"      = "CompFor";

  constructor(
    readonly varName: Identifier, // null for `CompSpecIf`
    readonly expr:    Node,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `for ${this.varName.prettyPrint()} in ${this.expr.prettyPrint()}`;
  }
}

export const isCompSpecFor = (node: Node): node is CompSpec => {
  return node instanceof CompSpecFor;
}

// ---------------------------------------------------------------------------

// Apply represents a function call
export class Apply extends NodeBase  {
  readonly type: "ApplyNode" = "ApplyNode";

  constructor(
    readonly target:        Node,
    readonly args:          Nodes,
    readonly trailingComma: boolean,
    readonly tailStrict:    boolean,
    readonly loc:           error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const argsString = this.args
      .map((arg: Node) => arg.prettyPrint())
      .join(", ");

    // NOTE: Space between `tailstrict` is important.
    const tailStrictString = this.tailStrict
      ? " tailstrict"
      : "";

    return `${this.target.prettyPrint()}(${argsString}${tailStrictString})`;
  }
}

export const isApply = (node: Node): node is Apply => {
  return node instanceof Apply;
}

export class ApplyParamAssignment extends NodeBase {
  readonly type: "ApplyParamAssignmentNode" = "ApplyParamAssignmentNode";

  constructor(
    readonly id:    IdentifierName,
    readonly right: Node,
    readonly loc:   error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.id}=${this.right.prettyPrint()}`;
  }
}
export type ApplyParamAssignments = im.List<ApplyParamAssignment>

export const isApplyParamAssignment = (
  node: Node
): node is ApplyParamAssignment => {
  return node instanceof ApplyParamAssignment;
};

// ---------------------------------------------------------------------------

// ApplyBrace represents e { }.  Desugared to e + { }.
export class ApplyBrace extends NodeBase {
  readonly type: "ApplyBraceNode" = "ApplyBraceNode";

  constructor(
    readonly left:  Node,
    readonly right: Node,
    readonly loc:   error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.left.prettyPrint()} ${this.right.prettyPrint()}`;
  }
}

export const isApplyBrace = (node: Node): node is ApplyBrace => {
  return node instanceof ApplyBrace;
}

// ---------------------------------------------------------------------------

// Array represents array constructors [1, 2, 3].
export class Array extends NodeBase {
  readonly type: "ArrayNode" = "ArrayNode";

  constructor(
    readonly elements:        Nodes,
    readonly trailingComma:   boolean,
    readonly headingComment:  Comment | null,
    readonly trailingComment: Comment | null,
    readonly loc:             error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const elementsString = this.elements
      .map((element: Node) => element.prettyPrint())
      .join(", ");
    return `[${elementsString}]`;
  }
}

export const isArray = (node: Node): node is Array => {
  return node instanceof Array;
}

// ---------------------------------------------------------------------------

// ArrayComp represents array comprehensions (which are like Python list
// comprehensions)
export class ArrayComp extends NodeBase {
  readonly type: "ArrayCompNode" = "ArrayCompNode";

  constructor(
    readonly body:          Node,
    readonly trailingComma: boolean,
    readonly specs:         CompSpecs,
    readonly loc:           error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const specsString = this.specs
      .map((spec: CompSpec) => spec.prettyPrint())
      .join(", ");
    return `[${specsString} ${this.body.prettyPrint()}]`;
  }
}

export const isArrayComp = (node: Node): node is ArrayComp => {
  return node instanceof ArrayComp;
}

// ---------------------------------------------------------------------------

// Assert represents an assert expression (not an object-level assert).
//
// After parsing, message can be nil indicating that no message was
// specified. This AST is elimiated by desugaring.
export class Assert extends NodeBase {
  readonly type: "AssertNode" = "AssertNode";

  constructor(
    readonly cond:    Node,
    readonly message: Node | null,
    readonly rest:    Node,
    readonly loc:     error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `assert ${this.cond.prettyPrint()}`;
  }
}

export const isAssert = (node: Node): node is Assert => {
  return node instanceof Assert;
}

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
export class Binary extends NodeBase {
  readonly type: "BinaryNode" = "BinaryNode";

  constructor(
    readonly left:  Node,
    readonly op:    BinaryOp,
    readonly right: Node,
    readonly loc:     error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const leftString = this.left.prettyPrint();
    const opString = BopStrings[this.op];
    const rightString = this.right.prettyPrint();
    return `${leftString} ${opString} ${rightString}`;
  }
}

export const isBinary = (node: Node): node is Binary => {
  return node instanceof Binary;
}

// ---------------------------------------------------------------------------

// Builtin represents built-in functions.
//
// There is no parse rule to build this AST.  Instead, it is used to build the
// std object in the interpreter.
export class Builtin extends NodeBase {
  readonly type: "BuiltinNode" = "BuiltinNode";

  constructor(
    readonly id:     number,
    readonly params: IdentifierNames,
    readonly loc:    error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const paramsString = this.params.join(", ");
    return `std.${this.id}(${paramsString})`;
  }
}

export const isBuiltin = (node: Node): node is Builtin => {
  return node instanceof Builtin;
}

// ---------------------------------------------------------------------------

// Conditional represents if/then/else.
//
// After parsing, branchFalse can be nil indicating that no else branch
// was specified.  The desugarer fills this in with a LiteralNull
export class Conditional extends NodeBase {
  readonly type: "ConditionalNode" = "ConditionalNode";

  constructor(
    readonly cond:        Node,
    readonly branchTrue:  Node,
    readonly branchFalse: Node | null,
    readonly loc:    error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const trueClause = `then ${this.branchTrue.prettyPrint()}`;
    const falseClause = this.branchFalse == null
      ? ""
      : `else ${this.branchFalse.prettyPrint()}`;
    return `if ${this.cond.prettyPrint()} ${trueClause} ${falseClause}`;
  }
}

export const isConditional = (node: Node): node is Conditional => {
  return node instanceof Conditional;
}

// ---------------------------------------------------------------------------

// Dollar represents the $ keyword
export class Dollar extends NodeBase {
  readonly type: "DollarNode" = "DollarNode";

  constructor(
    readonly loc:    error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `$`;
  }
};

export const isDollar = (node: Node): node is Dollar => {
  return node instanceof Dollar;
}

// ---------------------------------------------------------------------------

// Error represents the error e.
export class ErrorNode extends NodeBase {
  readonly type: "ErrorNode" = "ErrorNode";

  constructor(
    readonly expr: Node,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `error ${this.expr.prettyPrint()}`;
  }
}

export const isError = (node: Node): node is ErrorNode => {
  return node instanceof ErrorNode;
}

// ---------------------------------------------------------------------------

// Function represents a function call. (jbeda: or is it function defn?)
export class Function extends NodeBase {
  readonly type: "FunctionNode" = "FunctionNode";

  constructor(
    readonly parameters:      FunctionParams,
    readonly trailingComma:   boolean,
    readonly body:            Node,
    readonly headingComment:  Comments,
    readonly trailingComment: Comments,
    readonly loc:             error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const params = this.parameters
      .map((param: FunctionParam) => param.prettyPrint())
      .join(", ");
    return `function (${params}) ${this.body.prettyPrint()}`;
  }
}

export const isFunction = (node: Node): node is Function => {
  return node instanceof Function;
}

export class FunctionParam extends NodeBase {
  readonly type: "FunctionParamNode" = "FunctionParamNode";

  constructor(
    readonly id:           IdentifierName,
    readonly defaultValue: Node | null,
    readonly loc:             error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const defaultValueString = this.defaultValue == null
      ? ""
      : `=${this.defaultValue.prettyPrint()}`;
    return `(parameter) ${this.id}${defaultValueString}`;
  }
}
export type FunctionParams = im.List<FunctionParam>

export const isFunctionParam = (node: any): node is FunctionParam => {
  return node instanceof FunctionParam;
}

// ---------------------------------------------------------------------------

// Import represents import "file".
export class Import extends NodeBase {
  readonly type: "ImportNode" = "ImportNode";

  constructor(
    readonly file: string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `import "${this.file}"`;
  }
}

export const isImport = (node: Node): node is Import => {
  return node instanceof Import;
}

// ---------------------------------------------------------------------------

// ImportStr represents importstr "file".
export class ImportStr extends NodeBase {
  readonly type: "ImportStrNode" = "ImportStrNode";

  constructor(
    readonly file: string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `importstr "${this.file}"`;
  }
}

export const isImportStr = (node: Node): node is ImportStr => {
  return node instanceof ImportStr;
}

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

export class IndexSubscript extends NodeBase implements Index {
  readonly type: "IndexNode"        = "IndexNode";
  readonly id:    Identifier | null = null;

  constructor(
    readonly target: Node,
    readonly index:  Node,
    readonly loc:    error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.target.prettyPrint()}[${this.index.prettyPrint()}]`;
  }
}

export const isIndexSubscript = (node: Node): node is Index => {
  return node instanceof IndexSubscript;
}

export class IndexDot extends NodeBase implements Index {
  readonly type:  "IndexNode" = "IndexNode";
  readonly index: Node | null = null;

  constructor(
    readonly target: Node,
    readonly id:     Identifier,
    readonly loc:    error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.target.prettyPrint()}.${this.id.prettyPrint()}`;
  }
}

export const isIndexDot = (node: Node): node is Index => {
  return node instanceof IndexDot;
}

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
export class Local extends NodeBase {
  readonly type: "LocalNode" = "LocalNode";

  constructor(
    readonly binds: LocalBinds,
    readonly body:  Node,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const bindsString = this.binds
      .map((bind: LocalBind) => {
        const idString = bind.variable.prettyPrint();
        if (bind.functionSugar) {
          const paramsString = bind.params
            .map((param: FunctionParam) => param.id)
            .join(", ");
          return `${idString}(${paramsString})`;
        }
        return `${idString} = ${bind.body.prettyPrint()}`;
      })
      .join(",\n  ");

    return `local ${bindsString}`;
  }
}

export const isLocal = (node: Node): node is Local => {
  return node instanceof Local;
}

// ---------------------------------------------------------------------------

// LiteralBoolean represents true and false
export class LiteralBoolean extends NodeBase {
  readonly type: "LiteralBooleanNode" = "LiteralBooleanNode";

  constructor(
    readonly value: boolean,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.value}`;
  }
}

export const isLiteralBoolean = (node: Node): node is LiteralBoolean => {
  return node instanceof LiteralBoolean;
}

// ---------------------------------------------------------------------------

// LiteralNull represents the null keyword
export class LiteralNull extends NodeBase {
  readonly type: "LiteralNullNode" = "LiteralNullNode";

  constructor(
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `null`;
  }
}

export const isLiteralNull = (node: Node): node is LiteralNull => {
  return node instanceof LiteralNull;
}

// ---------------------------------------------------------------------------

// LiteralNumber represents a JSON number
export class LiteralNumber extends NodeBase {
  readonly type: "LiteralNumberNode" = "LiteralNumberNode";

  constructor(
    readonly value:          number,
    readonly originalString: string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${this.originalString}`;
  }
}

export const isLiteralNumber = (node: Node): node is LiteralNumber => {
  return node instanceof LiteralNumber;
}

// ---------------------------------------------------------------------------

export type LiteralStringKind =
  "StringSingle" |
  "StringDouble" |
  "StringBlock";

// LiteralString represents a JSON string
export interface LiteralString extends Node {
  readonly type:        "LiteralStringNode"
  readonly value:       string
  readonly kind:        LiteralStringKind
  readonly blockIndent: string
}

export const isLiteralString = (node: Node): node is LiteralString => {
  const nodeType: NodeKind = "LiteralStringNode";
  return node.type === nodeType;
}

export class LiteralStringSingle extends NodeBase implements LiteralString {
  readonly type:        "LiteralStringNode" = "LiteralStringNode";
  readonly kind:        "StringSingle"      = "StringSingle";
  readonly blockIndent: ""                  = "";

  constructor(
    readonly value:       string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `'${this.value}'`;
  }
}

export const isLiteralStringSingle = (
  node: Node
): node is LiteralStringSingle => {
  return node instanceof LiteralStringSingle;
}

export class LiteralStringDouble extends NodeBase implements LiteralString {
  readonly type:        "LiteralStringNode" = "LiteralStringNode";
  readonly kind:        "StringDouble"      = "StringDouble";
  readonly blockIndent: ""                  = "";

  constructor(
    readonly value:       string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `"${this.value}"`;
  }
}

export const isLiteralStringDouble = (node: Node): node is LiteralString => {
  return node instanceof LiteralStringDouble;
}

export class LiteralStringBlock extends NodeBase implements LiteralString {
  readonly type: "LiteralStringNode" = "LiteralStringNode";
  readonly kind: "StringBlock"       = "StringBlock";

  constructor(
    readonly value:       string,
    readonly blockIndent: string,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `|||${this.value}|||`;
  }
}

export const isLiteralStringBlock = (node: Node): node is LiteralStringBlock => {
  return node instanceof LiteralStringBlock;
}

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

const objectFieldHideStrings = im.Map<ObjectFieldHide, string>({
  "ObjectFieldHidden": "::",
  "ObjectFieldInherit": ":",
  "ObjectFieldVisible": ":::",
});

// export interface ObjectField extends NodeBase {
//   readonly type:            "ObjectFieldNode"
//   readonly kind:            ObjectFieldKind
//   readonly hide:            ObjectFieldHide // (ignore if kind != astObjectField*)
//   readonly superSugar:      boolean         // +:  (ignore if kind != astObjectField*)
//   readonly methodSugar:     boolean         // f(x, y, z): ...  (ignore if kind  == astObjectAssert)
//   readonly expr1:           Node | null     // Not in scope of the object
//   readonly id:              Identifier | null
//   readonly ids:             FunctionParams  // If methodSugar == true then holds the params.
//   readonly trailingComma:   boolean         // If methodSugar == true then remembers the trailing comma
//   readonly expr2:           Node | null     // In scope of the object (can see self).
//   readonly expr3:           Node | null     // In scope of the object (can see self).
//   readonly headingComments: Comments
// }

export class ObjectField extends NodeBase {
  readonly type: "ObjectFieldNode" = "ObjectFieldNode";

  constructor(
    readonly kind:            ObjectFieldKind,
    readonly hide:            ObjectFieldHide, // (ignore if kind != astObjectField*)
    readonly superSugar:      boolean,         // +:  (ignore if kind != astObjectField*)
    readonly methodSugar:     boolean,         // f(x, y, z): ...  (ignore if kind  == astObjectAssert)
    readonly expr1:           Node | null,     // Not in scope of the object
    readonly id:              Identifier | null,
    readonly ids:             FunctionParams,  // If methodSugar == true then holds the params.
    readonly trailingComma:   boolean,         // If methodSugar == true then remembers the trailing comma
    readonly expr2:           Node | null,     // In scope of the object (can see self).
    readonly expr3:           Node | null,     // In scope of the object (can see self).
    readonly headingComments: Comments,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    switch (this.kind) {
      case "ObjectAssert": return prettyPrintObjectAssert(this);
      case "ObjectFieldID": return prettyPrintObjectFieldId(this);
      case "ObjectLocal": return prettyPrintObjectLocal(this);
      case "ObjectFieldExpr":
      case "ObjectFieldStr":
      default: throw new Error(`INTERNAL ERROR: Unrecognized object field kind '${this.kind}':\n${renderAsJson(this)}`);
    }
  }
}

export const isObjectField = (node: Node): node is ObjectField => {
  return node instanceof ObjectField;
}

const prettyPrintObjectAssert = (field: ObjectField): string => {
    if (field.expr2 == null) {
      throw new Error(`INTERNAL ERROR: object 'assert' must have expression to assert:\n${renderAsJson(field)}`);
    }
    return field.expr3 == null
      ? `assert ${field.expr2.prettyPrint()}`
      : `assert ${field.expr2.prettyPrint()} : ${field.expr3.prettyPrint()}`;
}

const prettyPrintObjectFieldId = (field: ObjectField): string => {
  if (field.id == null) {
    throw new Error(`INTERNAL ERROR: object field must have id:\n${renderAsJson(field)}`);
  }
  const idString = field.id.prettyPrint();
  const hide = objectFieldHideStrings.get(field.hide);

  if (field.methodSugar) {
    const argsList = field.ids
      .map((param: FunctionParam) => param.id)
      .join(", ");
    return `(method) ${idString}(${argsList})${hide}`;
  }
  return `(field) ${idString}${hide}`;
}

const prettyPrintObjectLocal = (field: ObjectField): string => {
  if (field.id == null) {
    throw new Error(`INTERNAL ERROR: object field must have id:\n${renderAsJson(field)}`);
  }
  const idString = field.id.prettyPrint();

  if (field.methodSugar) {
    const argsList = field.ids
      .map((param: FunctionParam) => param.id)
      .join(", ");
    return `(method) local ${idString}(${argsList})`;
  }
  return `(field) local ${idString}`;
}

// TODO(jbeda): Add the remaining constructor helpers here

export type ObjectFields = im.List<ObjectField>;

// ---------------------------------------------------------------------------

// Object represents object constructors { f: e ... }.
//
// The trailing comma is only allowed if len(fields) > 0.  Converted to
// DesugaredObject during desugaring.
export class ObjectNode extends NodeBase {
  readonly type: "ObjectNode" = "ObjectNode";

  constructor(
    readonly fields:          ObjectFields,
    readonly trailingComma:   boolean,
    readonly headingComments: Comments,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    const fields = this.fields
      .filter((field: ObjectField) => field.kind === "ObjectFieldID")
      .map((field: ObjectField) => `  ${field.prettyPrint()}`)
      .join(",\n");

    return `(module) {\n${fields}\n}`;
  }
}

export const isObjectNode = (node: Node): node is ObjectNode => {
  return node instanceof ObjectNode;
}

// ---------------------------------------------------------------------------

export interface DesugaredObjectField extends NodeBase {
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
export interface DesugaredObject extends NodeBase {
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
// export interface ObjectComp extends NodeBase {
//   readonly type: "ObjectCompNode"
//   readonly fields:        ObjectFields
//   readonly trailingComma: boolean
//   readonly specs:         CompSpecs
// }

export class ObjectComp extends NodeBase {
  readonly type: "ObjectCompNode" = "ObjectCompNode";

  constructor(
    readonly fields:        ObjectFields,
    readonly trailingComma: boolean,
    readonly specs:         CompSpecs,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `[OBJECT COMP]`
  }
}

export const isObjectComp = (node: Node): node is ObjectComp => {
  return node instanceof ObjectComp;
}

// ---------------------------------------------------------------------------

// ObjectComprehensionSimple represents post-desugaring object
// comprehension { [e]: e for x in e }.
//
// TODO: Rename this to `ObjectCompSimple`
export interface ObjectComprehensionSimple extends NodeBase {
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
export class Self extends NodeBase {
  readonly type: "SelfNode" = "SelfNode";

  constructor(
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `self`;
  }
};

export const isSelf = (node: Node): node is Self => {
  return node instanceof Self;
}

// ---------------------------------------------------------------------------

// SuperIndex represents the super[e] and super.f constructs.
//
// Either index or identifier will be set before desugaring.  After desugaring, id will be
// nil.
export class SuperIndex extends NodeBase {
  readonly type: "SuperIndexNode" = "SuperIndexNode";

  constructor(
    readonly index: Node | null,
    readonly id:    Identifier | null,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    if (this.id != null) {
      return `super.${this.id.prettyPrint()}`;
    } else if (this.index != null) {
      return `super[${this.index.prettyPrint()}]`
    }
    throw new Error(`INTERNAL ERROR: Can't pretty-print super index if both 'id' and 'index' fields are null`);
  }
}

export const isSuperIndex = (node: Node): node is SuperIndex => {
  return node instanceof SuperIndex;
}

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
export class Unary extends NodeBase {
  readonly type: "UnaryNode" = "UnaryNode";

  constructor(
    readonly op:   UnaryOp,
    readonly expr: Node,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return `${UopStrings[this.op]}${this.expr.prettyPrint()}`;
  }
}

export const isUnary = (node: Node): node is Unary => {
  return node instanceof Unary;
}

// ---------------------------------------------------------------------------

// Var represents variables.
export class Var extends NodeBase {
  readonly type: "VarNode" = "VarNode";

  constructor(
    readonly id: Identifier,
    readonly loc:  error.LocationRange,
  ) { super(); }

  public prettyPrint = (): string => {
    return this.id.prettyPrint();
  }
}

export const isVar = (node: Node): node is Var => {
  return node instanceof Var;
}

// ---------------------------------------------------------------------------
