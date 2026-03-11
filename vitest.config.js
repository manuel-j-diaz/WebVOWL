import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./test/setup.mjs"],
		environment: "jsdom",
		include: ["test/**/*Test.js"],
	},
});
