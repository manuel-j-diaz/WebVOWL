/**
 * Shared tree-building utility for hierarchy and radial layouts.
 * Extracts rdfs:subClassOf edges, builds a tree (or forest with virtual root),
 * and returns structural metadata needed by layout algorithms.
 *
 * @param {Array} classNodes - Visible class nodes
 * @param {Array} allProperties - All property edges
 * @returns {{ treeData, nodeIndex, maxDepth, maxLevelWidth, classNodes }}
 */
module.exports = function treeBuilder( classNodes, allProperties ){
  const VIRTUAL_ROOT = "__vroot__";

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
  if ( roots.length === 0 || classNodes.length === 0 ) return null;

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

  const treeData = {
    iri: VIRTUAL_ROOT,
    children: roots.map(( root ) => { return buildNode(root.iri()); })
  };

  // First pass: determine the widest level so we can size the canvas
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

  return {
    treeData: treeData,
    nodeIndex: nodeIndex,
    maxDepth: maxDepth,
    maxLevelWidth: maxLevelWidth,
    classNodes: classNodes,
    VIRTUAL_ROOT: VIRTUAL_ROOT
  };
};
