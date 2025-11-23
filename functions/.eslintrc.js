export default {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2018,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  ignorePatterns: ["*.config.js", ".eslintrc.js"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {
    "require": "readonly",
    "module": "readonly",
    "exports": "readonly",
    "__dirname": "readonly",
    "__filename": "readonly",
    "process": "readonly",
    "console": "readonly",
    "Buffer": "readonly",
    "global": "readonly",
  },
};
