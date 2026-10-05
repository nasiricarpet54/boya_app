/**
 * Lint rules for the NestJS backend.
 *
 * `parserOptions.project` gives the parser type information, so type-aware
 * rules work. Rules below `recommended` that the project deliberately does not
 * follow are downgraded to `warn` and tracked in BACKLOG.md ("Lint Issues")
 * rather than fixed in bulk — CI runs `npm run lint` with
 * `continue-on-error: true` until that list is empty.
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // tsconfig.json excludes `test/`, tsconfig.test.json includes it. The lint
    // script covers both trees, so both projects are needed or every spec file
    // fails to parse.
    project: ['./tsconfig.json', './tsconfig.test.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.js', 'dist', 'dist-test', 'node_modules'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};