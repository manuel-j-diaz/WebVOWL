var OwlClass = require("../../../src/webvowl/js/elements/nodes/implementations/OwlClass");
var OwlNamedIndividual = require("../../../src/webvowl/js/elements/nodes/implementations/OwlNamedIndividual");
var RdfTypeProperty = require("../../../src/webvowl/js/elements/properties/implementations/RdfTypeProperty");

function makeIndividual(iri, label) {
	return {
		iri: function () { return iri; },
		label: function () { return label || iri; }
	};
}

function makeClassNode(id, individuals) {
	var node = new OwlClass();
	node.id(id);
	node.individuals(individuals || []);
	return node;
}

describe("Individuals filter", function () {
	var filter;

	beforeEach(function () {
		filter = require("../../../src/webvowl/js/modules/individualsFilter")();
		filter.enabled(true);
	});

	it("should inject one node and one edge for a single-typed individual", function () {
		var classA = makeClassNode("classA", [makeIndividual("ind1", "Individual 1")]);

		filter.filter([classA], []);

		var nodes = filter.filteredNodes();
		var props = filter.filteredProperties();

		// Original class + 1 individual
		expect(nodes.length).toBe(2);
		expect(nodes[1]).toBeInstanceOf(OwlNamedIndividual);
		expect(nodes[1].id()).toBe("ind1");

		// 1 rdf:type edge
		expect(props.length).toBe(1);
		expect(props[0]).toBeInstanceOf(RdfTypeProperty);
		expect(props[0].domain()).toBe(nodes[1]);
		expect(props[0].range()).toBe(classA);
	});

	it("should create one node and two edges for a multi-typed individual", function () {
		var sharedInd = makeIndividual("ind1", "Shared Individual");
		var classA = makeClassNode("classA", [sharedInd]);
		var classB = makeClassNode("classB", [sharedInd]);

		filter.filter([classA, classB], []);

		var nodes = filter.filteredNodes();
		var props = filter.filteredProperties();

		// 2 original classes + 1 individual (NOT 2 duplicates)
		expect(nodes.length).toBe(3);
		var indNodes = nodes.filter(function (n) { return n instanceof OwlNamedIndividual; });
		expect(indNodes.length).toBe(1);
		expect(indNodes[0].id()).toBe("ind1");

		// 2 rdf:type edges (one to each class)
		expect(props.length).toBe(2);
		expect(props[0].domain()).toBe(indNodes[0]);
		expect(props[1].domain()).toBe(indNodes[0]);
		expect(props[0].range()).toBe(classA);
		expect(props[1].range()).toBe(classB);
	});

	it("should produce unique edge IDs for multi-typed individuals", function () {
		var sharedInd = makeIndividual("ind1", "Shared");
		var classA = makeClassNode("classA", [sharedInd]);
		var classB = makeClassNode("classB", [sharedInd]);

		filter.filter([classA, classB], []);

		var props = filter.filteredProperties();
		expect(props.length).toBe(2);
		expect(props[0].id()).not.toBe(props[1].id());
	});

	it("should skip individuals when collapse threshold is exceeded", function () {
		var individuals = [
			makeIndividual("ind1"), makeIndividual("ind2"), makeIndividual("ind3")
		];
		var classA = makeClassNode("classA", individuals);

		filter.collapseThreshold(2);
		filter.filter([classA], []);

		// No individuals injected (3 > threshold 2)
		expect(filter.filteredNodes().length).toBe(1);
		expect(filter.filteredProperties().length).toBe(0);
	});

	it("should only create edge to expanded class when individual is in both expanded and collapsed classes", function () {
		var sharedInd = makeIndividual("ind1", "Shared");
		// classA has 1 individual (under threshold) -> expanded
		var classA = makeClassNode("classA", [sharedInd]);
		// classB has 3 individuals (over threshold of 2) -> collapsed
		var classB = makeClassNode("classB", [
			sharedInd, makeIndividual("ind2"), makeIndividual("ind3")
		]);

		filter.collapseThreshold(2);
		filter.filter([classA, classB], []);

		var nodes = filter.filteredNodes();
		var props = filter.filteredProperties();

		// 2 classes + 1 individual
		expect(nodes.length).toBe(3);
		var indNodes = nodes.filter(function (n) { return n instanceof OwlNamedIndividual; });
		expect(indNodes.length).toBe(1);

		// Only 1 edge (to classA, not classB which is collapsed)
		expect(props.length).toBe(1);
		expect(props[0].range()).toBe(classA);
	});

	it("should not inject anything when disabled", function () {
		var classA = makeClassNode("classA", [makeIndividual("ind1")]);

		filter.enabled(false);
		filter.filter([classA], []);

		expect(filter.filteredNodes().length).toBe(1);
		expect(filter.filteredProperties().length).toBe(0);
	});
});
