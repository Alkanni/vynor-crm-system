import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  // Import boundary: packages must not depend on apps
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vynor/web*', '@vynor/api*', '@vynor/worker*'],
              message: 'Shared packages must not import from application shells (@vynor/* apps).',
            },
            {
              group: ['**/apps/**', '../../apps/**'],
              message: 'Shared packages must not import from the apps directory.',
            },
          ],
        },
      ],
    },
  },
  // Import boundary: backend apps must not import frontend web
  {
    files: ['apps/api/**/*.{ts,tsx}', 'apps/worker/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vynor/web*', '**/apps/web/**'],
              message: 'Backend services must not import frontend web shell (@vynor/web).',
            },
          ],
        },
      ],
    },
  },
  // Import boundary: frontend web must not import backend API or worker shells directly
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vynor/api*', '@vynor/worker*', '**/apps/api/**', '**/apps/worker/**'],
              message:
                'Frontend web shell must communicate via contracts or HTTP, not direct backend imports.',
            },
          ],
        },
      ],
    },
  },
);
