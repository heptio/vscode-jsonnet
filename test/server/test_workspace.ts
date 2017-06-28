import * as fs from 'fs';
import * as url from 'url';

import * as ast from '../../server/parser/node';
import * as workspace from '../../server/ast/workspace';

export class FsDocumentManager implements workspace.DocumentManager {
  constructor(private readonly libResolver: workspace.LibPathResolver) {}

  public get = (
    fileSpec: workspace.FileUri | ast.Import | ast.ImportStr,
  ): {text: string, version?: number, resolvedPath: string} => {
    const fileUri = this.libResolver.resolvePath(fileSpec);
    if (fileUri == null || fileUri.path == null) {
      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileSpec}'`);
    }

    return {
      text: fs.readFileSync(fileUri.path).toString(),
      version: -1,
      resolvedPath: fileUri.path,
    };
  }
}
