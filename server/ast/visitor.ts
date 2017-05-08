'use strict';
import * as server from 'vscode-languageserver';
import * as immutable from 'immutable';

import * as ast from '../parser/node';
import * as error from '../lexer/static_error';
import * as lexer from '../lexer/lexer';

export interface Visitor {
  Visit(node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment): void
  VisitComment(node: ast.Comment): void
  VisitCompSpec(node: ast.CompSpec): void
  VisitApply(node: ast.Apply): void
  VisitApplyBrace(node: ast.ApplyBrace): void
  VisitApplyParamAssignmentNode(node: ast.ApplyParamAssignment): void
  VisitArray(node: ast.Array): void
  VisitArrayComp(node: ast.ArrayComp): void
  VisitAssert(node: ast.Assert): void
  VisitBinary(node: ast.Binary): void
  VisitBuiltin(node: ast.Builtin): void
  VisitConditional(node: ast.Conditional): void
  VisitDollar(node: ast.Dollar): void
  VisitError(node: ast.ErrorNode): void
  VisitFunction(node: ast.Function): void
  VisitIdentifier(node: ast.Identifier): void
  VisitImport(node: ast.Import): void
  VisitImportStr(node: ast.ImportStr): void
  VisitIndex(node: ast.Index): void
  // // VisitLocalBind(node: ast.LocalBind): void
  VisitLocal(node: ast.Local): void
  VisitLiteralBoolean(node: ast.LiteralBoolean): void
  VisitLiteralNull(node: ast.LiteralNull): void
  VisitLiteralNumber(node: ast.LiteralNumber): void
  VisitLiteralString(node: ast.LiteralString): void
  VisitObjectField(node: ast.ObjectField): void
  VisitObject(node: ast.ObjectNode): void
  VisitDesugaredObjectField(node: ast.DesugaredObjectField): void
  VisitDesugaredObject(node: ast.DesugaredObject): void
  VisitObjectComp(node: ast.ObjectComp): void
  VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): void
  VisitSelf(node: ast.Self): void
  VisitSuperIndex(node: ast.SuperIndex): void
  VisitUnary(node: ast.Unary): void
  VisitVar(node: ast.Var): void
}

export abstract class VisitorBase implements Visitor {
  public Visit = (
    node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment
  ): void => {
    if (node == null) {
      throw Error("Can't visit a null node");
    }

    node.parent = parent;
    node.env = currEnv;

    switch(node.type) {
      case "CommentNode": {
        this.VisitComment(<ast.Comment>node);
        return;
      }
      case "CompSpecNode": {
        const castedNode = <ast.CompSpec>node;
        this.VisitCompSpec(castedNode);
        castedNode.varName && this.Visit(castedNode.varName, castedNode, currEnv);
        this.Visit(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "ApplyNode": {
        const castedNode = <ast.Apply>node;
        this.VisitApply(castedNode);
        this.Visit(castedNode.target, castedNode, currEnv);
        castedNode.args.forEach((arg: ast.Node) => {
          this.Visit(arg, castedNode, currEnv);
        });
        return;
      }
      case "ApplyBraceNode": {
        const castedNode = <ast.ApplyBrace>node;
        this.VisitApplyBrace(castedNode);
        this.Visit(castedNode.left, castedNode, currEnv);
        this.Visit(castedNode.right, castedNode, currEnv);
        return;
      }
      case "ApplyParamAssignmentNode": {
        const castedNode = <ast.ApplyParamAssignment>node;
        this.VisitApplyParamAssignmentNode(castedNode);
        this.Visit(castedNode.right, castedNode, currEnv);
        return;
      }
      case "ArrayNode": {
        const castedNode = <ast.Array>node;
        this.VisitArray(castedNode);
        castedNode.headingComment && this.Visit(
          castedNode.headingComment, castedNode, currEnv);
        castedNode.elements.forEach((e: ast.Node) => {
          this.Visit(e, castedNode, currEnv);
        });
        castedNode.trailingComment && this.Visit(
          castedNode.trailingComment, castedNode, currEnv);
        return;
      }
      case "ArrayCompNode": {
        const castedNode = <ast.ArrayComp>node;
        this.VisitArrayComp(castedNode);
        this.Visit(castedNode.body, castedNode, currEnv);
        castedNode.specs.forEach((spec: ast.CompSpec) =>
          this.Visit(spec, castedNode, currEnv));
        return;
      }
      case "AssertNode": {
        const castedNode = <ast.Assert>node;
        this.VisitAssert(castedNode);
        this.Visit(castedNode.cond, castedNode, currEnv);
        castedNode.message && this.Visit(
          castedNode.message, castedNode, currEnv);
        this.Visit(castedNode.rest, castedNode, currEnv);
        return;
      }
      case "BinaryNode": {
        const castedNode = <ast.Binary>node;
        this.VisitBinary(castedNode);
        this.Visit(castedNode.left, castedNode, currEnv);
        this.Visit(castedNode.right, castedNode, currEnv);
        return;
      }
      case "BuiltinNode": {
        const castedNode = <ast.Builtin>node;
        this.VisitBuiltin(castedNode);
        return;
      }
      case "ConditionalNode": {
        const castedNode = <ast.Conditional>node;
        this.VisitConditional(castedNode);
        this.Visit(castedNode.cond, castedNode, currEnv);
        this.Visit(castedNode.branchTrue, castedNode, currEnv);
        castedNode.branchFalse && this.Visit(
          castedNode.branchFalse, castedNode, currEnv);
        return;
      }
      case "DollarNode": {
        const castedNode = <ast.Dollar>node;
        this.VisitDollar(castedNode);
        return;
      }
      case "ErrorNode": {
        const castedNode = <ast.ErrorNode>node;
        this.VisitError(castedNode);
        this.Visit(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "FunctionNode": {
        const castedNode = <ast.Function>node;
        this.VisitFunction(castedNode);
        castedNode.headingComment.forEach((comment: ast.Comment) => {
          this.Visit(comment, castedNode, currEnv);
        });
        castedNode.parameters.forEach((param: ast.FunctionParam) => {
          this.Visit(param, castedNode, currEnv);
        });

        // Add params to environment before visiting body.
        const envWithParams = castedNode.parameters
          .reduce(
            (acc: ast.Environment, field: ast.FunctionParam) => {
              return acc.merge(ast.environmentFromLocal(field));
            },
            immutable.Map<string, ast.LocalBind | ast.FunctionParam>()
          );

        // Visit body.
        this.Visit(castedNode.body, castedNode, envWithParams);
        castedNode.trailingComment.forEach((comment: ast.Comment) => {
          this.Visit(comment, castedNode, currEnv);
        });
        return;
      }
      case "FunctionParamNode": {
        const castedNode = <ast.FunctionParam>node;
        castedNode.defaultValue && this.Visit(
          castedNode.defaultValue, castedNode, currEnv);
        return;
      }
      case "IdentifierNode": {
        this.VisitIdentifier(<ast.Identifier>node);
        return;
      }
      case "ImportNode": {
        this.VisitImport(<ast.Import>node);
        return;
      }
      case "ImportStrNode": {
        this.VisitImportStr(<ast.ImportStr>node);
        return;
      }
      case "IndexNode": {
        const castedNode = <ast.Index>node;
        this.VisitIndex(castedNode);
        castedNode.id != null && this.Visit(castedNode.id, castedNode, currEnv);
        castedNode.target != null && this.Visit(
          castedNode.target, castedNode, currEnv);
        castedNode.index != null && this.Visit(
          castedNode.index, castedNode, currEnv);
        return;
      }
      // // case "LocalBindNode": return this.VisitLocalBind(<ast.LocalBind>node);
      case "LocalNode": {
        const castedNode = <ast.Local>node;
        const newEnv = currEnv.merge(ast.environmentFromLocal(castedNode));

        this.VisitLocal(castedNode);
        castedNode.binds.forEach(bind => {
          if (bind == undefined) {
            throw new Error(`INTERNAL ERROR: element was undefined during a forEach call`);
          }
          bind.body != null && this.Visit(bind.body, castedNode, newEnv);
        });
        castedNode.body != null && this.Visit(
          castedNode.body, castedNode, newEnv);
        // throw new Error(`${newEnv.get("fooModule")}`);
        return;
      }
      case "LiteralBooleanNode": {
        const castedNode = <ast.LiteralBoolean>node;
        this.VisitLiteralBoolean(castedNode);
        return;
      }
      case "LiteralNullNode": {
        const castedNode = <ast.LiteralNull>node;
        this.VisitLiteralNull(castedNode);
        return;
      }
      case "LiteralNumberNode": { return this.VisitLiteralNumber(<ast.LiteralNumber>node); }
      case "LiteralStringNode": {
        const castedNode = <ast.LiteralString>node;
        this.VisitLiteralString(castedNode);
        return;
      }
      case "ObjectFieldNode": {
        const castedNode = <ast.ObjectField>node;
        this.VisitObjectField(castedNode);
        castedNode.id != null && this.Visit(castedNode.id, castedNode, currEnv);
        castedNode.expr1 != null && this.Visit(
          castedNode.expr1, castedNode, currEnv);
        castedNode.expr2 != null && this.Visit(
          castedNode.expr2, castedNode, currEnv);
        castedNode.expr3 != null && this.Visit(
          castedNode.expr3, castedNode, currEnv);
        castedNode.headingComments != null &&
          castedNode.headingComments.forEach(comment => {
            if (comment == undefined) {
              throw new Error(`INTERNAL ERROR: element was undefined during a forEach call`);
            }
            this.Visit(comment, castedNode, currEnv);
          });
        return;
      }
      case "ObjectNode": {
        const castedNode = <ast.ObjectNode>node;
        this.VisitObject(castedNode);

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
        const envWithLocals = castedNode.fields
          .filter((field: ast.ObjectField) => {
            const localKind: ast.ObjectFieldKind = "ObjectLocal";
            return field.kind === localKind;
          })
          .reduce(
            (acc: ast.Environment, field: ast.ObjectField) => {
              return acc.merge(ast.environmentFromLocal(field));
            },
            immutable.Map<string, ast.LocalBind>()
          );

        castedNode.fields.forEach((field: ast.ObjectField) => {
          // NOTE: If this is a `local` field, there is no need to
          // remove current field from environment. It is perfectly
          // legal to do something like `local foo = foo; foo` (though
          // it will cause a stack overflow).
          this.Visit(field, castedNode, currEnv.merge(envWithLocals));
        });
        return;
      }
      case "DesugaredObjectFieldNode": {
        const castedNode = <ast.DesugaredObjectField>node;
        this.VisitDesugaredObjectField(castedNode);
        this.Visit(castedNode.name, castedNode, currEnv);
        this.Visit(castedNode.body, castedNode, currEnv);
        return;
      }
      case "DesugaredObjectNode": {
        const castedNode = <ast.DesugaredObject>node;
        this.VisitDesugaredObject(castedNode);
        castedNode.asserts.forEach((a: ast.Assert) => {
          this.Visit(a, castedNode, currEnv);
        });
        castedNode.fields.forEach((field: ast.DesugaredObjectField) => {
          this.Visit(field, castedNode, currEnv);
        });
        return;
      }
      case "ObjectCompNode": {
        const castedNode = <ast.ObjectComp>node;
        this.VisitObjectComp(castedNode);
        castedNode.specs.forEach((spec: ast.CompSpec) => {
          this.Visit(spec, castedNode, currEnv);
        });
        castedNode.fields.forEach((field: ast.ObjectField) => {
          this.Visit(field, castedNode, currEnv);
        });
        return;
      }
      case "ObjectComprehensionSimpleNode": {
        const castedNode = <ast.ObjectComprehensionSimple>node;
        this.VisitObjectComprehensionSimple(castedNode);
        this.Visit(castedNode.id, castedNode, currEnv);
        this.Visit(castedNode.field, castedNode, currEnv);
        this.Visit(castedNode.value, castedNode, currEnv);
        this.Visit(castedNode.array, castedNode, currEnv);
        return;
      }
      case "SelfNode": {
        const castedNode = <ast.Self>node;
        this.VisitSelf(castedNode);
        return;
      }
      case "SuperIndexNode": {
        const castedNode = <ast.SuperIndex>node;
        this.VisitSuperIndex(castedNode);
        castedNode.index && this.Visit(castedNode.index, castedNode, currEnv);
        castedNode.id && this.Visit(castedNode.id, castedNode, currEnv);
        return;
      }
      case "UnaryNode": {
        const castedNode = <ast.Unary>node;
        this.VisitUnary(castedNode);
        this.Visit(castedNode.expr, castedNode, currEnv);
        return;
      }
      case "VarNode": {
        const castedNode = <ast.Var>node;
        this.VisitVar(castedNode);
        castedNode.id != null && this.Visit(castedNode.id, castedNode, currEnv);
        return
      }
      default: throw new Error(
        `Visitor could not traverse tree; unknown node type '${node.type}'`);
    }
  }

  public abstract VisitComment = (node: ast.Comment): void => {}
  public abstract VisitCompSpec = (node: ast.CompSpec): void => {}
  public abstract VisitApply = (node: ast.Apply): void => {}
  public abstract VisitApplyBrace = (node: ast.ApplyBrace): void => {}
  public abstract VisitApplyParamAssignmentNode = (node: ast.ApplyParamAssignment): void => {}
  public abstract VisitArray = (node: ast.Array): void => {}
  public abstract VisitArrayComp = (node: ast.ArrayComp): void => {}
  public abstract VisitAssert = (node: ast.Assert): void => {}
  public abstract VisitBinary = (node: ast.Binary): void => {}
  public abstract VisitBuiltin = (node: ast.Builtin): void => {}
  public abstract VisitConditional = (node: ast.Conditional): void => {}
  public abstract VisitDollar = (node: ast.Dollar): void => {}
  public abstract VisitError = (node: ast.ErrorNode): void => {}
  public abstract VisitFunction = (node: ast.Function): void => {}

  public abstract VisitIdentifier = (node: ast.Identifier): void => {}
  public abstract VisitImport = (node: ast.Import): void => {}
  public abstract VisitImportStr = (node: ast.ImportStr): void => {}
  public abstract VisitIndex = (node: ast.Index): void => {}
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
  public abstract VisitLocal = (node: ast.Local): void => {}

  public abstract VisitLiteralBoolean = (node: ast.LiteralBoolean): void => {}
  public abstract VisitLiteralNull = (node: ast.LiteralNull): void => {}

  public abstract VisitLiteralNumber = (node: ast.LiteralNumber): void => {}
  public abstract VisitLiteralString = (node: ast.LiteralString): void => {}
  public abstract VisitObjectField = (node: ast.ObjectField): void => {}
  public abstract VisitObject = (node: ast.ObjectNode): void => {}
  public abstract VisitDesugaredObjectField = (node: ast.DesugaredObjectField): void => {}
  public abstract VisitDesugaredObject = (node: ast.DesugaredObject): void => {}
  public abstract VisitObjectComp = (node: ast.ObjectComp): void => {}
  public abstract VisitObjectComprehensionSimple = (node: ast.ObjectComprehensionSimple): void => {}
  public abstract VisitSelf = (node: ast.Self): void => {}
  public abstract VisitSuperIndex = (node: ast.SuperIndex): void => {}
  public abstract VisitUnary = (node: ast.Unary): void => {}
  public abstract VisitVar = (node: ast.Var): void => {}
}

export class DeserializingVisitor extends VisitorBase {
  public VisitComment = (node: ast.Comment): void => {}
  public VisitCompSpec = (node: ast.CompSpec): void => {}
  public VisitApply = (node: ast.Apply): void => {}
  public VisitApplyBrace = (node: ast.ApplyBrace): void => {}
  public VisitApplyParamAssignmentNode = (node: ast.ApplyParamAssignment): void => {}
  public VisitArray = (node: ast.Array): void => {}
  public VisitArrayComp = (node: ast.ArrayComp): void => {}
  public VisitAssert = (node: ast.Assert): void => {}
  public VisitBinary = (node: ast.Binary): void => {}
  public VisitBuiltin = (node: ast.Builtin): void => {}
  public VisitConditional = (node: ast.Conditional): void => {}
  public VisitDollar = (node: ast.Dollar): void => {}
  public VisitError = (node: ast.ErrorNode): void => {}
  public VisitFunction = (node: ast.Function): void => {}

  public VisitIdentifier = (node: ast.Identifier): void => {}
  public VisitImport = (node: ast.Import): void => {}
  public VisitImportStr = (node: ast.ImportStr): void => {}
  public VisitIndex = (node: ast.Index): void => {}
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
  public VisitLocal = (node: ast.Local): void => {}
  public VisitLiteralBoolean = (node: ast.LiteralBoolean): void => {}
  public VisitLiteralNull = (node: ast.LiteralNull): void => {}
  public VisitLiteralNumber = (node: ast.LiteralNumber): void => {}
  public VisitLiteralString = (node: ast.LiteralString): void => {}
  public VisitObjectField = (node: ast.ObjectField): void => {}
  public VisitObject = (node: ast.ObjectNode): void => {}
  public VisitDesugaredObjectField = (node: ast.DesugaredObjectField): void => {}
  public VisitDesugaredObject = (node: ast.DesugaredObject): void => {}
  public VisitObjectComp = (node: ast.ObjectComp): void => {}
  public VisitObjectComprehensionSimple = (node: ast.ObjectComprehensionSimple): void => {}
  public VisitSelf = (node: ast.Self): void => {}
  public VisitSuperIndex = (node: ast.SuperIndex): void => {}
  public VisitUnary = (node: ast.Unary): void => {}
  public VisitVar = (node: ast.Var): void => {}

}

// Finds the tightest-binding node that wraps the location denoted by
// `position`.
export class CursorVisitor extends VisitorBase {
  constructor(private position: error.Location) { super(); }

  get NodeAtPosition(): ast.Node { return this.tightestWrappingNode; }

  private tightestWrappingNode: ast.Node;

  public VisitComment = (node: ast.Comment): void => { this.updateIfCursorInRange(node); }
  public VisitCompSpec = (node: ast.CompSpec): void => { this.updateIfCursorInRange(node); }
  public VisitApply = (node: ast.Apply): void => { this.updateIfCursorInRange(node); }
  public VisitApplyBrace = (node: ast.ApplyBrace): void => { this.updateIfCursorInRange(node); }
  public VisitApplyParamAssignmentNode = (node: ast.ApplyParamAssignment): void => { this.updateIfCursorInRange(node); }
  public VisitArray = (node: ast.Array): void => { this.updateIfCursorInRange(node); }
  public VisitArrayComp = (node: ast.ArrayComp): void => { this.updateIfCursorInRange(node); }
  public VisitAssert = (node: ast.Assert): void => { this.updateIfCursorInRange(node); }
  public VisitBinary = (node: ast.Binary): void => { this.updateIfCursorInRange(node); }
  public VisitBuiltin = (node: ast.Builtin): void => { this.updateIfCursorInRange(node); }
  public VisitConditional = (node: ast.Conditional): void => { this.updateIfCursorInRange(node); }
  public VisitDollar = (node: ast.Dollar): void => { this.updateIfCursorInRange(node); }
  public VisitError = (node: ast.ErrorNode): void => { this.updateIfCursorInRange(node); }
  public VisitFunction = (node: ast.Function): void => { this.updateIfCursorInRange(node); }

  public VisitIdentifier = (node: ast.Identifier): void => { this.updateIfCursorInRange(node); }
  public VisitImport = (node: ast.Import): void => { this.updateIfCursorInRange(node); }
  public VisitImportStr = (node: ast.ImportStr): void => { this.updateIfCursorInRange(node); }
  public VisitIndex = (node: ast.Index): void => { this.updateIfCursorInRange(node); }
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
  public VisitLocal = (node: ast.Local): void => { this.updateIfCursorInRange(node); }
  public VisitLiteralBoolean = (node: ast.LiteralBoolean): void => { this.updateIfCursorInRange(node); }
  public VisitLiteralNull = (node: ast.LiteralNull): void => { this.updateIfCursorInRange(node); }
  public VisitLiteralNumber = (node: ast.LiteralNumber): void => { this.updateIfCursorInRange(node); }
  public VisitLiteralString = (node: ast.LiteralString): void => { this.updateIfCursorInRange(node); }
  public VisitObjectField = (node: ast.ObjectField): void => { this.updateIfCursorInRange(node); }
  public VisitObject = (node: ast.ObjectNode): void => { this.updateIfCursorInRange(node); }
  public VisitDesugaredObjectField = (node: ast.DesugaredObjectField): void => { this.updateIfCursorInRange(node); }
  public VisitDesugaredObject = (node: ast.DesugaredObject): void => { this.updateIfCursorInRange(node); }
  public VisitObjectComp = (node: ast.ObjectComp): void => { this.updateIfCursorInRange(node); }
  public VisitObjectComprehensionSimple = (node: ast.ObjectComprehensionSimple): void => { this.updateIfCursorInRange(node); }
  public VisitSelf = (node: ast.Self): void => { this.updateIfCursorInRange(node); }
  public VisitSuperIndex = (node: ast.SuperIndex): void => { this.updateIfCursorInRange(node); }
  public VisitUnary = (node: ast.Unary): void => { this.updateIfCursorInRange(node); }
  public VisitVar = (node: ast.Var): void => { this.updateIfCursorInRange(node); }

  private updateIfCursorInRange = (node: ast.Node): ast.Node => {
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
    }

    return this.tightestWrappingNode;
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
