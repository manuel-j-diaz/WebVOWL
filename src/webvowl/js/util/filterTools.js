const elementTools = require("./elementTools")();

module.exports = (function (){

  const tools = {};
  
  /**
   * Filters the passed nodes and removes dangling properties.
   * @param nodes
   * @param properties
   * @param shouldKeepNode function that returns true if the node should be kept
   * @returns {{nodes: Array, properties: Array}} the filtered nodes and properties
   */
  tools.filterNodesAndTidy = function ( nodes, properties, shouldKeepNode ){
    const removedNodeIds = new Set(),
      cleanedNodes = [],
      cleanedProperties = [];

    nodes.forEach(( node ) => {
      if ( shouldKeepNode(node) ) {
        cleanedNodes.push(node);
      } else {
        removedNodeIds.add(node.id());
      }
    });

    properties.forEach(( property ) => {
      if ( propertyHasVisibleNodes(removedNodeIds, property) ) {
        cleanedProperties.push(property);
      } else if ( elementTools.isDatatypeProperty(property) ) {
        // Remove floating datatypes/literals, because they belong to their datatype property
        const index = cleanedNodes.indexOf(property.range());
        if ( index >= 0 ) {
          cleanedNodes.splice(index, 1);
        }
      }
    });
    
    return {
      nodes: cleanedNodes,
      properties: cleanedProperties
    };
  };
  
  /**
   * Returns true, if the domain and the range of this property have not been removed.
   * @param removedNodes
   * @param property
   * @returns {boolean} true if property isn't dangling
   */
  function propertyHasVisibleNodes( removedNodeIds, property ){
    return !removedNodeIds.has(property.domain().id()) && !removedNodeIds.has(property.range().id());
  }
  
  
  return function (){
    return tools;
  };
})();
