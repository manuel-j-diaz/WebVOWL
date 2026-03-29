const ancestryBuilder = require("../../../src/app/js/util/ancestryBuilder");

function mockNode( iri ){
  return {
    iri: () => iri,
    type: () => "owl:Class",
    labelForCurrentLanguage: () => iri
  };
}

function mockSubClassOf( childNode, parentNode ){
  return {
    type: () => "rdfs:subClassOf",
    domain: () => childNode,
    range: () => parentNode
  };
}

describe("ancestryBuilder", () => {
  describe("buildAncestryPaths", () => {
    it("returns a single path for linear hierarchy A → B → C", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");
      const edges = [mockSubClassOf(b, a), mockSubClassOf(c, b)];

      const paths = ancestryBuilder.buildAncestryPaths(c, edges);
      expect(paths.length).toBe(1);
      expect(paths[0].map(( n ) => n.iri())).toEqual(["A", "B", "C"]);
    });

    it("returns a single path with just the node for a root (no parents)", () => {
      const a = mockNode("A");
      const paths = ancestryBuilder.buildAncestryPaths(a, []);
      expect(paths.length).toBe(1);
      expect(paths[0].map(( n ) => n.iri())).toEqual(["A"]);
    });

    it("returns two paths for diamond inheritance", () => {
      const d = mockNode("D");
      const b = mockNode("B");
      const c = mockNode("C");
      const a = mockNode("A");
      // D → B → A and D → C → A
      const edges = [
        mockSubClassOf(b, d),
        mockSubClassOf(c, d),
        mockSubClassOf(a, b),
        mockSubClassOf(a, c)
      ];

      const paths = ancestryBuilder.buildAncestryPaths(a, edges);
      expect(paths.length).toBe(2);
      const iris = paths.map(( p ) => p.map(( n ) => n.iri()));
      expect(iris).toContainEqual(["D", "B", "A"]);
      expect(iris).toContainEqual(["D", "C", "A"]);
    });

    it("returns two paths for multiple inheritance (two root parents)", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");
      // C has parents A and B, both roots
      const edges = [mockSubClassOf(c, a), mockSubClassOf(c, b)];

      const paths = ancestryBuilder.buildAncestryPaths(c, edges);
      expect(paths.length).toBe(2);
      const iris = paths.map(( p ) => p.map(( n ) => n.iri()));
      expect(iris).toContainEqual(["A", "C"]);
      expect(iris).toContainEqual(["B", "C"]);
    });

    it("handles cycles without infinite recursion", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      // A → B → A (cycle)
      const edges = [mockSubClassOf(a, b), mockSubClassOf(b, a)];

      // Should terminate without throwing
      const paths = ancestryBuilder.buildAncestryPaths(a, edges);
      expect(paths.length).toBeGreaterThan(0);
    });

    it("returns node alone when allProperties is empty", () => {
      const a = mockNode("A");
      const paths = ancestryBuilder.buildAncestryPaths(a, []);
      expect(paths.length).toBe(1);
      expect(paths[0][0].iri()).toBe("A");
    });

    it("skips edges with null domain or range", () => {
      const a = mockNode("A");
      const edges = [
        { type: () => "rdfs:subClassOf", domain: () => null, range: () => a },
        { type: () => "rdfs:subClassOf", domain: () => a, range: () => null }
      ];
      const paths = ancestryBuilder.buildAncestryPaths(a, edges);
      expect(paths.length).toBe(1);
      expect(paths[0][0].iri()).toBe("A");
    });

    it("handles null node gracefully", () => {
      const paths = ancestryBuilder.buildAncestryPaths(null, []);
      // Returns [[]] (one empty path) — no crash
      expect(paths.length).toBe(1);
      expect(paths[0].length).toBe(0);
    });
  });

  describe("buildAncestryTree", () => {
    it("merges paths sharing a common prefix", () => {
      const d = mockNode("D");
      const b = mockNode("B");
      const c = mockNode("C");
      const a = mockNode("A");

      const paths = [[d, b, a], [d, c, a]];
      const tree = ancestryBuilder.buildAncestryTree(paths);

      // Root has one child (D)
      expect(tree.node).toBeNull();
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].node.iri()).toBe("D");
      // D has two children: B and C
      expect(tree.children[0].children.length).toBe(2);
      const dChildIris = tree.children[0].children.map(( c ) => c.node.iri()).sort();
      expect(dChildIris).toEqual(["B", "C"]);
    });

    it("creates multiple root children for unrelated paths", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");

      const paths = [[a, c], [b, c]];
      const tree = ancestryBuilder.buildAncestryTree(paths);

      expect(tree.children.length).toBe(2);
      const rootIris = tree.children.map(( c ) => c.node.iri()).sort();
      expect(rootIris).toEqual(["A", "B"]);
    });

    it("handles single path correctly", () => {
      const a = mockNode("A");
      const b = mockNode("B");

      const tree = ancestryBuilder.buildAncestryTree([[a, b]]);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].node.iri()).toBe("A");
      expect(tree.children[0].children.length).toBe(1);
      expect(tree.children[0].children[0].node.iri()).toBe("B");
    });
  });
});
