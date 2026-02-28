import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import vitestPlugin from '@vitest/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';

export default [
	// Base JS rules
	js.configs.recommended,

	// React source files
	{
		files: ['src/**/*.{js,jsx}'],
		plugins: {
			react: reactPlugin,
			'react-hooks': reactHooksPlugin,
			'react-refresh': reactRefreshPlugin,
		},
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		settings: {
			react: { version: 'detect' },
		},
		rules: {
			...reactPlugin.configs.recommended.rules,
			...reactHooksPlugin.configs.recommended.rules,
			'react-refresh/only-export-components': 'warn',
			'react/react-in-jsx-scope': 'off', // Not needed with React 17+
			'react/prop-types': 'off', // We're not using PropTypes
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
			'no-console': 'warn',
		},
	},

	// Test files
	{
		files: ['src/**/*.test.{js,jsx}'],
		plugins: {
			vitest: vitestPlugin,
		},
		languageOptions: {
			globals: {
				...globals.browser,
				...vitestPlugin.environments.env.globals,
			},
		},
		rules: {
			...vitestPlugin.configs.recommended.rules,
			'no-console': 'off',
		},
	},

	// Prettier must be last — disables conflicting rules
	prettierConfig,

	{
		ignores: ['dist/**', 'node_modules/**'],
	},
];
