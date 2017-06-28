import * as fs from 'fs';
import * as path from 'path';
import * as server from 'vscode-languageserver';

import * as immutable from 'immutable';

import * as ast from './parser/node';
import * as astVisitor from './ast/visitor';
import * as compile from "./ast/compiler";
import * as error from './lexer/static_error';
import * as workspace from './ast/workspace';

// fromFailure creates a diagnostic from a `LexFailure |
// ParseFailure`.
export const fromFailure = (
  error: compile.LexFailure | compile.ParseFailure
): server.Diagnostic => {
  let begin: error.Location | null = null;
  let end: error.Location | null = null;
  let message: string | null = null;
  if (compile.isLexFailure(error)) {
    begin = error.lexError.loc.begin;
    end = error.lexError.loc.end;
    message = error.lexError.msg;
  } else {
    begin = error.parseError.loc.begin;
    end = error.parseError.loc.end;
    message = error.parseError.msg;
  }

  return {
    severity: server.DiagnosticSeverity.Error,
    range: {
      start: {line: begin.line - 1, character: begin.column - 1},
      end: {line: end.line - 1, character: end.column - 1},
    },
    message: `${message}`,
    source: `Jsonnet`,
  };
}

// fromAst takes a Jsonnet AST and returns an array of `Diagnostic`
// issues it finds.
export const fromAst = (
  root: ast.Node, libResolver: workspace.LibPathResolver,
): server.Diagnostic[] => {
  const diags = new Visitor(root, libResolver);
  diags.visit();
  return diags.diagnostics;
}

// ----------------------------------------------------------------------------
// Private utilities.
// ----------------------------------------------------------------------------

// Visitor traverses the Jsonnet AST and accumulates `Diagnostic`
// errors for reporting.
class Visitor extends astVisitor.VisitorBase {
  private diags = immutable.List<server.Diagnostic>();

  constructor(
    root: ast.Node,
    private readonly libResolver: workspace.LibPathResolver,
  ) {
    super(root);
  }

  get diagnostics(): server.Diagnostic[] {
    return this.diags.toArray();
  }

  protected visitImport = (node: ast.Import): void =>
    this.importDiagnostics(node);

  protected visitImportStr = (node: ast.ImportStr): void =>
    this.importDiagnostics(node);

  private importDiagnostics = (node: ast.Import | ast.ImportStr): void => {
    if (!this.libResolver.resolvePath(node)) {
      const begin = node.loc.begin;
      const end = node.loc.end;
      const diagnostic = {
        severity: server.DiagnosticSeverity.Warning,
        range: {
          start: {line: begin.line - 1, character: begin.column - 1},
          end: {line: end.line - 1, character: end.column - 1},
        },
        message:
          `Can't find path '${node.file}'. If the file is not in the ` +
          `current directory, it may be necessary to add it to the ` +
          `'jsonnet.libPaths'. If you are in vscode, you can press ` +
          `'cmd/ctrl-,' and add the path this library is located at to the ` +
          `'jsonnet.libPaths' array`,
        source: `Jsonnet`,
      };

      this.diags = this.diags.push(diagnostic);
    }
  }
}
