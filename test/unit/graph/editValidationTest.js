const editValidation = require("../../../src/webvowl/js/graph/editValidation");

function makeGraph(warnings) {
	warnings = warnings || [];
	return {
		options() {
			return {
				warningModule() {
					return { showWarning(...args) { warnings.push(args); } };
				},
				objectPropertyFilter() { return { enabled() { return true; } }; },
				disjointPropertyFilter() { return { enabled() { return true; } }; },
			};
		},
	};
}

function makeNode(id, type, iri) {
	return {
		id() { return id; },
		type() { return type || "owl:Class"; },
		iri() { return iri || `http://example.org/${id}`; },
	};
}

function makeProperty(domain, range, type) {
	return {
		domain() { return domain; },
		range() { return range; },
		type() { return type || "owl:ObjectProperty"; },
	};
}

describe("editValidation", () => {
	describe("checkIfIriClassAlreadyExist", () => {
		it("returns false when IRI not found", () => {
			const graph = makeGraph();
			const data = { nodes: [makeNode("a", "owl:Class", "http://ex.org/A")] };
			expect(editValidation.checkIfIriClassAlreadyExist(graph, data, "http://ex.org/B")).toBe(false);
		});

		it("returns matching node when IRI exists", () => {
			const graph = makeGraph();
			const node = makeNode("a", "owl:Class", "http://ex.org/A");
			const data = { nodes: [node] };
			expect(editValidation.checkIfIriClassAlreadyExist(graph, data, "http://ex.org/A")).toBe(node);
		});

		it("skips owl:Thing nodes", () => {
			const graph = makeGraph();
			const data = { nodes: [makeNode("a", "owl:Thing", "http://ex.org/A")] };
			expect(editValidation.checkIfIriClassAlreadyExist(graph, data, "http://ex.org/A")).toBe(false);
		});

		it("returns false for empty nodes list", () => {
			const graph = makeGraph();
			expect(editValidation.checkIfIriClassAlreadyExist(graph, { nodes: [] }, "http://ex.org/A")).toBe(false);
		});
	});

	describe("classesSanityCheck", () => {
		it("always allows owl:Class target", () => {
			const graph = makeGraph();
			const node = makeNode("a");
			const data = { properties: [] };
			expect(editValidation.classesSanityCheck(graph, data, node, "owl:Class")).toBe(true);
		});

		it("rejects when someValuesFrom property references the class", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const node = makeNode("a");
			const other = makeNode("b");
			const data = { properties: [makeProperty(node, other, "owl:someValuesFrom")] };

			expect(editValidation.classesSanityCheck(graph, data, node, "owl:Thing")).toBe(false);
			expect(warnings.length).toBe(1);
		});

		it("rejects when allValuesFrom property references the class as range", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const node = makeNode("a");
			const other = makeNode("b");
			const data = { properties: [makeProperty(other, node, "owl:allValuesFrom")] };

			expect(editValidation.classesSanityCheck(graph, data, node, "owl:Thing")).toBe(false);
			expect(warnings.length).toBe(1);
		});

		it("allows when no values-from restrictions exist", () => {
			const graph = makeGraph();
			const node = makeNode("a");
			const other = makeNode("b");
			const data = { properties: [makeProperty(node, other, "owl:ObjectProperty")] };
			expect(editValidation.classesSanityCheck(graph, data, node, "owl:Thing")).toBe(true);
		});
	});

	describe("genericPropertySanityCheck", () => {
		it("rejects rdfs:subClassOf loops", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const node = makeNode("a");
			expect(editValidation.genericPropertySanityCheck(graph, node, node, "rdfs:subClassOf", "H", "A")).toBe(false);
			expect(warnings.length).toBe(1);
		});

		it("rejects owl:disjointWith loops", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const node = makeNode("a");
			expect(editValidation.genericPropertySanityCheck(graph, node, node, "owl:disjointWith", "H", "A")).toBe(false);
		});

		it("rejects owl:allValuesFrom from owl:Thing domain", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const thing = makeNode("t", "owl:Thing");
			const other = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, thing, other, "owl:allValuesFrom", "H", "A")).toBe(false);
		});

		it("rejects owl:someValuesFrom from owl:Thing domain", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const thing = makeNode("t", "owl:Thing");
			const other = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, thing, other, "owl:someValuesFrom", "H", "A")).toBe(false);
		});

		it("rejects owl:allValuesFrom to owl:Thing range", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const thing = makeNode("t", "owl:Thing");
			const other = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, other, thing, "owl:allValuesFrom", "H", "A")).toBe(false);
		});

		it("rejects owl:someValuesFrom to owl:Thing range", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const thing = makeNode("t", "owl:Thing");
			const other = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, other, thing, "owl:someValuesFrom", "H", "A")).toBe(false);
		});

		it("allows valid non-loop property between regular classes", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, a, b, "owl:ObjectProperty", "H", "A")).toBe(true);
		});

		it("allows rdfs:subClassOf between distinct nodes", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			expect(editValidation.genericPropertySanityCheck(graph, a, b, "rdfs:subClassOf", "H", "A")).toBe(true);
		});
	});

	describe("sanityCheckProperty", () => {
		it("rejects when object properties are filtered out", () => {
			const warnings = [];
			const graph = {
				options() {
					return {
						warningModule() { return { showWarning(...args) { warnings.push(args); } }; },
						objectPropertyFilter() { return { enabled() { return false; } }; },
						disjointPropertyFilter() { return { enabled() { return true; } }; },
					};
				},
			};
			const a = makeNode("a");
			const b = makeNode("b");
			expect(editValidation.sanityCheckProperty(graph, a, b, "owl:objectProperty")).toBe(false);
		});

		it("rejects when disjointWith properties are filtered out", () => {
			const warnings = [];
			const graph = {
				options() {
					return {
						warningModule() { return { showWarning(...args) { warnings.push(args); } }; },
						objectPropertyFilter() { return { enabled() { return true; } }; },
						disjointPropertyFilter() { return { enabled() { return false; } }; },
					};
				},
			};
			const a = makeNode("a");
			const b = makeNode("b");
			expect(editValidation.sanityCheckProperty(graph, a, b, "owl:disjointWith")).toBe(false);
		});

		it("rejects rdfs:subClassOf loops", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const node = makeNode("a");
			expect(editValidation.sanityCheckProperty(graph, node, node, "rdfs:subClassOf")).toBe(false);
		});

		it("allows valid property creation", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			expect(editValidation.sanityCheckProperty(graph, a, b, "owl:objectProperty")).toBe(true);
		});
	});

	describe("propertyCheckExistenceChecker", () => {
		it("always allows non-subclass non-disjoint property types", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			const prop = makeProperty(a, b, "owl:ObjectProperty");
			expect(editValidation.propertyCheckExistenceChecker(graph, { properties: [] }, prop, a, b)).toBe(true);
		});

		it("rejects duplicate rdfs:subClassOf triple", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const a = makeNode("a");
			const b = makeNode("b");
			const existing = makeProperty(a, b, "rdfs:subClassOf");
			const newProp = makeProperty(a, b, "rdfs:subClassOf");

			expect(editValidation.propertyCheckExistenceChecker(
				graph, { properties: [existing] }, newProp, a, b
			)).toBe(false);
			expect(warnings.length).toBe(1);
		});

		it("rejects inverse rdfs:subClassOf triple", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const a = makeNode("a");
			const b = makeNode("b");
			const existing = makeProperty(b, a, "rdfs:subClassOf");
			const newProp = makeProperty(a, b, "rdfs:subClassOf");

			expect(editValidation.propertyCheckExistenceChecker(
				graph, { properties: [existing] }, newProp, a, b
			)).toBe(false);
		});

		it("rejects duplicate owl:disjointWith triple", () => {
			const warnings = [];
			const graph = makeGraph(warnings);
			const a = makeNode("a");
			const b = makeNode("b");
			const existing = makeProperty(a, b, "owl:disjointWith");
			const newProp = makeProperty(a, b, "owl:disjointWith");

			expect(editValidation.propertyCheckExistenceChecker(
				graph, { properties: [existing] }, newProp, a, b
			)).toBe(false);
		});

		it("allows distinct rdfs:subClassOf triples", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			const c = makeNode("c");
			const existing = makeProperty(a, c, "rdfs:subClassOf");
			const newProp = makeProperty(a, b, "rdfs:subClassOf");

			expect(editValidation.propertyCheckExistenceChecker(
				graph, { properties: [existing] }, newProp, a, b
			)).toBe(true);
		});

		it("skips self when checking existence", () => {
			const graph = makeGraph();
			const a = makeNode("a");
			const b = makeNode("b");
			const prop = makeProperty(a, b, "rdfs:subClassOf");
			// Property checking against itself should be skipped
			expect(editValidation.propertyCheckExistenceChecker(
				graph, { properties: [prop] }, prop, a, b
			)).toBe(true);
		});
	});
});
