import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config (the file name is ESLint's flat-config name). Same rules as the old
// config, except `prettier/prettier`: eslint-plugin-prettier was never installed.
export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'backups', 'dbscripts'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
            'no-console': 'warn',
        },
    }
);
