/**
 * Lint rules for the NestJS backend.
 *
 * `parserOptions.project` gives the parser type information, so type-aware
 * rules work. `no-explicit-any` and `no-unused-vars` are `warn` so the suite
 * can tighten gradually; the lint script's `--max-warnings 0` is what makes CI
 * block on them.
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
  overrides: [
    {
      // Migrations are append-only history and `.cursorrules` forbids editing an
      // old migration, so an unused `queryRunner` in `down()` is left alone.
      files: ['src/database/migrations/**/*.ts'],
      rules: { '@typescript-eslint/no-unused-vars': 'off' },
    },
  ],
};