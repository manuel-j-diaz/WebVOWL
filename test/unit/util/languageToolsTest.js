describe("Language tools text selection", function () {
	var languageTools;

	beforeEach(function () {
		languageTools = require("../../../src/webvowl/js/util/languageTools")();
	});

	it("should return undefined for undefined input", function () {
		expect(languageTools.textInLanguage(undefined, "en")).toBeUndefined();
	});

	it("should return string directly for string input", function () {
		expect(languageTools.textInLanguage("hello", "en")).toBe("hello");
	});

	it("should return preferred language value when key exists", function () {
		var text = { en: "hello", de: "hallo" };
		expect(languageTools.textInLanguage(text, "de")).toBe("hallo");
	});

	it("should fall back to English when preferred language is missing", function () {
		var text = { en: "hello", fr: "bonjour" };
		expect(languageTools.textInLanguage(text, "de")).toBe("hello");
	});

	it("should fall back to undefined language when no English", function () {
		var text = { "undefined": "fallback", fr: "bonjour" };
		expect(languageTools.textInLanguage(text, "de")).toBe("fallback");
	});

	it("should fall back to IRI-based as last resort", function () {
		var text = { "IRI-based": "iri-val", fr: "bonjour" };
		expect(languageTools.textInLanguage(text, "de")).toBe("iri-val");
	});

	it("should return undefined for empty object with no matching keys", function () {
		expect(languageTools.textInLanguage({}, "en")).toBeUndefined();
	});

	it("should return undefined when only unrelated languages present", function () {
		var text = { fr: "bonjour", ja: "konnichiwa" };
		expect(languageTools.textInLanguage(text, "de")).toBeUndefined();
	});
});
