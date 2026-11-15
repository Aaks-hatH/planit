module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.2' } },
  ignorePatterns: ['dist', 'node_modules', 'audit-shots', 'server.js', '*.cjs', 'planit-visual-audit.mjs', 'careersPrerender.js', 'blogPrerender.js', 'shareMeta.js', 'jobPostingLd.js'],
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    // Known debt from the dark->light conversion; tracked as warnings so CI can gate on errors (rules-of-hooks, no-undef).
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^[A-Z]', ignoreRestSiblings: true }],
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'off',
  },
};
