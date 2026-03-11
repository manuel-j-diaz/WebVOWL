import js from "@eslint/js";
import globals from "globals";

export default [
	js.configs.recommended,
	{
		files: ["src/**/*.js"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "commonjs",
			globals: {
				...globals.browser,
				d3: "readonly",
				webvowl: "readonly",
				__WEBVOWL_VERSION__: "readonly",
			},
		},
		rules: {
			"no-bitwise": "error",
			"eqeqeq": ["error", "smart"],
			"guard-for-in": "error",
			"no-use-before-define": ["error", { functions: false }],
			"no-caller": "error",
			"no-new": "error",
			"no-prototype-builtins": "warn",
			"no-unused-vars": ["warn", { args: "none" }],
			"no-var": "error",
			"prefer-const": ["error", { destructuring: "all" }],
			"prefer-template": "warn",
			"prefer-arrow-callback": ["warn", { allowNamedFunctions: true }],
		},
	},
	{
		files: ["test/**/*.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: {
				...globals.browser,
				...globals.jest,
				d3: "readonly",
				vi: "readonly",
			},
		},
	},
	{
		files: ["test/**/*.mjs"],
		languageOptions: {
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.jest,
				d3: "readonly",
				vi: "readonly",
			},
		},
	},
	{ ignores: ["deploy/**", "node_modules/**"] },
];
