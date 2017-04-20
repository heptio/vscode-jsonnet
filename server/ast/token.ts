'use strict';

// ---------------------------------------------------------------------------

export interface Location {
  line: number
  column: number
};

export interface LocationRange {
  fileName: string
  begin: Location
  end: Location
};

// ---------------------------------------------------------------------------

type TokenKind =
  // Symbols
  "TokenBraceL" |
  "TokenBraceR" |
  "TokenBracketL" |
  "TokenBracketR" |
  "TokenComma" |
  "TokenDollar" |
  "TokenDot" |
  "TokenParenL" |
  "TokenParenR" |
  "TokenSemicolon" |

  // Arbitrary length lexemes
  "TokenIdentifier" |
  "TokenNumber" |
  "TokenOperator" |
  "TokenStringBlock" |
  "TokenStringDouble" |
  "TokenStringSingle" |
  "TokenCommentCpp" |

  // Keywords
  "TokenAssert" |
  "TokenElse" |
  "TokenError" |
  "TokenFalse" |
  "TokenFor" |
  "TokenFunction" |
  "TokenIf" |
  "TokenImport" |
  "TokenImportStr" |
  "TokenIn" |
  "TokenLocal" |
  "TokenNullLit" |
  "TokenSelf" |
  "TokenSuper" |
  "TokenTailStrict" |
  "TokenThen" |
  "TokenTrue" |

  // A special token that holds line/column information about the end of the
  // file.
  "TokenEndOfFile"

// ---------------------------------------------------------------------------

export interface Token {
  kind:   TokenKind  // The type of the token
  // fodder: Fodder     // Any fodder the occurs before this token
  data:   string     // Content of the token if it is not a keyword

  // Extra info for when kind == tokenStringBlock
  // StringBlockIndent     string // The sequence of whitespace that indented the block.
  // StringBlockTermIndent string // This is always fewer whitespace characters than in stringBlockIndent.

  loc: LocationRange
}
