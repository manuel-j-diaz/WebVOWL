var OwlClass = require("../../../src/webvowl/js/elements/nodes/implementations/OwlClass");
var OwlObjectProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlObjectProperty");
var OwlDatatypeProperty = require("../../../src/webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
var RdfsDatatype = require("../../../src/webvowl/js/elements/nodes/implementations/RdfsDatatype");

describe("Filter tools — filterNodesAndTidy", function () {
	var filterTools;

	beforeEach(function () {
		filterTools = require("../../../src/webvowl/js/util/filterTools")();
	});

	it("should keep nodes that pass the predicate", function () {
		var node1 = new OwlClass(),
			node2 = new OwlClass(),
			prop = new OwlObjectProperty();

		node1.id("n1");
		node2.id("n2");
		prop.domain(node1).range(node2);

		var result = filterTools.filterNodesAndTidy([node1, node2], [prop], function () { return true; });

		expect(result.nodes.length).toBe(2);
		expect(result.properties.length).toBe(1);
	});

	it("should remove nodes that fail the predicate", function () {
		var node1 = new OwlClass(),
			node2 = new OwlClass(),
			prop = new OwlObjectProperty();

		node1.id("n1");
		node2.id("n2");
		prop.domain(node1).range(node2);

		var result = filterTools.filterNodesAndTidy([node1, node2], [prop], function (n) {
			return n.id() === "n1";
		});

		expect(result.nodes.length).toBe(1);
		expect(result.nodes[0]).toBe(node1);
	});

	it("should remove dangling properties when domain is removed", function () {
		var node1 = new OwlClass(),
			node2 = new OwlClass(),
			prop = new OwlObjectProperty();

		node1.id("n1");
		node2.id("n2");
		prop.domain(node1).range(node2);

		var result = filterTools.filterNodesAndTidy([node1, node2], [prop], function (n) {
			return n.id() === "n2";
		});

		expect(result.nodes.length).toBe(1);
		expect(result.properties.length).toBe(0);
	});

	it("should remove dangling properties when range is removed", function () {
		var node1 = new OwlClass(),
			node2 = new OwlClass(),
			prop = new OwlObjectProperty();

		node1.id("n1");
		node2.id("n2");
		prop.domain(node1).range(node2);

		var result = filterTools.filterNodesAndTidy([node1, node2], [prop], function (n) {
			return n.id() === "n1";
		});

		expect(result.properties.length).toBe(0);
	});

	it("should remove floating datatype nodes when their datatype property is filtered", function () {
		var classNode = new OwlClass(),
			datatypeNode = new RdfsDatatype(),
			prop = new OwlDatatypeProperty();

		classNode.id("c1");
		datatypeNode.id("dt1");
		prop.domain(classNode).range(datatypeNode);

		var result = filterTools.filterNodesAndTidy([classNode, datatypeNode], [prop], function (n) {
			return n.id() !== "c1";
		});

		// classNode removed -> prop dangles -> datatypeNode also removed
		expect(result.nodes.length).toBe(0);
		expect(result.properties.length).toBe(0);
	});

	it("should return empty arrays for empty inputs", function () {
		var result = filterTools.filterNodesAndTidy([], [], function () { return true; });

		expect(result.nodes.length).toBe(0);
		expect(result.properties.length).toBe(0);
	});

	it("should return empty when all nodes are removed", function () {
		var node = new OwlClass(),
			prop = new OwlObjectProperty();

		node.id("n1");
		prop.domain(node).range(node);

		var result = filterTools.filterNodesAndTidy([node], [prop], function () { return false; });

		expect(result.nodes.length).toBe(0);
		expect(result.properties.length).toBe(0);
	});

	it("should handle mixed filtering with multiple properties", function () {
		var node1 = new OwlClass(),
			node2 = new OwlClass(),
			node3 = new OwlClass(),
			prop12 = new OwlObjectProperty(),
			prop23 = new OwlObjectProperty();

		node1.id("n1");
		node2.id("n2");
		node3.id("n3");
		prop12.domain(node1).range(node2);
		prop23.domain(node2).range(node3);

		// Remove node1 — prop12 should be removed, prop23 should survive
		var result = filterTools.filterNodesAndTidy([node1, node2, node3], [prop12, prop23], function (n) {
			return n.id() !== "n1";
		});

		expect(result.nodes.length).toBe(2);
		expect(result.properties.length).toBe(1);
		expect(result.properties[0]).toBe(prop23);
	});
});
