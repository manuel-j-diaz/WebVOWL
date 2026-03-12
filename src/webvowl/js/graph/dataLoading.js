/**
 * Data ingestion, filtering, and refresh pipeline for the graph.
 *
 * Manages ontology loading, dictionary generation, data clearing,
 * transitive subclass edge synthesis, filter application, and TTL export helpers.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state.
 */
const { storeLinksOnNodes } = require("./dataUtils");

// ─── TTL export helpers ────────────────────────────────────────────────────

function getClassDataForTtlExport( ctx ){
  const allNodes = ctx.unfilteredData.nodes;
  const nodeData = [];
  for ( let i = 0; i < allNodes.length; i++ ) {
    if ( allNodes[i].type() !== "rdfs:Literal" &&
      allNodes[i].type() !== "rdfs:Datatype" &&
      allNodes[i].type() !== "owl:Thing" ) {
      nodeData.push(allNodes[i]);
    }
  }
  return nodeData;
}

function getPropertyDataForTtlExport( ctx ){
  const propertyData = [];
  const allProperties = ctx.unfilteredData.properties;
  for ( let i = 0; i < allProperties.length; i++ ) {
    if ( allProperties[i].type() === "owl:ObjectProperty" ||
      allProperties[i].type() === "owl:DatatypeProperty" ||
      allProperties[i].type() === "owl:ObjectProperty"
    ) {
      propertyData.push(allProperties[i]);
    } else {
      if ( allProperties[i].type() === "rdfs:subClassOf" ) {
        allProperties[i].baseIri("http://www.w3.org/2000/01/rdf-schema#");
        allProperties[i].iri("http://www.w3.org/2000/01/rdf-schema#subClassOf");
      }
      if ( allProperties[i].type() === "owl:disjointWith" ) {
        allProperties[i].baseIri("http://www.w3.org/2002/07/owl#");
        allProperties[i].iri("http://www.w3.org/2002/07/owl#disjointWith");
      }
    }
  }
  return propertyData;
}

function getAxiomsForTtlExport( ctx ){
  const axioms = [];
  const allProperties = ctx.unfilteredData.properties;
  for ( let i = 0; i < allProperties.length; i++ ) {
    // currently using only the object properties
  }
  return axioms;
}

// ─── Dictionary generation ─────────────────────────────────────────────────

function generateDictionary( ctx, data ){
  let i;
  const originalDictionary = [];
  const nodes = data.nodes;
  for ( i = 0; i < nodes.length; i++ ) {
    if ( nodes[i].labelForCurrentLanguage() !== undefined )
      originalDictionary.push(nodes[i]);
  }
  const props = data.properties;
  for ( i = 0; i < props.length; i++ ) {
    if ( props[i].labelForCurrentLanguage() !== undefined )
      originalDictionary.push(props[i]);
  }
  ctx.parser.setDictionary(originalDictionary);

  const literFilter = ctx.graph.options().literalFilter();
  const idsToRemove = literFilter.removedNodes();
  const originalDict = ctx.parser.getDictionary();
  const newDict = [];

  for ( i = 0; i < originalDict.length; i++ ) {
    const dictElement = originalDict[i];
    let dictElementId;
    if ( dictElement.property )
      dictElementId = dictElement.property().id();
    else
      dictElementId = dictElement.id();
    let addToDictionary = true;
    for ( let j = 0; j < idsToRemove.length; j++ ) {
      const currentId = idsToRemove[j];
      if ( currentId === dictElementId ) {
        addToDictionary = false;
      }
    }
    if ( addToDictionary === true ) {
      newDict.push(dictElement);
    }
  }
  ctx.parser.setDictionary(newDict);
}

// ─── Progress bar ──────────────────────────────────────────────────────────

function updateProgressBarMode( ctx ){
  const loadingModule = ctx.graph.options().loadingModule();
  const state = loadingModule.getProgressBarMode();
  switch ( state ) {
    case  0:
      loadingModule.setErrorMode();
      break;
    case  1:
      loadingModule.setBusyMode();
      break;
    case  2:
      loadingModule.setPercentMode();
      break;
    default:
      loadingModule.setPercentMode();
  }
}

// ─── Clear functions ───────────────────────────────────────────────────────

function clearAllGraphData( ctx ){
  if ( ctx.graph.graphNodeElements() && ctx.graph.graphNodeElements().length > 0 ) {
    ctx.setCachedJsonOBJ(ctx.graph.options().exportMenu().createJSON_exportObject());
  } else {
    ctx.setCachedJsonOBJ(null);
  }
  ctx.force.stop();
  if ( ctx.unfilteredData ) {
    ctx.unfilteredData.nodes = [];
    ctx.unfilteredData.properties = [];
  }
}

function clearGraphData( ctx ){
  ctx.force.stop();
  const sidebar = ctx.graph.options().sidebar();
  if ( sidebar )
    sidebar.clearOntologyInformation();
  if ( ctx.graphContainer )
    ctx.redrawGraph();
}

// ─── Error handling ────────────────────────────────────────────────────────

function handleOnLoadingError( ctx ){
  ctx.force.stop();
  clearGraphData(ctx);
  ctx.graph.options().ontologyMenu().append_bulletPoint("Failed to load ontology");
  d3.select("#progressBarValue").node().innherHTML = "";
  d3.select("#progressBarValue").classed("busyProgressBar", false);
  ctx.graph.options().loadingModule().setErrorMode();
  ctx.graph.options().loadingModule().showErrorDetailsMessage();
}

// ─── Transitive subclass edges ─────────────────────────────────────────────

function addTransitiveSubclassEdges( ctx, unfilteredData, filteredData ){
  const parentMap = {};
  unfilteredData.properties.forEach(( p ) => {
    if ( p.type && p.type() === "rdfs:subClassOf" && p.domain() && p.range() ) {
      const childId = p.domain().id();
      if ( !parentMap[childId] ) parentMap[childId] = [];
      parentMap[childId].push(p.range());
    }
  });

  const visibleIds = {};
  filteredData.nodes.forEach(( n ) => { visibleIds[n.id()] = n; });

  const existingEdges = {};
  filteredData.properties.forEach(( p ) => {
    if ( p.type && p.type() === "rdfs:subClassOf" && p.domain() && p.range() ) {
      existingEdges[`${p.domain().id()}→${p.range().id()}`] = true;
    }
  });

  function findVisibleAncestors( nodeId, visited ){
    if ( visited[nodeId] ) return [];
    visited[nodeId] = true;
    const parents = parentMap[nodeId] || [];
    let result = [];
    parents.forEach(( parent ) => {
      if ( visibleIds[parent.id()] ) {
        result.push(parent);
      } else {
        const ancestors = findVisibleAncestors(parent.id(), visited);
        result = result.concat(ancestors);
      }
    });
    return result;
  }

  const transitiveProps = [];
  let counter = 0;

  filteredData.nodes.forEach(( childNode ) => {
    const parents = parentMap[childNode.id()] || [];
    const hasHiddenParent = parents.some(( p ) => { return !visibleIds[p.id()]; });
    if ( !hasHiddenParent ) return;

    const ancestors = findVisibleAncestors(childNode.id(), {});
    ancestors.forEach(( ancestorNode ) => {
      const key = `${childNode.id()}→${ancestorNode.id()}`;
      if ( existingEdges[key] ) return;
      existingEdges[key] = true;

      const prop = new ctx.RdfsSubClassOf(ctx.graph);
      prop.id(`transitive_subclass_${counter++}`);
      prop.domain(childNode);
      prop.range(ancestorNode);
      transitiveProps.push(prop);
    });
  });

  if ( transitiveProps.length > 0 ) {
    filteredData.properties = filteredData.properties.concat(transitiveProps);
  }
  return filteredData;
}

// ─── Filter function ───────────────────────────────────────────────────────

function filterFunction( ctx, module, data, initializing ){
  const links = ctx.linkCreator.createLinks(data.properties);
  storeLinksOnNodes(data.nodes, links);

  if ( initializing ) {
    if ( module.initialize ) {
      module.initialize(data.nodes, data.properties);
    }
  }
  module.filter(data.nodes, data.properties);
  return {
    nodes: module.filteredNodes(),
    properties: module.filteredProperties()
  };
}

// ─── refreshGraphData ──────────────────────────────────────────────────────

function refreshGraphData( ctx ){
  const shouldExecuteEmptyFilter = ctx.options.literalFilter().enabled();
  ctx.graph.executeEmptyLiteralFilter();
  ctx.options.literalFilter().enabled(shouldExecuteEmptyFilter);

  let preprocessedData = Object.assign({}, ctx.unfilteredData);

  let currentDegree = 0;
  ctx.options.filterModules().forEach(( m ) => {
    if ( m.getCurrentDegree ) currentDegree = m.getCurrentDegree();
  });
  ctx.options.filterModules().forEach(( m ) => {
    if ( m.setBaseProperties ) m.setBaseProperties(ctx.unfilteredData.properties);
    if ( m.setShowAll ) m.setShowAll(currentDegree === 0);
  });

  ctx.options.filterModules().forEach(( module ) => {
    preprocessedData = filterFunction(ctx, module, preprocessedData);
  });
  preprocessedData = addTransitiveSubclassEdges(ctx, ctx.unfilteredData, preprocessedData);
  ctx.options.focuserModule().handle(undefined, true);
  ctx.setClassNodes(preprocessedData.nodes);
  ctx.setProperties(preprocessedData.properties);
  const links = ctx.linkCreator.createLinks(ctx.properties);
  const labelNodes = links.map(( link ) => {
    return link.label();
  });
  ctx.setLinks(links);
  ctx.setLabelNodes(labelNodes);
  storeLinksOnNodes(ctx.classNodes, links);
  ctx.setForceLayoutData(ctx.classNodes, labelNodes, links);
}

// ─── quick_refreshGraphData ────────────────────────────────────────────────

function quick_refreshGraphData( ctx ){
  const links = ctx.linkCreator.createLinks(ctx.properties);
  const labelNodes = links.map(( link ) => {
    return link.label();
  });
  ctx.setLinks(links);
  ctx.setLabelNodes(labelNodes);

  storeLinksOnNodes(ctx.classNodes, links);
  ctx.setForceLayoutData(ctx.classNodes, labelNodes, links);
}

// ─── loadGraphData ─────────────────────────────────────────────────────────

function loadGraphData( ctx, init ){
  const loadingModule = ctx.graph.options().loadingModule();
  ctx.force.stop();

  ctx.force.nodes([]);
  if ( ctx.force.force("link") ) {
    ctx.force.force("link").links([]);
  }
  ctx.searchHighlight.searchState.nodeArrayForPulse = [];
  ctx.searchHighlight.searchState.pulseNodeIds = [];
  ctx.searchHighlight.searchState.locationId = 0;
  d3.select("#locateSearchResult").classed("highlighted", false);
  d3.select("#locateSearchResult").node().title = "Nothing to locate";
  clearGraphData(ctx);

  if ( init ) {
    ctx.force.stop();
    return;
  }

  ctx.setShowFilterWarning(false);
  ctx.parser.parse(ctx.options.data());
  ctx.setUnfilteredData({
    nodes: ctx.parser.nodes(),
    properties: ctx.parser.properties()
  });

  ctx.shared.eN = ctx.unfilteredData.nodes.length + 1;
  ctx.shared.eP = ctx.unfilteredData.properties.length + 1;

  for ( let p = 0; p < ctx.unfilteredData.properties.length; p++ ) {
    const currentId = ctx.unfilteredData.properties[p].id();
    if ( currentId.includes('objectProperty') ) {
      const idStr = currentId.split('objectProperty');
      if ( idStr[0].length === 0 ) {
        const idInt = parseInt(idStr[1]);
        if ( ctx.shared.eP < idInt ) {
          ctx.shared.eP = idInt + 1;
        }
      }
    }
  }
  for ( let n = 0; n < ctx.unfilteredData.nodes.length; n++ ) {
    const currentId_Nodes = ctx.unfilteredData.nodes[n].id();
    if ( currentId_Nodes.includes('Class') ) {
      const idStr_Nodes = currentId_Nodes.split('Class');
      if ( idStr_Nodes[0].length === 0 ) {
        const idInt_Nodes = parseInt(idStr_Nodes[1]);
        if ( ctx.shared.eN < idInt_Nodes ) {
          ctx.shared.eN = idInt_Nodes + 1;
        }
      }
    }
  }

  ctx.setInitialLoad(true);
  ctx.graph.options().warningModule().closeFilterHint();

  ctx.setUpdateRenderingDuringSimulation(true);
  const validOntology = ctx.graph.options().loadingModule().successfullyLoadedOntology();
  if ( ctx.graphContainer && validOntology === true ) {

    ctx.setUpdateRenderingDuringSimulation(false);
    ctx.graph.options().ontologyMenu().append_bulletPoint("Generating visualization ... ");
    loadingModule.setPercentMode();

    if ( ctx.unfilteredData.nodes.length > 0 ) {
      ctx.graphContainer.style("opacity", "0");
      ctx.force.on("tick", ctx.hiddenRecalculatePositions);
    } else {
      ctx.graphContainer.style("opacity", "1");
      if ( ctx.showFPS === true ) {
        ctx.force.on("tick", ctx.recalculatePositionsWithFPS);
      }
      else {
        ctx.force.on("tick", ctx.recalculatePositions);
      }
    }

    ctx.force.alpha(1).restart();
  } else {
    ctx.force.stop();
    ctx.graph.options().ontologyMenu().append_bulletPoint("Failed to load ontology");
    loadingModule.setErrorMode();
  }
  ctx.graph.options().clearMetaObject();
  ctx.graph.options().clearGeneralMetaObject();
  ctx.graph.options().editSidebar().clearMetaObjectValue();
  if ( ctx.options.data() !== undefined ) {
    const header = ctx.options.data().header;
    if ( header ) {
      if ( header.iri ) {
        ctx.graph.options().addOrUpdateGeneralObjectEntry("iri", header.iri);
      }
      if ( header.title ) {
        ctx.graph.options().addOrUpdateGeneralObjectEntry("title", header.title);
      }
      if ( header.author ) {
        ctx.graph.options().addOrUpdateGeneralObjectEntry("author", header.author);
      }
      if ( header.version ) {
        ctx.graph.options().addOrUpdateGeneralObjectEntry("version", header.version);
      }
      if ( header.description ) {
        ctx.graph.options().addOrUpdateGeneralObjectEntry("description", header.description);
      }
      if ( header.prefixList ) {
        const pL = header.prefixList;
        for ( const pr in pL ) {
          if ( pL.hasOwnProperty(pr) ) {
            const val = pL[pr];
            ctx.graph.options().addPrefix(pr, val);
          }
        }
      }
      if ( header.other ) {
        const otherObjects = header.other;
        for ( const name in otherObjects ) {
          if ( otherObjects.hasOwnProperty(name) ) {
            const otherObj = otherObjects[name];
            if ( otherObj.hasOwnProperty("identifier") && otherObj.hasOwnProperty("value") ) {
              ctx.graph.options().addOrUpdateMetaObjectEntry(otherObj.identfier, otherObj.value);
            }
          }
        }
      }
    }
  }
  let initializationData = Object.assign({}, ctx.unfilteredData);
  ctx.options.filterModules().forEach(( module ) => {
    initializationData = filterFunction(ctx, module, initializationData, true);
  });
  generateDictionary(ctx, ctx.unfilteredData);

  ctx.parser.parseSettings();
  ctx.setGraphUpdateRequired(ctx.parser.settingsImported());
  ctx.setCenterGraphViewOnLoad(true);
  if ( ctx.parser.settingsImportGraphZoomAndTranslation() === true ) {
    ctx.setCenterGraphViewOnLoad(false);
  }
  ctx.graph.options().searchMenu().requestDictionaryUpdate();
  ctx.graph.options().editSidebar().updateGeneralOntologyInfo();
  ctx.graph.options().editSidebar().updatePrefixUi();
  ctx.graph.options().editSidebar().updateElementWidth();
}

module.exports = {
  getClassDataForTtlExport,
  getPropertyDataForTtlExport,
  getAxiomsForTtlExport,
  generateDictionary,
  updateProgressBarMode,
  clearAllGraphData,
  clearGraphData,
  handleOnLoadingError,
  addTransitiveSubclassEdges,
  filterFunction,
  refreshGraphData,
  quick_refreshGraphData,
  loadGraphData,
};
