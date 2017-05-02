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
  return new StaticError(MakeLocationRangeMessage(""), msg);
}

export const MakeStaticErrorPoint = (
  msg: string, fn: string, l: Location
): StaticError => {
  return new StaticError(MakeLocationRange(fn, l, l), msg);
}

export const MakeStaticError = (
  msg: string, lr: LocationRange
): StaticError => {
  return new StaticError(lr, msg);
}
