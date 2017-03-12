local identifier = "[a-zA-Z_][a-z0-9A-Z_]*";

local Include(id) = { include: "#%s" % id };
local Pattern(name, match) = {
  name: name,
  match: match,
};

{
  "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  name: "Jsonnet",
  patterns: [
    Include("expression"),
    Include("keywords"),
  ],
  repository: {
    expression: {
      patterns: [
        Include("literals"),
        Include("comment"),
        Include("double-quoted-strings"),
        Include("triple-quoted-strings"),
        Include("builtin-functions"),
        Include("functions"),
      ]
    },
    keywords: {
      patterns: [
        Pattern("keyword.operator.jsonnet", "[!:~\\+\\-&\\|\\^=<>\\*\\/%]"),
        Pattern("keyword.other.jsonnet", "\\$"),
        Pattern("keyword.other.jsonnet", "\\b(self|super|import|importstr|local|tailstrict)\\b"),
        Pattern("keyword.control.jsonnet", "\\b(if|then|else|for|in|error|assert)\\b"),
        Pattern("storage.type.jsonnet", "\\b(function)\\b"),
        Pattern("entity.name.type", "%s::" % identifier,),
        Pattern("variable.parameter.jsonnet", "%s:" % identifier),

      ]
    },
    "literals": {
      "patterns": [
        {
          "name": "constant.language.jsonnet",
          "match": "\\b(true|false|null)\\b"
        },
        {
          "name": "constant.numeric.jsonnet",
          "match": "\\b(\\d+([Ee][+-]?\\d+)?)\\b"
        },
        {
          "name": "constant.numeric.jsonnet",
          "match": "\\b\\d+[.]\\d*([Ee][+-]?\\d+)?\\b"
        },
        {
          "name": "constant.numeric.jsonnet",
          "match": "\\b[.]\\d+([Ee][+-]?\\d+)?\\b"
        }
      ]
    },
    "builtin-functions": {
      "patterns": [
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](acos|asin|atan|ceil|char|codepoint|cos|exp|exponent)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](filter|floor|force|length|log|makeArray|mantissa)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](objectFields|objectHas|pow|sin|sqrt|tan|type|thisFile)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](acos|asin|atan|ceil|char|codepoint|cos|exp|exponent)\\b"
        },

        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](abs|assertEqual|escapeString(Bash|Dollars|Json|Python))\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](filterMap|flattenArrays|foldl|foldr|format|join)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](lines|manifest(Ini|Python(Vars)?)|map|max|min|mod)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](set|set(Diff|Inter|Member|Union)|sort)\\b"
        },
        {
          "name": "support.function.jsonnet",
          "match": "\\bstd[.](range|split|stringChars|substr|toString|uniq)\\b"
        }
      ]
    },
    "double-quoted-strings": {
      "name": "string.quoted.double.jsonnet",
      "begin": "\"",
      "end": "\"",
      "patterns": [
        {
          "name": "constant.character.escape.jsonnet",
          "match": "\\\\([\"\\\\/bfnrt]|(u[0-9a-fA-F]{4}))"
        },
        {
          "name": "invalid.illegal.jsonnet",
          "match": "\\\\[^\"\\\\/bfnrtu]"
        }
      ]
    },
    "triple-quoted-strings": {
      "patterns": [
        {
          "name": "string.quoted.triple.jsonnet",
          "begin": "\\|\\|\\|",
          "end": "\\|\\|\\|"
        }
      ]
    },
    "functions": {
      "patterns": [
        {
          "name": "meta.function",
          "begin": "\\b([a-zA-Z_][a-z0-9A-Z_]*)\\s*\\(",
          "end": "\\)",
          "beginCaptures": {
            "1": { "name": "entity.name.function.jsonnet" }
          },
          "patterns": [
            { "include": "#expression" }
          ]
        }
      ]
    },
    "comment": {
      "patterns": [
        {
          "name": "comment.block.jsonnet",
          "begin": "/\\*",
          "end": "\\*/"
        },

        {
          "name": "comment.line.jsonnet",
          "match": "//.*$"
        },

        {
          "name": "comment.block.jsonnet",
          "match": "#.*$"
        }
      ]
    }
  },
  "scopeName": "source.jsonnet"
}