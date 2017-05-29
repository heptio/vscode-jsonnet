import * as ast from "../parser/node";

//////////////////////////////////////////////////////////////////////////////
// Location

// Location represents a single location in an (unspecified) file.
export class Location {
  constructor(
    readonly line:   number,
    readonly column: number,
  ) {}

  // IsSet returns if this Location has been set.
  public IsSet = (): boolean => {
    return this.line != 0
  };

  public String = (): string => {
    return `${this.line}:${this.column}`;
  };

  public beforeRangeOrEqual = (range: LocationRange): boolean => {
    const begin = range.begin;
    if (this.line < begin.line) {
      return true;
    } else if (this.line == begin.line && this.column <= begin.column) {
      return true;
    }
    return false;
  }

  public strictlyBeforeRange = (range: LocationRange): boolean => {
    const begin = range.begin;
    if (this.line < begin.line) {
      return true;
    } else if (this.line == begin.line && this.column < begin.column) {
      return true;
    }
    return false;
  }

  public afterRangeOrEqual = (range: LocationRange): boolean => {
    const end = range.end;
    if (this.line > end.line) {
      return true;
    } else if (this.line == end.line && this.column >= end.column) {
      return true;
    }
    return false;
  }

  public strictlyAfterRange = (range: LocationRange): boolean => {
    const end = range.end;
    if (this.line > end.line) {
      return true;
    } else if (this.line == end.line && this.column > end.column) {
      return true;
    }
    return false;
  }

  public inRange = (loc: LocationRange): boolean => {
    const range = {
      beginLine: loc.begin.line,
      endLine: loc.end.line,
      beginCol: loc.begin.column,
      endCol: loc.end.column,
    }

    if (
      range.beginLine == this.line && this.line == range.endLine &&
      range.beginCol <= this.column && this.column <= range.endCol
    ) {
      return true;
    } else if (
      range.beginLine < this.line && this.line == range.endLine &&
      this.column <= range.endCol
    ) {
      return true;
    } else if (
      range.beginLine == this.line && this.line < range.endLine &&
      this.column >= range.beginCol
    ) {
      return true;
    } else if (range.beginLine < this.line && this.line < range.endLine) {
      return true;
    } else {
      return false;
    }
  }
}

const emptyLocation = () => new Location(0, 0);

//////////////////////////////////////////////////////////////////////////////
// LocationRange

// LocationRange represents a range of a source file.
export class LocationRange {
  constructor(
    readonly fileName: string,
    readonly begin:    Location,
    readonly end:      Location,
  ) {}

  // IsSet returns if this LocationRange has been set.
  public IsSet = (): boolean => {
    return this.begin.IsSet()
  };

  public String = (): string => {
    if (!this.IsSet()) {
      return this.fileName
    }

    let filePrefix = "";
    if (this.fileName.length > 0) {
      filePrefix = this.fileName + ":";
    }
    if (this.begin.line == this.end.line) {
      if (this.begin.column == this.end.column) {
        return `${filePrefix}${this.begin.String()}`
      }
      return `${filePrefix}${this.begin.String()}-${this.end.column}`;
    }

    return `${filePrefix}(${this.begin.String()})-(${this.end.String()})`;
  }

  public rangeIsTighter = (thatRange: LocationRange): boolean => {
    return this.begin.inRange(thatRange) && this.end.inRange(thatRange);
  }
}

// This is useful for special locations, e.g. manifestation entry point.
export const MakeLocationRangeMessage = (msg: string): LocationRange => {
  return new LocationRange(msg, emptyLocation(), emptyLocation());
}

export const MakeLocationRange = (
  fn: string, begin: Location, end: Location
): LocationRange => {
  return new LocationRange(fn, begin, end);
}

//////////////////////////////////////////////////////////////////////////////
// StaticError

// StaticError represents an error during parsing/lexing some jsonnet.
export class StaticError {
  constructor (
    // rest allows the parser to return a partial parse result. For
    // example, if the user types a `.`, it is likely the document
    // will not parse, and it is useful to the autocomplete mechanisms
    // to return the AST that preceeds the `.` character.
    readonly rest: ast.Node | null,
    readonly loc: LocationRange,
    readonly msg: string,
  ) {}

  public Error = (): string => {
    const loc = this.loc.IsSet()
      ? this.loc.String()
      : "";
    return `${loc} ${this.msg}`;
  }
}

export const isStaticError = (x: any): x is StaticError => {
    return x instanceof StaticError;
}

export const MakeStaticErrorMsg = (msg: string): StaticError => {
  return new StaticError(null, MakeLocationRangeMessage(""), msg);
}

export const MakeStaticErrorPoint = (
  msg: string, fn: string, l: Location
): StaticError => {
  return new StaticError(null, MakeLocationRange(fn, l, l), msg);
}

export const MakeStaticError = (
  msg: string, lr: LocationRange
): StaticError => {
  return new StaticError(null, lr, msg);
}

export const MakeStaticErrorRest = (
  rest: ast.Node, msg: string, lr: LocationRange
): StaticError => {
  return new StaticError(rest, lr, msg);
}
