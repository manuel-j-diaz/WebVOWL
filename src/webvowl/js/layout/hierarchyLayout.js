/**
 * Hierarchical tree layout for WebVOWL.
 * Extracts rdfs:subClassOf edges and lays out the entire forest as one tree
 * using a virtual root node. Scales the virtual canvas so no two adjacent
 * same-level nodes are closer than NODE_SEPARATION px. Centers the result
 * at the SVG origin (0, 0). Pins class nodes via node.pinned(true).
 * owl:Thing and owl:NamedIndividual nodes are excluded from pinning.
 */
module.exports = function ( graph ){
  var layout = {},
    hierarchyEnabled = true,
    pinnedNodes = [];

  // Defaults — kept here so hierarchyLayout.js stays self-contained if options are unavailable.
  // The UI sliders write into graph.options() and layout.apply() reads them at call time.
  var DEFAULT_NODE_SEPARATION  = 150;
  var DEFAULT_LEVEL_SEPARATION = 180;

  layout.apply = function ( classNodes, allProperties ){
    pinnedNodes = [];

    // Read live values from options (UI sliders), falling back to defaults
    var opts = graph.options ? graph.options() : null;
    var NODE_SEPARATION  = (opts && typeof opts.nodeSeparation  === "function") ? opts.nodeSeparation()  : DEFAULT_NODE_SEPARATION;
    var LEVEL_SEPARATION = (opts && typeof opts.levelSeparation === "function") ? opts.levelSeparation() : DEFAULT_LEVEL_SEPARATION;

    // Only operate on TBox class nodes — exclude injected ABox individuals
    classNodes = classNodes.filter(function ( n ){
      return !(n.type && n.type() === "owl:NamedIndividual");
    });

    var subclassEdges = allProperties.filter(function ( p ){
      return p.type && p.type() === "rdfs:subClassOf";
    });
    console.log("[hierarchy] classNodes:", classNodes.length, "subclassEdges:", subclassEdges.length);

    // Build parent → children index (IRI strings)
    var childrenOf = {};
    var hasParent = {};
    classNodes.forEach(function ( node ){
      childrenOf[node.iri()] = [];
    });
    subclassEdges.forEach(function ( edge ){
      var child = edge.domain();
      var parent = edge.range();
      if ( !child || !parent ) return;
      if ( childrenOf[parent.iri()] ) {
        childrenOf[parent.iri()].push(child.iri());
        hasParent[child.iri()] = true;
      }
    });

    // Node index by IRI
    var nodeIndex = {};
    classNodes.forEach(function ( n ){ nodeIndex[n.iri()] = n; });

    // Find roots: class nodes with no parent in the visible set
    var roots = classNodes.filter(function ( node ){
      return !hasParent[node.iri()];
    });
    console.log("[hierarchy] roots:", roots.length);
    if ( roots.length === 0 || classNodes.length === 0 ) return;

    var graphWidth  = Math.max(400, (graph.options().width()  || 800) - 80);
    var graphHeight = Math.max(300, (graph.options().height() || 600) - 120);

    // Build tree data with cycle guard (shared visited across all roots)
    var visited = {};
    function buildNode( iri ){
      if ( visited[iri] ) return { iri: iri, children: [] };
      visited[iri] = true;
      return {
        iri: iri,
        children: (childrenOf[iri] || []).map(buildNode)
      };
    }

    var VIRTUAL_ROOT = "__vroot__";
    var treeData = {
      iri: VIRTUAL_ROOT,
      children: roots.map(function ( root ){ return buildNode(root.iri()); })
    };

    // --- First pass: determine the widest level so we can size the canvas ---
    var tempTree = d3.tree().size([1, 1]);
    var tempRoot = tempTree(d3.hierarchy(treeData, function ( d ){ return d.children; }));
    var tempNodes = tempRoot.descendants();

    var depthCounts = {};
    tempNodes.forEach(function ( n ){
      if ( n.data.iri === VIRTUAL_ROOT ) return;
      depthCounts[n.depth] = (depthCounts[n.depth] || 0) + 1;
    });

    var maxLevelWidth = 1;
    Object.keys(depthCounts).forEach(function ( d ){
      if ( depthCounts[d] > maxLevelWidth ) maxLevelWidth = depthCounts[d];
    });

    var maxDepth = d3.max(tempNodes, function ( n ){ return n.depth; }) || 1;

    // Scale canvas: at least NODE_SEPARATION px per node at the widest level
    var treeWidth  = Math.max(graphWidth,  maxLevelWidth * NODE_SEPARATION);
    var treeHeight = Math.max(graphHeight, maxDepth * LEVEL_SEPARATION);

    console.log("[hierarchy] maxLevelWidth:", maxLevelWidth, "maxDepth:", maxDepth,
      "treeWidth:", treeWidth, "treeHeight:", treeHeight);

    // --- Second pass: actual layout at computed size ---
    var tree = d3.tree().size([treeWidth, treeHeight]);
    var treeRoot = tree(d3.hierarchy(treeData, function ( d ){ return d.children; }));
    var treeNodes = treeRoot.descendants();

    // Center the tree around the SVG origin (0, 0)
    var halfWidth  = treeWidth  / 2;
    var halfHeight = treeHeight / 2;

    var noPinnedFn = 0, noClassNode = 0, skippedThing = 0;

    treeNodes.forEach(function ( tNode ){
      if ( tNode.data.iri === VIRTUAL_ROOT ) return;
      var classNode = nodeIndex[tNode.data.iri];
      if ( !classNode ) { noClassNode++; return; }
      // owl:Thing floats as a force node — not pinned
      if ( classNode.type && classNode.type() === "owl:Thing" ) { skippedThing++; return; }

      // Verify pinned() exists before calling
      if ( typeof classNode.pinned !== "function" ) {
        noPinnedFn++;
        console.warn("[hierarchy] node has no pinned() fn:", tNode.data.iri, classNode);
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

      // Verify fx was actually set
      if ( classNode.fx == null ) {
        console.warn("[hierarchy] pinned(true) did NOT set fx for:", tNode.data.iri, classNode);
      }

      pinnedNodes.push(classNode);
    });

    // Sample first 3 pinned nodes for position/state verification
    console.log("[hierarchy] pinned", pinnedNodes.length, "nodes",
      "| noPinnedFn:", noPinnedFn, "| noClassNode:", noClassNode, "| skippedThing:", skippedThing);
    pinnedNodes.slice(0, 3).forEach(function ( n ){
      console.log("[hierarchy] sample pinned node:", n.iri ? n.iri() : "?",
        "x:", n.x, "y:", n.y, "fx:", n.fx,
        "pinned():", typeof n.pinned === "function" ? n.pinned() : "N/A",
        "frozen():", typeof n.frozen === "function" ? n.frozen() : "N/A");
    });
  };

  layout.unapply = function (){
    pinnedNodes.forEach(function ( node ){
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
