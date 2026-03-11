const elementTools = require("../util/elementTools")();
const filterTools = require("../util/filterTools")();

module.exports = function (){
  const collapsing = {};
  let enabled = false,
    filteredNodes, filteredProperties;

  const collapsedNodeIds = new Set();
  let childrenIndex = {};
  let descendantIndex = {};
  let baseProperties = null;

  collapsing.setBaseProperties = function ( props ){
    baseProperties = props;
  };

  collapsing.filter = function ( nodes, properties ){
    // Filtered index: for collapsible flag (instanceof, no false-positive +/- buttons)
    childrenIndex = {};
    properties.forEach(( p ) => {
      if ( !elementTools.isRdfsSubClassOf(p) ) return;
      const parentId = p.range().id();
      const childId = p.domain().id();
      if ( !childrenIndex[parentId] ) childrenIndex[parentId] = [];
      childrenIndex[parentId].push(childId);
    });

    // Descendant index: for recursive hiding (string check, full base hierarchy)
    descendantIndex = {};
    const propsForDesc = baseProperties || properties;
    propsForDesc.forEach(( p ) => {
      if ( !(p.type && p.type() === "rdfs:subClassOf") ) return;
      if ( !p.domain() || !p.range() ) return;
      const parentId = p.range().id();
      const childId = p.domain().id();
      if ( !descendantIndex[parentId] ) descendantIndex[parentId] = [];
      descendantIndex[parentId].push(childId);
    });

    // Mark collapsible: nodes that have children (only when feature is enabled)
    nodes.forEach(( n ) => {
      if ( !elementTools.isDatatype(n) ) {
        n.collapsible(enabled && (childrenIndex[n.id()] || []).length > 0);
      }
    });

    if ( !enabled || collapsedNodeIds.size === 0 ) {
      filteredNodes = nodes;
      filteredProperties = properties;
      return;
    }

    // Collect all descendants of collapsed nodes
    const toHide = new Set();
    collapsedNodeIds.forEach(( id ) => { collectDescendants(id, toHide); });

    const result = filterTools.filterNodesAndTidy(nodes, properties, ( n ) => {
      return !toHide.has(n.id());
    });
    filteredNodes = result.nodes;
    filteredProperties = result.properties;
  };

  function collectDescendants( id, result ){
    (descendantIndex[id] || []).forEach(( childId ) => {
      if ( !result.has(childId) ) {
        result.add(childId);
        collectDescendants(childId, result);
      }
    });
  }

  collapsing.toggleCollapsed = function ( nodeId ){
    if ( collapsedNodeIds.has(nodeId) ) collapsedNodeIds.delete(nodeId);
    else collapsedNodeIds.add(nodeId);
  };

  collapsing.isCollapsed = function ( nodeId ){
    return collapsedNodeIds.has(nodeId);
  };

  collapsing.hasChildren = function ( nodeId ){
    return (childrenIndex[nodeId] || []).length > 0;
  };

  collapsing.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return collapsing;
  };

  collapsing.reset = function (){
    collapsedNodeIds.clear();
    childrenIndex = {};
    descendantIndex = {};
    baseProperties = null;
  };

  collapsing.filteredNodes = function (){
    return filteredNodes;
  };

  collapsing.filteredProperties = function (){
    return filteredProperties;
  };

  return collapsing;
};
