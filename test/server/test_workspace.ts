import * as fs from 'fs';
import * as url from 'url';

import * as workspace from '../../server/ast/workspace';

export class FsDocumentManager implements workspace.DocumentManager {
  public get = (fileUri: string) => {
      const parsed = url.parse(fileUri);
      if (parsed && parsed.path) {
        // TODO: Perhaps make this a promise?
        return {text: fs.readFileSync(parsed.path).toString(), version: -1};
      }

      throw new Error(`INTERNAL ERROR: Failed to parse URI '${fileUri}'`);
  }
}
