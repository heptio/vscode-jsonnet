'use strict';
import * as server from 'vscode-languageserver';
import * as immutable from 'immutable';

import * as ast from '../parser/node';
import * as error from '../lexer/static_error';
import * as lexer from '../lexer/lexer';

export interface Visitor {
  visit(): void
}

export abstract class VisitorBase implements Visitor {
  protected rootObject: ast.Node | null = null;

  constructor(
    protected rootNode: ast.Node,
    private parent: ast.Node | null = null,
    private env: ast.Environment = ast.emptyEnvironment,
  ) {}

  public visit = () => {
    this.visitHelper(this.rootNode, this.parent, this.env);
  }

  protected visitHelper = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {
    if (node == null) {
      throw Error("INTERNAL ERROR: Can't visit a null node");
    }

    this.previsit(node, parent, currEnv);

    switch(node.type) {
      case "CommentNode": {
        this.visitComment(<ast.Comment>node);
        return;
      }
      case "CompSpecNode": {
        const castedNode = <ast.CompSpec>node;
        this.visitCompSpec(castedNode);
        castedNode.varName && this.visitHelper(castedNode.varName, castedNode, currEnv);
        this.visitHelper(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "ApplyNode": {
        const castedNode = <ast.Apply>node;
        this.visitApply(castedNode);
        this.visitHelper(castedNode.target, castedNode, currEnv);
        castedNode.args.forEach((arg: ast.Node) => {
          this.visitHelper(arg, castedNode, currEnv);
        });
        return;
      }
      case "ApplyBraceNode": {
        const castedNode = <ast.ApplyBrace>node;
        this.visitApplyBrace(castedNode);
        this.visitHelper(castedNode.left, castedNode, currEnv);
        this.visitHelper(castedNode.right, castedNode, currEnv);
        return;
      }
      case "ApplyParamAssignmentNode": {
        const castedNode = <ast.ApplyParamAssignment>node;
        this.visitApplyParamAssignmentNode(castedNode);
        this.visitHelper(castedNode.right, castedNode, currEnv);
        return;
      }
      case "ArrayNode": {
        const castedNode = <ast.Array>node;
        this.visitArray(castedNode);
        castedNode.headingComment && this.visitHelper(
          castedNode.headingComment, castedNode, currEnv);
        castedNode.elements.forEach((e: ast.Node) => {
          this.visitHelper(e, castedNode, currEnv);
        });
        castedNode.trailingComment && this.visitHelper(
          castedNode.trailingComment, castedNode, currEnv);
        return;
      }
      case "ArrayCompNode": {
        const castedNode = <ast.ArrayComp>node;
        this.visitArrayComp(castedNode);
        this.visitHelper(castedNode.body, castedNode, currEnv);
        castedNode.specs.forEach((spec: ast.CompSpec) =>
          this.visitHelper(spec, castedNode, currEnv));
        return;
      }
      case "AssertNode": {
        const castedNode = <ast.Assert>node;
        this.visitAssert(castedNode);
        this.visitHelper(castedNode.cond, castedNode, currEnv);
        castedNode.message && this.visitHelper(
          castedNode.message, castedNode, currEnv);
        this.visitHelper(castedNode.rest, castedNode, currEnv);
        return;
      }
      case "BinaryNode": {
        const castedNode = <ast.Binary>node;
        this.visitBinary(castedNode);
        this.visitHelper(castedNode.left, castedNode, currEnv);
        this.visitHelper(castedNode.right, castedNode, currEnv);
        return;
      }
      case "BuiltinNode": {
        const castedNode = <ast.Builtin>node;
        this.visitBuiltin(castedNode);
        return;
      }
      case "ConditionalNode": {
        const castedNode = <ast.Conditional>node;
        this.visitConditional(castedNode);
        this.visitHelper(castedNode.cond, castedNode, currEnv);
        this.visitHelper(castedNode.branchTrue, castedNode, currEnv);
        castedNode.branchFalse && this.visitHelper(
          castedNode.branchFalse, castedNode, currEnv);
        return;
      }
      case "DollarNode": {
        const castedNode = <ast.Dollar>node;
        this.visitDollar(castedNode);
        return;
      }
      case "ErrorNode": {
        const castedNode = <ast.ErrorNode>node;
        this.visitError(castedNode);
        this.visitHelper(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "FunctionNode": {
        const castedNode = <ast.Function>node;
        this.visitFunction(castedNode);

        if (castedNode.headingComment != null) {
          this.visitHelper(castedNode.headingComment, castedNode, currEnv);
        }

        // Add params to environment before visiting body.
        const envWithParams = currEnv.merge(
          ast.envFromParams(castedNode.parameters));

        castedNode.parameters.forEach((param: ast.FunctionParam) => {
          this.visitHelper(param, castedNode, envWithParams);
        });

        // Visit body.
        this.visitHelper(castedNode.body, castedNode, envWithParams);
        castedNode.trailingComment.forEach((comment: ast.Comment) => {
          // NOTE: Using `currEnv` instead of `envWithparams`.
          this.visitHelper(comment, castedNode, currEnv);
        });
        return;
      }
      case "FunctionParamNode": {
        const castedNode = <ast.FunctionParam>node;
        castedNode.defaultValue && this.visitHelper(
          castedNode.defaultValue, castedNode, currEnv);
        return;
      }
      case "IdentifierNode": {
        this.visitIdentifier(<ast.Identifier>node);
        return;
      }
      case "ImportNode": {
        this.visitImport(<ast.Import>node);
        return;
      }
      case "ImportStrNode": {
        this.visitImportStr(<ast.ImportStr>node);
        return;
      }
      case "IndexNode": {
        const castedNode = <ast.Index>node;
        this.visitIndex(castedNode);
        castedNode.id != null && this.visitHelper(castedNode.id, castedNode, currEnv);
        castedNode.target != null && this.visitHelper(
          castedNode.target, castedNode, currEnv);
        castedNode.index != null && this.visitHelper(
          castedNode.index, castedNode, currEnv);
        return;
      }
      case "LocalBindNode": {
        const castedNode = <ast.LocalBind>node;
        this.visitLocalBind(<ast.LocalBind>node);

        // NOTE: If `functionSugar` is false, the params will be
        // empty.
        const envWithParams = currEnv.merge(
          ast.envFromParams(castedNode.params));

        castedNode.params.forEach((param: ast.FunctionParam) => {
          this.visitHelper(param, castedNode, envWithParams)
        });

        this.visitHelper(castedNode.body, castedNode, envWithParams);
        return;
      }
      case "LocalNode": {
        const castedNode = <ast.Local>node;
        this.visitLocal(castedNode);

        // NOTE: The binds of a `local` are in scope for both the
        // binds themselves, as well as the body of the `local`.
        const envWithBinds = currEnv.merge(ast.envFromLocalBinds(castedNode));
        castedNode.env = envWithBinds;

        castedNode.binds.forEach((bind: ast.LocalBind) => {
          this.visitHelper(bind, castedNode, envWithBinds);
        });

        this.visitHelper(castedNode.body, castedNode, envWithBinds);
        return;
      }
      case "LiteralBooleanNode": {
        const castedNode = <ast.LiteralBoolean>node;
        this.visitLiteralBoolean(castedNode);
        return;
      }
      case "LiteralNullNode": {
        const castedNode = <ast.LiteralNull>node;
        this.visitLiteralNull(castedNode);
        return;
      }
      case "LiteralNumberNode": { return this.visitLiteralNumber(<ast.LiteralNumber>node); }
      case "LiteralStringNode": {
        const castedNode = <ast.LiteralString>node;
        this.visitLiteralString(castedNode);
        return;
      }
      case "ObjectFieldNode": {
        const castedNode = <ast.ObjectField>node;
        this.visitObjectField(castedNode);

        // NOTE: If `methodSugar` is false, the params will be empty.
        let envWithParams = currEnv.merge(ast.envFromParams(castedNode.ids));

        castedNode.id != null && this.visitHelper(
          castedNode.id, castedNode, envWithParams);
        castedNode.expr1 != null && this.visitHelper(
          castedNode.expr1, castedNode, envWithParams);

        castedNode.ids.forEach((param: ast.FunctionParam) => {
          this.visitHelper(param, castedNode, envWithParams);
        });

        castedNode.expr2 != null && this.visitHelper(
          castedNode.expr2, castedNode, envWithParams);
        castedNode.expr3 != null && this.visitHelper(
          castedNode.expr3, castedNode, envWithParams);
        if (castedNode.headingComments != null) {
          this.visitHelper(castedNode.headingComments, castedNode, currEnv);
        }
        return;
      }
      case "ObjectNode": {
        const castedNode = <ast.ObjectNode>node;
        if (this.rootObject == null) {
          this.rootObject = castedNode;
          castedNode.rootObject = castedNode;
        }
        this.visitObject(castedNode);

        // `local` object fields are scoped with order-independence,
        // so something like this is legal:
        //
        // {
        //    bar: {baz: foo},
        //    local foo = 3,
        // }
        //
        // Since this case requires `foo` to be in the environment of
        // `bar`'s body, we here collect up the `local` fields first,
        // create a new environment that includes them, and pass that
        // on to each field we visit.
        const envWithLocals = currEnv.merge(
          ast.envFromFields(castedNode.fields));

        castedNode.fields.forEach((field: ast.ObjectField) => {
          // NOTE: If this is a `local` field, there is no need to
          // remove current field from environment. It is perfectly
          // legal to do something like `local foo = foo; foo` (though
          // it will cause a stack overflow).
          this.visitHelper(field, castedNode, envWithLocals);
        });
        return;
      }
      case "DesugaredObjectFieldNode": {
        const castedNode = <ast.DesugaredObjectField>node;
        this.visitDesugaredObjectField(castedNode);
        this.visitHelper(castedNode.name, castedNode, currEnv);
        this.visitHelper(castedNode.body, castedNode, currEnv);
        return;
      }
      case "DesugaredObjectNode": {
        const castedNode = <ast.DesugaredObject>node;
        this.visitDesugaredObject(castedNode);
        castedNode.asserts.forEach((a: ast.Assert) => {
          this.visitHelper(a, castedNode, currEnv);
        });
        castedNode.fields.forEach((field: ast.DesugaredObjectField) => {
          this.visitHelper(field, castedNode, currEnv);
        });
        return;
      }
      case "ObjectCompNode": {
        const castedNode = <ast.ObjectComp>node;
        this.visitObjectComp(castedNode);
        castedNode.specs.forEach((spec: ast.CompSpec) => {
          this.visitHelper(spec, castedNode, currEnv);
        });
        castedNode.fields.forEach((field: ast.ObjectField) => {
          this.visitHelper(field, castedNode, currEnv);
        });
        return;
      }
      case "ObjectComprehensionSimpleNode": {
        const castedNode = <ast.ObjectComprehensionSimple>node;
        this.visitObjectComprehensionSimple(castedNode);
        this.visitHelper(castedNode.id, castedNode, currEnv);
        this.visitHelper(castedNode.field, castedNode, currEnv);
        this.visitHelper(castedNode.value, castedNode, currEnv);
        this.visitHelper(castedNode.array, castedNode, currEnv);
        return;
      }
      case "SelfNode": {
        const castedNode = <ast.Self>node;
        this.visitSelf(castedNode);
        return;
      }
      case "SuperIndexNode": {
        const castedNode = <ast.SuperIndex>node;
        this.visitSuperIndex(castedNode);
        castedNode.index && this.visitHelper(castedNode.index, castedNode, currEnv);
        castedNode.id && this.visitHelper(castedNode.id, castedNode, currEnv);
        return;
      }
      case "UnaryNode": {
        const castedNode = <ast.Unary>node;
        this.visitUnary(castedNode);
        this.visitHelper(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "VarNode": {
        const castedNode = <ast.Var>node;
        this.visitVar(castedNode);
        castedNode.id != null && this.visitHelper(castedNode.id, castedNode, currEnv);
        return
      }
      default: throw new Error(
        `Visitor could not traverse tree; unknown node type '${node.type}'`);
    }
  }

  protected previsit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {}

  protected visitComment = (node: ast.Comment): void => {}
  protected visitCompSpec = (node: ast.CompSpec): void => {}
  protected visitApply = (node: ast.Apply): void => {}
  protected visitApplyBrace = (node: ast.ApplyBrace): void => {}
  protected visitApplyParamAssignmentNode = (node: ast.ApplyParamAssignment): void => {}
  protected visitArray = (node: ast.Array): void => {}
  protected visitArrayComp = (node: ast.ArrayComp): void => {}
  protected visitAssert = (node: ast.Assert): void => {}
  protected visitBinary = (node: ast.Binary): void => {}
  protected visitBuiltin = (node: ast.Builtin): void => {}
  protected visitConditional = (node: ast.Conditional): void => {}
  protected visitDollar = (node: ast.Dollar): void => {}
  protected visitError = (node: ast.ErrorNode): void => {}
  protected visitFunction = (node: ast.Function): void => {}

  protected visitIdentifier = (node: ast.Identifier): void => {}
  protected visitImport = (node: ast.Import): void => {}
  protected visitImportStr = (node: ast.ImportStr): void => {}
  protected visitIndex = (node: ast.Index): void => {}
  protected visitLocalBind = (node: ast.LocalBind): void => {}
  protected visitLocal = (node: ast.Local): void => {}

  protected visitLiteralBoolean = (node: ast.LiteralBoolean): void => {}
  protected visitLiteralNull = (node: ast.LiteralNull): void => {}

  protected visitLiteralNumber = (node: ast.LiteralNumber): void => {}
  protected visitLiteralString = (node: ast.LiteralString): void => {}
  protected visitObjectField = (node: ast.ObjectField): void => {}
  protected visitObject = (node: ast.ObjectNode): void => {}
  protected visitDesugaredObjectField = (node: ast.DesugaredObjectField): void => {}
  protected visitDesugaredObject = (node: ast.DesugaredObject): void => {}
  protected visitObjectComp = (node: ast.ObjectComp): void => {}
  protected visitObjectComprehensionSimple = (node: ast.ObjectComprehensionSimple): void => {}
  protected visitSelf = (node: ast.Self): void => {}
  protected visitSuperIndex = (node: ast.SuperIndex): void => {}
  protected visitUnary = (node: ast.Unary): void => {}
  protected visitVar = (node: ast.Var): void => {}
}

// ----------------------------------------------------------------------------
// Initializing visitor.
// ----------------------------------------------------------------------------

// InitializingVisitor initializes an AST by populating the `parent`
// and `env` values in every node.
export class InitializingVisitor extends VisitorBase {
  protected previsit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {
    node.parent = parent;
    node.env = currEnv;
    node.rootObject = this.rootObject;
  }
}

// ----------------------------------------------------------------------------
// Cursor visitor.
// ----------------------------------------------------------------------------

// FindFailure represents a failure find a node whose range wraps a
// cursor location.
export type FindFailure = AnalyzableFindFailure | UnanalyzableFindFailure;

export const isFindFailure = (thing): thing is FindFailure => {
  return thing instanceof UnanalyzableFindFailure ||
    thing instanceof AnalyzableFindFailure;
}

export type FindFailureKind =
  "BeforeDocStart" | "AfterDocEnd" | "AfterLineEnd" | "NotIdentifier";

// AnalyzableFindFailure represents a failure to find a node whose
// range wraps a cursor location, but which is amenable to static
// analysis.
//
// In particular, this means that the cursor lies in the range of the
// document's AST, and it is therefore possible to inspect the AST
// surrounding the cursor.
export class AnalyzableFindFailure {
  // IMPLEMENTATION NOTES: Currently we consider the kind
  // `"AfterDocEnd"` to be unanalyzable, but as our static analysis
  // features become more featureful, we can probably revisit this
  // corner case and get better results in the general case.

  constructor(
    public readonly kind: "AfterLineEnd" | "NotIdentifier",
    public readonly tightestEnclosingNode: ast.Node,
    public readonly terminalNodeOnCursorLine: ast.Node | null,
  ) {}
}

export const isAnalyzableFindFailure = (
  thing
): thing is AnalyzableFindFailure => {
  return thing instanceof AnalyzableFindFailure;
}

// UnanalyzableFindFailrue represents a failure to find a node whose
// range wraps a cursor location, and is not amenable to static
// analysis.
//
// In particular, this means that the cursor lies outside of the range
// of a document's AST, which means we cannot inspect the context of
// where the cursor lies in an AST.
export class UnanalyzableFindFailure {
  constructor(public readonly kind: "BeforeDocStart" | "AfterDocEnd") {}
}

export const isUnanalyzableFindFailure = (
  thing
): thing is UnanalyzableFindFailure => {
  return thing instanceof UnanalyzableFindFailure;
}

// CursorVisitor finds a node whose range some cursor lies in, or the
// closest node to it.
export class CursorVisitor extends VisitorBase {
  // IMPLEMENTATION NOTES: The goal of this class is to map the corner
  // cases into `ast.Node | FindFailure`. Broadly, this mapping falls
  // into a few cases:
  //
  // * Cursor in the range of an identifier.
  //   * Return the identifier.
  // * Cursor in the range of a node that is not an identifier (e.g.,
  //   number literal, multi-line object with no members, and so on).
  //   * Return a find failure with kind `"NotIdentifier"`.
  // * Cursor lies inside document range, the last node on the line
  //   of the cursor ends before the cursor's position.
  //   * Return find failure with kind `"AfterLineEnd"`.
  // * Cursor lies outside document range.
  //   * Return find failure with kind `"BeforeDocStart"` or
  //     `"AfterDocEnd"`.

  constructor(
    private cursor: error.Location,
    root: ast.Node,
  ) {
    super(root);
    this.terminalNode = root;
  }

  // Identifier whose range encloses the cursor, if there is one. This
  // can be a multi-line node (e.g., perhaps an empty object), or a
  // single line node (e.g., a number literal).
  private enclosingNode: ast.Node | null = null;

  // Last node in the tree.
  private terminalNode: ast.Node;

  // Last node in the line our cursor lies on, if there is one.
  private terminalNodeOnCursorLine: ast.Node | null = null;

  get nodeAtPosition(): ast.Identifier | FindFailure {
    if (this.enclosingNode == null) {
      if (this.cursor.strictlyBeforeRange(this.rootNode.loc)) {
        return new UnanalyzableFindFailure("BeforeDocStart");
      } else if (this.cursor.strictlyAfterRange(this.terminalNode.loc)) {
        return new UnanalyzableFindFailure("AfterDocEnd");
      }
      throw new Error(
        "INTERNAL ERROR: No wrapping identifier was found, but node didn't lie outside of document range");
    } else if (!ast.isIdentifier(this.enclosingNode)) {
      if (
        this.terminalNodeOnCursorLine != null &&
        this.cursor.strictlyAfterRange(this.terminalNodeOnCursorLine.loc)
      ) {
        return new AnalyzableFindFailure(
          "AfterLineEnd", this.enclosingNode, this.terminalNodeOnCursorLine);
      }
      return new AnalyzableFindFailure(
        "NotIdentifier", this.enclosingNode, this.terminalNodeOnCursorLine);
    }
    return this.enclosingNode;
  }

  protected previsit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment,
  ): void => {
    const nodeEnd = node.loc.end;

    if (this.cursor.inRange(node.loc)) {
      if (
        this.enclosingNode == null ||
        node.loc.rangeIsTighter(this.enclosingNode.loc)
      ) {
        this.enclosingNode = node;
      }
    }

    if (nodeEnd.afterRangeOrEqual(this.terminalNode.loc)) {
      this.terminalNode = node;
    }

    if (nodeEnd.line === this.cursor.line) {
      if (this.terminalNodeOnCursorLine == null) {
        this.terminalNodeOnCursorLine = node;
      } else if (nodeEnd.afterRangeOrEqual(this.terminalNodeOnCursorLine.loc)) {
        this.terminalNodeOnCursorLine = node;
      }
    }
  }
}

// nodeRangeIsCloser checks whether `thisNode` is closer to `pos` than
// `thatNode`.
//
// NOTE: Function currently works for expressions that are on one
// line.
const nodeRangeIsCloser = (
  pos: error.Location, thisNode: ast.Node, thatNode: ast.Node
): boolean => {
  const thisLoc = thisNode.loc;
  const thatLoc = thatNode.loc;
  if (thisLoc.begin.line == pos.line && thisLoc.end.line == pos.line) {
    if (thatLoc.begin.line == pos.line && thatLoc.end.line == pos.line) {
      // `thisNode` and `thatNode` lie on the same line, and
      // `thisNode` begins closer to the position.
      //
      // NOTE: We use <= here so that we always choose the last node
      // that begins at a point. For example, a `Var` and `Identifier`
      // might begin in the same place, but we'd like to choose the
      // `Identifier`, as it would be a child of the `Var`.
      return Math.abs(thisLoc.begin.column - pos.column) <=
        Math.abs(thatLoc.begin.column - pos.column)
    } else {
      return true;
    }
  }

  return false;
}
