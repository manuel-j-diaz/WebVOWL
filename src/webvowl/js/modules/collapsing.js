var elementTools = require("../util/elementTools")();
var filterTools = require("../util/filterTools")();

module.exports = function (){
  var collapsing = {},
    enabled = false,
    filteredNodes, filteredProperties;

  var collapsedNodeIds = new Set();
  var childrenIndex = {};
  var descendantIndex = {};
  var baseProperties = null;

  collapsing.setBaseProperties = function ( props ){
    baseProperties = props;
  };

  collapsing.filter = function ( nodes, properties ){
    // Filtered index: for collapsible flag (instanceof, no false-positive +/- buttons)
    childrenIndex = {};
    properties.forEach(function ( p ){
      if ( !elementTools.isRdfsSubClassOf(p) ) return;
      var parentId = p.range().id();
      var childId = p.domain().id();
      if ( !childrenIndex[parentId] ) childrenIndex[parentId] = [];
      childrenIndex[parentId].push(childId);
    });

    // Descendant index: for recursive hiding (string check, full base hierarchy)
    descendantIndex = {};
    var propsForDesc = baseProperties || properties;
    propsForDesc.forEach(function ( p ){
      if ( !(p.type && p.type() === "rdfs:subClassOf") ) return;
      if ( !p.domain() || !p.range() ) return;
      var parentId = p.range().id();
      var childId = p.domain().id();
      if ( !descendantIndex[parentId] ) descendantIndex[parentId] = [];
      descendantIndex[parentId].push(childId);
    });

    // Mark collapsible: nodes that have children (only when feature is enabled)
    nodes.forEach(function ( n ){
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
    var toHide = new Set();
    collapsedNodeIds.forEach(function ( id ){ collectDescendants(id, toHide); });

    var result = filterTools.filterNodesAndTidy(nodes, properties, function ( n ){
      return !toHide.has(n.id());
    });
    filteredNodes = result.nodes;
    filteredProperties = result.properties;
  };

  function collectDescendants( id, result ){
    (descendantIndex[id] || []).forEach(function ( childId ){
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
