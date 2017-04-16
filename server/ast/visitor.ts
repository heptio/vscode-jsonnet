'use strict';
import * as server from 'vscode-languageserver';
import * as immutable from 'immutable';

import * as ast from './schema';

export interface Visitor {
  Visit(node: ast.Node, parent: ast.Node | null, currEnv: ast.Environment): void
  VisitComment(node: ast.Comment): void
  // VisitCompSpec(node: ast.CompSpec): void
  // VisitApply(node: ast.Apply): void
  // VisitApplyBrace(node: ast.ApplyBrace): void
  // VisitArray(node: ast.Array): void
  // VisitArrayComp(node: ast.ArrayComp): void
  // VisitAssert(node: ast.Assert): void
  // VisitBinary(node: ast.Binary): void
  // VisitBuiltin(node: ast.Builtin): void
  // VisitConditional(node: ast.Conditional): void
  // VisitDollar(node: ast.Dollar): void
  // VisitError(node: ast.Error): void
  // VisitFunction(node: ast.Function): void
  VisitIdentifier(node: ast.Identifier): void
  VisitImport(node: ast.Import): void
  VisitImportStr(node: ast.ImportStr): void
  VisitIndex(node: ast.Index): void
  // // VisitLocalBind(node: ast.LocalBind): void
  VisitLocal(node: ast.Local): void
  // VisitLiteralBoolean(node: ast.LiteralBoolean): void
  // VisitLiteralNull(node: ast.LiteralNull): void
  // VisitLiteralNumber(node: ast.LiteralNumber): void
  // VisitLiteralString(node: ast.LiteralString): void
  VisitObjectField(node: ast.ObjectField): void
  VisitObject(node: ast.ObjectNode): void
  // VisitDesugaredObjectField(node: ast.DesugaredObjectField): void
  // VisitDesugaredObject(node: ast.DesugaredObject): void
  // VisitObjectComp(node: ast.ObjectComp): void
  // VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): void
  // VisitSelf(node: ast.Self): void
  // VisitSuperIndex(node: ast.SuperIndex): void
  // VisitUnary(node: ast.Unary): void
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

    switch(node.nodeType) {
    case "CommentNode": {
      this.VisitComment(<ast.Comment>node);
      return;
    }
    // case "CompSpecNode": return this.VisitCompSpec(node);
    // case "ApplyNode": return this.VisitApply(node);
    // case "ApplyBraceNode": return this.VisitApplyBrace(node);
    // case "ArrayNode": return this.VisitArray(node);
    // case "ArrayCompNode": return this.VisitArrayComp(node);
    // case "AssertNode": return this.VisitAssert(node);
    // case "BinaryNode": return this.VisitBinary(node);
    // case "BuiltinNode": return this.VisitBuiltin(node);
    // case "ConditionalNode": return this.VisitConditional(node);
    // case "DollarNode": return this.VisitDollar(node);
    // case "ErrorNode": return this.VisitError(node);
    // case "FunctionNode": return this.VisitFunction(node);
    case "IdentifierNode": { this.VisitIdentifier(<ast.Identifier>node); }
    case "ImportNode": { this.VisitImport(<ast.Import>node); }
    case "ImportStrNode": { this.VisitImportStr(<ast.ImportStr>node); }
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
        bind.body != null && this.Visit(bind.body, castedNode, newEnv);
      });
      castedNode.body != null && this.Visit(
        castedNode.body, castedNode, newEnv);
      // throw new Error(`${newEnv.get("fooModule")}`);
      return;
    }
    // case "LiteralBooleanNode": return this.VisitLiteralBoolean(node);
    // case "LiteralNullNode": return this.VisitLiteralNull(node);
    // case "LiteralNumberNode": return this.VisitLiteralNumber(node);
    // case "LiteralStringNode": return this.VisitLiteralString(node);
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
          this.Visit(comment, castedNode, currEnv);
        });
      return;
    }
    case "ObjectNode": {
      const castedNode = <ast.ObjectNode>node;
      this.VisitObject(castedNode);
      castedNode.fields.forEach(field => {
        this.Visit(field, castedNode, currEnv);
      });
      return;
    }
    // case "DesugaredObjectFieldNode": return this.VisitDesugaredObjectField(node);
    // case "DesugaredObjectNode": return this.VisitDesugaredObject(node);
    // case "ObjectCompNode": return this.VisitObjectComp(node);
    // case "ObjectComprehensionSimpleNode": return this.VisitObjectComprehensionSimple(node);
    // case "SelfNode": return this.VisitSelf(node);
    // case "SuperIndexNode": return this.VisitSuperIndex(node);
    // case "UnaryNode": return this.VisitUnary(node);
    case "VarNode": {
      const castedNode = <ast.Var>node;
      this.VisitVar(castedNode);
      castedNode.id != null && this.Visit(castedNode.id, castedNode, currEnv);
      return
    }
    default: throw new Error(
      `Visitor could not traverse tree; unknown node type '${node.nodeType}'`);
    }
  }

  public abstract VisitComment(node: ast.Comment): void
  // public abstract VisitCompSpec(node: ast.CompSpec): void
  // public abstract VisitApply(node: ast.Apply): void
  // public abstract VisitApplyBrace(node: ast.ApplyBrace): void
  // public abstract VisitArray(node: ast.Array): void
  // public abstract VisitArrayComp(node: ast.ArrayComp): void
  // public abstract VisitAssert(node: ast.Assert): void
  // public abstract VisitBinary(node: ast.Binary): void
  // public abstract VisitBuiltin(node: ast.Builtin): void
  // public abstract VisitConditional(node: ast.Conditional): void
  // public abstract VisitDollar(node: ast.Dollar): void
  // public abstract VisitError(node: ast.Error): void
  // public abstract VisitFunction(node: ast.Function): void
  public abstract VisitIdentifier(node: ast.Identifier): void
  public abstract VisitImport(node: ast.Import): void
  public abstract VisitImportStr(node: ast.ImportStr): void
  public abstract VisitIndex(node: ast.Index): void
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
  public abstract VisitLocal(node: ast.Local): void
  // public abstract VisitLiteralBoolean(node: ast.LiteralBoolean): void
  // public abstract VisitLiteralNull(node: ast.LiteralNull): void
  // public abstract VisitLiteralNumber(node: ast.LiteralNumber): void
  // public abstract VisitLiteralString(node: ast.LiteralString): void
  public abstract VisitObjectField(node: ast.ObjectField): void
  public abstract VisitObject(node: ast.ObjectNode): void
  // public abstract VisitDesugaredObjectField(node: ast.DesugaredObjectField): void
  // public abstract VisitDesugaredObject(node: ast.DesugaredObject): void
  // public abstract VisitObjectComp(node: ast.ObjectComp): void
  // public abstract VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): void
  // public abstract VisitSelf(node: ast.Self): void
  // public abstract VisitSuperIndex(node: ast.SuperIndex): void
  // public abstract VisitUnary(node: ast.Unary): void
  public abstract VisitVar(node: ast.Var): void
}

// Finds the tightest-binding node that wraps the location denoted by
// `position`.
export class CursorVisitor extends VisitorBase {
  constructor(
    private document: server.TextDocument,
    position: server.Position,
  ) {
    super();
    this.position = {
      line: position.line + 1,
      col: position.character + 1,
    };
  }

  get NodeAtPosition(): ast.NodeBase { return this.tightestWrappingNode; }

  private tightestWrappingNode: ast.NodeBase;
  private position: {line: number, col: number};

  public VisitComment(node: ast.Comment): void {
    this.updateIfCursorInRange(node);
  }
  // public abstract VisitCompSpec(node: ast.CompSpec): void
  // public abstract VisitApply(node: ast.Apply): void
  // public abstract VisitApplyBrace(node: ast.ApplyBrace): void
  // public abstract VisitArray(node: ast.Array): void
  // public abstract VisitArrayComp(node: ast.ArrayComp): void
  // public abstract VisitAssert(node: ast.Assert): void
  // public abstract VisitBinary(node: ast.Binary): void
  // public abstract VisitBuiltin(node: ast.Builtin): void
  // public abstract VisitConditional(node: ast.Conditional): void
  // public abstract VisitDollar(node: ast.Dollar): void
  // public abstract VisitError(node: ast.Error): void
  // public abstract VisitFunction(node: ast.Function): void
  public VisitIdentifier(node: ast.Identifier): void { this.updateIfCursorInRange(node); }
  public VisitImport(node: ast.Import): void { this.updateIfCursorInRange(node); }
  public VisitImportStr(node: ast.ImportStr): void { this.updateIfCursorInRange(node); }
  public VisitIndex(node: ast.Index): void { this.updateIfCursorInRange(node); }
  // // public abstract VisitLocalBind(node: ast.LocalBind): void
  public VisitLocal(node: ast.Local): void { this.updateIfCursorInRange(node); }
  // public abstract VisitLiteralBoolean(node: ast.LiteralBoolean): void
  // public abstract VisitLiteralNull(node: ast.LiteralNull): void
  // public abstract VisitLiteralNumber(node: ast.LiteralNumber): void
  // public abstract VisitLiteralString(node: ast.LiteralString): void
  public VisitObjectField(node: ast.ObjectField): void { this.updateIfCursorInRange(node); }
  public VisitObject(node: ast.ObjectNode): void { this.updateIfCursorInRange(node); }
  // public abstract VisitDesugaredObjectField(node: ast.DesugaredObjectField): void
  // public abstract VisitDesugaredObject(node: ast.DesugaredObject): void
  // public abstract VisitObjectComp(node: ast.ObjectComp): void
  // public abstract VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): void
  // public abstract VisitSelf(node: ast.Self): void
  // public abstract VisitSuperIndex(node: ast.SuperIndex): void
  // public abstract VisitUnary(node: ast.Unary): void
  public VisitVar(node: ast.Var): void { this.updateIfCursorInRange(node); }

  private updateIfCursorInRange(node: ast.NodeBase): ast.Node {
    const locationRange = node.locationRange;
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

function nodeRangeIsTighter(thisNode: ast.NodeBase, thatNode: ast.NodeBase): boolean {
  if (thatNode == null) {
    return true;
  }

  const thisNodeBegin = {
    line: thisNode.locationRange.begin.line,
    col: thisNode.locationRange.begin.column
  };
  const thisNodeEnd = {
    line: thisNode.locationRange.end.line,
    col: thisNode.locationRange.end.column
  };
  const thatNodeRange = {
    beginLine: thatNode.locationRange.begin.line,
    endLine: thatNode.locationRange.end.line,
    beginCol: thatNode.locationRange.begin.column,
    endCol: thatNode.locationRange.end.column,
  };
  return cursorInLocationRange(thisNodeBegin, thatNodeRange) &&
    cursorInLocationRange(thisNodeEnd, thatNodeRange);
}

function cursorInLocationRange(
  cursor: {line: number, col: number},
  range: {beginLine: number, endLine: number, beginCol: number, endCol: number},
): boolean {

  if (range.beginLine == cursor.line && cursor.line == range.endLine &&
    range.beginCol <= cursor.col && cursor.col <= range.endCol
  ) {
    return true;
  } else if (range.beginLine < cursor.line && cursor.line == range.endLine &&
    cursor.col <= range.endCol
  ) {
    return true;
  } else if (range.beginLine == cursor.line && cursor.line < range.endLine &&
    cursor.col >= range.beginCol
  ) {
      return true;
  } else if (range.beginLine < cursor.line && cursor.line < range.endLine) {
    return true;
  } else {
    return false;
  }
};
