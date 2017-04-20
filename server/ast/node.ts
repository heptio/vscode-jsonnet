'use strict';
import * as immutable from 'immutable';

import * as token from './token';

// TODO: Consider grouping these by `node.*`, `object.*`, and so on.

//
// NOTE: As a design point we implement the AST as a collection of
// interfaces rather than classes. The reason is primarily because
// deserializing JSON object and converting its runtime type to be a
// TypeScript class (`NodeBase`, say) is non-trivial, and this causes
// unexpected behavior when you try to call a method that exists on a
// class.
//
// In particular, annotating a JSON object with a type, (as in
// `<ast.NodeBase>someObj`) will silence the compiler warning, but
// won't change the runtime type. So when you go to call a method on
// this new "casted" value, the method will be missing.
//
// Until we implement deserialization that changes the runtime types,
// these types should all remain interfaces.
//

export type NodeTypes =
  "CommentNode" |
  "CompSpecNode" |
  "ApplyNode" |
  "ApplyBraceNode" |
  "ArrayNode" |
  "ArrayCompNode" |
  "AssertNode" |
  "BinaryNode" |
  "BuiltinNode" |
  "ConditionalNode" |
  "DollarNode" |
  "ErrorNode" |
  "FunctionNode" |
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

export type Environment = immutable.Map<string, LocalBind>;

export const emptyEnvironment = immutable.Map<string, LocalBind>();

export const environmentFromLocal = (local: Local): Environment => {
  const defaultLocal: {[key: string]: LocalBind} = {};
  const binds = local.binds
    .reduce(
      (acc, bind) => {
        acc[bind.variable.name] = bind;
        return acc;
      },
      defaultLocal);
  return immutable.Map(binds);
}

export const renderAsJson = (node: Node): string => {
  return "```\n" + JSON.stringify(
  node,
  (k, v) => {
    if (k === "parent") {
      return (<Node>v).nodeType;
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

export interface Node {
  nodeType: NodeTypes
  parent: Node | null;     // Filled in by the visitor.
  env: Environment | null; // Filled in by the visitor.
};

export interface NodeBase extends Node {
  parent: Node | null;     // Filled in by the visitor.
  env: Environment | null; // Filled in by the visitor.

  nodeType: NodeTypes
  locationRange: token.LocationRange
  freeVariables: IdentifierName[]
};

// ---------------------------------------------------------------------------

export interface Identifier extends NodeBase {
  name: IdentifierName
}

type IdentifierName = string;

// ---------------------------------------------------------------------------

type ObjectFieldKind = "ObjectAssert" | "ObjectFieldID" | "ObjectFieldExpr" |
"ObjectFieldStr" |"ObjectLocal";

export interface ObjectField extends NodeBase {
  kind:            ObjectFieldKind
  // hide             ObjectFieldHide // (ignore if kind != astObjectField*)
  superSugar:      boolean          // +:  (ignore if kind != astObjectField*)
  methodSugar:     boolean          // f(x, y, z): ...  (ignore if kind  == astObjectAssert)
  expr1:           Node | null      // Not in scope of the object
  id:              Identifier | null
  ids:             IdentifierName[] // If methodSugar == true then holds the params.
  trailingComma:   boolean          // If methodSugar == true then remembers the trailing comma
  expr2:           Node | null      // In scope of the object (can see self).
  expr3:           Node | null      // In scope of the object (can see self).
  headingComments: Comment[] | null
};

export interface ObjectNode extends NodeBase {
  fields:          ObjectField[]
  trailingComma:   boolean
  headingComments: Comment[]
};

// ---------------------------------------------------------------------------

export type CommentKind = "CppStyle" | "CStyle" | "HashStyle";

export interface Comment extends NodeBase {
  kind: CommentKind
  text: string
};

// ---------------------------------------------------------------------------

// LocalBind is a helper struct for Local
export interface LocalBind {
  variable:      Identifier
  body:          Node | null
  functionSugar: boolean
  params:        IdentifierName[] // if functionSugar is true
  trailingComma: boolean
}

// Local represents local x = e; e.  After desugaring, functionSugar is false.
export interface Local extends NodeBase {
  binds: LocalBind[]
  body:  Node | null
}

// ---------------------------------------------------------------------------

// Import represents import "file".
export interface Import extends NodeBase {
  file: string
}

// ImportStr represents importstr "file".
export interface ImportStr extends NodeBase {
  file: string
}

// ---------------------------------------------------------------------------

// Index represents both e[e] and the syntax sugar e.f.
//
// One of index and id will be nil before desugaring.  After desugaring id
// will be nil.
export interface Index extends NodeBase {
  target: Node | null
  index:  Node | null
  id:     Identifier | null
}

// ---------------------------------------------------------------------------

// Var represents variables.
export interface Var extends NodeBase {
  id: Identifier
}

// ---------------------------------------------------------------------------

// LiteralNumber represents a JSON number
export interface LiteralNumber extends NodeBase {
  value:          number
  originalString: string
}
