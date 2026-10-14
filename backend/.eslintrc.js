// PlanIT backend ESLint configuration
// Run locally:  cd backend && npx eslint . --ext .js
// Fix auto-fixable issues:  npx eslint . --ext .js --fix

'use strict';

module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs',
  },
  rules: {
    // ── Errors (will fail CI) ────────────────────────────────────────────

    // No variables that are declared but never used.
    // Prefix with _ to intentionally ignore: function(_req, res) { ... }
    'no-unused-vars': ['error', {
      vars: 'all',
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],

    // No using variables before they are defined
    'no-use-before-define': ['error', { functions: false, classes: true }],

    // No eval() — serious security risk, especially in an auth/payment app
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Always use === and !== instead of == and !=
    // == does type coercion: "0" == false is true, which causes bugs
    'eqeqeq': ['error', 'always', { null: 'ignore' }],

    // No duplicate keys in object literals
    'no-dupe-keys': 'error',

    // No duplicate case labels in switch statements
    'no-duplicate-case': 'error',

    // No unreachable code after return/throw
    'no-unreachable': 'error',

    // require() calls must not be inside loops or conditionals
    // (hurts performance and can cause hard-to-debug issues)
    'global-require': 'warn',

    // No returning values from Promise executors — common async mistake
    'no-promise-executor-return': 'error',

    // Async functions must not return values in Promise constructor
    'no-async-promise-executor': 'error',

    // Disallow await inside loops (use Promise.all instead)
    'no-await-in-loop': 'warn',

    // ── Security-specific ────────────────────────────────────────────────

    // No process.exit() outside of top-level startup code.
    // Calling process.exit() in a route handler kills the entire server.
    // Use next(err) or res.status(500) instead.
    'no-process-exit': 'error',

    // ── Warnings (reported but won't fail CI on their own) ───────────────

    // console.log is fine during dev but should be cleaned up.
    // console.error and console.warn are allowed (used for error logging).
    'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],

    // Prefer const when a variable is never reassigned
    'prefer-const': 'warn',

    // Use template literals instead of string concatenation
    'prefer-template': 'warn',

    // Warn on TODO comments so they don't get forgotten
    'no-warning-comments': ['warn', {
      terms: ['todo', 'fixme', 'hack', 'xxx'],
      location: 'start',
    }],
  },

  // Ignore generated/vendor files
  ignorePatterns: [
    'node_modules/',
    '*.min.js',
  ],
};
