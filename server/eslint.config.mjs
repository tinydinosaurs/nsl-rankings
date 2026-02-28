import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
	// Base JS rules
	js.configs.recommended,

	// Server source files
	{
		files: ['**/*.js'],
		ignores: ['*.test.js', 'vitest.config.js'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
			'no-console': 'off', // Console is fine in server code
		},
	},

	// Test files
	{
		files: ['**/*.test.js'],
		languageOptions: {
			globals: {
				...globals.node,
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				vi: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
		},
	},

	// Prettier must be last — disables conflicting rules
	prettierConfig,

	{
		ignores: ['node_modules/**', 'data/**'],
	},
];
