'use strict';

// TODO: Consider grouping these by `node.*`, `object.*`, and so on.

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

export interface Node {
  nodeType: NodeTypes
};

export class NodeBase implements Node {
  nodeType: NodeTypes
  locationRange: LocationRange
  freeVariables: Identifier[]
};

// ---------------------------------------------------------------------------

type Identifier = string;

// ---------------------------------------------------------------------------

export class Location {
  line: number
  column: number
};

export class LocationRange {
  filename: string
  begin: Location
  end: Location
};

// ---------------------------------------------------------------------------

type ObjectFieldKind = "ObjectAssert" | "ObjectFieldID" | "ObjectFieldExpr" |
                       "ObjectFieldStr" |"ObjectLocal";

export class ObjectField {
  kind:            ObjectFieldKind
  // hide             ObjectFieldHide // (ignore if kind != astObjectField*)
  superSugar:      boolean         // +:  (ignore if kind != astObjectField*)
  methodSugar:     boolean         // f(x, y, z): ...  (ignore if kind  == astObjectAssert)
  expr1:           Node            // Not in scope of the object
  id:              Identifier
  ids:             Identifier[]    // If methodSugar == true then holds the params.
  trailingComma:   boolean         // If methodSugar == true then remembers the trailing comma
  expr2:           Node            // In scope of the object (can see self).
  expr3:           Node            // In scope of the object (can see self).
  headingComments: Comment[]
};

export class ObjectNode extends NodeBase {
  fields:          ObjectField[]
  trailingComma:   boolean
  headingComments: Comment[]
};

// ---------------------------------------------------------------------------

export type CommentKind = "CppStyle" | "CStyle" | "HashStyle";

export class Comment extends NodeBase {
  kind: CommentKind
  text: string
};

// ---------------------------------------------------------------------------

// LocalBind is a helper struct for Local
export class LocalBind {
  variable:      Identifier
  body:          Node
  functionSugar: boolean
  params:        Identifier[] // if functionSugar is true
  trailingComma: boolean
}

// Local represents local x = e; e.  After desugaring, functionSugar is false.
export class Local extends NodeBase {
  binds: LocalBind[]
  body:  Node
}

// ---------------------------------------------------------------------------

// Import represents import "file".
export class Import extends NodeBase {
  file: string
}

// ImportStr represents importstr "file".
export class ImportStr extends NodeBase {
  file: string
}

// ---------------------------------------------------------------------------

// Index represents both e[e] and the syntax sugar e.f.
//
// One of index and id will be nil before desugaring.  After desugaring id
// will be nil.
export class Index extends NodeBase {
  target: Node
  index:  Node
  id:     Identifier
}

// ---------------------------------------------------------------------------

// Var represents variables.
export class Var extends NodeBase {
	Id: Identifier
}
