// NOTE: This module "breaks" the circular dependency between different packages.
// By not being a TypeScript project with project references, we can use this
// tiny module as a glue between @app-config/node and @app-config/* extensions.

// NOTE: Also, we don't require modules up-front - lazy load them instead.
// This avoids circular dependency chains.
const { defaultAliases } = require('@app-config/node');

module.exports = {
  defaultExtensions(
    aliases = defaultAliases,
    environmentOverride,
    symmetricKey,
    environmentSourceNames,
  ) {
    const {
      unescape$Directives,
      tryDirective,
      ifDirective,
      eqDirective,
      envDirective,
      extendsDirective,
      extendsSelfDirective,
      overrideDirective,
      timestampDirective,
      environmentVariableSubstitution,
    } = require('@app-config/extensions');

    const { default: encryptedDirective } = require('@app-config/encryption');
    const { default: v1Compat } = require('@app-config/v1-compat');
    const { default: gitRefDirectives } = require('@app-config/git');

    return [
      unescape$Directives(),
      tryDirective(),
      ifDirective(),
      eqDirective(),
      v1Compat(),
      envDirective(aliases, environmentOverride, environmentSourceNames),
      extendsDirective(),
      extendsSelfDirective(),
      overrideDirective(),
      encryptedDirective(symmetricKey),
      timestampDirective(),
      environmentVariableSubstitution(aliases, environmentOverride, environmentSourceNames),
      gitRefDirectives(),
    ];
  },
  defaultEnvExtensions() {
    const { unescape$Directives, markAllValuesAsSecret } = require('@app-config/extensions');

    return [unescape$Directives(), markAllValuesAsSecret()];
  },
  defaultMetaExtensions() {
    const {
      unescape$Directives,
      tryDirective,
      ifDirective,
      eqDirective,
      extendsDirective,
      extendsSelfDirective,
      overrideDirective,
    } = require('@app-config/extensions');

    return [
      unescape$Directives(),
      tryDirective(),
      ifDirective(),
      eqDirective(),
      extendsDirective(),
      extendsSelfDirective(),
      overrideDirective(),
    ];
  },
};
