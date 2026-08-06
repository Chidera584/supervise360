import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // backend/ has its own lint config/invocation (npm --prefix backend run lint); scripts/legacy
  // are one-off pre-TypeScript-era scripts that were never linted and aren't valid ESM/TS.
  { ignores: ['dist', 'backend/**', 'scripts/legacy/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Pre-existing debt across the codebase (hundreds of call sites use `any` for DB row
      // shapes and loosely-typed request bodies) - downgraded to warn so CI can gate on lint
      // without being permanently red. New code should still prefer real types.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  }
);
