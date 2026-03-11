/**
 * Hierarchical tree layout for WebVOWL.
 * Extracts rdfs:subClassOf edges and lays out the entire forest as one tree
 * using a virtual root node. Scales the virtual canvas so no two adjacent
 * same-level nodes are closer than NODE_SEPARATION px. Centers the result
 * at the SVG origin (0, 0). Pins class nodes via node.pinned(true).
 * owl:Thing and owl:NamedIndividual nodes are excluded from pinning.
 */
module.exports = function ( graph ){
  const layout = {};
  let hierarchyEnabled = true;
  let pinnedNodes = [];

  // Defaults — kept here so hierarchyLayout.js stays self-contained if options are unavailable.
  // The UI sliders write into graph.options() and layout.apply() reads them at call time.
  const DEFAULT_NODE_SEPARATION  = 150;
  const DEFAULT_LEVEL_SEPARATION = 180;

  layout.apply = function ( classNodes, allProperties ){
    pinnedNodes = [];

    // Read live values from options (UI sliders), falling back to defaults
    const opts = graph.options ? graph.options() : null;
    const NODE_SEPARATION  = (opts && typeof opts.nodeSeparation  === "function") ? opts.nodeSeparation()  : DEFAULT_NODE_SEPARATION;
    const LEVEL_SEPARATION = (opts && typeof opts.levelSeparation === "function") ? opts.levelSeparation() : DEFAULT_LEVEL_SEPARATION;

    // Only operate on TBox class nodes — exclude injected ABox individuals
    classNodes = classNodes.filter(( n ) => {
      return !(n.type && n.type() === "owl:NamedIndividual");
    });

    const subclassEdges = allProperties.filter(( p ) => {
      return p.type && p.type() === "rdfs:subClassOf";
    });

    // Build parent → children index (IRI strings)
    const childrenOf = {};
    const hasParent = {};
    classNodes.forEach(( node ) => {
      childrenOf[node.iri()] = [];
    });
    subclassEdges.forEach(( edge ) => {
      const child = edge.domain();
      const parent = edge.range();
      if ( !child || !parent ) return;
      if ( childrenOf[parent.iri()] ) {
        childrenOf[parent.iri()].push(child.iri());
        hasParent[child.iri()] = true;
      }
    });

    // Node index by IRI
    const nodeIndex = {};
    classNodes.forEach(( n ) => { nodeIndex[n.iri()] = n; });

    // Find roots: class nodes with no parent in the visible set
    const roots = classNodes.filter(( node ) => {
      return !hasParent[node.iri()];
    });
    if ( roots.length === 0 || classNodes.length === 0 ) return;

    // Build tree data with cycle guard (shared visited across all roots)
    const visited = {};
    function buildNode( iri ){
      if ( visited[iri] ) return { iri: iri, children: [] };
      visited[iri] = true;
      return {
        iri: iri,
        children: (childrenOf[iri] || []).map(buildNode)
      };
    }

    const VIRTUAL_ROOT = "__vroot__";
    const treeData = {
      iri: VIRTUAL_ROOT,
      children: roots.map(( root ) => { return buildNode(root.iri()); })
    };

    // --- First pass: determine the widest level so we can size the canvas ---
    const tempTree = d3.tree().size([1, 1]);
    const tempRoot = tempTree(d3.hierarchy(treeData, ( d ) => { return d.children; }));
    const tempNodes = tempRoot.descendants();

    const depthCounts = {};
    tempNodes.forEach(( n ) => {
      if ( n.data.iri === VIRTUAL_ROOT ) return;
      depthCounts[n.depth] = (depthCounts[n.depth] || 0) + 1;
    });

    let maxLevelWidth = 1;
    Object.keys(depthCounts).forEach(( d ) => {
      if ( depthCounts[d] > maxLevelWidth ) maxLevelWidth = depthCounts[d];
    });

    const maxDepth = d3.max(tempNodes, ( n ) => { return n.depth; }) || 1;

    // Scale canvas using slider values directly so both sliders have full effect
    const treeWidth  = maxLevelWidth * NODE_SEPARATION;
    const treeHeight = maxDepth * LEVEL_SEPARATION;


    // --- Second pass: actual layout at computed size ---
    const tree = d3.tree().size([treeWidth, treeHeight]);
    const treeRoot = tree(d3.hierarchy(treeData, ( d ) => { return d.children; }));
    const treeNodes = treeRoot.descendants();

    // Center the tree around the SVG origin (0, 0)
    const halfWidth  = treeWidth  / 2;
    const halfHeight = treeHeight / 2;

    let noPinnedFn = 0, noClassNode = 0, skippedThing = 0;

    treeNodes.forEach(( tNode ) => {
      if ( tNode.data.iri === VIRTUAL_ROOT ) return;
      const classNode = nodeIndex[tNode.data.iri];
      if ( !classNode ) { noClassNode++; return; }
      // owl:Thing floats as a force node — not pinned
      if ( classNode.type && classNode.type() === "owl:Thing" ) { skippedThing++; return; }

      // Verify pinned() exists before calling
      if ( typeof classNode.pinned !== "function" ) {
        noPinnedFn++;
        // Fallback: set fixed directly
        classNode.x  = tNode.x - halfWidth;
        classNode.y  = tNode.y - halfHeight;
        classNode.fx = classNode.x;
        classNode.fy = classNode.y;
        pinnedNodes.push(classNode);
        return;
      }

      classNode.x  = tNode.x - halfWidth;   // center horizontally
      classNode.y  = tNode.y - halfHeight;  // center vertically
      classNode.pinned(true);


      pinnedNodes.push(classNode);
    });

  };

  layout.unapply = function (){
    pinnedNodes.forEach(( node ) => {
      node.pinned(false);
    });
    pinnedNodes = [];
  };

  layout.enabled = function ( p ){
    if ( !arguments.length ) return hierarchyEnabled;
    hierarchyEnabled = p;
    return layout;
  };

  return layout;
};
