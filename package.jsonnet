local package = import "./package.libsonnet";

local contributes = package.contributes;
local event = package.event;
local grammar = package.contributes.grammar;
local keybinding = package.contributes.keybinding;
local language = package.contributes.language;
local languageSpec = package.languageSpec;

local jsonnetLanguage = languageSpec.Default(
  "jsonnet", "Jsonnet", [".jsonnet",".libsonnet"]);

local preview = contributes.command.Default(
  "jsonnet.preview",
  "Jsonnet: Open Preview");

local previewToSide = contributes.command.Default(
  "jsonnet.previewToSide",
  "Jsonnet: Open Preview to the Side");

local previewKeybinding = keybinding.FromCommand(
  previewToSide, "editorFocus", "shift+ctrl+i", mac="shift+cmd+i");

package.Default() +
package.Name(jsonnetLanguage.name) +
package.DisplayName(jsonnetLanguage.displayName) +
package.Description("Language support for Jsonnet") +
package.Version("0.0.7") +
package.Publisher("heptio") +
package.License("SEE LICENSE IN 'LICENSE' file") +
package.Homepage("https://github.com/heptio/vscode-jsonnet/blob/master/README.md") +
package.Category("Languages") +
package.ActivationEvent(event.OnCommand(previewToSide.command)) +
package.ActivationEvent(event.OnCommand(preview.command)) +
package.Main("./out/src/extension") +

// Repository.
package.repository.Default("git", "https://github.com/heptio/vscode-jsonnet.git") +

// Engines.
package.engines.VsCode("^1.10.0") +

// Contribution points.
package.contributes.Language(language.FromLanguageSpec(
  jsonnetLanguage, "./language-configuration.json")) +
package.contributes.Grammar(grammar.FromLanguageSpec(
  jsonnetLanguage, "source.jsonnet", "./syntaxes/jsonnet.tmLanguage.json")) +
package.contributes.Command(previewToSide) +
package.contributes.Command(preview) +
package.contributes.Keybinding(previewKeybinding) +
package.contributes.DefaultConfiguration(
  "Jsonnet configuration",
  contributes.configuration.DefaultStringProperty(
    "jsonnet.executablePath", "Location of the `jsonnet` executable.") +
  contributes.configuration.DefaultObjectProperty(
    "jsonnet.extStrs", "External strings to pass to `jsonnet` executable.")) +

// Everything else.
{
  scripts: {
    "vscode:prepublish": "tsc -p ./",
    compile: "tsc -watch -p ./",
    postinstall: "node ./node_modules/vscode/bin/install",
    test: "node ./node_modules/vscode/bin/test"
  },
  devDependencies: {
    typescript: "^2.0.3",
    vscode: "^1.0.0",
    mocha: "^2.3.3",
    "@types/node": "^6.0.40",
    "@types/mocha": "^2.2.32"
  }
}