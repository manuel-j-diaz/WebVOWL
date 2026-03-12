/**
 * Edit-mode CRUD operations for creating, modifying, and deleting nodes and properties.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state.
 * The context is built by graph.js and contains:
 *   graph, unfilteredData, classNodes, properties,
 *   NodePrototypeMap, PropertyPrototypeMap, shared (mutable counters/quadtree),
 *   generateDictionary, options, elementTools, editValidation
 */
const elementTools = require("../util/elementTools")();
const editValidation = require("./editValidation");

// ─── Internal helpers ────────────────────────────────────────────────────────

function addNewNodeElement( ctx, element ){
  ctx.shared.nodeQuadtree = null;
  ctx.unfilteredData.nodes.push(element);
  if ( !ctx.classNodes.includes(element) )
    ctx.classNodes.push(element);

  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();
  ctx.graph.fastUpdate();
}

function defaultIriValue( ctx, element ){
  if ( ctx.graph.options().getGeneralMetaObject().iri ) {
    const str2Compare = ctx.graph.options().getGeneralMetaObject().iri + element.id();
    return element.iri() === str2Compare;
  }
  return false;
}

// ─── Node creation ───────────────────────────────────────────────────────────

function createNewNodeAtPosition( ctx, pos ){
  const typeToCreate = d3.select("#defaultClass").node().title;
  const prototype = ctx.NodePrototypeMap.get(typeToCreate.toLowerCase());
  const aNode = new prototype(ctx.graph);
  let autoEditElement = false;
  if ( typeToCreate === "owl:Thing" ) {
    aNode.label("Thing");
  } else {
    aNode.label("NewClass");
    autoEditElement = true;
  }
  aNode.x = pos.x;
  aNode.y = pos.y;
  aNode.id(`Class${ctx.shared.eN++}`);

  aNode.baseIri(d3.select("#iriEditor").node().value);
  aNode.iri(aNode.baseIri() + aNode.id());
  addNewNodeElement(ctx, aNode);
  ctx.options.focuserModule().handle(aNode, true);
  aNode.frozen(ctx.graph.paused());
  aNode.locked(ctx.graph.paused());
  aNode.enableEditing(autoEditElement);
}

// ─── Node type change ────────────────────────────────────────────────────────

function changeNodeType( ctx, element ){
  const typeString = d3.select("#typeEditor").node().value;

  if ( editValidation.classesSanityCheck(ctx.graph, ctx.unfilteredData, element, typeString) === false ) {
    ctx.graph.options().editSidebar().updateSelectionInformation(element);
    return;
  }

  const prototype = ctx.NodePrototypeMap.get(typeString.toLowerCase());
  const aNode = new prototype(ctx.graph);

  aNode.x = element.x;
  aNode.y = element.y;
  aNode.px = element.x;
  aNode.py = element.y;
  aNode.id(element.id());
  aNode.copyInformation(element);

  if ( typeString === "owl:Thing" ) {
    aNode.label("Thing");
  } else if ( elementTools.isDatatype(element) === false ) {
    if ( element.backupLabel() !== undefined ) {
      aNode.label(element.backupLabel());
    } else if ( aNode.backupLabel() !== undefined ) {
      aNode.label(aNode.backupLabel());
    } else {
      aNode.label("NewClass");
    }
  }

  if ( typeString === "rdfs:Datatype" ) {
    if ( aNode.dType() === "undefined" )
      aNode.label("undefined");
    else {
      const identifier = aNode.dType().split(":")[1];
      aNode.label(identifier);
    }
  }

  // Update property domain and range references
  for ( let i = 0; i < ctx.unfilteredData.properties.length; i++ ) {
    if ( ctx.unfilteredData.properties[i].domain() === element )
      ctx.unfilteredData.properties[i].domain(aNode);
    if ( ctx.unfilteredData.properties[i].range() === element )
      ctx.unfilteredData.properties[i].range(aNode);
  }
  for ( let i = 0; i < ctx.properties.length; i++ ) {
    if ( ctx.properties[i].domain() === element )
      ctx.properties[i].domain(aNode);
    if ( ctx.properties[i].range() === element )
      ctx.properties[i].range(aNode);
  }

  let remId = ctx.unfilteredData.nodes.indexOf(element);
  if ( remId !== -1 )
    ctx.unfilteredData.nodes.splice(remId, 1);
  remId = ctx.classNodes.indexOf(element);
  if ( remId !== -1 )
    ctx.classNodes.splice(remId, 1);

  addNewNodeElement(ctx, aNode);
  ctx.options.focuserModule().handle(aNode);
  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();
  element = null;
}

// ─── Property type change ────────────────────────────────────────────────────

function changePropertyType( ctx, element ){
  const typeString = d3.select("#typeEditor").node().value;

  if ( editValidation.sanityCheckProperty(ctx.graph, element.domain(), element.range(), typeString) === false )
    return false;

  const propPrototype = ctx.PropertyPrototypeMap.get(typeString.toLowerCase());
  const aProp = new propPrototype(ctx.graph);
  aProp.copyInformation(element);
  aProp.id(element.id());

  element.domain().removePropertyElement(element);
  element.range().removePropertyElement(element);
  aProp.domain(element.domain());
  aProp.range(element.range());

  if ( element.backupLabel() !== undefined ) {
    aProp.label(element.backupLabel());
  } else {
    aProp.label("newObjectProperty");
  }

  if ( aProp.type() === "rdfs:subClassOf" ) {
    aProp.iri("http://www.w3.org/2000/01/rdf-schema#subClassOf");
  } else {
    if ( element.iri() === "http://www.w3.org/2000/01/rdf-schema#subClassOf" )
      aProp.iri(ctx.graph.options().getGeneralMetaObjectProperty('iri') + aProp.id());
  }

  if ( editValidation.propertyCheckExistenceChecker(ctx.graph, ctx.unfilteredData, aProp, element.domain(), element.range()) === false ) {
    ctx.graph.options().editSidebar().updateSelectionInformation(element);
    return;
  }

  ctx.unfilteredData.properties.push(aProp);
  if ( !ctx.properties.includes(aProp) )
    ctx.properties.push(aProp);
  let remId = ctx.unfilteredData.properties.indexOf(element);
  if ( remId !== -1 )
    ctx.unfilteredData.properties.splice(remId, 1);
  if ( !ctx.properties.includes(aProp) )
    ctx.properties.push(aProp);
  remId = ctx.properties.indexOf(element);
  if ( remId !== -1 )
    ctx.properties.splice(remId, 1);

  ctx.graph.fastUpdate();
  aProp.domain().addProperty(aProp);
  aProp.range().addProperty(aProp);
  if ( element.labelObject() && aProp.labelObject() ) {
    aProp.labelObject().x = element.labelObject().x;
    aProp.labelObject().px = element.labelObject().px;
    aProp.labelObject().y = element.labelObject().y;
    aProp.labelObject().py = element.labelObject().py;
  }

  ctx.options.focuserModule().handle(aProp);
  element = null;
}

// ─── Object property creation ────────────────────────────────────────────────

function createNewObjectProperty( ctx, domain, range, draggerEndposition ){
  const defaultPropertyName = d3.select("#defaultProperty").node().title;

  if ( editValidation.sanityCheckProperty(ctx.graph, domain, range, defaultPropertyName) === false )
    return false;

  const propPrototype = ctx.PropertyPrototypeMap.get(defaultPropertyName.toLowerCase());
  const aProp = new propPrototype(ctx.graph);
  aProp.id(`objectProperty${ctx.shared.eP++}`);
  aProp.domain(domain);
  aProp.range(range);
  aProp.label("newObjectProperty");
  aProp.baseIri(d3.select("#iriEditor").node().value);
  aProp.iri(aProp.baseIri() + aProp.id());

  if ( editValidation.propertyCheckExistenceChecker(ctx.graph, ctx.unfilteredData, aProp, domain, range) === false )
    return false;

  let autoEditElement = false;
  if ( defaultPropertyName === "owl:objectProperty" ) {
    autoEditElement = true;
  }

  let pX = 0.49 * (domain.x + range.x);
  let pY = 0.49 * (domain.y + range.y);

  if ( domain === range ) {
    const dirD_x = draggerEndposition[0] - domain.x;
    const dirD_y = draggerEndposition[1] - domain.y;
    const len = Math.sqrt(dirD_x * dirD_x + dirD_y * dirD_y);
    let nx = dirD_x / len;
    let ny = dirD_y / len;
    if ( isNaN(len) ) {
      nx = 0;
      ny = -1;
    }
    const offset = 2 * domain.actualRadius() + 50;
    pX = domain.x + offset * nx;
    pY = domain.y + offset * ny;
  }

  domain.addProperty(aProp);
  range.addProperty(aProp);

  ctx.unfilteredData.properties.push(aProp);
  if ( !ctx.properties.includes(aProp) )
    ctx.properties.push(aProp);
  ctx.graph.fastUpdate();
  aProp.labelObject().x = pX;
  aProp.labelObject().px = pX;
  aProp.labelObject().y = pY;
  aProp.labelObject().py = pY;

  aProp.frozen(ctx.graph.paused());
  aProp.locked(ctx.graph.paused());
  domain.frozen(ctx.graph.paused());
  domain.locked(ctx.graph.paused());
  range.frozen(ctx.graph.paused());
  range.locked(ctx.graph.paused());

  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();

  ctx.options.focuserModule().handle(aProp);
  ctx.graph.activateHoverElementsForProperties(true, aProp, false, ctx.touchDevice);
  aProp.labelObject().increasedLoopAngle = true;
  aProp.enableEditing(autoEditElement);
}

// ─── Datatype property creation ──────────────────────────────────────────────

function createDataTypeProperty( ctx, node ){
  clearTimeout(ctx.shared.nodeFreezer);

  if ( ctx.graph.options().datatypeFilter().enabled() === false ) {
    ctx.graph.options().warningModule().showWarning("Warning",
      "Datatype properties are filtered out in the visualization!",
      "Element not created!", 1, false);
    return;
  }

  let aNode, prototype;
  const defaultDatatypeName = d3.select("#defaultDatatype").node().title;
  if ( defaultDatatypeName === "rdfs:Literal" ) {
    prototype = ctx.NodePrototypeMap.get("rdfs:literal");
    aNode = new prototype(ctx.graph);
    aNode.label("Literal");
    aNode.iri("http://www.w3.org/2000/01/rdf-schema#Literal");
    aNode.baseIri("http://www.w3.org/2000/01/rdf-schema#");
  } else {
    prototype = ctx.NodePrototypeMap.get("rdfs:datatype");
    aNode = new prototype(ctx.graph);
    let identifier = "";
    if ( defaultDatatypeName === "undefined" ) {
      identifier = "undefined";
      aNode.label(identifier);
      aNode.iri(`http://www.undefinedDatatype.org/#${identifier}`);
      aNode.baseIri("http://www.undefinedDatatype.org/#");
      aNode.dType(defaultDatatypeName);
    } else {
      identifier = defaultDatatypeName.split(":")[1];
      aNode.label(identifier);
      aNode.dType(defaultDatatypeName);
      aNode.iri(`http://www.w3.org/2001/XMLSchema#${identifier}`);
      aNode.baseIri("http://www.w3.org/2001/XMLSchema#");
    }
  }

  const nX = node.x - node.actualRadius() - 100;
  const nY = node.y + node.actualRadius() + 100;
  aNode.x = nX;
  aNode.y = nY;
  aNode.px = aNode.x;
  aNode.py = aNode.y;
  aNode.id(`NodeId${ctx.shared.eN++}`);
  ctx.unfilteredData.nodes.push(aNode);
  if ( !ctx.classNodes.includes(aNode) )
    ctx.classNodes.push(aNode);

  const propPrototype = ctx.PropertyPrototypeMap.get("owl:datatypeproperty");
  const aProp = new propPrototype(ctx.graph);
  aProp.id(`datatypeProperty${ctx.shared.eP++}`);
  aProp.domain(node);
  aProp.range(aNode);
  aProp.label("newDatatypeProperty");

  const ontoIri = d3.select("#iriEditor").node().value;
  aProp.baseIri(ontoIri);
  aProp.iri(ontoIri + aProp.id());
  ctx.unfilteredData.properties.push(aProp);
  if ( !ctx.properties.includes(aProp) )
    ctx.properties.push(aProp);
  ctx.graph.fastUpdate();
  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();

  ctx.shared.nodeFreezer = setTimeout(() => {
    if ( node && node.frozen() === true && node.pinned() === false && ctx.graph.paused() === false ) {
      node.frozen(ctx.graph.paused());
      node.locked(ctx.graph.paused());
    }
  }, 1000);
  ctx.options.focuserModule().handle(undefined);
  if ( node ) {
    node.frozen(true);
    node.locked(true);
  }
}

// ─── Node removal ────────────────────────────────────────────────────────────

function removeNodesViaResponse( ctx, nodesToRemove, propsToRemove ){
  let i, remId;
  for ( i = 0; i < propsToRemove.length; i++ ) {
    remId = ctx.unfilteredData.properties.indexOf(propsToRemove[i]);
    if ( remId !== -1 )
      ctx.unfilteredData.properties.splice(remId, 1);
    remId = ctx.properties.indexOf(propsToRemove[i]);
    if ( remId !== -1 )
      ctx.properties.splice(remId, 1);
    propsToRemove[i] = null;
  }
  for ( i = 0; i < nodesToRemove.length; i++ ) {
    remId = ctx.unfilteredData.nodes.indexOf(nodesToRemove[i]);
    if ( remId !== -1 )
      ctx.unfilteredData.nodes.splice(remId, 1);
    remId = ctx.classNodes.indexOf(nodesToRemove[i]);
    if ( remId !== -1 )
      ctx.classNodes.splice(remId, 1);
    nodesToRemove[i] = null;
  }
  ctx.graph.fastUpdate();
  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();
  ctx.options.focuserModule().handle(undefined);
  nodesToRemove = null;
  propsToRemove = null;
}

function removeNodeViaEditor( ctx, node ){
  const propsToRemove = [];
  const nodesToRemove = [];
  let datatypes = 0;
  let remId;

  nodesToRemove.push(node);
  for ( let i = 0; i < ctx.unfilteredData.properties.length; i++ ) {
    if ( ctx.unfilteredData.properties[i].domain() === node || ctx.unfilteredData.properties[i].range() === node ) {
      propsToRemove.push(ctx.unfilteredData.properties[i]);
      if ( ctx.unfilteredData.properties[i].type().toLocaleLowerCase() === "owl:datatypeproperty" &&
        ctx.unfilteredData.properties[i].range() !== node ) {
        nodesToRemove.push(ctx.unfilteredData.properties[i].range());
        datatypes++;
      }
    }
  }
  const removedItems = propsToRemove.length + nodesToRemove.length;
  if ( removedItems > 2 ) {
    let text = `You are about to delete 1 class and ${propsToRemove.length} properties`;
    if ( datatypes !== 0 ) {
      text = `You are about to delete 1 class, ${datatypes} datatypes  and ${propsToRemove.length} properties`;
    }
    ctx.graph.options().warningModule().responseWarning(
      "Removing elements", text, "Awaiting response!",
      ctx.graph.removeNodesViaResponse, [nodesToRemove, propsToRemove], false);
  } else {
    for ( let i = 0; i < propsToRemove.length; i++ ) {
      remId = ctx.unfilteredData.properties.indexOf(propsToRemove[i]);
      if ( remId !== -1 )
        ctx.unfilteredData.properties.splice(remId, 1);
      remId = ctx.properties.indexOf(propsToRemove[i]);
      if ( remId !== -1 )
        ctx.properties.splice(remId, 1);
      propsToRemove[i] = null;
    }
    for ( let i = 0; i < nodesToRemove.length; i++ ) {
      remId = ctx.unfilteredData.nodes.indexOf(nodesToRemove[i]);
      if ( remId !== -1 )
        ctx.unfilteredData.nodes.splice(remId, 1);
      remId = ctx.classNodes.indexOf(nodesToRemove[i]);
      if ( remId !== -1 )
        ctx.classNodes.splice(remId, 1);
      nodesToRemove[i] = null;
    }
    ctx.graph.fastUpdate();
    ctx.generateDictionary(ctx.unfilteredData);
    ctx.graph.getUpdateDictionary();
    ctx.options.focuserModule().handle(undefined);
  }
}

// ─── Property removal ────────────────────────────────────────────────────────

function removePropertyViaEditor( ctx, property ){
  property.domain().removePropertyElement(property);
  property.range().removePropertyElement(property);
  let remId;

  if ( property.type().toLocaleLowerCase() === "owl:datatypeproperty" ) {
    let datatype = property.range();
    remId = ctx.unfilteredData.nodes.indexOf(property.range());
    if ( remId !== -1 )
      ctx.unfilteredData.nodes.splice(remId, 1);
    remId = ctx.classNodes.indexOf(property.range());
    if ( remId !== -1 )
      ctx.classNodes.splice(remId, 1);
    datatype = null;
  }
  remId = ctx.unfilteredData.properties.indexOf(property);
  if ( remId !== -1 )
    ctx.unfilteredData.properties.splice(remId, 1);
  remId = ctx.properties.indexOf(property);
  if ( remId !== -1 )
    ctx.properties.splice(remId, 1);
  if ( property.inverse() ) {
    property.inverse().inverse(0);
  }

  ctx.graph.fastUpdate();
  ctx.generateDictionary(ctx.unfilteredData);
  ctx.graph.getUpdateDictionary();
  ctx.options.focuserModule().handle(undefined);
  property = null;
}

module.exports = {
  addNewNodeElement,
  createNewNodeAtPosition,
  changeNodeType,
  changePropertyType,
  createNewObjectProperty,
  createDataTypeProperty,
  removeNodesViaResponse,
  removeNodeViaEditor,
  removePropertyViaEditor,
};
