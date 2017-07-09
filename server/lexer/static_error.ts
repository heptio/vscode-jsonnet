import * as ast from "../parser/node";

export const staticErrorPrefix = "STATIC ERROR: ";
export const runtimeErrorPrefix = "RUNTIME ERROR: ";

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

  public static fromString = (coord: string): Location | null => {
    const nums = coord.split(":");
    if (nums.length != 2) {
      return null;
    }
    return new Location(parseInt(nums[0]), parseInt(nums[1]));
  }

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

  public static fromString = (
    filename: string, loc: string,
  ): LocationRange | null => {
    // NOTE: Use `g` to search the string for all coordinates
    // formatted as `x:y`.
    const coordinates = loc.match(/(\d+:\d+)+/g);

    let start: Location | null = null;
    let end: Location | null = null;
    if (coordinates == null) {
      console.log(`Could not parse coordinates '${loc}'`);
      return null;
    } else if (coordinates.length == 2) {
      // Easy case. Of the form `(x1:y1)-(x2:y2)`.
      start = Location.fromString(coordinates[0]);
      end = Location.fromString(coordinates[1]);
      return start != null && end != null && new LocationRange(filename, start, end) || null;
    } else if (coordinates.length == 1) {
      // One of two forms: `x1:y1` or `x1:y1-y2`.
      start = Location.fromString(coordinates[0]);
      if (start == null) {
        return null;
      }

      const y2 = loc.match(/\-(\d+)/);
      if (y2 == null) {
        end = start;
      } else {
        end = new Location(start.line, parseInt(y2[1]));
      }

      return new LocationRange(filename, start, end);
    } else {
      console.log(`Could not parse coordinates '${loc}'`);
      return null;
    }
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
