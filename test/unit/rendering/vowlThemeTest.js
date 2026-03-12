const theme = require("../../../src/webvowl/js/rendering/vowlTheme");

describe("vowlTheme", () => {
	describe("FILL dictionary", () => {
		it("maps owl:Class-family styles to blue (#acf)", () => {
			const blueClasses = [
				"class", "object", "disjoint", "objectproperty",
				"disjointwith", "equivalentproperty", "transitiveproperty",
				"functionalproperty", "inversefunctionalproperty",
				"symmetricproperty", "allvaluesfromproperty", "somevaluesfromproperty",
			];
			for (const cls of blueClasses) {
				expect(theme.FILL[cls]).toBe("#acf");
			}
		});

		it("maps datatypeproperty to green (#9c6)", () => {
			expect(theme.FILL["datatypeproperty"]).toBe("#9c6");
		});

		it("maps rdf/rdfproperty to magenta (#c9c)", () => {
			expect(theme.FILL["rdf"]).toBe("#c9c");
			expect(theme.FILL["rdfproperty"]).toBe("#c9c");
		});

		it("maps literal/datatype to orange (#fc3)", () => {
			expect(theme.FILL["literal"]).toBe("#fc3");
			expect(theme.FILL["datatype"]).toBe("#fc3");
		});

		it("maps deprecated styles to gray (#ccc)", () => {
			expect(theme.FILL["deprecated"]).toBe("#ccc");
			expect(theme.FILL["deprecatedproperty"]).toBe("#ccc");
		});

		it("maps individual to light orange (#fca)", () => {
			expect(theme.FILL["individual"]).toBe("#fca");
		});

		it("maps subclass styles to light gray (#ecf0f1)", () => {
			expect(theme.FILL["subclass"]).toBe("#ecf0f1");
			expect(theme.FILL["subclassproperty"]).toBe("#ecf0f1");
		});

		it("maps symbol to blue (#69c)", () => {
			expect(theme.FILL["symbol"]).toBe("#69c");
		});
	});

	describe("FILL_DEFAULT", () => {
		it("defaults to blue (#acf)", () => {
			expect(theme.FILL_DEFAULT).toBe("#acf");
		});
	});

	describe("STROKE dictionary", () => {
		it("maps individual to brown-orange (#b74)", () => {
			expect(theme.STROKE["individual"]).toBe("#b74");
		});

		it("maps rdftype to brown-orange (#b74)", () => {
			expect(theme.STROKE["rdftype"]).toBe("#b74");
		});

		it("maps values-from to blue (#69c)", () => {
			expect(theme.STROKE["values-from"]).toBe("#69c");
		});
	});

	describe("STROKE_DEFAULT", () => {
		it("defaults to black (#000)", () => {
			expect(theme.STROKE_DEFAULT).toBe("#000");
		});
	});

	describe("semantic colors", () => {
		it.each([
			["HOVERED", "#f00"],
			["FOCUSED_STROKE", "#f00"],
			["HALO", "#f00"],
			["TEXT", "#000"],
			["PIN", "#e33"],
			["PIN_STROKE", "#fff"],
			["COLLAPSE_BTN", "#f00"],
			["COLLAPSE_HOVER", "#29f"],
			["ARROW_FILLED", "#000"],
			["ARROW_WHITE", "#ecf0f1"],
			["SUBCLASS_BG", "#ecf0f1"],
			["LINK_DEFAULT", "#000"],
			["LINK_RDFTYPE", "#b74"],
		])("%s equals %s", (name, expected) => {
			expect(theme[name]).toBe(expected);
		});
	});

	describe("RDFTYPE_ALPHA", () => {
		it("is 0.6", () => {
			expect(theme.RDFTYPE_ALPHA).toBe(0.6);
		});

		it("is a number between 0 and 1", () => {
			expect(typeof theme.RDFTYPE_ALPHA).toBe("number");
			expect(theme.RDFTYPE_ALPHA).toBeGreaterThan(0);
			expect(theme.RDFTYPE_ALPHA).toBeLessThanOrEqual(1);
		});
	});

	describe("module exports all expected keys", () => {
		it("exports all documented color constants", () => {
			const expectedKeys = [
				"FILL", "FILL_DEFAULT", "STROKE", "STROKE_DEFAULT",
				"HOVERED", "FOCUSED_STROKE", "HALO", "TEXT",
				"PIN", "PIN_STROKE", "COLLAPSE_BTN", "COLLAPSE_HOVER",
				"ARROW_FILLED", "ARROW_WHITE", "SUBCLASS_BG",
				"LINK_DEFAULT", "LINK_RDFTYPE", "RDFTYPE_ALPHA",
			];
			for (const key of expectedKeys) {
				expect(theme).toHaveProperty(key);
			}
		});
	});
});
