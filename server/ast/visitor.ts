'use strict';
import * as server from 'vscode-languageserver';

import * as ast from './schema';

export interface Visitor<T> {
  Visit(node: ast.Node): T
  VisitComment(node: ast.Comment): T
  // VisitCompSpec(node: ast.CompSpec): T
  // VisitApply(node: ast.Apply): T
  // VisitApplyBrace(node: ast.ApplyBrace): T
  // VisitArray(node: ast.Array): T
  // VisitArrayComp(node: ast.ArrayComp): T
  // VisitAssert(node: ast.Assert): T
  // VisitBinary(node: ast.Binary): T
  // VisitBuiltin(node: ast.Builtin): T
  // VisitConditional(node: ast.Conditional): T
  // VisitDollar(node: ast.Dollar): T
  // VisitError(node: ast.Error): T
  // VisitFunction(node: ast.Function): T
  VisitImport(node: ast.Import): T
  VisitImportStr(node: ast.ImportStr): T
  VisitIndex(node: ast.Index): T
  // // VisitLocalBind(node: ast.LocalBind): T
  VisitLocal(node: ast.Local): T
  // VisitLiteralBoolean(node: ast.LiteralBoolean): T
  // VisitLiteralNull(node: ast.LiteralNull): T
  // VisitLiteralNumber(node: ast.LiteralNumber): T
  // VisitLiteralString(node: ast.LiteralString): T
  // // VisitObjectField(node: ast.ObjectField): T
  VisitObject(node: ast.ObjectNode): T
  // VisitDesugaredObjectField(node: ast.DesugaredObjectField): T
  // VisitDesugaredObject(node: ast.DesugaredObject): T
  // VisitObjectComp(node: ast.ObjectComp): T
  // VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): T
  // VisitSelf(node: ast.Self): T
  // VisitSuperIndex(node: ast.SuperIndex): T
  // VisitUnary(node: ast.Unary): T
  VisitVar(node: ast.Var): T
}

export abstract class VisitorBase<T> implements Visitor<T> {
  public Visit = (node: ast.Node): T => {
    if (node == null) {
      return;
    }

    switch(node.nodeType) {
    case "CommentNode": return this.VisitComment(<ast.Comment>node);
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
    case "ImportNode": return this.VisitImport(<ast.Import>node);
    case "ImportStrNode": return this.VisitImportStr(<ast.ImportStr>node);
    case "IndexNode": return this.VisitIndex(<ast.Index>node);
    // // case "LocalBindNode": return this.VisitLocalBind(<ast.LocalBind>node);
    case "LocalNode": return this.VisitLocal(<ast.Local>node);
    // case "LiteralBooleanNode": return this.VisitLiteralBoolean(node);
    // case "LiteralNullNode": return this.VisitLiteralNull(node);
    // case "LiteralNumberNode": return this.VisitLiteralNumber(node);
    // case "LiteralStringNode": return this.VisitLiteralString(node);
    // // case "ObjectFieldNode": return this.VisitObjectField(<ast.ObjectField>node);
    case "ObjectNode": return this.VisitObject(<ast.ObjectNode>node);
    // case "DesugaredObjectFieldNode": return this.VisitDesugaredObjectField(node);
    // case "DesugaredObjectNode": return this.VisitDesugaredObject(node);
    // case "ObjectCompNode": return this.VisitObjectComp(node);
    // case "ObjectComprehensionSimpleNode": return this.VisitObjectComprehensionSimple(node);
    // case "SelfNode": return this.VisitSelf(node);
    // case "SuperIndexNode": return this.VisitSuperIndex(node);
    // case "UnaryNode": return this.VisitUnary(node);
    case "VarNode": return this.VisitVar(<ast.Var>node);
    default: throw new Error(
      `Visitor could not traverse tree; unknown node type '${node.nodeType}'`);
    }
  }

  public abstract VisitComment(node: ast.Comment): T
  // public abstract VisitCompSpec(node: ast.CompSpec): T
  // public abstract VisitApply(node: ast.Apply): T
  // public abstract VisitApplyBrace(node: ast.ApplyBrace): T
  // public abstract VisitArray(node: ast.Array): T
  // public abstract VisitArrayComp(node: ast.ArrayComp): T
  // public abstract VisitAssert(node: ast.Assert): T
  // public abstract VisitBinary(node: ast.Binary): T
  // public abstract VisitBuiltin(node: ast.Builtin): T
  // public abstract VisitConditional(node: ast.Conditional): T
  // public abstract VisitDollar(node: ast.Dollar): T
  // public abstract VisitError(node: ast.Error): T
  // public abstract VisitFunction(node: ast.Function): T
  public abstract VisitImport(node: ast.Import): T
  public abstract VisitImportStr(node: ast.ImportStr): T
  public abstract VisitIndex(node: ast.Index): T
  // // public abstract VisitLocalBind(node: ast.LocalBind): T
  public abstract VisitLocal(node: ast.Local): T
  // public abstract VisitLiteralBoolean(node: ast.LiteralBoolean): T
  // public abstract VisitLiteralNull(node: ast.LiteralNull): T
  // public abstract VisitLiteralNumber(node: ast.LiteralNumber): T
  // public abstract VisitLiteralString(node: ast.LiteralString): T
  // // public abstract VisitObjectField(node: ast.ObjectField): T
  public abstract VisitObject(node: ast.ObjectNode): T
  // public abstract VisitDesugaredObjectField(node: ast.DesugaredObjectField): T
  // public abstract VisitDesugaredObject(node: ast.DesugaredObject): T
  // public abstract VisitObjectComp(node: ast.ObjectComp): T
  // public abstract VisitObjectComprehensionSimple(node: ast.ObjectComprehensionSimple): T
  // public abstract VisitSelf(node: ast.Self): T
  // public abstract VisitSuperIndex(node: ast.SuperIndex): T
  // public abstract VisitUnary(node: ast.Unary): T
  public abstract VisitVar(node: ast.Var): T
}
