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
    private rootNode: ast.Node,
    private parent: ast.Node | null = null,
    private env: ast.Environment = ast.emptyEnvironment,
  ) {}

  public visit = () => {
    this.visitHelper(this.rootNode, null, this.env);
  }

  protected visitHelper = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {
    if (node == null) {
      throw Error("INTERNAL ERROR: Can't visit a null node");
    }

    this.onPrevisit(node, parent, currEnv);

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

        castedNode.headingComment.forEach((comment: ast.Comment) => {
          this.visitHelper(comment, castedNode, currEnv);
        });

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
      // // case "LocalBindNode": return this.VisitLocalBind(<ast.LocalBind>node);
      case "LocalNode": {
        const castedNode = <ast.Local>node;
        this.visitLocal(castedNode);

        const envWithBinds = currEnv.merge(ast.envFromLocalBinds(castedNode));
        castedNode.binds.forEach((bind: ast.LocalBind) => {
          // NOTE: If `functionSugar` is false, the params will be
          // empty.
          const envWithParams = envWithBinds.merge(
              ast.envFromParams(bind.params));

          // TODO: `castedNode` is marked as parent here because
          // `LocalBind` currently does not implement `Node`. We
          // should decide whether that should change.
          bind.params.forEach((param: ast.FunctionParam) => {
            this.visitHelper(param, castedNode, envWithParams)
          });

          this.visitHelper(bind.body, castedNode, envWithParams);
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
        castedNode.headingComments.forEach(comment => {
          if (comment == undefined) {
            throw new Error(`INTERNAL ERROR: element was undefined during a forEach call`);
          }
          this.visitHelper(comment, castedNode, currEnv);
        });
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

  protected onPrevisit = (
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
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
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

export class InitializingVisitor extends VisitorBase {
  protected onPrevisit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {
    node.parent = parent;
    node.env = currEnv;
    node.rootObject = this.rootObject;
  }
}

// Finds the tightest-binding node that wraps the location denoted by
// `position`.
export class CursorVisitor extends VisitorBase {
  constructor(
    private position: error.Location,
    root: ast.Node,
  ) {
    super(root);
  }

  get NodeAtPosition(): ast.Node { return this.tightestWrappingNode; }

  private tightestWrappingNode: ast.Node;

  protected onPrevisit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment,
  ): void => {
    this.updateTightestNode(node);
  }

  private updateTightestNode = (node: ast.Node): void => {
    const locationRange = node.loc;
    const range = {
      beginLine: locationRange.begin.line,
      endLine: locationRange.end.line,
      beginCol: locationRange.begin.column,
      endCol: locationRange.end.column,
    };

    if (cursorInLocationRange(this.position, range) &&
      nodeRangeIsTighter(node, this.tightestWrappingNode)
    ) {
      this.tightestWrappingNode = node;
    } else if (
      nodeRangeIsCloser(this.position, node, this.tightestWrappingNode)
    ) {
      this.tightestWrappingNode = node;
    }
  }
}

const nodeRangeIsTighter = (
  thisNode: ast.Node, thatNode: ast.Node
): boolean => {
  if (thatNode == null) {
    return true;
  }

  const thisNodeBegin = new error.Location(
    thisNode.loc.begin.line,
    thisNode.loc.begin.column);
  const thisNodeEnd = new error.Location(
    thisNode.loc.end.line,
    thisNode.loc.end.column);
  const thatNodeRange = {
    beginLine: thatNode.loc.begin.line,
    endLine: thatNode.loc.end.line,
    beginCol: thatNode.loc.begin.column,
    endCol: thatNode.loc.end.column,
  };
  return cursorInLocationRange(thisNodeBegin, thatNodeRange) &&
  cursorInLocationRange(thisNodeEnd, thatNodeRange);
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
      return Math.abs(thisLoc.begin.column - pos.column) <
        Math.abs(thatLoc.begin.column - pos.column)
    } else {
      return true;
    }
  }

  return false;
}

const cursorInLocationRange = (
  cursor: error.Location,
  range: {beginLine: number, endLine: number, beginCol: number, endCol: number},
): boolean => {

  if (range.beginLine == cursor.line && cursor.line == range.endLine &&
  range.beginCol <= cursor.column && cursor.column <= range.endCol
  ) {
    return true;
  } else if (range.beginLine < cursor.line && cursor.line == range.endLine &&
  cursor.column <= range.endCol
  ) {
    return true;
  } else if (range.beginLine == cursor.line && cursor.line < range.endLine &&
  cursor.column >= range.beginCol
  ) {
    return true;
  } else if (range.beginLine < cursor.line && cursor.line < range.endLine) {
    return true;
  } else {
    return false;
  }
};
