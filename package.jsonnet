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

package.Default() +
package.Name(jsonnetLanguage.name) +
package.DisplayName(jsonnetLanguage.displayName) +
package.Description("Language support for Jsonnet") +
package.Version("0.0.5") +
package.Publisher("heptio") +
package.License("SEE LICENSE IN 'LICENSE' file") +
package.Homepage("https://github.com/heptio/vscode-jsonnet/blob/master/README.md") +
package.repository.Default("git", "https://github.com/heptio/vscode-jsonnet.git") +
package.engines.VsCode("^1.10.0") +
package.Category("Languages") +
package.ActivationEvent(event.OnCommand(previewToSide.command)) +
package.ActivationEvent(event.OnCommand(preview.command)) +
package.Main("./out/src/extension") +
{
  local previewKeybinding = keybinding.FromCommand(
    previewToSide, "editorFocus", "shift+ctrl+i", mac="shift+cmd+i"),

  contributes:
    contributes.Default() +
    contributes.Language(language.FromLanguageSpec(
      jsonnetLanguage, "./language-configuration.json")) +
    contributes.Grammar(grammar.FromLanguageSpec(
      jsonnetLanguage, "source.jsonnet", "./syntaxes/jsonnet.tmLanguage.json")) +
    contributes.Command(previewToSide) +
    contributes.Command(preview) +
    contributes.Keybinding(previewKeybinding) +
    contributes.DefaultConfiguration(
      "Jsonnet configuration",
      contributes.configuration.DefaultStringProperty(
        "jsonnet.executablePath", "Location of the `jsonnet` executable.")),
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