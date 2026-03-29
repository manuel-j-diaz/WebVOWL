/**
 * Radial tree layout for WebVOWL.
 * Root node at center, children in concentric rings outward.
 * Uses treeBuilder for shared tree construction, then assigns polar→Cartesian
 * coordinates. Pins class nodes via node.pinned(true).
 * owl:Thing and owl:NamedIndividual nodes are excluded from pinning.
 */
const treeBuilder = require("./treeBuilder");

module.exports = function ( graph ){
  const layout = {};
  let radialEnabled = false;
  let pinnedNodes = [];

  const DEFAULT_NODE_SEPARATION  = 150;
  const DEFAULT_LEVEL_SEPARATION = 180;

  layout.apply = function ( classNodes, allProperties ){
    pinnedNodes = [];

    const opts = graph.options ? graph.options() : null;
    const NODE_SEPARATION  = (opts && typeof opts.nodeSeparation  === "function") ? opts.nodeSeparation()  : DEFAULT_NODE_SEPARATION;
    const LEVEL_SEPARATION = (opts && typeof opts.levelSeparation === "function") ? opts.levelSeparation() : DEFAULT_LEVEL_SEPARATION;

    const tree = treeBuilder(classNodes, allProperties);
    if ( !tree ) return;

    const { treeData, nodeIndex, maxDepth, maxLevelWidth, VIRTUAL_ROOT } = tree;

    const totalRadius = maxDepth * LEVEL_SEPARATION;

    // Compute angular span from node separation:
    // The widest level has maxLevelWidth nodes. We want NODE_SEPARATION px of arc
    // between adjacent nodes at that ring's radius (outerRadius = totalRadius).
    // arc = angle * radius, so angle per node = NODE_SEPARATION / totalRadius.
    // Total angle = maxLevelWidth * (NODE_SEPARATION / totalRadius), clamped to 2π max.
    const angularSpan = Math.min(2 * Math.PI, maxLevelWidth * NODE_SEPARATION / (totalRadius || 1));

    // Radial layout: x = angle (radians), y = radius
    const d3Tree = d3.tree()
      .size([angularSpan, totalRadius])
      .separation(( a, b ) => {
        return (a.parent === b.parent ? 1 : 2) / (a.depth || 1);
      });

    const treeRoot = d3Tree(d3.hierarchy(treeData, ( d ) => { return d.children; }));
    const treeNodes = treeRoot.descendants();

    treeNodes.forEach(( tNode ) => {
      if ( tNode.data.iri === VIRTUAL_ROOT ) return;
      const classNode = nodeIndex[tNode.data.iri];
      if ( !classNode ) return;
      // owl:Thing floats as a force node — not pinned
      if ( classNode.type && classNode.type() === "owl:Thing" ) return;

      // D3 convention: tNode.x = angle, tNode.y = radius
      const x = tNode.y * Math.cos(tNode.x);
      const y = tNode.y * Math.sin(tNode.x);

      if ( typeof classNode.pinned !== "function" ) {
        classNode.x  = x;
        classNode.y  = y;
        classNode.fx = x;
        classNode.fy = y;
        pinnedNodes.push(classNode);
        return;
      }

      classNode.x = x;
      classNode.y = y;
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
    if ( !arguments.length ) return radialEnabled;
    radialEnabled = p;
    return layout;
  };

  return layout;
};
