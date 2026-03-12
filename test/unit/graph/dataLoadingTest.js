const { addTransitiveSubclassEdges, generateDictionary } = require("../../../src/webvowl/js/graph/dataLoading");

/** Helper to make a mock node */
function mockNode( id ){
  return {
    _id: id,
    id: function (){ return this._id; },
    labelForCurrentLanguage: () => id,
  };
}

/** Helper to make a mock subClassOf property */
function mockSubClassProp( domainNode, rangeNode ){
  return {
    type: () => "rdfs:subClassOf",
    domain: () => domainNode,
    range: () => rangeNode,
  };
}

describe("dataLoading", () => {
  describe("addTransitiveSubclassEdges", () => {
    it("adds nothing when all parents are visible", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      const prop = mockSubClassProp(a, b);

      const ctx = { RdfsSubClassOf: class {} };
      const unfiltered = { nodes: [a, b], properties: [prop] };
      const filtered = { nodes: [a, b], properties: [prop] };

      const result = addTransitiveSubclassEdges(ctx, unfiltered, filtered);
      expect(result.properties.length).toBe(1);
    });

    it("adds transitive edge when intermediate is hidden", () => {
      // A -> B -> C, but B is filtered out
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");
      const propAB = mockSubClassProp(a, b);
      const propBC = mockSubClassProp(b, c);

      let createdProps = 0;
      class MockRdfsSubClassOf {
        constructor(){ this._id = null; this._domain = null; this._range = null; createdProps++; }
        id( v ){ if ( arguments.length ) { this._id = v; return this; } return this._id; }
        domain( v ){ if ( arguments.length ) { this._domain = v; return this; } return this._domain; }
        range( v ){ if ( arguments.length ) { this._range = v; return this; } return this._range; }
        type(){ return "rdfs:subClassOf"; }
      }

      const ctx = { graph: {}, RdfsSubClassOf: MockRdfsSubClassOf };
      const unfiltered = { nodes: [a, b, c], properties: [propAB, propBC] };
      const filtered = { nodes: [a, c], properties: [] }; // B hidden, no edges

      const result = addTransitiveSubclassEdges(ctx, unfiltered, filtered);
      expect(result.properties.length).toBe(1);
      expect(createdProps).toBe(1);
      expect(result.properties[0]._domain).toBe(a);
      expect(result.properties[0]._range).toBe(c);
    });

    it("skips duplicate transitive edges", () => {
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");
      const propAB = mockSubClassProp(a, b);
      const propBC = mockSubClassProp(b, c);
      // Existing transitive edge A→C already present
      const propAC = mockSubClassProp(a, c);

      class MockRdfsSubClassOf {
        constructor(){ this._id = null; this._domain = null; this._range = null; }
        id( v ){ if ( arguments.length ) { this._id = v; return this; } return this._id; }
        domain( v ){ if ( arguments.length ) { this._domain = v; return this; } return this._domain; }
        range( v ){ if ( arguments.length ) { this._range = v; return this; } return this._range; }
        type(){ return "rdfs:subClassOf"; }
      }

      const ctx = { graph: {}, RdfsSubClassOf: MockRdfsSubClassOf };
      const unfiltered = { nodes: [a, b, c], properties: [propAB, propBC] };
      const filtered = { nodes: [a, c], properties: [propAC] };

      const result = addTransitiveSubclassEdges(ctx, unfiltered, filtered);
      // Should not add A→C again since it already exists
      expect(result.properties.length).toBe(1);
    });

    it("handles diamond hierarchy", () => {
      // A -> B -> D, A -> C -> D. Both B and C hidden.
      const a = mockNode("A");
      const b = mockNode("B");
      const c = mockNode("C");
      const d = mockNode("D");

      class MockRdfsSubClassOf {
        constructor(){ this._id = null; this._domain = null; this._range = null; }
        id( v ){ if ( arguments.length ) { this._id = v; return this; } return this._id; }
        domain( v ){ if ( arguments.length ) { this._domain = v; return this; } return this._domain; }
        range( v ){ if ( arguments.length ) { this._range = v; return this; } return this._range; }
        type(){ return "rdfs:subClassOf"; }
      }

      const ctx = { graph: {}, RdfsSubClassOf: MockRdfsSubClassOf };
      const unfiltered = {
        nodes: [a, b, c, d],
        properties: [mockSubClassProp(a, b), mockSubClassProp(a, c), mockSubClassProp(b, d), mockSubClassProp(c, d)]
      };
      const filtered = { nodes: [a, d], properties: [] };

      const result = addTransitiveSubclassEdges(ctx, unfiltered, filtered);
      // Should add A→D once (not twice)
      expect(result.properties.length).toBe(1);
      expect(result.properties[0]._domain).toBe(a);
      expect(result.properties[0]._range).toBe(d);
    });
  });

  describe("generateDictionary", () => {
    it("populates parser dictionary from nodes and properties", () => {
      const dictValues = [];
      const ctx = {
        parser: {
          setDictionary: ( d ) => { dictValues.push([...d]); },
          getDictionary: () => dictValues[0] || [],
        },
        graph: {
          options: () => ({
            literalFilter: () => ({ removedNodes: () => [] }),
          }),
        },
      };

      const data = {
        nodes: [
          { labelForCurrentLanguage: () => "Foo", id: () => "n1" },
          { labelForCurrentLanguage: () => undefined, id: () => "n2" },
        ],
        properties: [
          { labelForCurrentLanguage: () => "bar", id: () => "p1" },
        ],
      };

      generateDictionary(ctx, data);
      // First call sets original dict (2 items: Foo node + bar prop)
      expect(dictValues[0].length).toBe(2);
    });

    it("filters out removed node IDs from dictionary", () => {
      let finalDict;
      const ctx = {
        parser: {
          setDictionary: ( d ) => { finalDict = d; },
          getDictionary: () => [
            { id: () => "n1" },
            { id: () => "n2" },
            { property: () => ({ id: () => "p1" }) },
          ],
        },
        graph: {
          options: () => ({
            literalFilter: () => ({ removedNodes: () => ["n2"] }),
          }),
        },
      };

      const data = {
        nodes: [
          { labelForCurrentLanguage: () => "A", id: () => "n1" },
        ],
        properties: [],
      };

      generateDictionary(ctx, data);
      // n2 should be removed from the final dictionary
      const ids = finalDict.map(( e ) => e.property ? e.property().id() : e.id());
      expect(ids).not.toContain("n2");
    });
  });
});
