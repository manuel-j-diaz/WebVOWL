const radialLayoutFactory = require("../../../src/webvowl/js/layout/radialLayout");

/** Helper to create a mock class node */
function mockNode( iri, type ){
  return {
    iri: () => iri,
    type: () => type || "owl:Class",
    x: 0, y: 0, fx: null, fy: null,
    _pinned: false,
    pinned: function ( val ){
      if ( val === undefined ) return this._pinned;
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

function mockGraph( overrides ){
  return Object.assign({
    options: () => ({
      nodeSeparation: () => 150,
      levelSeparation: () => 180,
    }),
  }, overrides);
}

describe("radialLayout", () => {
  it("pins nodes after apply() and unpins after unapply()", () => {
    const graph = mockGraph();
    const layout = radialLayoutFactory(graph);
    layout.enabled(true);

    const root = mockNode("Root");
    const child = mockNode("Child");
    const edges = [mockSubClassOf(child, root)];

    layout.apply([root, child], edges);
    expect(root.pinned()).toBe(true);
    expect(child.pinned()).toBe(true);

    layout.unapply();
    expect(root.pinned()).toBe(false);
    expect(child.pinned()).toBe(false);
  });

  it("places root-level nodes at smaller radius than deeper nodes", () => {
    const graph = mockGraph();
    const layout = radialLayoutFactory(graph);

    const root = mockNode("Root");
    const child = mockNode("Child");
    const grandchild = mockNode("Grandchild");
    const edges = [
      mockSubClassOf(child, root),
      mockSubClassOf(grandchild, child)
    ];

    layout.apply([root, child, grandchild], edges);

    const rootRadius = Math.sqrt(root.x * root.x + root.y * root.y);
    const childRadius = Math.sqrt(child.x * child.x + child.y * child.y);
    const grandchildRadius = Math.sqrt(grandchild.x * grandchild.x + grandchild.y * grandchild.y);

    expect(childRadius).toBeGreaterThan(rootRadius);
    expect(grandchildRadius).toBeGreaterThan(childRadius);
  });

  it("enabled() getter/setter works", () => {
    const graph = mockGraph();
    const layout = radialLayoutFactory(graph);

    expect(layout.enabled()).toBe(false);
    layout.enabled(true);
    expect(layout.enabled()).toBe(true);
    layout.enabled(false);
    expect(layout.enabled()).toBe(false);
  });

  it("skips owl:Thing nodes", () => {
    const graph = mockGraph();
    const layout = radialLayoutFactory(graph);

    const thing = mockNode("owl:Thing", "owl:Thing");
    const child = mockNode("Child");
    const edges = [mockSubClassOf(child, thing)];

    layout.apply([thing, child], edges);
    // owl:Thing should NOT be pinned
    expect(thing.pinned()).toBe(false);
    // child should be pinned
    expect(child.pinned()).toBe(true);
  });

  it("handles empty input gracefully", () => {
    const graph = mockGraph();
    const layout = radialLayoutFactory(graph);

    // Should not throw
    expect(() => { layout.apply([], []); }).not.toThrow();
  });
});
