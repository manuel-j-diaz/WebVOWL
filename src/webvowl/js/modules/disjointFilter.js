const OwlDisjointWith = require("../elements/properties/implementations/OwlDisjointWith");

module.exports = function (){

  const filter = {};
  let nodes,
    properties,
    // Hidden by default (unchecked); check to show
    enabled = false,
    filteredNodes,
    filteredProperties;
  
  
  /**
   * If enabled, all disjoint with properties are filtered.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;
    
    if ( !this.enabled() ) {
      removeDisjointWithProperties();
    }
    
    filteredNodes = nodes;
    filteredProperties = properties;
  };
  
  function removeDisjointWithProperties(){
    const cleanedProperties = [];

    for ( const property of properties ) {
      if ( !(property instanceof OwlDisjointWith) ) {
        cleanedProperties.push(property);
      }
    }

    properties = cleanedProperties;
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
