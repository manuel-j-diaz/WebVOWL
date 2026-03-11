const SetOperatorNode = require("../elements/nodes/SetOperatorNode");
const OwlThing = require("../elements/nodes/implementations/OwlThing");
const OwlNothing = require("../elements/nodes/implementations/OwlNothing");
const elementTools = require("../util/elementTools")();

module.exports = function (){

  const statistics = {};
  let nodeCount,
    occurencesOfClassAndDatatypeTypes = {},
    edgeCount,
    occurencesOfPropertyTypes = {},
    classCount,
    datatypeCount,
    datatypePropertyCount,
    objectPropertyCount,
    propertyCount,
    totalIndividualCount,
    filteredNodes,
    filteredProperties;
  
  
  statistics.filter = function ( classesAndDatatypes, properties ){
    resetStoredData();
    
    storeTotalCounts(classesAndDatatypes, properties);
    storeClassAndDatatypeCount(classesAndDatatypes);
    storePropertyCount(properties);
    
    storeOccurencesOfTypes(classesAndDatatypes, occurencesOfClassAndDatatypeTypes);
    storeOccurencesOfTypes(properties, occurencesOfPropertyTypes);
    
    storeTotalIndividualCount(classesAndDatatypes);
    
    filteredNodes = classesAndDatatypes;
    filteredProperties = properties;
  };
  
  function resetStoredData(){
    nodeCount = 0;
    edgeCount = 0;
    classCount = 0;
    datatypeCount = 0;
    datatypePropertyCount = 0;
    objectPropertyCount = 0;
    propertyCount = 0;
    totalIndividualCount = 0;
  }
  
  function storeTotalCounts( classesAndDatatypes, properties ){
    nodeCount = classesAndDatatypes.length;

    const seenPropertyIds = new Set();
    for ( const property of properties ) {
      if ( !seenPropertyIds.has(property.id()) ) {
        edgeCount += 1;
      }

      seenPropertyIds.add(property.id());
      if ( property.inverse() ) {
        seenPropertyIds.add(property.inverse().id());
      }
    }
  }
  
  function storeClassAndDatatypeCount( classesAndDatatypes ){
    // Each datatype should be counted just a single time
    const datatypeSet = new Set();
    let hasThing = false,
      hasNothing = false;
    classCount = 0;
    let old = 0, newcc = 0;
    classesAndDatatypes.forEach(( node ) => {
      if ( elementTools.isDatatype(node) ) {
        datatypeSet.add(node.defaultLabel());
      } else if ( !(node instanceof SetOperatorNode) ) {
        if ( node instanceof OwlThing ) {
          hasThing = true;
        } else if ( node instanceof OwlNothing ) {
          hasNothing = true;
        } else {
          old = classCount;
          const adds = 1 + countElementArray(node.equivalents());
          classCount += adds;
          newcc = classCount;
        }
      } else if ( node instanceof SetOperatorNode ) {
        old = classCount;
        classCount += 1;
        newcc = classCount;
      }
    });
    
    // count things and nothings just a single time
    // classCount += hasThing ? 1 : 0;
    // classCount += hasNothing ? 1 : 0;
    
    datatypeCount = datatypeSet.size;
  }
  
  function storePropertyCount( properties ){
    for ( const property of properties ) {
      let attr;
      let result = false;
      if ( property.attributes ) {
        attr = property.attributes();
        if ( attr && attr.indexOf("datatype") !== -1 ) {
          result = true;
        }
      }
      if ( result === true ) {
        datatypePropertyCount += getExtendedPropertyCount(property);
      } else if ( elementTools.isObjectProperty(property) ) {
        objectPropertyCount += getExtendedPropertyCount(property);
      }
    }
    propertyCount = objectPropertyCount + datatypePropertyCount;
  }
  
  function getExtendedPropertyCount( property ){
    // count the property itself
    let count = 1;
    
    // and count properties this property represents
    count += countElementArray(property.equivalents());
    count += countElementArray(property.redundantProperties());
    
    return count;
  }
  
  function countElementArray( properties ){
    if ( properties ) {
      return properties.length;
    }
    return 0;
  }
  
  function storeOccurencesOfTypes( elements, storage ){
    elements.forEach(( element ) => {
      const type = element.type();
      let typeCount = storage[type];
      
      if ( typeof typeCount === "undefined" ) {
        typeCount = 0;
      } else {
        typeCount += 1;
      }
      storage[type] = typeCount;
    });
  }
  
  function storeTotalIndividualCount( nodes ){
    let sawIndividuals = {};
    let totalCount = 0;
    for ( const node of nodes ) {
      const individuals = node.individuals();

      let tempCount = 0;
      for ( const individual of individuals ) {
        if ( sawIndividuals[individual.iri()] === undefined ) {
          sawIndividuals[individual.iri()] = 1; // this iri for that individual is now set to 1 >> seen it
          tempCount++;
        }
      }
      totalCount += tempCount;
    }
    totalIndividualCount = totalCount;
    sawIndividuals = {}; // clear the object

  }
  
  
  statistics.nodeCount = function (){
    return nodeCount;
  };
  
  statistics.occurencesOfClassAndDatatypeTypes = function (){
    return occurencesOfClassAndDatatypeTypes;
  };
  
  statistics.edgeCount = function (){
    return edgeCount;
  };
  
  statistics.occurencesOfPropertyTypes = function (){
    return occurencesOfPropertyTypes;
  };
  
  statistics.classCount = function (){
    return classCount;
  };
  
  statistics.datatypeCount = function (){
    return datatypeCount;
  };
  
  statistics.datatypePropertyCount = function (){
    return datatypePropertyCount;
  };
  
  statistics.objectPropertyCount = function (){
    return objectPropertyCount;
  };
  
  statistics.propertyCount = function (){
    return propertyCount;
  };
  
  statistics.totalIndividualCount = function (){
    return totalIndividualCount;
  };
  
  
  // Functions a filter must have
  statistics.filteredNodes = function (){
    return filteredNodes;
  };
  
  statistics.filteredProperties = function (){
    return filteredProperties;
  };
  
  
  return statistics;
};
