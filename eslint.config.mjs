// Flat ESLint config applied repo-wide. Each package's `lint` script runs
// `eslint .` from its own directory; this root config is picked up everywhere.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // RLS discipline: raw pool access is banned outside packages/db —
      // all tenant-scoped queries must flow through withTenant().
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message:
                'Import the pool/withTenant helpers from @raqeeb/db instead of using pg directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/db/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
