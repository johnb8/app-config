<p align="center">
  <img src="https://raw.githubusercontent.com/launchcodedev/app-config/master/img/app-config.png" width="40%" align="center" alt="app-config">
</p>

<p align="center">
  <a href="https://www.mozilla.org/en-US/MPL/2.0/">
    <img alt="Licensed under MPL 2.0" src="https://img.shields.io/badge/license-MPL_2.0-green.svg?style=flat-square"/>
  </a>
  <a href="https://www.npmjs.com/package/@lcdev/app-config">
    <img alt="npm" src="https://img.shields.io/npm/v/@lcdev/app-config.svg?style=flat-square"/>
  </a>
  <a href="https://github.com/launchcodedev/app-config/actions">
    <img alt="Build Status" src="https://img.shields.io/github/workflow/status/launchcodedev/app-config/CI?style=flat-square"/>
  </a>
  <a href="https://app-config.netlify.app">
    <img alt="Netlify Status" src="https://img.shields.io/netlify/8a8b48b6-cae6-4fd9-a085-a39f9d4ac140?style=flat-square"/>
  </a>
</p>

<p align="center">
  <i><b>Easy Configuration Loader with Strict Validation</b></i>
</p>

---

## Features

- **Schema Validation:** Avoid production typos. Write JSON Schema for your configuration, and we'll have your back.
- **Strong Typing:** Use it with TypeScript without separate validation. Types are generated based on JSON Schema constraints.
- **Powerful and Robust:** Flexible parsing extensions and file loading strategies. Provides file merging, environment specific values (eg. production vs development) and more.
- **First Class Encryption:** Manage your secrets in version control, backed by OpenPGP (optional). Or, keep secrets away from committed files with schema validation.
- **Use Your Tools:** Don't be constrained by your tools - export environment variables for usage anywhere.
- **Multi-Format:** Write YAML, TOML, JSON, JSON5 - whatever makes most sense for you.

## Using App Config

Read the [Introduction](https://app-config.netlify.app/guide/intro/) or [Quick Start](https://app-config.netlify.app/guide/intro/quick-start/) guides on our website.

Or, start by installing through your package manager:

```sh
yarn add @lcdev/app-config@2
```

## Contributing

Contributions are always welcome, no matter how large or small.
Substantial feature requests should be proposed as an Github issue first.
Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

See [Contributing](./CONTRIBUTING.md).
