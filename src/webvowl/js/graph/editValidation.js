/**
 * Validation helpers for edit mode operations.
 * Each function takes the graph object (for access to options/warningModule)
 * and unfilteredData (the raw ontology data) as needed.
 */
const elementTools = require("../util/elementTools")();

/**
 * Returns the matching node if url is already in use, false otherwise.
 */
function checkIfIriClassAlreadyExist( graph, unfilteredData, url ){
  const allNodes = unfilteredData.nodes;
  for ( let i = 0; i < allNodes.length; i++ ) {
    if ( elementTools.isDatatype(allNodes[i]) === true || allNodes[i].type() === "owl:Thing" )
      continue;
    const classIRI = allNodes[i].iri();
    if ( url === classIRI ) {
      return allNodes[i];
    }
  }
  return false;
}

/**
 * Returns false (with a warning) if the class can't be changed to targetType
 * because of values-from restrictions.
 */
function classesSanityCheck( graph, unfilteredData, classElement, targetType ){
  if ( targetType === "owl:Class" ) return true;

  const allProps = unfilteredData.properties;
  for ( let i = 0; i < allProps.length; i++ ) {
    if ( allProps[i].range() === classElement || allProps[i].domain() === classElement ) {
      if ( allProps[i].type() === "owl:someValuesFrom" ) {
        graph.options().warningModule().showWarning("Can not change class type",
          "The element has a property that is of type owl:someValuesFrom",
          "Element type not changed!", 1, true);
        return false;
      }
      if ( allProps[i].type() === "owl:allValuesFrom" ) {
        graph.options().warningModule().showWarning("Can not change class type",
          "The element has a property that is of type owl:allValuesFrom",
          "Element type not changed!", 1, true);
        return false;
      }
    }
  }
  return true;
}

/**
 * Domain/range restriction checks shared by property creation and type change.
 */
function genericPropertySanityCheck( graph, domain, range, typeString, header, action ){
  if ( domain === range && typeString === "rdfs:subClassOf" ) {
    graph.options().warningModule().showWarning(header,
      "rdfs:subClassOf can not be created as loops (domain == range)",
      action, 1, false);
    return false;
  }
  if ( domain === range && typeString === "owl:disjointWith" ) {
    graph.options().warningModule().showWarning(header,
      "owl:disjointWith  can not be created as loops (domain == range)",
      action, 1, false);
    return false;
  }
  if ( domain.type() === "owl:Thing" && typeString === "owl:allValuesFrom" ) {
    graph.options().warningModule().showWarning(header,
      "owl:allValuesFrom can not originate from owl:Thing",
      action, 1, false);
    return false;
  }
  if ( domain.type() === "owl:Thing" && typeString === "owl:someValuesFrom" ) {
    graph.options().warningModule().showWarning(header,
      "owl:someValuesFrom can not originate from owl:Thing",
      action, 1, false);
    return false;
  }
  if ( range.type() === "owl:Thing" && typeString === "owl:allValuesFrom" ) {
    graph.options().warningModule().showWarning(header,
      "owl:allValuesFrom can not be connected to owl:Thing",
      action, 1, false);
    return false;
  }
  if ( range.type() === "owl:Thing" && typeString === "owl:someValuesFrom" ) {
    graph.options().warningModule().showWarning(header,
      "owl:someValuesFrom can not be connected to owl:Thing",
      action, 1, false);
    return false;
  }
  return true;
}

/**
 * Check if a property can be created given current filter state and restrictions.
 */
function sanityCheckProperty( graph, domain, range, typeString ){
  if ( typeString === "owl:objectProperty" && graph.options().objectPropertyFilter().enabled() === false ) {
    graph.options().warningModule().showWarning("Warning",
      "Object properties are filtered out in the visualization!",
      "Element not created!", 1, false);
    return false;
  }
  if ( typeString === "owl:disjointWith" && graph.options().disjointPropertyFilter().enabled() === false ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:disjointWith properties are filtered out in the visualization!",
      "Element not created!", 1, false);
    return false;
  }
  if ( domain === range && typeString === "rdfs:subClassOf" ) {
    graph.options().warningModule().showWarning("Warning",
      "rdfs:subClassOf can not be created as loops (domain == range)",
      "Element not created!", 1, false);
    return false;
  }
  if ( domain === range && typeString === "owl:disjointWith" ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:disjointWith  can not be created as loops (domain == range)",
      "Element not created!", 1, false);
    return false;
  }
  if ( domain.type() === "owl:Thing" && typeString === "owl:someValuesFrom" ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:someValuesFrom can not originate from owl:Thing",
      "Element not created!", 1, false);
    return false;
  }
  if ( domain.type() === "owl:Thing" && typeString === "owl:allValuesFrom" ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:allValuesFrom can not originate from owl:Thing",
      "Element not created!", 1, false);
    return false;
  }
  if ( range.type() === "owl:Thing" && typeString === "owl:allValuesFrom" ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:allValuesFrom can not be connected to owl:Thing",
      "Element not created!", 1, false);
    return false;
  }
  if ( range.type() === "owl:Thing" && typeString === "owl:someValuesFrom" ) {
    graph.options().warningModule().showWarning("Warning",
      "owl:someValuesFrom can not be connected to owl:Thing",
      "Element not created!", 1, false);
    return false;
  }
  return true;
}

/**
 * Returns false (with a warning) if the triple already exists.
 */
function propertyCheckExistenceChecker( graph, unfilteredData, property, domain, range ){
  const allProps = unfilteredData.properties;
  if ( property.type() === "rdfs:subClassOf" || property.type() === "owl:disjointWith" ) {
    for ( let i = 0; i < allProps.length; i++ ) {
      if ( allProps[i] === property ) continue;
      if ( allProps[i].domain() === domain && allProps[i].range() === range && allProps[i].type() === property.type() ) {
        graph.options().warningModule().showWarning("Warning",
          "This triple already exist!",
          "Element not created!", 1, false);
        return false;
      }
      if ( allProps[i].domain() === range && allProps[i].range() === domain && allProps[i].type() === property.type() ) {
        graph.options().warningModule().showWarning("Warning",
          "Inverse assignment already exist! ",
          "Element not created!", 1, false);
        return false;
      }
    }
    return true;
  }
  return true;
}

module.exports = {
  checkIfIriClassAlreadyExist,
  classesSanityCheck,
  genericPropertySanityCheck,
  sanityCheckProperty,
  propertyCheckExistenceChecker
};
