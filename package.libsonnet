{

  Default():: {
    engines: {},
    categories: [],
    activationEvents: [],
  },
  Name(name):: {name: name},
  DisplayName(displayName):: {displayName: displayName},
  Description(description):: {description: description},
  Version(version):: {version: version},
  Publisher(publisher):: {publisher: publisher},
  License(license):: {license: license},
  Homepage(homepage):: {homepage: homepage},
  Category(category):: {categories+: [category]},
  ActivationEvent(event):: {activationEvents+: [event]},
  Main(main):: {main: main},

  repository:: {
    Default(type, url):: {
      repository: {
        type: type,
        url: url,
      },
    },
  },

  engines:: {
    VsCode(vscodeVersion):: {
      engines+: {
        vscode: vscodeVersion,
      },
    },
  },

  event:: {
    OnCommand(id):: "onCommand:%s" % id,
  },

  languageSpec:: {
    Default(name, displayName, extensions):: {
      name: name,
      displayName: displayName,
      extensions: extensions,
    }
  },

  contributes:: {
    Default():: {
      languages: [],
      grammars: [],
      commands: [],
      keybindings: [],
    },

    Language(language):: {languages+: [language]},
    Grammar(grammar):: {grammars+: [grammar]},
    Command(command):: {commands+: [command]},
    Keybinding(keybinding):: {keybindings+: [keybinding]},

    command:: {
      Default(command, title):: {
        command: command,
        title: title,
      },
    },

    keybinding:: {
      FromCommand(command, when, key, mac=null):: {
        command: command.command,
        key: key,
        [if !(mac == null) then "mac"]: mac,
        when: when,
      },
    },

    language:: {
      FromLanguageSpec(language, configurationFile):: {
        id: language.name,
        aliases: [language.displayName, language.name],
        extensions: language.extensions,
        configuration: configurationFile,
      },
    },

    grammar:: {
      FromLanguageSpec(language, scopeName, path):: {
        language: language.name,
        scopeName: scopeName,
        path: path,
      },
    },
  },
}