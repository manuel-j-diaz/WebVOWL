const { storeLinksOnNodes, setPositionOfOldLabelsOnNewLabels, createLowerCasePrototypeMap } =
	require("../../../src/webvowl/js/graph/dataUtils");

function makeNode(id) {
	let storedLinks = [];
	return {
		_id: id,
		links(arr) {
			if (arr !== undefined) storedLinks = arr;
			return storedLinks;
		},
	};
}

function makeLink(domain, range) {
	return { domain() { return domain; }, range() { return range; } };
}

describe("dataUtils", () => {
	describe("storeLinksOnNodes", () => {
		it("assigns links to both domain and range nodes", () => {
			const a = makeNode("a");
			const b = makeNode("b");
			const link = makeLink(a, b);

			storeLinksOnNodes([a, b], [link]);

			expect(a.links()).toContain(link);
			expect(b.links()).toContain(link);
		});

		it("stores self-loop link only once on the node", () => {
			const a = makeNode("a");
			const link = makeLink(a, a);

			storeLinksOnNodes([a], [link]);

			expect(a.links().length).toBe(1);
			expect(a.links()[0]).toBe(link);
		});

		it("assigns empty array to unlinked nodes", () => {
			const a = makeNode("a");
			const b = makeNode("b");
			const link = makeLink(a, a);

			storeLinksOnNodes([a, b], [link]);

			expect(b.links()).toEqual([]);
		});

		it("handles multiple links per node", () => {
			const a = makeNode("a");
			const b = makeNode("b");
			const c = makeNode("c");
			const link1 = makeLink(a, b);
			const link2 = makeLink(a, c);

			storeLinksOnNodes([a, b, c], [link1, link2]);

			expect(a.links().length).toBe(2);
			expect(b.links().length).toBe(1);
			expect(c.links().length).toBe(1);
		});

		it("handles empty inputs", () => {
			storeLinksOnNodes([], []);
			// No error thrown
		});
	});

	describe("setPositionOfOldLabelsOnNewLabels", () => {
		function makeLabel(id, x, y) {
			return {
				_id: id, x, y,
				equals(other) { return this._id === other._id; },
			};
		}

		it("copies position from matching old labels", () => {
			const old = makeLabel("a", 100, 200);
			const newLabel = makeLabel("a", 0, 0);

			setPositionOfOldLabelsOnNewLabels([old], [newLabel]);

			expect(newLabel.x).toBe(100);
			expect(newLabel.y).toBe(200);
		});

		it("leaves position unchanged when no match", () => {
			const old = makeLabel("a", 100, 200);
			const newLabel = makeLabel("b", 5, 10);

			setPositionOfOldLabelsOnNewLabels([old], [newLabel]);

			expect(newLabel.x).toBe(5);
			expect(newLabel.y).toBe(10);
		});

		it("handles multiple labels with partial matches", () => {
			const old1 = makeLabel("a", 10, 20);
			const old2 = makeLabel("b", 30, 40);
			const new1 = makeLabel("a", 0, 0);
			const new2 = makeLabel("c", 0, 0);

			setPositionOfOldLabelsOnNewLabels([old1, old2], [new1, new2]);

			expect(new1.x).toBe(10);
			expect(new1.y).toBe(20);
			expect(new2.x).toBe(0); // no match
			expect(new2.y).toBe(0);
		});

		it("handles empty arrays", () => {
			setPositionOfOldLabelsOnNewLabels([], []);
			// No error thrown
		});
	});

	describe("createLowerCasePrototypeMap", () => {
		it("builds case-insensitive key map", () => {
			function FakeClass() {}
			FakeClass.prototype.type = function () { return "Owl:Class"; };

			const input = new Map();
			input.set("key1", FakeClass);

			const result = createLowerCasePrototypeMap(input);

			expect(result.get("owl:class")).toBe(FakeClass);
			expect(result.has("Owl:Class")).toBe(false); // only lowercase keys
		});

		it("maps multiple prototypes", () => {
			function TypeA() {}
			TypeA.prototype.type = function () { return "owl:ObjectProperty"; };

			function TypeB() {}
			TypeB.prototype.type = function () { return "rdfs:SubClassOf"; };

			const input = new Map();
			input.set("a", TypeA);
			input.set("b", TypeB);

			const result = createLowerCasePrototypeMap(input);

			expect(result.size).toBe(2);
			expect(result.get("owl:objectproperty")).toBe(TypeA);
			expect(result.get("rdfs:subclassof")).toBe(TypeB);
		});

		it("returns empty map for empty input", () => {
			const result = createLowerCasePrototypeMap(new Map());
			expect(result.size).toBe(0);
		});
	});
});
