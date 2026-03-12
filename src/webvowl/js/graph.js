const math = require("./util/math")();
const linkCreator = require("./parsing/linkCreator")();
const elementTools = require("./util/elementTools")();
// add some maps for nodes and properties -- used for object generation
const nodePrototypeMap = require("./elements/nodes/nodeMap")();
const propertyPrototypeMap = require("./elements/properties/propertyMap")();
const RdfsSubClassOf = require("./elements/properties/implementations/RdfsSubClassOf");
const curveFunction = require("./util/lineGenerators").curveFunction;
const CanvasRenderer = require("./rendering/canvasRenderer");
const { getWorldPosFromScreen, getScreenCoords, getClickedScreenCoords } = require("./graph/coordinateUtils");
const { storeLinksOnNodes, setPositionOfOldLabelsOnNewLabels, createLowerCasePrototypeMap } = require("./graph/dataUtils");
const editValidation = require("./graph/editValidation");
const editCRUD = require("./graph/editCRUD");
const touchBehavior = require("./graph/touchBehavior");
const searchHighlight = require("./graph/searchHighlight");
const hoverUI = require("./graph/hoverUI");
const zoomNavigation = require("./graph/zoomNavigation");
const dataLoading = require("./graph/dataLoading");
const editorModeModule = require("./graph/editorMode");


module.exports = function ( graphContainerSelector ){
  let graph = {},
    CARDINALITY_HDISTANCE = 20,
    CARDINALITY_VDISTANCE = 10,
    options = require("./options")(),
    parser = require("./parser")(graph),
    language = "default",
    paused = false,
    // Container for visual elements
    graphContainer,
    nodeContainer,
    labelContainer,
    cardinalityContainer,
    linkContainer,
    // Visual elements
    nodeElements,
    initialLoad = true,
    updateRenderingDuringSimulation = false,
    labelGroupElements,
    linkGroups,
    linkPathElements,
    cardinalityElements,
    // Internal data
    classNodes,
    labelNodes,
    links,
    properties,
    unfilteredData,
    // Graph behaviour
    force,
    dragBehaviour,
    zoomFactor = 1.0,
    programmaticZoom = false,
    centerGraphViewOnLoad = false,
    transformAnimation = false,
    graphTranslation = [0, 0],
    graphUpdateRequired = false,
    defaultZoom = 1.0,
    defaultTargetZoom = 0.8,
    global_dof = 0,
    originalD3_dblClickFunction = null,
    originalD3_touchZoomFunction = null,

    // editing elements
    editContainer,
    draggerLayer = null,
    draggerObjectsArray = [],
    currentlySelectedNode = null,
    draggingStarted = false,
    frozenDomainForPropertyDragger,
    frozenRangeForPropertyDragger,

    editMode = true,
    debugContainer = d3.select("#FPS_Statistics"),
    finishedLoadingSequence = false,

    now, then, // used for fps computation
    showFPS = false,
    seenEditorHint = false,
    seenFilterWarning = false,
    showFilterWarning = false,

    keepDetailsCollapsedOnLoading = true,
    adjustingGraphSize = false,
    showReloadButtonAfterLayoutOptimization = false,
    zoom;
  let hierarchyLayout = null;
  // Shared mutable state accessed by both graph.js and editCRUD.js
  const shared = { eP: 0, eN: 0, nodeQuadtree: null, nodeFreezer: null };
  const NodePrototypeMap = createLowerCasePrototypeMap(nodePrototypeMap);
  const PropertyPrototypeMap = createLowerCasePrototypeMap(propertyPrototypeMap);
  const classDragger = require("./classDragger")(graph);
  const rangeDragger = require("./rangeDragger")(graph);
  const domainDragger = require("./domainDragger")(graph);
  const shadowClone = require("./shadowClone")(graph);
  const canvasRenderer = CanvasRenderer();
  let canvasRenderPending = false;
  const FORCE_EARLY_STOP_ALPHA = 0.05; // stop simulation early; last 5% adds lag without visible benefit

  // Context object passed to editCRUD — uses getters for values that get reassigned
  const editCtx = Object.defineProperties({
    graph,
    NodePrototypeMap,
    PropertyPrototypeMap,
    shared,
    generateDictionary,
  }, {
    unfilteredData: { get: () => unfilteredData, enumerable: true },
    classNodes:     { get: () => classNodes, enumerable: true },
    properties:     { get: () => properties, enumerable: true },
    options:        { get: () => options, enumerable: true },
    touchDevice:    { get: () => touchBehavior.isTouchDevice(), enumerable: true },
  });

  // Context object passed to searchHighlight — uses getters for values that get reassigned
  const searchCtx = Object.defineProperties({ graph }, {
    force:              { get: () => force, enumerable: true },
    unfilteredData:     { get: () => unfilteredData, enumerable: true },
    graphTranslation:   { get: () => graphTranslation, enumerable: true },
    zoomFactor:         { get: () => zoomFactor, enumerable: true },
    transformAnimation: { get: () => transformAnimation, enumerable: true },
    targetLocationZoom: { value: ( node ) => { targetLocationZoom(node); }, enumerable: true },
  });

  // Context object passed to hoverUI — uses getters for values that get reassigned
  const hoverCtx = Object.defineProperties({
    graph, classDragger, rangeDragger, domainDragger, shadowClone, shared,
  }, {
    editMode:        { get: () => editMode, enumerable: true },
    editContainer:   { get: () => editContainer, enumerable: true },
    draggerLayer:    { get: () => draggerLayer, enumerable: true },
    nodeContainer:   { get: () => nodeContainer, enumerable: true },
    labelContainer:  { get: () => labelContainer, enumerable: true },
    recalculatePositions: { value: () => { recalculatePositions(); }, enumerable: true },
  });

  // Context object passed to zoomNavigation — uses getters + setter callbacks
  const zoomCtx = Object.defineProperties({
    graph, math,
    setZoomFactor:       ( val ) => { zoomFactor = val; },
    setGraphTranslation: ( val ) => { graphTranslation = val; },
    setProgrammaticZoom: ( val ) => { programmaticZoom = val; },
    setTransformAnimation: ( val ) => { transformAnimation = val; },
    updateHaloRadius:    () => { updateHaloRadius(); },
    hideHalos:           () => { return searchHighlight.hideHalos(); },
    nodeInViewport:      ( node ) => { return nodeInViewport(node); },
  }, {
    zoomFactor:          { get: () => zoomFactor, enumerable: true },
    graphTranslation:    { get: () => graphTranslation, enumerable: true },
    programmaticZoom:    { get: () => programmaticZoom, enumerable: true },
    transformAnimation:  { get: () => transformAnimation, enumerable: true },
    zoom:                { get: () => zoom, enumerable: true },
    graphContainer:      { get: () => graphContainer, enumerable: true },
    force:               { get: () => force, enumerable: true },
    options:             { get: () => options, enumerable: true },
    canvasRenderer:      { get: () => canvasRenderer, enumerable: true },
    classNodes:          { get: () => classNodes, enumerable: true },
    labelNodes:          { get: () => labelNodes, enumerable: true },
    links:               { get: () => links, enumerable: true },
    properties:          { get: () => properties, enumerable: true },
    defaultZoom:         { get: () => defaultZoom, enumerable: true },
    defaultTargetZoom:   { get: () => defaultTargetZoom, enumerable: true },
    touchState:          { get: () => touchBehavior.touchState, enumerable: true },
  });

  // Context object passed to dataLoading — uses getters + setter callbacks
  const dataCtx = Object.defineProperties({
    graph, shared, parser, searchHighlight, linkCreator, RdfsSubClassOf,
    setUnfilteredData:   ( val ) => { unfilteredData = val; },
    setShowFilterWarning: ( val ) => { showFilterWarning = val; },
    setCachedJsonOBJ:    ( val ) => { cachedJsonOBJ = val; },
    setInitialLoad:      ( val ) => { initialLoad = val; },
    setUpdateRenderingDuringSimulation: ( val ) => { updateRenderingDuringSimulation = val; },
    setCenterGraphViewOnLoad: ( val ) => { centerGraphViewOnLoad = val; },
    setGraphUpdateRequired: ( val ) => { graphUpdateRequired = val; },
    setClassNodes:       ( val ) => { classNodes = val; },
    setProperties:       ( val ) => { properties = val; },
    setLinks:            ( val ) => { links = val; },
    setLabelNodes:       ( val ) => { labelNodes = val; },
    redrawGraph:         () => { redrawGraph(); },
    setForceLayoutData:  ( cn, ln, lk ) => { setForceLayoutData(cn, ln, lk); },
  }, {
    unfilteredData:      { get: () => unfilteredData, enumerable: true },
    force:               { get: () => force, enumerable: true },
    options:             { get: () => options, enumerable: true },
    graphContainer:      { get: () => graphContainer, enumerable: true },
    showFPS:             { get: () => showFPS, enumerable: true },
    classNodes:          { get: () => classNodes, enumerable: true },
    properties:          { get: () => properties, enumerable: true },
    hiddenRecalculatePositions:   { get: () => hiddenRecalculatePositions, enumerable: true },
    recalculatePositions:         { get: () => recalculatePositions, enumerable: true },
    recalculatePositionsWithFPS:  { get: () => recalculatePositionsWithFPS, enumerable: true },
  });

  // Context object passed to editorMode — uses getters + setter callbacks
  const editorCtx = Object.defineProperties({
    graph, classDragger, rangeDragger, domainDragger, shadowClone,
    hoverUI, touchBehavior,
    setEditMode: ( val ) => { editMode = val; },
  }, {
    editMode:                  { get: () => editMode, enumerable: true },
    options:                   { get: () => options, enumerable: true },
    originalD3_dblClickFunction: { get: () => originalD3_dblClickFunction, enumerable: true },
  });

  graph.math = function (){
    return math;
  };
  /** --------------------------------------------------------- **/
  /** -- getter and setter definitions                       -- **/
  /** --------------------------------------------------------- **/
  graph.isEditorMode = function (){
    return editMode;
  };
  graph.getGlobalDOF = function (){
    return global_dof;
  };
  graph.setGlobalDOF = function ( val ){
    global_dof = val;
  };
  
  graph.updateZoomSliderValueFromOutside = function (){
    graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);
  };
  
  graph.setDefaultZoom = function ( val ){
    defaultZoom = val;
    graph.reset();
    graph.options().zoomSlider().updateZoomSliderValue(defaultZoom);
  };
  graph.setTargetZoom = function ( val ){
    defaultTargetZoom = val;
  };
  graph.graphOptions = function (){
    return options;
  };
  
  graph.scaleFactor = function (){
    return zoomFactor;
  };
  graph.translation = function (){
    return graphTranslation;
  };
  
  // Returns the visible nodes
  graph.graphNodeElements = function (){
    return nodeElements;
  };
  // Returns the visible Label Nodes
  graph.graphLabelElements = function (){
    return labelNodes;
  };
  
  graph.graphLinkElements = function (){
    return links;
  };
  
  graph.setSliderZoom = function ( val ){
    zoomNavigation.setSliderZoom(zoomCtx, val);
  };

  graph.setZoom = function ( value ){
    zoomNavigation.setZoom(zoomCtx, value);
  };

  graph.setTranslation = function ( translation ){
    zoomNavigation.setTranslation(zoomCtx, translation);
  };
  
  graph.options = function (){
    return options;
  };
  // search functionality
  graph.getUpdateDictionary = function (){
    return parser.getDictionary();
  };
  
  graph.language = function ( newLanguage ){
    if ( !arguments.length ) return language;
    
    // Just update if the language changes
    if ( language !== newLanguage ) {
      language = newLanguage || "default";
      redrawContent();
      recalculatePositions();
      graph.options().searchMenu().requestDictionaryUpdate();
      graph.resetSearchHighlight();
    }
    return graph;
  };
  
  
  /** --------------------------------------------------------- **/
  /** graph / rendering  related functions                      **/
  /** --------------------------------------------------------- **/
  
  // Initializes the graph.
  function initializeGraph(){

    options.graphContainerSelector(graphContainerSelector);
    let moved = false;
    force = d3.forceSimulation()
      .force("link", d3.forceLink())
      .on("tick", hiddenRecalculatePositions)
      .on("end", () => {
        // Render the final settled layout in canvas mode.
        if ( options.useCanvasRenderer() ) {
          graph.requestCanvasRender();
        }
      })
      .stop();

    dragBehaviour = d3.drag()
      .subject(( event, d ) => {
        return d;
      })
      .on("start", function ( event, d ){
        event.sourceEvent.stopPropagation(); // Prevent panning
        hoverUI.ignoreOtherHoverEvents(true);
        if ( d.type && d.type() === "Class_dragger" ) {
          classDragger.mouseButtonPressed = true;
          clearTimeout(hoverUI.hoverState.delayedHider);
          classDragger.selectedViaTouch(true);
          d.parentNode().locked(true);
          draggingStarted = true;
        } else if ( d.type && (d.type() === "Range_dragger" || d.type() === "Domain_dragger") ) {
          hoverUI.ignoreOtherHoverEvents(true);
          clearTimeout(hoverUI.hoverState.delayedHider);
          frozenDomainForPropertyDragger = shadowClone.parentNode().domain();
          frozenRangeForPropertyDragger = shadowClone.parentNode().range();
          shadowClone.setInitialPosition();
          shadowClone.hideClone(false);
          shadowClone.hideParentProperty(true);
          shadowClone.updateElement();
          hoverUI.hoverState.deleteGroupElement.classed("hidden", true);
          hoverUI.hoverState.addDataPropertyGroupElement.classed("hidden", true);
          frozenDomainForPropertyDragger.frozen(true);
          frozenDomainForPropertyDragger.locked(true);
          frozenRangeForPropertyDragger.frozen(true);
          frozenRangeForPropertyDragger.locked(true);
          domainDragger.updateElement();
          domainDragger.mouseButtonPressed = true;
          rangeDragger.updateElement();
          rangeDragger.mouseButtonPressed = true;
        }
        else {
          d.locked(true);
          moved = false;
        }
      })
      .on("drag", function ( event, d ){

        if ( d.type && d.type() === "Class_dragger" ) {
          clearTimeout(hoverUI.hoverState.delayedHider);
          classDragger.setPosition(event.x, event.y);
        } else if ( d.type && d.type() === "Range_dragger" ) {
          clearTimeout(hoverUI.hoverState.delayedHider);
          rangeDragger.setPosition(event.x, event.y);
          shadowClone.setPosition(event.x, event.y);
          domainDragger.updateElementViaRangeDragger(event.x, event.y);
        }
        else if ( d.type && d.type() === "Domain_dragger" ) {
          clearTimeout(hoverUI.hoverState.delayedHider);
          domainDragger.setPosition(event.x, event.y);
          shadowClone.setPositionDomain(event.x, event.y);
          rangeDragger.updateElementViaDomainDragger(event.x, event.y);
        }
        
        else {
          d.fx = event.x;
          d.fy = event.y;
          force.alpha(0.3).restart();
          updateHaloRadius();
          moved = true;
          if ( d.renderType && d.renderType() === "round" ) {
            classDragger.setParentNode(d);
          }
          // Canvas mode: tick handler never renders during simulation, so we must
          // trigger a render directly on each drag event for immediate visual feedback.
          if ( options.useCanvasRenderer() ) {
            graph.requestCanvasRender();
          }
        }
      })
      .on("end", function ( event, d ){
        hoverUI.ignoreOtherHoverEvents(false);
        if ( d.type && d.type() === "Class_dragger" ) {
          const nX = classDragger.x;
          const nY = classDragger.y;
          clearTimeout(hoverUI.hoverState.delayedHider);
          classDragger.mouseButtonPressed = false;
          classDragger.selectedViaTouch(false);
          d.setParentNode(d.parentNode());

          const draggerEndPos = [nX, nY];
          const targetNode = graph.getTargetNode(draggerEndPos);
          if ( targetNode ) {
            createNewObjectProperty(d.parentNode(), targetNode, draggerEndPos);
          }
          if ( touchBehavior.isTouchDevice() === false ) {
            hoverUI.editElementHoverOut(hoverCtx);
          }
          draggingStarted = false;
        } else if ( d.type && (d.type() === "Range_dragger" || d.type() === "Domain_dragger") ) {
          hoverUI.ignoreOtherHoverEvents(false);
          frozenDomainForPropertyDragger.frozen(false);
          frozenDomainForPropertyDragger.locked(false);
          frozenRangeForPropertyDragger.frozen(false);
          frozenRangeForPropertyDragger.locked(false);
          rangeDragger.mouseButtonPressed = false;
          domainDragger.mouseButtonPressed = false;
          domainDragger.updateElement();
          rangeDragger.updateElement();
          shadowClone.hideClone(true);

          const isRange = d.type() === "Range_dragger";
          const activeDragger = isRange ? rangeDragger : domainDragger;
          const endPos = [activeDragger.x, activeDragger.y];
          let targetNode = graph.getTargetNode(endPos);
          if ( elementTools.isDatatype(targetNode) === true ) {
            targetNode = null;
            console.log("---------------TARGET NODE IS A DATATYPE/ LITERAL ------------");
          }

          if ( targetNode === null ) {
            d.reDrawEverthing();
            shadowClone.hideParentProperty(false);
          }
          else {
            if ( isRange ) d.updateRange(targetNode);
            else           d.updateDomain(targetNode);
            graph.update();
            shadowClone.hideParentProperty(false);
          }
        }
        
        else {
          d.locked(false);
          const pnp = graph.options().pickAndPinModule();
          if ( pnp.enabled() === true && moved === true ) {
            if ( d.id ) { // node
              pnp.handle(d, true);
            }
            if ( d.property ) {
              pnp.handle(d.property(), true);
            }
          }
        }
      });
    
    // Apply the zooming factor.
    zoom = d3.zoom()
      .scaleExtent([options.minMagnification(), options.maxMagnification()])
      .on("zoom", zoomed);
    
    draggerObjectsArray.push(classDragger);
    draggerObjectsArray.push(rangeDragger);
    draggerObjectsArray.push(domainDragger);
    draggerObjectsArray.push(shadowClone);
    force.stop();
  }
  
  graph.lazyRefresh = function (){
    redrawContent();
    recalculatePositions();
  };
  
  graph.adjustingGraphSize = function ( val ){
    adjustingGraphSize = val;
  };
  
  graph.showReloadButtonAfterLayoutOptimization = function ( show ){
    showReloadButtonAfterLayoutOptimization = show;
  };
  
  
  function hiddenRecalculatePositions(){
    finishedLoadingSequence = false;
    if ( graph.options().loadingModule().successfullyLoadedOntology() === false ) {
      force.stop();
      d3.select("#progressBarValue").node().innerHTML = "";
      graph.updateProgressBarMode();
      graph.options().loadingModule().showErrorDetailsMessage(hiddenRecalculatePositions);
      if ( keepDetailsCollapsedOnLoading && adjustingGraphSize === false ) {
        graph.options().loadingModule().collapseDetails("hiddenRecalculatePositions");
      }
      return;
    }
    if ( updateRenderingDuringSimulation === false ) {
      const value = 1.0 - force.alpha();
      let percent = `${parseInt(200 * value)}%`;
      graph.options().loadingModule().setPercentValue(percent);
      d3.select("#progressBarValue").style("width", percent);
      d3.select("#progressBarValue").node().innerHTML = percent;
      
      if ( value > 0.49 ) {
        updateRenderingDuringSimulation = true;
        // show graph container;
        if ( graphContainer ) {
          graphContainer.style("opacity", "1");
          percent = "100%";
          d3.select("#progressBarValue").style("width", percent);
          d3.select("#progressBarValue").node().innerHTML = percent;
          graph.options().ontologyMenu().append_message_toLastBulletPoint("done");
          d3.select("#reloadCachedOntology").classed("hidden", !showReloadButtonAfterLayoutOptimization);
          if ( showFilterWarning === true && seenFilterWarning === false ) {
            graph.options().warningModule().showFilterHint();
            seenFilterWarning = true;
          }
        }
        
        if ( initialLoad ) {
          if ( graph.paused() === false )
            force.alpha(0.3).restart(); // resume force
          initialLoad = false;
          
        }
        
        
        finishedLoadingSequence = true;
        // In canvas mode, do one immediate render so the graph isn't blank during
        // the fast-settle phase (alpha 0.3 → CANVAS_SETTLE_ALPHA, no renders).
        if ( options.useCanvasRenderer() ) {
          graph.requestCanvasRender();
        }
        if ( showFPS === true ) {
          force.on("tick", recalculatePositionsWithFPS);
          recalculatePositionsWithFPS();
        }
        else {
          force.on("tick", recalculatePositions);
          recalculatePositions();
        }
        
        if ( centerGraphViewOnLoad === true && force.nodes().length > 0 ) {
          if ( force.nodes().length < 10 ) graph.forceRelocationEvent(true); // uses dynamic zoomer;
          else graph.forceRelocationEvent();
          centerGraphViewOnLoad = false;
          // console.log("--------------------------------------")
        }
        
        
        graph.showEditorHintIfNeeded();
        
        if ( graph.options().loadingModule().missingImportsWarning() === false ) {
          graph.options().loadingModule().hideLoadingIndicator();
          graph.options().ontologyMenu().append_bulletPoint("Successfully loaded ontology");
          graph.options().loadingModule().setSuccessful();
        } else {
          graph.options().loadingModule().showWarningDetailsMessage();
          graph.options().ontologyMenu().append_bulletPoint("Loaded ontology with warnings");
        }
      }
    }
  }
  
  graph.showEditorHintIfNeeded = function (){
    if ( seenEditorHint === false && editMode === true ) {
      seenEditorHint = true;
      graph.options().warningModule().showEditorHint();
    }
  };
  
  graph.setForceTickFunctionWithFPS = function (){
    showFPS = true;
    if ( force && finishedLoadingSequence === true ) {
      force.on("tick", recalculatePositionsWithFPS);
    }
    
  };
  graph.setDefaultForceTickFunction = function (){
    showFPS = false;
    if ( force && finishedLoadingSequence === true ) {
      force.on("tick", recalculatePositions);
    }
  };
  function recalculatePositionsWithFPS(){
    // compute the fps
    
    recalculatePositions();
    now = Date.now();
    const diff = now - then;
    const fps = (1000 / (diff)).toFixed(2);

    debugContainer.node().innerHTML = `FPS: ${fps}<br>Nodes: ${force.nodes().length}<br>Links: ${force.force("link") ? force.force("link").links().length : 0}`;
    then = Date.now();
    
  }
  
  function recalculatePositions(){
    // Invalidate cached quadtree — positions have changed
    shared.nodeQuadtree = null;

    // Canvas mode fast path: skip SVG DOM writes, only compute label midpoints
    if ( !editMode && options.useCanvasRenderer() ) {
      nodeElements.attr("transform", ( node ) => {
        return `translate(${node.x},${node.y})`;
      });
      labelGroupElements.each(( label ) => {
        const link = label.link();
        if ( link.layers().length === 1 && !link.loops() ) {
          const di = math.calculateIntersection(link.range(), link.domain(), 0);
          const ri = math.calculateIntersection(link.domain(), link.range(), 0);
          const pos = math.calculateCenter(di, ri);
          label.x = pos.x;
          label.y = pos.y;
        }
      });
      updateHaloRadius();
      if ( force.alpha() < FORCE_EARLY_STOP_ALPHA ) {
        force.stop();
        graph.requestCanvasRender();
      }
      return;
    }

    const needDraggerUpdate = editMode;

    // Set node positions
    nodeElements.attr("transform", ( node ) => {
      return `translate(${node.x},${node.y})`;
    });

    // Set label group positions
    labelGroupElements.attr("transform", ( label ) => {
      const link = label.link();
      if ( link.layers().length === 1 && !link.loops() ) {
        const linkDomainIntersection = math.calculateIntersection(link.range(), link.domain(), 0);
        const linkRangeIntersection = math.calculateIntersection(link.domain(), link.range(), 0);
        const position = math.calculateCenter(linkDomainIntersection, linkRangeIntersection);
        label.x = position.x;
        label.y = position.y;
        if ( needDraggerUpdate ) {
          label.linkRangeIntersection = linkRangeIntersection;
          label.linkDomainIntersection = linkDomainIntersection;
          if ( link.property().focused() === true || hoverUI.hoverState.hoveredPropertyElement !== undefined ) {
            rangeDragger.updateElement();
            domainDragger.updateElement();
          }
        }
      } else if ( needDraggerUpdate ) {
        label.linkDomainIntersection = math.calculateIntersection(link.label(), link.domain(), 0);
        label.linkRangeIntersection = math.calculateIntersection(link.label(), link.range(), 0);
        if ( link.property().focused() === true || hoverUI.hoverState.hoveredPropertyElement !== undefined ) {
          rangeDragger.updateElement();
          domainDragger.updateElement();
        }
      }
      return `translate(${label.x},${label.y})`;
    });

    // Set link paths
    linkPathElements.attr("d", ( l ) => {
      if ( l.isLoop() ) {
        if ( needDraggerUpdate ) {
          const ptrAr = math.getLoopPoints(l);
          l.label().linkRangeIntersection = ptrAr[1];
          l.label().linkDomainIntersection = ptrAr[0];
          if ( l.property().focused() === true || hoverUI.hoverState.hoveredPropertyElement !== undefined ) {
            rangeDragger.updateElement();
            domainDragger.updateElement();
          }
        }
        return math.calculateLoopPath(l);
      }
      const curvePoint = l.label();
      const pathStart = math.calculateIntersection(curvePoint, l.domain(), 1);
      const pathEnd = math.calculateIntersection(curvePoint, l.range(), 1);
      if ( needDraggerUpdate ) {
        l.linkRangeIntersection = pathStart;
        l.linkDomainIntersection = pathEnd;
        if ( l.property().focused() === true || hoverUI.hoverState.hoveredPropertyElement !== undefined ) {
          domainDragger.updateElement();
          rangeDragger.updateElement();
        }
      }
      return curveFunction([pathStart, curvePoint, pathEnd]);
    });

    // Set cardinality positions
    cardinalityElements.attr("transform", ( property ) => {
      if ( !property.link() ) { return null; }
      const label = property.link().label(),
        pos = math.calculateIntersection(label, property.range(), CARDINALITY_HDISTANCE),
        normalV = math.calculateNormalVector(label, property.range(), CARDINALITY_VDISTANCE);
      return `translate(${pos.x + normalV.x},${pos.y + normalV.y})`;
    });

    // Edit-mode: update hovered element positions
    if ( needDraggerUpdate ) {
      if ( hoverUI.hoverState.hoveredNodeElement ) {
        hoverUI.setDeleteHoverElementPosition(hoverUI.hoverState.hoveredNodeElement);
        hoverUI.setAddDataPropertyHoverElementPosition(hoverUI.hoverState.hoveredNodeElement);
        if ( draggingStarted === false ) {
          classDragger.setParentNode(hoverUI.hoverState.hoveredNodeElement);
        }
      }
      if ( hoverUI.hoverState.hoveredPropertyElement ) {
        hoverUI.setDeleteHoverElementPositionProperty(hoverUI.hoverState.hoveredPropertyElement);
      }
    }

    updateHaloRadius();
    if ( !editMode && force.alpha() < FORCE_EARLY_STOP_ALPHA ) {
      force.stop();
    }
    if ( editMode && options.useCanvasRenderer() ) {
      graph.requestCanvasRender();
    }
  }

  graph.updatePropertyDraggerElements = function ( property ){
    editorModeModule.updatePropertyDraggerElements(editorCtx, property);
  };
  
  function addClickEvents(){
    function executeModules( selectedElement, currentEvent ){
      options.selectionModules().forEach(( module ) => {
        module.handle(selectedElement, undefined, currentEvent);
      });
    }

    nodeElements.on("click", function ( event, clickedNode ){

      // manaual double clicker // helper for iphone 6 etc...
      if ( touchBehavior.isTouchDevice() === true && doubletap(event) === true ) {
        event.stopPropagation();
        if ( editMode === true ) {
          clickedNode.raiseDoubleClickEdit(defaultIriValue(clickedNode));
        }
      }
      else {
        executeModules(clickedNode, event);
      }
    });

    nodeElements.on("dblclick", function ( event, clickedNode ){

      event.stopPropagation();
      if ( editMode === true ) {
        clickedNode.raiseDoubleClickEdit(defaultIriValue(clickedNode));
      }
    });

    labelGroupElements.selectAll(".label").on("click", function ( event, clickedProperty ){
      executeModules(clickedProperty, event);

      // this is for enviroments that do not define dblClick function;
      if ( touchBehavior.isTouchDevice() === true && doubletap(event) === true ) {
        event.stopPropagation();
        if ( editMode === true ) {
          clickedProperty.raiseDoubleClickEdit(defaultIriValue(clickedProperty));
        }
      }
    });
    labelGroupElements.selectAll(".label").on("dblclick", function ( event, clickedProperty ){
      event.stopPropagation();
      if ( editMode === true ) {
        clickedProperty.raiseDoubleClickEdit(defaultIriValue(clickedProperty));
      }
      
    });
  }
  
  function defaultIriValue( element ){
    // get the iri of that element;
    if ( graph.options().getGeneralMetaObject().iri ) {
      const str2Compare = graph.options().getGeneralMetaObject().iri + element.id();
      return element.iri() === str2Compare;
    }
    return false;
  }
  
  /** Adjusts the containers current scale and position. */
  function zoomed( event ){
    zoomNavigation.zoomed(zoomCtx, event);
  }
  
  function redrawGraph(){
    remove();

    graphContainer = d3.selectAll(options.graphContainerSelector())
      .append("svg")
      .classed("vowlGraph", true)
      .attr("width", options.width())
      .attr("height", options.height())
      .call(zoom)
      .append("g");

    if ( options.useCanvasRenderer() ) {
      canvasRenderer.setup(options.graphContainerSelector(), options.width(), options.height());
      if (options.collapsingModule()) {
        canvasRenderer.collapsingModule(options.collapsingModule());
      }
    }
    // add touch and double click functions
    
    const svgGraph = d3.selectAll(".vowlGraph");
    originalD3_dblClickFunction = svgGraph.on("dblclick.zoom");
    originalD3_touchZoomFunction = svgGraph.on("touchstart");
    svgGraph.on("touchstart", touchzoomed);
    if ( editMode === true ) {
      svgGraph.on("dblclick.zoom", graph.modified_dblClickFunction);
    }
    else {
      svgGraph.on("dblclick.zoom", originalD3_dblClickFunction);
    }
    
  }
  
  graph.getUnfilteredData = function (){
    return unfilteredData;
  };
  
  graph.getClassDataForTtlExport = function (){
    return dataLoading.getClassDataForTtlExport(dataCtx);
  };
  graph.getPropertyDataForTtlExport = function (){
    return dataLoading.getPropertyDataForTtlExport(dataCtx);
  };
  graph.getAxiomsForTtlExport = function (){
    return dataLoading.getAxiomsForTtlExport(dataCtx);
  };
  
  
  function redrawContent(){
    let markerContainer;
    
    if ( !graphContainer ) {
      return;
    }
    
    // Empty the graph container
    graphContainer.selectAll("*").remove();
    
    // Last container -> elements of this container overlap others
    linkContainer = graphContainer.append("g").classed("linkContainer", true);
    cardinalityContainer = graphContainer.append("g").classed("cardinalityContainer", true);
    labelContainer = graphContainer.append("g").classed("labelContainer", true);
    nodeContainer = graphContainer.append("g").classed("nodeContainer", true);
    
    // adding editing Elements
    const draggerPathLayer = graphContainer.append("g").classed("linkContainer", true);
    draggerLayer = graphContainer.append("g").classed("editContainer", true);
    editContainer = graphContainer.append("g").classed("editContainer", true);
    
    draggerPathLayer.classed("hidden-in-export", true);
    editContainer.classed("hidden-in-export", true);
    draggerLayer.classed("hidden-in-export", true);
    
    const drElement = draggerLayer.selectAll(".node")
      .data(draggerObjectsArray).enter()
      .append("g")
      .classed("node", true)
      .classed("hidden-in-export", true)
      .attr("id", ( d ) => {
        return d.id();
      })
      .call(dragBehaviour);
    drElement.each(function ( node ){
      node.svgRoot(d3.select(this));
      node.svgPathLayer(draggerPathLayer);
      if ( node.type() === "shadowClone" ) {
        node.drawClone();
        node.hideClone(true);
      } else {
        node.drawNode();
        node.hideDragger(true);
      }
    });
    hoverUI.generateEditElements(hoverCtx);
    
    
    // Add an extra container for all markers
    markerContainer = linkContainer.append("defs");
    
    // Draw nodes
    
    if ( classNodes === undefined ) classNodes = [];
    
    nodeElements = nodeContainer.selectAll(".node")
      .data(classNodes).enter()
      .append("g")
      .classed("node", true)
      .attr("id", ( d ) => {
        return d.id();
      })
      .call(dragBehaviour);
    nodeElements.each(function ( node ){
      node.draw(d3.select(this));
    });
    
    
    if ( labelNodes === undefined ) labelNodes = [];
    
    // Draw label groups (property + inverse)
    labelGroupElements = labelContainer.selectAll(".labelGroup")
      .data(labelNodes).enter()
      .append("g")
      .classed("labelGroup", true)
      .call(dragBehaviour);
    
    labelGroupElements.each(function ( label ){
      const success = label.draw(d3.select(this));
      label.property().labelObject(label);
      // Remove empty groups without a label.
      if ( !success ) {
        d3.select(this).remove();
      }
    });
    // Place subclass label groups on the bottom of all labels
    labelGroupElements.each(function ( label ){
      // the label might be hidden e.g. in compact notation
      if ( !this.parentNode ) {
        return;
      }
      
      if ( elementTools.isRdfsSubClassOf(label.property()) ) {
        const parentNode = this.parentNode;
        parentNode.insertBefore(this, parentNode.firstChild);
      }
    });
    if ( properties === undefined ) properties = [];
    // Draw cardinality elements
    cardinalityElements = cardinalityContainer.selectAll(".cardinality")
      .data(properties).enter()
      .append("g")
      .classed("cardinality", true);

    // Canvas renderer draws cardinalities itself; skip SVG element creation.
    if ( !options.useCanvasRenderer() ) {
      cardinalityElements.each(function ( property ){
        const success = property.drawCardinality(d3.select(this));

        // Remove empty groups without a label.
        if ( !success ) {
          d3.select(this).remove();
        }
      });
    }

    // Draw links
    if ( links === undefined ) links = [];
    linkGroups = linkContainer.selectAll(".link")
      .data(links).enter()
      .append("g")
      .classed("link", true);

    // Canvas renderer draws links itself; skip SVG path + marker creation.
    // Link groups still exist as structural placeholders (linkPathElements will be empty).
    if ( !options.useCanvasRenderer() ) {
      linkGroups.each(function ( link ){
        link.draw(d3.select(this), markerContainer);
      });
    }
    linkPathElements = linkGroups.selectAll("path");
    // Select the path for direct access to receive a better performance
    addClickEvents();

    // Apply canvas-mode class so SVG elements become invisible when canvas is active
    d3.select(options.graphContainerSelector())
      .classed("canvas-mode", options.useCanvasRenderer());
  }

  function remove(){
    if ( graphContainer ) {
      // Select the parent element because the graph container is a group (e.g. for zooming)
      d3.select(graphContainer.node().parentNode).remove();
    }
    canvasRenderer.destroy();
  }
  
  initializeGraph(); // << call the initialization function
  
  graph.updateCanvasContainerSize = function (){
    if ( graphContainer ) {
      const svgElement = d3.selectAll(".vowlGraph");
      svgElement.attr("width", options.width());
      svgElement.attr("height", options.height());
      graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
    }
    if ( options.useCanvasRenderer() ) {
      canvasRenderer.resize(options.width(), options.height());
    }
  };

  graph.requestCanvasRender = function (){
    if ( !options.useCanvasRenderer() || canvasRenderPending ) return;
    canvasRenderPending = true;
    requestAnimationFrame(() => {
      canvasRenderPending = false;
      if ( options.useCanvasRenderer() ) {
        canvasRenderer.render(classNodes, labelNodes, links, properties, zoomFactor, graphTranslation, math);
      }
    });
  };

  /** Returns the canvas element when canvas mode is active, null otherwise. */
  graph.canvasElement = function (){
    return options.useCanvasRenderer() ? canvasRenderer.canvas() : null;
  };
  
  // Loads all settings, removes the old graph (if it exists) and draws a new one.
  graph.start = function (){
    force.stop();
    loadGraphData(true);
    redrawGraph();
    graph.update(true);
    
    if ( graph.options().loadingModule().successfullyLoadedOntology() === false ) {
      graph.options().loadingModule().setErrorMode();
    }
    
  };
  
  /**
   * Switch between SVG and canvas rendering without disturbing the force simulation.
   * Node positions, zoom, and translation are all preserved.
   */
  graph.switchRenderMode = function (){
    if ( graph.options().loadingModule().successfullyLoadedOntology() === false ) return;
    force.stop();
    remove();        // destroy old SVG + canvas
    redrawGraph();   // recreate SVG, set up canvas if now enabled
    refreshGraphData();  // rebind data arrays to force and D3 selections
    redrawContent(); // create SVG node/link elements with current data
    refreshGraphStyle(); // restore zoom transform and force parameters (no alpha restart)
    // Apply current node positions to the display without restarting the simulation.
    if ( options.useCanvasRenderer() ) {
      graph.requestCanvasRender();
    } else {
      recalculatePositions();
    }
  };

  // Updates only the style of the graph.
  graph.updateStyle = function (){
    refreshGraphStyle();
    if ( graph.options().loadingModule().successfullyLoadedOntology() === false ) {
      force.stop();
    } else {
      force.alpha(1).restart();
    }
  };
  
  graph.reload = function (){
    loadGraphData();
    graph.update();
    
  };
  
  graph.load = function (){
    force.stop();
    if ( options.collapsingModule() ) {
      options.collapsingModule().reset();
    }
    loadGraphData();
    refreshGraphData();
    for ( let i = 0; i < labelNodes.length; i++ ) {
      const label = labelNodes[i];
      if ( label.property().x && label.property().y ) {
        label.x = label.property().x;
        label.y = label.property().y;
      }
    }
    graph.update();
  };
  
  graph.fastUpdate = function (){
    // fast update function for editor calls;
    // -- experimental ;
    quick_refreshGraphData();
    searchHighlight.updateNodeMap(searchCtx);
    force.alpha(1).restart();
    redrawContent();
    graph.updatePulseIds(searchHighlight.searchState.nodeArrayForPulse);
    refreshGraphStyle();
    searchHighlight.updateHaloStyles(searchCtx);
    
  };
  
  graph.getNodeMapForSearch = function (){
    return searchHighlight.getNodeMapForSearch();
  };
  
  // Updates the graphs displayed data and style.
  graph.update = function ( init, alpha ){
    const validOntology = graph.options().loadingModule().successfullyLoadedOntology();
    if ( validOntology === false && (init && init === true) ) {
      graph.options().loadingModule().collapseDetails();
      return;
    }
    if ( validOntology === false ) {
      return;
    }
    
    keepDetailsCollapsedOnLoading = false;
    refreshGraphData();

    // Apply/unapply hierarchy layout after filter pipeline, before force.start()
    if ( hierarchyLayout ) {
      if ( hierarchyLayout.enabled() ) {
        hierarchyLayout.unapply();
        hierarchyLayout.apply(classNodes, properties);
      } else {
        hierarchyLayout.unapply();
      }
    }

    // DEBUG: snapshot fixed counts after hierarchy apply, before force.alpha(1).restart()
    if ( hierarchyLayout && hierarchyLayout.enabled() ) {
      const afterApply = force.nodes().filter((n) => { return n.fx != null; }).length;
      console.log("[graph.update] after hierarchy.apply: fixed nodes =", afterApply, "/ total =", force.nodes().length);
    }

    // update node map
    searchHighlight.updateNodeMap(searchCtx);

    force.alpha(alpha !== undefined ? alpha : 1).restart();

    // DEBUG: snapshot fixed counts after force.alpha restart
    if ( hierarchyLayout && hierarchyLayout.enabled() ) {
      const afterStart = force.nodes().filter((n) => { return n.fx != null; }).length;
      console.log("[graph.update] after force restart: fixed nodes =", afterStart, "/ total =", force.nodes().length);
    }

    redrawContent();
    graph.updatePulseIds(searchHighlight.searchState.nodeArrayForPulse);
    refreshGraphStyle();

    // DEBUG: snapshot fixed counts after refreshGraphStyle()
    if ( hierarchyLayout && hierarchyLayout.enabled() ) {
      const afterStyle = force.nodes().filter((n) => { return n.fx != null; }).length;
      const pinnedCount = force.nodes().filter((n) => { return typeof n.pinned === "function" && n.pinned(); }).length;
      console.log("[graph.update] after refreshGraphStyle(): fixed nodes =", afterStyle,
        "| pinned()=true nodes =", pinnedCount, "| paused =", paused);
      // Sample first 3 fixed nodes
      force.nodes().filter((n) => { return n.fx != null; }).slice(0,3).forEach((n) => {
        console.log("[graph.update] fixed node:", n.iri ? n.iri() : n.id,
          "fx:", n.fx, "pinned():", typeof n.pinned==="function"?n.pinned():"N/A",
          "frozen():", typeof n.frozen==="function"?n.frozen():"N/A");
      });
    }

    searchHighlight.updateHaloStyles(searchCtx);
  };
  
  graph.paused = function ( p ){
    if ( !arguments.length ) return paused;
    paused = p;
    graph.updateStyle();
    return graph;
  };
  // resetting the graph
  graph.reset = function (){
    zoomNavigation.reset(zoomCtx);
  };

  graph.zoomOut = function (){
    zoomNavigation.zoomOut(zoomCtx);
  };

  graph.zoomIn = function (){
    zoomNavigation.zoomIn(zoomCtx);
  };

  /** --------------------------------------------------------- **/
  /** -- data related handling                               -- **/
  /** --------------------------------------------------------- **/
  
  let cachedJsonOBJ = null;
  graph.clearAllGraphData = function (){
    dataLoading.clearAllGraphData(dataCtx);
  };
  graph.getCachedJsonObj = function (){
    return cachedJsonOBJ;
  };
  graph.clearGraphData = function (){
    dataLoading.clearGraphData(dataCtx);
  };

  function generateDictionary( data ){
    dataLoading.generateDictionary(dataCtx, data);
  }

  graph.updateProgressBarMode = function (){
    dataLoading.updateProgressBarMode(dataCtx);
  };

  graph.setFilterWarning = function ( val ){
    showFilterWarning = val;
  };
  function loadGraphData( init ){
    dataLoading.loadGraphData(dataCtx, init);
  }

  graph.handleOnLoadingError = function (){
    dataLoading.handleOnLoadingError(dataCtx);
  };

  function quick_refreshGraphData(){
    dataLoading.quick_refreshGraphData(dataCtx);
  }

  function refreshGraphData(){
    dataLoading.refreshGraphData(dataCtx);
  }
  
  
  /** --------------------------------------------------------- **/
  /** -- force-layout related functions                      -- **/
  /** --------------------------------------------------------- **/
  function setForceLayoutData( classNodes, labelNodes, links ){
    let d3Links = [];
    links.forEach(( link ) => {
      d3Links = d3Links.concat(link.linkParts());
    });

    const d3Nodes = [].concat(classNodes).concat(labelNodes);
    setPositionOfOldLabelsOnNewLabels(force.nodes(), labelNodes);
    
    force.nodes(d3Nodes);
    force.force("link").links(d3Links);
  }
  
  // Applies all options that don't change the graph data.
  function refreshGraphStyle(){
    zoom = zoom.scaleExtent([options.minMagnification(), options.maxMagnification()]);
    if ( graphContainer ) {
      programmaticZoom = true;
      d3.select(".vowlGraph").call(zoom.transform,
        d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
      programmaticZoom = false;
    }

    const w = options.width(), h = options.height(), grav = options.gravity();
    const chargeFn = ( element ) => {
      let charge = options.charge();
      if ( elementTools.isLabel(element) ) {
        charge *= 0.8;
      }
      return charge;
    };

    force.force("charge", d3.forceManyBody().strength(chargeFn))
      .force("x", d3.forceX(w / 2).strength(grav))
      .force("y", d3.forceY(h / 2).strength(grav));

    const linkForce = force.force("link");
    if ( linkForce ) {
      linkForce.distance(calculateLinkPartDistance).strength(options.linkStrength());
    }
    
    force.nodes().forEach(( n ) => {
      n.frozen(paused);
    });
  }
  
  function calculateLinkPartDistance( linkPart ){
    const link = linkPart.link();
    
    if ( link.isLoop() ) {
      return options.loopDistance();
    }
    
    // divide by 2 to receive the length for a single link part
    let linkPartDistance = getVisibleLinkDistance(link) / 2;
    linkPartDistance += linkPart.domain().actualRadius();
    linkPartDistance += linkPart.range().actualRadius();
    return linkPartDistance;
  }
  
  function getVisibleLinkDistance( link ){
    if ( elementTools.isDatatype(link.domain()) || elementTools.isDatatype(link.range()) ) {
      return options.datatypeDistance();
    } else {
      return options.classDistance();
    }
  }
  
  /** --------------------------------------------------------- **/
  /** -- animation functions for the nodes --                   **/
  /** --------------------------------------------------------- **/
  
  graph.animateDynamicLabelWidth = function (){
    const wantedWidth = options.dynamicLabelWidth();
    let i;
    for ( i = 0; i < classNodes.length; i++ ) {
      const nodeElement = classNodes[i];
      if ( elementTools.isDatatype(nodeElement) ) {
        nodeElement.animateDynamicLabelWidth(wantedWidth);
      }
    }
    for ( i = 0; i < properties.length; i++ ) {
      properties[i].animateDynamicLabelWidth(wantedWidth);
    }
  };


  /** --------------------------------------------------------- **/
  /** -- halo and localization functions (delegated to searchHighlight.js) **/
  /** --------------------------------------------------------- **/
  function updateHaloRadius(){
    searchHighlight.updateHaloRadius(searchCtx);
  }

  function transform( p, cx, cy ){
    return zoomNavigation.transform(zoomCtx, p, cx, cy);
  }

  graph.zoomToElementInGraph = function ( element ){
    targetLocationZoom(element);
  };
  graph.updateHaloRadius = function ( element ){
    searchHighlight.computeDistanceToCenter(searchCtx, element);
  };

  function targetLocationZoom( target ){
    zoomNavigation.targetLocationZoom(zoomCtx, target);
  }

  graph.locateSearchResult = function (){
    searchHighlight.locateSearchResult(searchCtx);
  };
  graph.resetSearchHighlight = function (){
    searchHighlight.resetSearchHighlight(searchCtx);
  };
  graph.updatePulseIds = function ( nodeIdArray ){
    searchHighlight.updatePulseIds(searchCtx, nodeIdArray);
  };
  graph.highLightNodes = function ( nodeIdArray ){
    searchHighlight.highLightNodes(searchCtx, nodeIdArray);
  };
  graph.hideHalos = function (){
    return searchHighlight.hideHalos();
  };
  function nodeInViewport( node ){
    return searchHighlight.nodeInViewport(searchCtx, node);
  }
  
  graph.getBoundingBoxForTex = function (){
    return zoomNavigation.getBoundingBoxForTex(zoomCtx);
  };

  graph.forceRelocationEvent = function ( dynamic ){
    zoomNavigation.forceRelocationEvent(zoomCtx, dynamic);
  };
  
  
  graph.isADraggerActive = function (){
    return editorModeModule.isADraggerActive(editorCtx);
  };

  /** --------------------------------------------------------- **/
  /** -- VOWL EDITOR  create/ edit /delete functions --         **/
  /** --------------------------------------------------------- **/

  graph.changeNodeType = function ( element ){
    editCRUD.changeNodeType(editCtx, element);
  };

  graph.changePropertyType = function ( element ){
    editCRUD.changePropertyType(editCtx, element);
  };

  graph.removeEditElements = function (){
    editorModeModule.removeEditElements(editorCtx);
  };

  graph.editorMode = function ( val ){
    return editorModeModule.editorMode(editorCtx, val);
  };
  
  function createNewNodeAtPosition( pos ){
    editCRUD.createNewNodeAtPosition(editCtx, pos);
  }

  graph.getTargetNode = function ( position ){
    const dx = position[0];
    const dy = position[1];

    // Build quadtree lazily (invalidated each tick in recalculatePositions)
    if ( !shared.nodeQuadtree ) {
      shared.nodeQuadtree = d3.quadtree()
        .x(( d ) => { return d.x; })
        .y(( d ) => { return d.y; })
        .addAll(unfilteredData.nodes);
    }

    const tN = shared.nodeQuadtree.find(dx, dy);
    if ( !tN ) return null;
    const minDist = Math.sqrt((tN.x - dx) * (tN.x - dx) + (tN.y - dy) * (tN.y - dy));
    if ( hoverUI.hoverState.hoveredNodeElement ) {
      const offsetDist = hoverUI.hoverState.hoveredNodeElement.actualRadius() + 30;
      if ( minDist > offsetDist ) return null;
      if ( tN.renderType() === "rect" ) return null;
      if ( tN === hoverUI.hoverState.hoveredNodeElement && minDist <= hoverUI.hoverState.hoveredNodeElement.actualRadius() ) {
        return tN;
      } else if ( tN === hoverUI.hoverState.hoveredNodeElement && minDist > hoverUI.hoverState.hoveredNodeElement.actualRadius() ) {
        return null;
      }
      return tN;
    }
    else {

      if ( minDist > (tN.actualRadius() + 30) )
        return null;
      else return tN;

    }
  };
  
  graph.genericPropertySanityCheck = function ( domain, range, typeString, header, action ){
    return editValidation.genericPropertySanityCheck(graph, domain, range, typeString, header, action);
  };
  
  graph.checkIfIriClassAlreadyExist = function ( url ){
    return editValidation.checkIfIriClassAlreadyExist(graph, unfilteredData, url);
  };
  
  graph.classesSanityCheck = function ( classElement, targetType ){
    return editValidation.classesSanityCheck(graph, unfilteredData, classElement, targetType);
  };
  
  graph.propertyCheckExistenceChecker = function ( property, domain, range ){
    return editValidation.propertyCheckExistenceChecker(graph, unfilteredData, property, domain, range);
  };
  
  graph.sanityCheckProperty = function ( domain, range, typeString ){
    return editValidation.sanityCheckProperty(graph, domain, range, typeString);
  };
  
  function createNewObjectProperty( domain, range, draggerEndposition ){
    editCRUD.createNewObjectProperty(editCtx, domain, range, draggerEndposition);
  }
  
  graph.createDataTypeProperty = function ( node ){
    editCRUD.createDataTypeProperty(editCtx, node);
  };

  graph.removeNodesViaResponse = function ( nodesToRemove, propsToRemove ){
    editCRUD.removeNodesViaResponse(editCtx, nodesToRemove, propsToRemove);
  };

  graph.removeNodeViaEditor = function ( node ){
    editCRUD.removeNodeViaEditor(editCtx, node);
  };

  graph.removePropertyViaEditor = function ( property ){
    editCRUD.removePropertyViaEditor(editCtx, property);
    hoverUI.hoverState.hoveredPropertyElement = undefined;
  };
  
  graph.setHierarchyLayout = function ( layout ){
    hierarchyLayout = layout;
  };

  graph.executeColorExternalsModule = function (){
    options.colorExternalsModule().filter(unfilteredData.nodes, unfilteredData.properties);
  };
  
  graph.executeCompactNotationModule = function (){
    if ( unfilteredData ) {
      options.compactNotationModule().filter(unfilteredData.nodes, unfilteredData.properties);
    }
    
  };
  graph.executeEmptyLiteralFilter = function (){
    
    if ( unfilteredData && unfilteredData.nodes.length > 1 ) {
      options.literalFilter().filter(unfilteredData.nodes, unfilteredData.properties);
      unfilteredData.nodes = options.literalFilter().filteredNodes();
      unfilteredData.properties = options.literalFilter().filteredProperties();
    }
    
  };
  
  
  /** --------------------------------------------------------- **/
  /** -- Touch behaviour functions (delegated to touchBehavior.js) **/
  /** --------------------------------------------------------- **/

  // Touch context for touchBehavior — uses getters for values that get reassigned
  const touchCtx = Object.defineProperties({ graph, createNewNodeAtPosition }, {
    editMode:                    { get: () => editMode, enumerable: true },
    zoom:                        { get: () => zoom, enumerable: true },
    graphTranslation:            { get: () => graphTranslation, enumerable: true },
    zoomFactor:                  { get: () => zoomFactor, enumerable: true },
    originalD3_touchZoomFunction: { get: () => originalD3_touchZoomFunction, enumerable: true },
    setProgrammaticZoom:         { value: ( val ) => { programmaticZoom = val; }, enumerable: true },
  });

  graph.setTouchDevice = function ( val ){
    touchBehavior.setTouchDevice(val);
  };
  graph.isTouchDevice = function (){
    return touchBehavior.isTouchDevice();
  };
  graph.modified_dblClickFunction = function ( event ){
    touchBehavior.modified_dblClickFunction(touchCtx, event);
  };
  function doubletap( event ){
    return touchBehavior.doubletap(touchCtx, event);
  }
  function touchzoomed( event ){
    touchBehavior.touchzoomed(touchCtx, event);
  }
  graph.modified_dblTouchFunction = function ( event ){
    touchBehavior.modified_dblTouchFunction(touchCtx, event);
  };

  /** --------------------------------------------------------- **/
  /** -- Hover and Selection functions (delegated to hoverUI.js) **/
  /** --------------------------------------------------------- **/

  graph.ignoreOtherHoverEvents = function ( val ){
    return hoverUI.ignoreOtherHoverEvents(val);
  };
  graph.hideHoverPropertyElementsForAnimation = function (){
    hoverUI.hideHoverPropertyElementsForAnimation();
  };
  graph.showHoverElementsAfterAnimation = function ( property, inversed ){
    hoverUI.showHoverElementsAfterAnimation(property, inversed);
  };
  graph.killDelayedTimer = function (){
    hoverUI.killDelayedTimer(hoverCtx);
  };
  graph.activateHoverElementsForProperties = function ( val, property, inversed, touchBehaviour ){
    hoverUI.activateHoverElementsForProperties(hoverCtx, val, property, inversed, touchBehaviour);
  };
  graph.updateDraggerElements = function (){
    hoverUI.updateDraggerElements(hoverCtx);
  };
  graph.activateHoverElements = function ( val, node, touchBehaviour ){
    hoverUI.activateHoverElements(hoverCtx, val, node, touchBehaviour);
  };


  return graph;
};
