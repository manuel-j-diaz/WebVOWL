const elementTools = require("../util/elementTools")();

module.exports = function (){

  const filter = {};
  let nodes,
    properties,
    enabled = false,
    filteredNodes,
    filteredProperties,
    nodesWithOwnProperties = null,
    showAll = false;
  
  
  /**
   * If enabled subclasses that have only subclass properties are filtered.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.setBaseProperties = function(baseProperties) {
    nodesWithOwnProperties = new Set();
    baseProperties.forEach((p) => {
      if (!elementTools.isRdfsSubClassOf(p)) {
        if (p.domain()) nodesWithOwnProperties.add(p.domain().id());
        if (p.range()) nodesWithOwnProperties.add(p.range().id());
      }
    });
  };

  filter.setShowAll = function(val) {
    showAll = val;
  };

  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;
    
    if ( !this.enabled() ) {
      hideSubclassesWithoutOwnProperties();
    }
    
    filteredNodes = nodes;
    filteredProperties = properties;
  };
  
  function subtreeHasOwnPropertiesInBase(connectedProperties) {
    if (!nodesWithOwnProperties) return false;
    for (const p of connectedProperties) {
      if (p.domain() && nodesWithOwnProperties.has(p.domain().id())) return true;
      if (p.range() && nodesWithOwnProperties.has(p.range().id())) return true;
    }
    return false;
  }

  function hideSubclassesWithoutOwnProperties(){
    if (showAll) return;   // degree=0: show everything

    let unneededProperties = [];
    const unneededClasses = [];
    const subclasses = [];


    for ( const property of properties ) {
      if ( elementTools.isRdfsSubClassOf(property) ) {
        subclasses.push(property.domain());
      }
    }

    for ( const subclass of subclasses ) {
      const connectedProperties = findRelevantConnectedProperties(subclass, properties);

      // Only remove the node and its properties, if they're all subclassOf properties
      if ( areOnlySubclassProperties(connectedProperties) &&
        !subtreeHasOwnPropertiesInBase(connectedProperties) &&
        doesNotInheritFromMultipleClasses(subclass, connectedProperties) ) {

        unneededProperties = unneededProperties.concat(connectedProperties);
        unneededClasses.push(subclass);
      }
    }

    nodes = removeUnneededElements(nodes, unneededClasses);
    properties = removeUnneededElements(properties, unneededProperties);
  }
  
  /**
   * Looks recursively for connected properties. Because just subclasses are relevant,
   * we just look recursively for their properties.
   *
   * @param node
   * @param allProperties
   * @param visitedNodes a visited nodes which is used on recursive invocation
   * @returns {Array}
   */
  function findRelevantConnectedProperties( node, allProperties, visitedNodes ){
    let connectedProperties = [];

    for ( const property of allProperties ) {
      if ( property.domain() === node ||
        property.range() === node ) {
        
        connectedProperties.push(property);
        
        
        /* Special case: SuperClass <-(1) Subclass <-(2) Subclass ->(3) e.g. Datatype
         * We need to find the last property recursively. Otherwise, we would remove the subClassOf
         * property (1) because we didn't see the datatype property (3).
         */
        
        // Look only for subclass properties, because these are the relevant properties
        if ( elementTools.isRdfsSubClassOf(property) ) {
          const domain = property.domain();
          visitedNodes = visitedNodes || new Set();

          // If we have the range, there might be a nested property on the domain
          if ( node === property.range() && !visitedNodes.has(domain.id()) ) {
            visitedNodes.add(domain.id());
            const nestedConnectedProperties = findRelevantConnectedProperties(domain, allProperties, visitedNodes);
            connectedProperties = connectedProperties.concat(nestedConnectedProperties);
          }
        }
      }
    }
    
    return connectedProperties;
  }
  
  function areOnlySubclassProperties( connectedProperties ){
    let onlySubclassProperties = true;

    for ( const property of connectedProperties ) {
      if ( !elementTools.isRdfsSubClassOf(property) ) {
        onlySubclassProperties = false;
        break;
      }
    }

    return onlySubclassProperties;
  }
  
  function doesNotInheritFromMultipleClasses( subclass, connectedProperties ){
    let superClassCount = 0;

    for ( const property of connectedProperties ) {
      
      if ( property.domain() === subclass ) {
        superClassCount += 1;
      }
      
      if ( superClassCount > 1 ) {
        return false;
      }
    }
    
    return true;
  }
  
  function removeUnneededElements( array, removableElements ){
    const disjoint = [];

    for ( const element of array ) {
      if ( removableElements.indexOf(element) === -1 ) {
        disjoint.push(element);
      }
    }
    return disjoint;
  }
  
  filter.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return filter;
  };
  
  
  // Functions a filter must have
  filter.filteredNodes = function (){
    return filteredNodes;
  };
  
  filter.filteredProperties = function (){
    return filteredProperties;
  };
  
  
  return filter;
};
