var OwlClass = require("../../../src/webvowl/js/elements/nodes/implementations/OwlClass");
var OwlThing = require("../../../src/webvowl/js/elements/nodes/implementations/OwlThing");
var DatatypeNode = require("../../../src/webvowl/js/elements/nodes/DatatypeNode");
var RdfsDatatype = require("../../../src/webvowl/js/elements/nodes/implementations/RdfsDatatype");
var OwlObjectProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlObjectProperty");
var OwlDatatypeProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
var RdfsSubClassOf = require("../../../src/webvowl/js/elements/properties/implementations/RdfsSubClassOf");
var OwlFunctionalProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlFunctionalProperty");
var OwlSymmetricProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlSymmetricProperty");
var OwlTransitiveProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlTransitiveProperty");
var Label = require("../../../src/webvowl/js/elements/links/Label");

describe("Element type checking tools", function () {
	var tools;

	beforeEach(function () {
		tools = require("../../../src/webvowl/js/util/elementTools")();
	});

	describe("isLabel", function () {
		it("should identify a Label instance", function () {
			var mockProperty = { inverse: function () { return null; }, fixed: false,
				frozen: function () { return false; }, locked: function () { return false; },
				pinned: function () { return false; } };
			expect(tools.isLabel(new Label(mockProperty, {}))).toBe(true);
		});

		it("should not identify a node as label", function () {
			expect(tools.isLabel(new OwlClass())).toBe(false);
		});
	});

	describe("isNode", function () {
		it("should identify OwlClass as node", function () {
			expect(tools.isNode(new OwlClass())).toBe(true);
		});

		it("should not identify property as node", function () {
			expect(tools.isNode(new OwlObjectProperty())).toBe(false);
		});
	});

	describe("isDatatype", function () {
		it("should identify RdfsDatatype as datatype", function () {
			expect(tools.isDatatype(new RdfsDatatype())).toBe(true);
		});

		it("should not identify OwlClass as datatype", function () {
			expect(tools.isDatatype(new OwlClass())).toBe(false);
		});
	});

	describe("isThing", function () {
		it("should identify OwlThing as Thing", function () {
			expect(tools.isThing(new OwlThing())).toBe(true);
		});

		it("should not identify OwlClass as Thing", function () {
			expect(tools.isThing(new OwlClass())).toBe(false);
		});
	});

	describe("isProperty", function () {
		it("should identify OwlObjectProperty as property", function () {
			expect(tools.isProperty(new OwlObjectProperty())).toBe(true);
		});

		it("should not identify OwlClass as property", function () {
			expect(tools.isProperty(new OwlClass())).toBe(false);
		});
	});

	describe("isObjectProperty", function () {
		it("should identify OwlObjectProperty via instanceof", function () {
			expect(tools.isObjectProperty(new OwlObjectProperty())).toBe(true);
		});

		it("should identify OwlFunctionalProperty via type() fallback", function () {
			expect(tools.isObjectProperty(new OwlFunctionalProperty())).toBe(true);
		});

		it("should identify OwlSymmetricProperty via type() fallback", function () {
			expect(tools.isObjectProperty(new OwlSymmetricProperty())).toBe(true);
		});

		it("should identify OwlTransitiveProperty via type() fallback", function () {
			expect(tools.isObjectProperty(new OwlTransitiveProperty())).toBe(true);
		});

		it("should not identify DatatypeProperty as object property", function () {
			expect(tools.isObjectProperty(new OwlDatatypeProperty())).toBe(false);
		});
	});

	describe("isDatatypeProperty", function () {
		it("should identify OwlDatatypeProperty", function () {
			expect(tools.isDatatypeProperty(new OwlDatatypeProperty())).toBe(true);
		});

		it("should not identify OwlObjectProperty as datatype property", function () {
			expect(tools.isDatatypeProperty(new OwlObjectProperty())).toBe(false);
		});
	});

	describe("isRdfsSubClassOf", function () {
		it("should identify RdfsSubClassOf", function () {
			expect(tools.isRdfsSubClassOf(new RdfsSubClassOf())).toBe(true);
		});

		it("should not identify OwlObjectProperty as subClassOf", function () {
			expect(tools.isRdfsSubClassOf(new OwlObjectProperty())).toBe(false);
		});
	});
});
