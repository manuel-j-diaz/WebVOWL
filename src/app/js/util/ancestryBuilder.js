/**
 * Pure utility for building class ancestry trees from rdfs:subClassOf edges.
 * No DOM dependencies — takes a node and properties array, returns a tree structure.
 */
const ancestryBuilder = {};

/**
 * Walk upward from a node through rdfs:subClassOf edges, collecting all
 * root-to-node paths. Handles cycles, diamond inheritance, and missing edges.
 *
 * @param {object} node - The selected class node
 * @param {Array} allProperties - All property edges (unfiltered)
 * @returns {Array<Array<object>>} Array of paths, each path is root-first array of node objects
 */
ancestryBuilder.buildAncestryPaths = function ( node, allProperties ){
  if ( !node || !allProperties ) return [[node].filter(Boolean)];

  const subclassEdges = allProperties.filter(( p ) => {
    return p.type && p.type() === "rdfs:subClassOf";
  });

  // Build child → [parent nodes] map
  const parentMap = {};
  subclassEdges.forEach(( edge ) => {
    const child = edge.domain();
    const parent = edge.range();
    if ( !child || !parent ) return;
    const childIri = child.iri();
    if ( !parentMap[childIri] ) parentMap[childIri] = [];
    parentMap[childIri].push(parent);
  });

  const paths = [];

  function walkUp( currentNode, currentPath, visited ){
    const iri = currentNode.iri();
    if ( visited[iri] ) return; // cycle guard
    visited[iri] = true;

    currentPath.unshift(currentNode);

    const parents = parentMap[iri];
    if ( !parents || parents.length === 0 ) {
      // Root reached — save a copy of the path
      paths.push(currentPath.slice());
    } else {
      parents.forEach(( parentNode ) => {
        // Copy visited set at each branch for diamond inheritance
        walkUp(parentNode, currentPath, Object.assign({}, visited));
      });
    }

    currentPath.shift(); // backtrack
  }

  walkUp(node, [], {});

  // If no paths found (shouldn't happen, but safety), return node alone
  if ( paths.length === 0 ) return [[node]];
  return paths;
};

/**
 * Merge multiple root-to-leaf paths into a single tree, collapsing shared prefixes.
 *
 * @param {Array<Array<object>>} paths - Array of root-first paths
 * @returns {{ node: null, children: Array }} Virtual root with merged tree children
 */
ancestryBuilder.buildAncestryTree = function ( paths ){
  const root = { node: null, children: [] };

  paths.forEach(( path ) => {
    let current = root;
    path.forEach(( graphNode ) => {
      const iri = graphNode.iri();
      let child = current.children.find(( c ) => {
        return c.node.iri() === iri;
      });
      if ( !child ) {
        child = { node: graphNode, children: [] };
        current.children.push(child);
      }
      current = child;
    });
  });

  return root;
};

module.exports = ancestryBuilder;
