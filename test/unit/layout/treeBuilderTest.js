const treeBuilder = require("../../../src/webvowl/js/layout/treeBuilder");

/** Helper to create a mock class node */
function mockNode( iri, type ){
  return {
    iri: () => iri,
    type: () => type || "owl:Class",
    x: 0, y: 0, fx: null, fy: null,
    pinned: function ( val ){
      if ( val === undefined ) return this._pinned || false;
      this._pinned = val;
      if ( val ) { this.fx = this.x; this.fy = this.y; }
      else { this.fx = null; this.fy = null; }
    }
  };
}

/** Helper to create a mock subClassOf property edge */
function mockSubClassOf( childNode, parentNode ){
  return {
    type: () => "rdfs:subClassOf",
    domain: () => childNode,
    range: () => parentNode
  };
}

describe("treeBuilder", () => {
  it("builds a single-root tree correctly", () => {
    const a = mockNode("A");
    const b = mockNode("B");
    const c = mockNode("C");
    const edges = [mockSubClassOf(b, a), mockSubClassOf(c, a)];

    const result = treeBuilder([a, b, c], edges);
    expect(result).not.toBeNull();
    expect(result.treeData.iri).toBe("__vroot__");
    expect(result.treeData.children.length).toBe(1); // only A is root
    expect(result.treeData.children[0].iri).toBe("A");
    expect(result.treeData.children[0].children.length).toBe(2);
    expect(result.maxDepth).toBeGreaterThanOrEqual(2); // vroot → A → B/C
  });

  it("creates virtual root for multi-root forest", () => {
    const a = mockNode("A");
    const b = mockNode("B");
    const c = mockNode("C");
    // No edges — all three are roots
    const result = treeBuilder([a, b, c], []);
    expect(result).not.toBeNull();
    expect(result.treeData.iri).toBe("__vroot__");
    expect(result.treeData.children.length).toBe(3);
  });

  it("handles cycles via visited guard", () => {
    const a = mockNode("A");
    const b = mockNode("B");
    // A → B and B → A (cycle)
    const edges = [mockSubClassOf(b, a), mockSubClassOf(a, b)];
    // Neither has a parent-free root since both appear as children,
    // but treeBuilder should still not infinite-loop
    const result = treeBuilder([a, b], edges);
    // Both have parents, so roots is empty → returns null
    expect(result).toBeNull();
  });

  it("handles cycle with an external root", () => {
    const a = mockNode("A");
    const b = mockNode("B");
    const c = mockNode("C");
    // A is root; B → C and C → B form a cycle under A
    const edges = [mockSubClassOf(b, a), mockSubClassOf(c, b), mockSubClassOf(b, c)];
    const result = treeBuilder([a, b, c], edges);
    expect(result).not.toBeNull();
    // Should not infinite-loop; cycle nodes appear but with empty children on revisit
  });

  it("excludes owl:NamedIndividual nodes", () => {
    const a = mockNode("A");
    const ind = mockNode("I1", "owl:NamedIndividual");
    const result = treeBuilder([a, ind], []);
    expect(result).not.toBeNull();
    expect(result.classNodes.length).toBe(1);
    expect(result.nodeIndex["I1"]).toBeUndefined();
  });

  it("computes depthCounts and maxLevelWidth accurately", () => {
    const root = mockNode("R");
    const c1 = mockNode("C1");
    const c2 = mockNode("C2");
    const c3 = mockNode("C3");
    const edges = [
      mockSubClassOf(c1, root),
      mockSubClassOf(c2, root),
      mockSubClassOf(c3, root)
    ];
    const result = treeBuilder([root, c1, c2, c3], edges);
    expect(result).not.toBeNull();
    // Level 1 (under vroot): root=1 node, level 2: 3 children
    expect(result.maxLevelWidth).toBe(3);
  });

  it("returns null for empty input", () => {
    expect(treeBuilder([], [])).toBeNull();
  });
});
