/**
 * Pure data-processing helpers for the graph module.
 * No dependency on graph state — all inputs are explicit parameters.
 */

/**
 * Single-pass O(n) assignment of links to their domain/range nodes.
 */
function storeLinksOnNodes( nodes, links ){
  const linkMap = new Map();
  for ( let j = 0, linksLength = links.length; j < linksLength; j++ ) {
    const link = links[j];
    const domain = link.domain();
    const range = link.range();
    if ( !linkMap.has(domain) ) linkMap.set(domain, []);
    linkMap.get(domain).push(link);
    if ( range !== domain ) {
      if ( !linkMap.has(range) ) linkMap.set(range, []);
      linkMap.get(range).push(link);
    }
  }
  for ( let i = 0, nodesLength = nodes.length; i < nodesLength; i++ ) {
    nodes[i].links(linkMap.get(nodes[i]) || []);
  }
}

/**
 * Copy positions from old label nodes to newly-created label nodes
 * so they don't jump to random positions when data refreshes.
 */
function setPositionOfOldLabelsOnNewLabels( oldLabelNodes, labelNodes ){
  labelNodes.forEach(( labelNode ) => {
    for ( let i = 0; i < oldLabelNodes.length; i++ ) {
      const oldNode = oldLabelNodes[i];
      if ( oldNode.equals(labelNode) ) {
        labelNode.x = oldNode.x;
        labelNode.y = oldNode.y;
        break;
      }
    }
  });
}

/**
 * Build a case-insensitive key → constructor Map from a prototype Map.
 */
function createLowerCasePrototypeMap( prototypeMap ){
  const newMap = new Map();
  prototypeMap.forEach(( Prototype ) => {
    newMap.set(new Prototype().type().toLowerCase(), Prototype);
  });
  return newMap;
}

module.exports = { storeLinksOnNodes, setPositionOfOldLabelsOnNewLabels, createLowerCasePrototypeMap };
