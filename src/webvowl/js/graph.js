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
    pulseNodeIds = [],
    nodeArrayForPulse = [],
    nodeMap = [],
    locationId = 0,
    defaultZoom = 1.0,
    defaultTargetZoom = 0.8,
    global_dof = 0,
    touchDevice = false,
    last_touch_time,
    originalD3_dblClickFunction = null,
    originalD3_touchZoomFunction = null,

    // editing elements
    deleteGroupElement,
    addDataPropertyGroupElement,
    editContainer,
    draggerLayer = null,
    draggerObjectsArray = [],
    delayedHider,
    hoveredNodeElement = null,
    currentlySelectedNode = null,
    hoveredPropertyElement = null,
    draggingStarted = false,
    frozenDomainForPropertyDragger,
    frozenRangeForPropertyDragger,

    editMode = true,
    debugContainer = d3.select("#FPS_Statistics"),
    finishedLoadingSequence = false,

    ignoreOtherHoverEvents = false,
    forceNotZooming = false,
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
    touchDevice:    { get: () => touchDevice, enumerable: true },
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

    const cx = 0.5 * graph.options().width();
    const cy = 0.5 * graph.options().height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, graph.options().height() / zoomFactor];
    const eP = [cp.x, cp.y, graph.options().height() / val];
    const pos_intp = d3.interpolateZoom(sP, eP);

    graphContainer.attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(1)
      .attrTween("transform", () => {
        return ( t ) => {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", () => {
        graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);
      });
  };


  graph.setZoom = function ( value ){
    zoomFactor = value;
    programmaticZoom = true;
    d3.select(".vowlGraph").call(zoom.transform,
      d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(value));
    programmaticZoom = false;
  };

  graph.setTranslation = function ( translation ){
    graphTranslation = [translation[0], translation[1]];
    programmaticZoom = true;
    d3.select(".vowlGraph").call(zoom.transform,
      d3.zoomIdentity.translate(translation[0], translation[1]).scale(zoomFactor));
    programmaticZoom = false;
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
        graph.ignoreOtherHoverEvents(true);
        if ( d.type && d.type() === "Class_dragger" ) {
          classDragger.mouseButtonPressed = true;
          clearTimeout(delayedHider);
          classDragger.selectedViaTouch(true);
          d.parentNode().locked(true);
          draggingStarted = true;
        } else if ( d.type && d.type() === "Range_dragger" ) {
          graph.ignoreOtherHoverEvents(true);
          clearTimeout(delayedHider);
          frozenDomainForPropertyDragger = shadowClone.parentNode().domain();
          frozenRangeForPropertyDragger = shadowClone.parentNode().range();
          shadowClone.setInitialPosition();
          shadowClone.hideClone(false);
          shadowClone.hideParentProperty(true);
          shadowClone.updateElement();
          deleteGroupElement.classed("hidden", true);
          addDataPropertyGroupElement.classed("hidden", true);
          frozenDomainForPropertyDragger.frozen(true);
          frozenDomainForPropertyDragger.locked(true);
          frozenRangeForPropertyDragger.frozen(true);
          frozenRangeForPropertyDragger.locked(true);
          domainDragger.updateElement();
          domainDragger.mouseButtonPressed = true;
          rangeDragger.updateElement();
          rangeDragger.mouseButtonPressed = true;

        } else if ( d.type && d.type() === "Domain_dragger" ) {
          graph.ignoreOtherHoverEvents(true);
          clearTimeout(delayedHider);
          frozenDomainForPropertyDragger = shadowClone.parentNode().domain();
          frozenRangeForPropertyDragger = shadowClone.parentNode().range();
          shadowClone.setInitialPosition();
          shadowClone.hideClone(false);
          shadowClone.hideParentProperty(true);
          shadowClone.updateElement();
          deleteGroupElement.classed("hidden", true);
          addDataPropertyGroupElement.classed("hidden", true);
          
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
          clearTimeout(delayedHider);
          classDragger.setPosition(event.x, event.y);
        } else if ( d.type && d.type() === "Range_dragger" ) {
          clearTimeout(delayedHider);
          rangeDragger.setPosition(event.x, event.y);
          shadowClone.setPosition(event.x, event.y);
          domainDragger.updateElementViaRangeDragger(event.x, event.y);
        }
        else if ( d.type && d.type() === "Domain_dragger" ) {
          clearTimeout(delayedHider);
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
        graph.ignoreOtherHoverEvents(false);
        if ( d.type && d.type() === "Class_dragger" ) {
          const nX = classDragger.x;
          const nY = classDragger.y;
          clearTimeout(delayedHider);
          classDragger.mouseButtonPressed = false;
          classDragger.selectedViaTouch(false);
          d.setParentNode(d.parentNode());

          const draggerEndPos = [nX, nY];
          const targetNode = graph.getTargetNode(draggerEndPos);
          if ( targetNode ) {
            createNewObjectProperty(d.parentNode(), targetNode, draggerEndPos);
          }
          if ( touchDevice === false ) {
            editElementHoverOut();
          }
          draggingStarted = false;
        } else if ( d.type && d.type() === "Range_dragger" ) {
          graph.ignoreOtherHoverEvents(false);
          frozenDomainForPropertyDragger.frozen(false);
          frozenDomainForPropertyDragger.locked(false);
          frozenRangeForPropertyDragger.frozen(false);
          frozenRangeForPropertyDragger.locked(false);
          rangeDragger.mouseButtonPressed = false;
          domainDragger.mouseButtonPressed = false;
          domainDragger.updateElement();
          rangeDragger.updateElement();
          shadowClone.hideClone(true);
          const rX = rangeDragger.x;
          const rY = rangeDragger.y;
          const rangeDraggerEndPos = [rX, rY];
          let targetRangeNode = graph.getTargetNode(rangeDraggerEndPos);
          if ( elementTools.isDatatype(targetRangeNode) === true ) {
            targetRangeNode = null;
            console.log("---------------TARGET NODE IS A DATATYPE/ LITERAL ------------");
          }
          
          if ( targetRangeNode === null ) {
            d.reDrawEverthing();
            shadowClone.hideParentProperty(false);
          }
          else {
            d.updateRange(targetRangeNode);
            graph.update();
            shadowClone.hideParentProperty(false);
          }
        } else if ( d.type && d.type() === "Domain_dragger" ) {
          graph.ignoreOtherHoverEvents(false);
          frozenDomainForPropertyDragger.frozen(false);
          frozenDomainForPropertyDragger.locked(false);
          frozenRangeForPropertyDragger.frozen(false);
          frozenRangeForPropertyDragger.locked(false);
          rangeDragger.mouseButtonPressed = false;
          domainDragger.mouseButtonPressed = false;
          domainDragger.updateElement();
          rangeDragger.updateElement();
          shadowClone.hideClone(true);
          
          const dX = domainDragger.x;
          const dY = domainDragger.y;
          const domainDraggerEndPos = [dX, dY];
          let targetDomainNode = graph.getTargetNode(domainDraggerEndPos);
          if ( elementTools.isDatatype(targetDomainNode) === true ) {
            targetDomainNode = null;
            console.log("---------------TARGET NODE IS A DATATYPE/ LITERAL ------------");
          }
          shadowClone.hideClone(true);
          if ( targetDomainNode === null ) {
            d.reDrawEverthing();
            shadowClone.hideParentProperty(false);
          }
          else {
            d.updateDomain(targetDomainNode);
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

    // add switch for edit mode to make this faster;
    if ( !editMode ) {
      if ( options.useCanvasRenderer() ) {
        // Canvas mode: skip most SVG DOM writes. Keep node transforms so
        // invisible SVG elements (collapse/pin buttons) track their nodes
        // and continue to receive pointer events at the correct position.
        nodeElements.attr("transform", ( node ) => {
          return `translate(${node.x},${node.y})`;
        });
        // Compute label midpoints for single-layer links — the canvas renderer
        // reads label.x/y directly and recalculates intersection points itself.
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

      nodeElements.attr("transform", ( node ) => {
        return `translate(${node.x},${node.y})`;
      });

      // Set label group positions
      labelGroupElements.attr("transform", ( label ) => {
        let position;

        // force centered positions on single-layered links
        const link = label.link();
        if ( link.layers().length === 1 && !link.loops() ) {
          const linkDomainIntersection = math.calculateIntersection(link.range(), link.domain(), 0);
          const linkRangeIntersection = math.calculateIntersection(link.domain(), link.range(), 0);
          position = math.calculateCenter(linkDomainIntersection, linkRangeIntersection);
          label.x = position.x;
          label.y = position.y;
        }
        return `translate(${label.x},${label.y})`;
      });
      // Set link paths and calculate additional information
      linkPathElements.attr("d", ( l ) => {
        if ( l.isLoop() ) {
          return math.calculateLoopPath(l);
        }
        const curvePoint = l.label();
        const pathStart = math.calculateIntersection(curvePoint, l.domain(), 1);
        const pathEnd = math.calculateIntersection(curvePoint, l.range(), 1);

        return curveFunction([pathStart, curvePoint, pathEnd]);
      });

      // Set cardinality positions
      cardinalityElements.attr("transform", ( property ) => {
        if ( !property.link() ) {
          return null;
        }
        const label = property.link().label(),
          pos = math.calculateIntersection(label, property.range(), CARDINALITY_HDISTANCE),
          normalV = math.calculateNormalVector(label, property.range(), CARDINALITY_VDISTANCE);

        return `translate(${pos.x + normalV.x},${pos.y + normalV.y})`;
      });


      updateHaloRadius();
      if ( force.alpha() < FORCE_EARLY_STOP_ALPHA ) {
        force.stop();
      }
      return;
    }

    // TODO: this is Editor redraw function // we need to make this faster!!


    nodeElements.attr("transform", ( node ) => {
      return `translate(${node.x},${node.y})`;
    });

    // Set label group positions
    labelGroupElements.attr("transform", ( label ) => {
      let position;

      // force centered positions on single-layered links
      const link = label.link();
      if ( link.layers().length === 1 && !link.loops() ) {
        const linkDomainIntersection = math.calculateIntersection(link.range(), link.domain(), 0);
        const linkRangeIntersection = math.calculateIntersection(link.domain(), link.range(), 0);
        position = math.calculateCenter(linkDomainIntersection, linkRangeIntersection);
        label.x = position.x;
        label.y = position.y;
        label.linkRangeIntersection = linkRangeIntersection;
        label.linkDomainIntersection = linkDomainIntersection;
        if ( link.property().focused() === true || hoveredPropertyElement !== undefined ) {
          rangeDragger.updateElement();
          domainDragger.updateElement();
        }
      } else {
        label.linkDomainIntersection = math.calculateIntersection(link.label(), link.domain(), 0);
        label.linkRangeIntersection = math.calculateIntersection(link.label(), link.range(), 0);
        if ( link.property().focused() === true || hoveredPropertyElement !== undefined ) {
          rangeDragger.updateElement();
          domainDragger.updateElement();
        }
        
      }
      return `translate(${label.x},${label.y})`;
    });
    // Set link paths and calculate additional information
    linkPathElements.attr("d", ( l ) => {
      if ( l.isLoop() ) {

        const ptrAr = math.getLoopPoints(l);
        l.label().linkRangeIntersection = ptrAr[1];
        l.label().linkDomainIntersection = ptrAr[0];

        if ( l.property().focused() === true || hoveredPropertyElement !== undefined ) {
          rangeDragger.updateElement();
          domainDragger.updateElement();
        }
        return math.calculateLoopPath(l);
      }
      const curvePoint = l.label();
      const pathStart = math.calculateIntersection(curvePoint, l.domain(), 1);
      const pathEnd = math.calculateIntersection(curvePoint, l.range(), 1);
      l.linkRangeIntersection = pathStart;
      l.linkDomainIntersection = pathEnd;
      if ( l.property().focused() === true || hoveredPropertyElement !== undefined ) {
        domainDragger.updateElement();
        rangeDragger.updateElement();
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

    if ( hoveredNodeElement ) {
      setDeleteHoverElementPosition(hoveredNodeElement);
      setAddDataPropertyHoverElementPosition(hoveredNodeElement);
      if ( draggingStarted === false ) {
        classDragger.setParentNode(hoveredNodeElement);
      }
    }
    if ( hoveredPropertyElement ) {
      setDeleteHoverElementPositionProperty(hoveredPropertyElement);
    }

    updateHaloRadius();
    if ( options.useCanvasRenderer() ) {
      graph.requestCanvasRender();
    }
  }

  graph.updatePropertyDraggerElements = function ( property ){
    if ( property.type() !== "owl:DatatypeProperty" ) {
      
      shadowClone.setParentProperty(property);
      rangeDragger.setParentProperty(property);
      rangeDragger.hideDragger(false);
      rangeDragger.addMouseEvents();
      domainDragger.setParentProperty(property);
      domainDragger.hideDragger(false);
      domainDragger.addMouseEvents();
      
    }
    else {
      rangeDragger.hideDragger(true);
      domainDragger.hideDragger(true);
      shadowClone.hideClone(true);
    }
  };
  
  function addClickEvents(){
    function executeModules( selectedElement, currentEvent ){
      options.selectionModules().forEach(( module ) => {
        module.handle(selectedElement, undefined, currentEvent);
      });
    }

    nodeElements.on("click", function ( event, clickedNode ){

      // manaual double clicker // helper for iphone 6 etc...
      if ( touchDevice === true && doubletap(event) === true ) {
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
      if ( touchDevice === true && doubletap(event) === true ) {
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
    if ( forceNotZooming === true ) {
      programmaticZoom = true;
      d3.select(".vowlGraph").call(zoom.transform,
        d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
      programmaticZoom = false;
      return;
    }

    if ( programmaticZoom ) return;
    let zoomEventByMWheel = false;
    if ( event.sourceEvent ) {
      if ( event.sourceEvent.deltaY ) zoomEventByMWheel = true;
    }
    if ( zoomEventByMWheel === false ) {
      if ( transformAnimation === true ) {
        return;
      }
      zoomFactor = event.transform.k;
      graphTranslation = [event.transform.x, event.transform.y];
      graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
      updateHaloRadius();
      graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);
      if ( options.useCanvasRenderer() ) {
        canvasRenderer.render(classNodes, labelNodes, links, properties, zoomFactor, graphTranslation, math);
      }
      return;
    }
    /** animate the transition **/
    const prevZoomFactor = zoomFactor;
    const prevTranslation = graphTranslation.slice();
    zoomFactor = event.transform.k;
    graphTranslation = [event.transform.x, event.transform.y];
    graphContainer.transition()
      .tween("attr.translate", () => {
        const interpZoom = d3.interpolateNumber(prevZoomFactor, zoomFactor);
        const interpTx = d3.interpolateNumber(prevTranslation[0], graphTranslation[0]);
        const interpTy = d3.interpolateNumber(prevTranslation[1], graphTranslation[1]);
        return ( t ) => {
          transformAnimation = true;
          updateHaloRadius();
          graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);
          if ( options.useCanvasRenderer() ) {
            canvasRenderer.render(classNodes, labelNodes, links, properties,
              interpZoom(t), [interpTx(t), interpTy(t)], math);
          }
        };
      })
      .on("end", () => {
        transformAnimation = false;
        if ( options.useCanvasRenderer() ) {
          canvasRenderer.render(classNodes, labelNodes, links, properties, zoomFactor, graphTranslation, math);
        }
      })
      .attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`)
      .ease(d3.easeLinear)
      .duration(250);
  }// end of zoomed function
  
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
  
  function generateEditElements(){
    addDataPropertyGroupElement = editContainer.append('g')
      .classed("hidden-in-export", true)
      .classed("hidden", true)
      .classed("addDataPropertyElement", true)
      .attr("transform", `translate(${0},${0})`);


    addDataPropertyGroupElement.append("circle")
    // .classed("deleteElement", true)
      .attr("r", 12)
      .attr("cx", 0)
      .attr("cy", 0)
      .append("title").text("Add Datatype Property");
    
    addDataPropertyGroupElement.append("line")
    // .classed("deleteElementIcon ",true)
      .attr("x1", -8)
      .attr("y1", 0)
      .attr("x2", 8)
      .attr("y2", 0)
      .append("title").text("Add Datatype Property");
    
    addDataPropertyGroupElement.append("line")
    // .classed("deleteElementIcon",true)
      .attr("x1", 0)
      .attr("y1", -8)
      .attr("x2", 0)
      .attr("y2", 8)
      .append("title").text("Add Datatype Property");
    
    if ( graph.options().useAccuracyHelper() ) {
      addDataPropertyGroupElement.append("circle")
        .attr("r", 15)
        .attr("cx", -7)
        .attr("cy", 7)
        .classed("superHiddenElement", true)
        .classed("superOpacityElement", !graph.options().showDraggerObject());
    }
    
    
    deleteGroupElement = editContainer.append('g')
      .classed("hidden-in-export", true)
      .classed("hidden", true)
      .classed("deleteParentElement", true)
      .attr("transform", `translate(${0},${0})`);

    deleteGroupElement.append("circle")
      .attr("r", 12)
      .attr("cx", 0)
      .attr("cy", 0)
      .append("title").text("Delete This Node");
    
    const crossLen = 5;
    deleteGroupElement.append("line")
      .attr("x1", -crossLen)
      .attr("y1", -crossLen)
      .attr("x2", crossLen)
      .attr("y2", crossLen)
      .append("title").text("Delete This Node");
    
    deleteGroupElement.append("line")
      .attr("x1", crossLen)
      .attr("y1", -crossLen)
      .attr("x2", -crossLen)
      .attr("y2", crossLen)
      .append("title").text("Delete This Node");
    
    if ( graph.options().useAccuracyHelper() ) {
      deleteGroupElement.append("circle")
        .attr("r", 15)
        .attr("cx", 7)
        .attr("cy", -7)
        .classed("superHiddenElement", true)
        .classed("superOpacityElement", !graph.options().showDraggerObject());
    }
    
    
  }
  
  graph.getUnfilteredData = function (){
    return unfilteredData;
  };
  
  graph.getClassDataForTtlExport = function (){
    const allNodes = unfilteredData.nodes;
    const nodeData = [];
    for ( let i = 0; i < allNodes.length; i++ ) {
      if ( allNodes[i].type() !== "rdfs:Literal" &&
        allNodes[i].type() !== "rdfs:Datatype" &&
        allNodes[i].type() !== "owl:Thing" ) {
        nodeData.push(allNodes[i]);
      }
    }
    return nodeData;
  };
  
  graph.getPropertyDataForTtlExport = function (){
    const propertyData = [];
    const allProperties = unfilteredData.properties;
    for ( let i = 0; i < allProperties.length; i++ ) {
      // currently using only the object properties
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
  };
  
  graph.getAxiomsForTtlExport = function (){
    const axioms = [];
    const allProperties = unfilteredData.properties;
    for ( let i = 0; i < allProperties.length; i++ ) {
      // currently using only the object properties
    }
    return axioms;
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
    generateEditElements();
    
    
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
    updateNodeMap();
    force.alpha(1).restart();
    redrawContent();
    graph.updatePulseIds(nodeArrayForPulse);
    refreshGraphStyle();
    updateHaloStyles();
    
  };
  
  graph.getNodeMapForSearch = function (){
    return nodeMap;
  };
  function updateNodeMap(){
    nodeMap = [];
    let node;
    for ( let j = 0; j < force.nodes().length; j++ ) {
      node = force.nodes()[j];
      if ( node.id ) {
        nodeMap[node.id()] = j;
        // check for equivalents
        const eqs = node.equivalents();
        if ( eqs.length > 0 ) {
          for ( let e = 0; e < eqs.length; e++ ) {
            const eqObject = eqs[e];
            nodeMap[eqObject.id()] = j;
          }
        }
      }
      if ( node.property ) {
        nodeMap[node.property().id()] = j;
        const inverse = node.inverse();
        if ( inverse ) {
          nodeMap[inverse.id()] = j;
        }
      }
    }
  }
  
  function updateHaloStyles(){
    let haloElement;
    let halo;
    let node;
    for ( let j = 0; j < force.nodes().length; j++ ) {
      node = force.nodes()[j];
      if ( node.id ) {
        haloElement = node.getHalos();
        if ( haloElement ) {
          halo = haloElement.selectAll(".searchResultA");
          halo.classed("searchResultA", false);
          halo.classed("searchResultB", true);
        }
      }
      
      if ( node.property ) {
        haloElement = node.property().getHalos();
        if ( haloElement ) {
          halo = haloElement.selectAll(".searchResultA");
          halo.classed("searchResultA", false);
          halo.classed("searchResultB", true);
        }
      }
    }
  }
  
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
    updateNodeMap();

    force.alpha(alpha !== undefined ? alpha : 1).restart();

    // DEBUG: snapshot fixed counts after force.alpha restart
    if ( hierarchyLayout && hierarchyLayout.enabled() ) {
      const afterStart = force.nodes().filter((n) => { return n.fx != null; }).length;
      console.log("[graph.update] after force restart: fixed nodes =", afterStart, "/ total =", force.nodes().length);
    }

    redrawContent();
    graph.updatePulseIds(nodeArrayForPulse);
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

    updateHaloStyles();
  };
  
  graph.paused = function ( p ){
    if ( !arguments.length ) return paused;
    paused = p;
    graph.updateStyle();
    return graph;
  };
  // resetting the graph
  graph.reset = function (){
    // window size
    const w = 0.5 * graph.options().width();
    const h = 0.5 * graph.options().height();
    // computing initial translation for the graph due tue the dynamic default zoom level
    const tx = w - defaultZoom * w;
    const ty = h - defaultZoom * h;
    graphTranslation = [tx, ty];
    zoomFactor = defaultZoom;
    programmaticZoom = true;
    d3.select(".vowlGraph").call(zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(defaultZoom));
    programmaticZoom = false;
  };
  
  
  graph.zoomOut = function (){

    const minMag = options.minMagnification(),
      maxMag = options.maxMagnification();
    const stepSize = (maxMag - minMag) / 10;
    let val = zoomFactor - stepSize;
    if ( val < minMag ) val = minMag;

    const cx = 0.5 * graph.options().width();
    const cy = 0.5 * graph.options().height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, graph.options().height() / zoomFactor];
    const eP = [cp.x, cp.y, graph.options().height() / val];
    const pos_intp = d3.interpolateZoom(sP, eP);

    graphContainer.attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(250)
      .attrTween("transform", () => {
        return ( t ) => {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", () => {
        graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        updateHaloRadius();
        options.zoomSlider().updateZoomSliderValue(zoomFactor);
      });

  };

  graph.zoomIn = function (){
    const minMag = options.minMagnification(),
      maxMag = options.maxMagnification();
    const stepSize = (maxMag - minMag) / 10;
    let val = zoomFactor + stepSize;
    if ( val > maxMag ) val = maxMag;
    const cx = 0.5 * graph.options().width();
    const cy = 0.5 * graph.options().height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, graph.options().height() / zoomFactor];
    const eP = [cp.x, cp.y, graph.options().height() / val];
    const pos_intp = d3.interpolateZoom(sP, eP);

    graphContainer.attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(250)
      .attrTween("transform", () => {
        return ( t ) => {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", () => {
        graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        updateHaloRadius();
        options.zoomSlider().updateZoomSliderValue(zoomFactor);
      });


  };

  /** --------------------------------------------------------- **/
  /** -- data related handling                               -- **/
  /** --------------------------------------------------------- **/
  
  let cachedJsonOBJ = null;
  graph.clearAllGraphData = function (){
    if ( graph.graphNodeElements() && graph.graphNodeElements().length > 0 ) {
      cachedJsonOBJ = graph.options().exportMenu().createJSON_exportObject();
    } else {
      cachedJsonOBJ = null;
    }
    force.stop();
    if ( unfilteredData ) {
      unfilteredData.nodes = [];
      unfilteredData.properties = [];
    }
  };
  graph.getCachedJsonObj = function (){
    return cachedJsonOBJ;
  };
  
  // removes data when data could not be loaded
  graph.clearGraphData = function (){
    force.stop();
    const sidebar = graph.options().sidebar();
    if ( sidebar )
      sidebar.clearOntologyInformation();
    if ( graphContainer )
      redrawGraph();
  };
  
  function generateDictionary( data ){
    let i;
    const originalDictionary = [];
    const nodes = data.nodes;
    for ( i = 0; i < nodes.length; i++ ) {
      // check if node has a label
      if ( nodes[i].labelForCurrentLanguage() !== undefined )
        originalDictionary.push(nodes[i]);
    }
    const props = data.properties;
    for ( i = 0; i < props.length; i++ ) {
      if ( props[i].labelForCurrentLanguage() !== undefined )
        originalDictionary.push(props[i]);
    }
    parser.setDictionary(originalDictionary);
    
    const literFilter = graph.options().literalFilter();
    const idsToRemove = literFilter.removedNodes();
    const originalDict = parser.getDictionary();
    const newDict = [];
    
    // go through the dictionary and remove the ids;
    for ( i = 0; i < originalDict.length; i++ ) {
      const dictElement = originalDict[i];
      let dictElementId;
      if ( dictElement.property )
        dictElementId = dictElement.property().id();
      else
        dictElementId = dictElement.id();
      // compare against the removed ids;
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
    // tell the parser that the dictionary is updated
    parser.setDictionary(newDict);
    
  }
  
  graph.updateProgressBarMode = function (){
    const loadingModule = graph.options().loadingModule();

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
  };
  
  graph.setFilterWarning = function ( val ){
    showFilterWarning = val;
  };
  function loadGraphData( init ){
    // reset the locate button and previously selected locations and other variables

    const loadingModule = graph.options().loadingModule();
    force.stop();
    
    force.nodes([]);
    if ( force.force("link") ) {
      force.force("link").links([]);
    }
    nodeArrayForPulse = [];
    pulseNodeIds = [];
    locationId = 0;
    d3.select("#locateSearchResult").classed("highlighted", false);
    d3.select("#locateSearchResult").node().title = "Nothing to locate";
    graph.clearGraphData();
    
    if ( init ) {
      force.stop();
      return;
    }
    
    showFilterWarning = false;
    parser.parse(options.data());
    unfilteredData = {
      nodes: parser.nodes(),
      properties: parser.properties()
    };
    // fixing class and property id counter for the editor
    shared.eN = unfilteredData.nodes.length + 1;
    shared.eP = unfilteredData.properties.length + 1;


    // using the ids of elements if to ensure that loaded elements will not get the same id;
    for ( let p = 0; p < unfilteredData.properties.length; p++ ) {
      const currentId = unfilteredData.properties[p].id();
      if ( currentId.includes('objectProperty') ) {
        // could be ours;
        const idStr = currentId.split('objectProperty');
        if ( idStr[0].length === 0 ) {
          const idInt = parseInt(idStr[1]);
          if ( shared.eP < idInt ) {
            shared.eP = idInt + 1;
          }
        }
      }
    }
    // using the ids of elements if to ensure that loaded elements will not get the same id;
    for ( let n = 0; n < unfilteredData.nodes.length; n++ ) {
      const currentId_Nodes = unfilteredData.nodes[n].id();
      if ( currentId_Nodes.includes('Class') ) {
        // could be ours;
        const idStr_Nodes = currentId_Nodes.split('Class');
        if ( idStr_Nodes[0].length === 0 ) {
          const idInt_Nodes = parseInt(idStr_Nodes[1]);
          if ( shared.eN < idInt_Nodes ) {
            shared.eN = idInt_Nodes + 1;
          }
        }
      }
    }
    
    initialLoad = true;
    graph.options().warningModule().closeFilterHint();
    
    // loading handler
    updateRenderingDuringSimulation = true;
    const validOntology = graph.options().loadingModule().successfullyLoadedOntology();
    if ( graphContainer && validOntology === true ) {
      
      updateRenderingDuringSimulation = false;
      graph.options().ontologyMenu().append_bulletPoint("Generating visualization ... ");
      loadingModule.setPercentMode();
      
      if ( unfilteredData.nodes.length > 0 ) {
        graphContainer.style("opacity", "0");
        force.on("tick", hiddenRecalculatePositions);
      } else {
        graphContainer.style("opacity", "1");
        if ( showFPS === true ) {
          force.on("tick", recalculatePositionsWithFPS);
        }
        else {
          force.on("tick", recalculatePositions);
        }
      }

      force.alpha(1).restart();
    } else {
      force.stop();
      graph.options().ontologyMenu().append_bulletPoint("Failed to load ontology");
      loadingModule.setErrorMode();
    }
    // update prefixList(
    // update general MetaOBJECT
    graph.options().clearMetaObject();
    graph.options().clearGeneralMetaObject();
    graph.options().editSidebar().clearMetaObjectValue();
    if ( options.data() !== undefined ) {
      const header = options.data().header;
      if ( header ) {
        if ( header.iri ) {
          graph.options().addOrUpdateGeneralObjectEntry("iri", header.iri);
        }
        if ( header.title ) {
          graph.options().addOrUpdateGeneralObjectEntry("title", header.title);
        }
        if ( header.author ) {
          graph.options().addOrUpdateGeneralObjectEntry("author", header.author);
        }
        if ( header.version ) {
          graph.options().addOrUpdateGeneralObjectEntry("version", header.version);
        }
        if ( header.description ) {
          graph.options().addOrUpdateGeneralObjectEntry("description", header.description);
        }
        if ( header.prefixList ) {
          const pL = header.prefixList;
          for ( const pr in pL ) {
            if ( pL.hasOwnProperty(pr) ) {
              const val = pL[pr];
              graph.options().addPrefix(pr, val);
            }
          }
        }
        // get other metadata;
        if ( header.other ) {
          const otherObjects = header.other;
          for ( const name in otherObjects ) {
            if ( otherObjects.hasOwnProperty(name) ) {
              const otherObj = otherObjects[name];
              if ( otherObj.hasOwnProperty("identifier") && otherObj.hasOwnProperty("value") ) {
                graph.options().addOrUpdateMetaObjectEntry(otherObj.identfier, otherObj.value);
              }
            }
          }
        }
      }
    }
    // update more meta OBJECT
    // Initialize filters with data to replicate consecutive filtering
    let initializationData = Object.assign({}, unfilteredData);
    options.filterModules().forEach(( module ) => {
      initializationData = filterFunction(module, initializationData, true);
    });
    // generate dictionary here ;
    generateDictionary(unfilteredData);
    
    parser.parseSettings();
    graphUpdateRequired = parser.settingsImported();
    centerGraphViewOnLoad = true;
    if ( parser.settingsImportGraphZoomAndTranslation() === true ) {
      centerGraphViewOnLoad = false;
    }
    graph.options().searchMenu().requestDictionaryUpdate();
    graph.options().editSidebar().updateGeneralOntologyInfo();
    graph.options().editSidebar().updatePrefixUi();
    graph.options().editSidebar().updateElementWidth();
  }
  
  graph.handleOnLoadingError = function (){
    force.stop();
    graph.clearGraphData();
    graph.options().ontologyMenu().append_bulletPoint("Failed to load ontology");
    d3.select("#progressBarValue").node().innherHTML = "";
    d3.select("#progressBarValue").classed("busyProgressBar", false);
    graph.options().loadingModule().setErrorMode();
    graph.options().loadingModule().showErrorDetailsMessage();
  };
  
  function quick_refreshGraphData(){
    links = linkCreator.createLinks(properties);
    labelNodes = links.map(( link ) => {
      return link.label();
    });

    storeLinksOnNodes(classNodes, links);
    setForceLayoutData(classNodes, labelNodes, links);
  }
  
  // After the filter pipeline, synthesize transitive subclass edges to reconnect
  // nodes whose intermediate ancestors were removed by degree/subclass filters.
  function addTransitiveSubclassEdges(unfilteredData, filteredData) {
    // Build parent map: childId → [parentNode, ...]
    const parentMap = {};
    unfilteredData.properties.forEach((p) => {
      if (p.type && p.type() === "rdfs:subClassOf" && p.domain() && p.range()) {
        const childId = p.domain().id();
        if (!parentMap[childId]) parentMap[childId] = [];
        parentMap[childId].push(p.range());
      }
    });

    // Build set of visible node IDs
    const visibleIds = {};
    filteredData.nodes.forEach((n) => { visibleIds[n.id()] = n; });

    // Build existing edge set to avoid duplicates (including originals)
    const existingEdges = {};
    filteredData.properties.forEach((p) => {
      if (p.type && p.type() === "rdfs:subClassOf" && p.domain() && p.range()) {
        existingEdges[`${p.domain().id()}→${p.range().id()}`] = true;
      }
    });

    // Walk up the unfiltered subclass chain to find nearest visible ancestor(s)
    function findVisibleAncestors(nodeId, visited) {
      if (visited[nodeId]) return [];
      visited[nodeId] = true;
      const parents = parentMap[nodeId] || [];
      let result = [];
      parents.forEach((parent) => {
        if (visibleIds[parent.id()]) {
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

    filteredData.nodes.forEach((childNode) => {
      const parents = parentMap[childNode.id()] || [];
      // Only act when at least one direct parent is hidden
      const hasHiddenParent = parents.some((p) => { return !visibleIds[p.id()]; });
      if (!hasHiddenParent) return;

      const ancestors = findVisibleAncestors(childNode.id(), {});
      ancestors.forEach((ancestorNode) => {
        const key = `${childNode.id()}→${ancestorNode.id()}`;
        if (existingEdges[key]) return;
        existingEdges[key] = true;

        const prop = new RdfsSubClassOf(graph);
        prop.id(`transitive_subclass_${counter++}`);
        prop.domain(childNode);
        prop.range(ancestorNode);
        transitiveProps.push(prop);
      });
    });

    if (transitiveProps.length > 0) {
      filteredData.properties = filteredData.properties.concat(transitiveProps);
    }
    return filteredData;
  }

  //Applies the data of the graph options object and parses it. The graph is not redrawn.
  function refreshGraphData(){
    const shouldExecuteEmptyFilter = options.literalFilter().enabled();
    graph.executeEmptyLiteralFilter();
    options.literalFilter().enabled(shouldExecuteEmptyFilter);
    
    let preprocessedData = Object.assign({}, unfilteredData);

    // Configure subclassFilter with unfiltered data and current degree so it
    // doesn't remove nodes whose own properties are hidden by earlier filters,
    // and respects degree=0 as "show everything."
    let currentDegree = 0;
    options.filterModules().forEach((m) => {
      if (m.getCurrentDegree) currentDegree = m.getCurrentDegree();
    });
    options.filterModules().forEach((m) => {
      if (m.setBaseProperties) m.setBaseProperties(unfilteredData.properties);
      if (m.setShowAll) m.setShowAll(currentDegree === 0);
    });

    // Filter the data
    options.filterModules().forEach(( module ) => {
      preprocessedData = filterFunction(module, preprocessedData);
    });
    // Reconnect nodes whose intermediate subclass ancestors were filtered out
    preprocessedData = addTransitiveSubclassEdges(unfilteredData, preprocessedData);
    options.focuserModule().handle(undefined, true);
    classNodes = preprocessedData.nodes;
    properties = preprocessedData.properties;
    links = linkCreator.createLinks(properties);
    labelNodes = links.map(( link ) => {
      return link.label();
    });
    storeLinksOnNodes(classNodes, links);
    setForceLayoutData(classNodes, labelNodes, links);
    // for (var i = 0; i < classNodes.length; i++) {
    //     if (classNodes[i].setRectangularRepresentation)
    //         classNodes[i].setRectangularRepresentation(graph.options().rectangularRepresentation());
    // }
  }
  
  function filterFunction( module, data, initializing ){
    links = linkCreator.createLinks(data.properties);
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
  /** -- halo and localization functions --                     **/
  /** --------------------------------------------------------- **/
  function updateHaloRadius(){
    if ( pulseNodeIds && pulseNodeIds.length > 0 ) {
      const forceNodes = force.nodes();
      for ( let i = 0; i < pulseNodeIds.length; i++ ) {
        const node = forceNodes[pulseNodeIds[i]];
        if ( node ) {
          if ( node.property ) {
            // match search strings with property label
            if ( node.property().inverse ) {
              const searchString = graph.options().searchMenu().getSearchString().toLowerCase();
              const name = node.property().labelForCurrentLanguage().toLowerCase();
              if ( name === searchString ) computeDistanceToCenter(node);
              else {
                node.property().removeHalo();
                if ( node.property().inverse() ) {
                  if ( !node.property().inverse().getHalos() )
                    node.property().inverse().drawHalo();
                  computeDistanceToCenter(node, true);
                }
                if ( node.property().equivalents() ) {
                  const eq = node.property().equivalents();
                  for ( let e = 0; e < eq.length; e++ ) {
                    if ( !eq[e].getHalos() )
                      eq[e].drawHalo();
                  }
                  if ( !node.property().getHalos() )
                    node.property().drawHalo();
                  computeDistanceToCenter(node, false);
                  
                }
              }
            }
          }
          computeDistanceToCenter(node);
        }
      }
    }
  }
  
  function computeDistanceToCenter( node, inverse ){
    let container = node;
    const w = graph.options().width();
    const h = graph.options().height();
    let posXY = getScreenCoords(node.x, node.y, graphTranslation, zoomFactor);

    let highlightOfInv = false;
    
    if ( inverse && inverse === true ) {
      highlightOfInv = true;
      posXY = getScreenCoords(node.x, node.y + 20, graphTranslation, zoomFactor);
    }
    const x = posXY.x;
    const y = posXY.y;
    let nodeIsRect = false;
    let halo;
    let roundHalo;
    let rectHalo;
    let borderPoint_x = 0;
    let borderPoint_y = 0;
    let defaultRadius;
    const offset = 15;
    let radius;
    
    if ( node.property && highlightOfInv === true ) {
      if ( node.property().inverse() ) {
        rectHalo = node.property().inverse().getHalos().select("rect");
        
      } else {
        if ( node.property().getHalos() )
          rectHalo = node.property().getHalos().select("rect");
        else {
          node.property().drawHalo();
          rectHalo = node.property().getHalos().select("rect");
        }
      }
      rectHalo.classed("hidden", true);
      if ( node.property().inverse() ) {
        if ( node.property().inverse().getHalos() ) {
          roundHalo = node.property().inverse().getHalos().select("circle");
        }
      } else {
        roundHalo = node.property().getHalos().select("circle");
      }
      if ( roundHalo.node() === null ) {
        radius = node.property().inverse().width() + 15;
        
        roundHalo = node.property().inverse().getHalos().append("circle")
          .classed("searchResultB", true)
          .classed("searchResultA", false)
          .attr("r", radius + 15);
        
      }
      halo = roundHalo; // swap the halo to be round
      nodeIsRect = true;
      container = node.property().inverse();
    }
    
    if ( node.id ) {
      if ( !node.getHalos() ) return; // something went wrong before
      halo = node.getHalos().select("rect");
      if ( halo.node() === null ) {
        // this is a round node
        nodeIsRect = false;
        roundHalo = node.getHalos().select("circle");
        defaultRadius = node.actualRadius();
        roundHalo.attr("r", defaultRadius + offset);
        halo = roundHalo;
      } else { // this is a rect node
        nodeIsRect = true;
        rectHalo = node.getHalos().select("rect");
        rectHalo.classed("hidden", true);
        roundHalo = node.getHalos().select("circle");
        if ( roundHalo.node() === null ) {
          radius = node.width();
          roundHalo = node.getHalos().append("circle")
            .classed("searchResultB", true)
            .classed("searchResultA", false)
            .attr("r", radius + offset);
        }
        halo = roundHalo;
      }
    }
    if ( node.property && !inverse ) {
      if ( !node.property().getHalos() ) return; // something went wrong before
      rectHalo = node.property().getHalos().select("rect");
      rectHalo.classed("hidden", true);
      
      roundHalo = node.property().getHalos().select("circle");
      if ( roundHalo.node() === null ) {
        radius = node.property().width();
        
        roundHalo = node.property().getHalos().append("circle")
          .classed("searchResultB", true)
          .classed("searchResultA", false)
          .attr("r", radius + 15);
        
      }
      halo = roundHalo; // swap the halo to be round
      nodeIsRect = true;
      container = node.property();
    }
    
    if ( x < 0 || x > w || y < 0 || y > h ) {
      // node outside viewport;
      // check for quadrant and get the correct boarder point (intersection with viewport)
      if ( x < 0 && y < 0 ) {
        borderPoint_x = 0;
        borderPoint_y = 0;
      } else if ( x > 0 && x < w && y < 0 ) {
        borderPoint_x = x;
        borderPoint_y = 0;
      } else if ( x > w && y < 0 ) {
        borderPoint_x = w;
        borderPoint_y = 0;
      } else if ( x > w && y > 0 && y < h ) {
        borderPoint_x = w;
        borderPoint_y = y;
      } else if ( x > w && y > h ) {
        borderPoint_x = w;
        borderPoint_y = h;
      } else if ( x > 0 && x < w && y > h ) {
        borderPoint_x = x;
        borderPoint_y = h;
      } else if ( x < 0 && y > h ) {
        borderPoint_x = 0;
        borderPoint_y = h;
      } else if ( x < 0 && y > 0 && y < h ) {
        borderPoint_x = 0;
        borderPoint_y = y;
      }
      // kill all pulses of nodes that are outside the viewport
      container.getHalos().select("rect").classed("searchResultA", false);
      container.getHalos().select("circle").classed("searchResultA", false);
      container.getHalos().select("rect").classed("searchResultB", true);
      container.getHalos().select("circle").classed("searchResultB", true);
      halo.classed("hidden", false);
      // compute in pixel coordinates length of difference vector
      const borderRadius_x = borderPoint_x - x;
      const borderRadius_y = borderPoint_y - y;

      let len = borderRadius_x * borderRadius_x + borderRadius_y * borderRadius_y;
      len = Math.sqrt(len);

      const normedX = borderRadius_x / len;
      const normedY = borderRadius_y / len;
      
      len = len + 20; // add 20 px;
      
      // re-normalized vector
      const newVectorX = normedX * len + x;
      const newVectorY = normedY * len + y;
      // compute world coordinates of this point
      const wX = (newVectorX - graphTranslation[0]) / zoomFactor;
      const wY = (newVectorY - graphTranslation[1]) / zoomFactor;

      // compute distance in world coordinates
      let dx = wX - node.x;
      let dy = wY - node.y;
      if ( highlightOfInv === true )
        dy = wY - node.y - 20;
      
      if ( highlightOfInv === false && node.property && node.property().inverse() )
        dy = wY - node.y + 20;
      
      let newRadius = Math.sqrt(dx * dx + dy * dy);
      halo = container.getHalos().select("circle");
      // sanity checks and setting new halo radius
      if ( !nodeIsRect ) {
        defaultRadius = node.actualRadius() + offset;
        if ( newRadius < defaultRadius ) {
          newRadius = defaultRadius;
        }
        halo.attr("r", newRadius);
      } else {
        defaultRadius = 0.5 * container.width();
        if ( newRadius < defaultRadius )
          newRadius = defaultRadius;
        halo.attr("r", newRadius);
      }
    } else { // node is in viewport , render original;
      // reset the halo to original radius
      defaultRadius = node.actualRadius() + 15;
      if ( !nodeIsRect ) {
        halo.attr("r", defaultRadius);
      } else { // this is rectangular node render as such
        halo = container.getHalos().select("rect");
        halo.classed("hidden", false);
        //halo.classed("searchResultB", true);
        //halo.classed("searchResultA", false);
        const aCircHalo = container.getHalos().select("circle");
        aCircHalo.classed("hidden", true);
        
        container.getHalos().select("rect").classed("hidden", false);
        container.getHalos().select("circle").classed("hidden", true);
      }
    }
  }
  
  function transform( p, cx, cy ){
    // one iteration step for the locate target animation
    zoomFactor = graph.options().height() / p[2];
    graphTranslation = [(cx - p[0] * zoomFactor), (cy - p[1] * zoomFactor)];
    updateHaloRadius();
    // update the values in case the user wants to break the animation
    programmaticZoom = true;
    d3.select(".vowlGraph").call(zoom.transform,
      d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
    programmaticZoom = false;
    graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);
    return `translate(${graphTranslation[0]},${graphTranslation[1]})scale(${zoomFactor})`;
  }
  
  graph.zoomToElementInGraph = function ( element ){
    targetLocationZoom(element);
  };
  graph.updateHaloRadius = function ( element ){
    computeDistanceToCenter(element);
  };
  
  function targetLocationZoom( target ){
    // store the original information
    const cx = 0.5 * graph.options().width();
    const cy = 0.5 * graph.options().height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, graph.options().height() / zoomFactor];

    const zoomLevel = Math.max(defaultZoom + 0.5 * defaultZoom, defaultTargetZoom);
    const eP = [target.x, target.y, graph.options().height() / zoomLevel];
    const pos_intp = d3.interpolateZoom(sP, eP);

    let lenAnimation = pos_intp.duration;
    if ( lenAnimation > 2500 ) {
      lenAnimation = 2500;
    }
    
    graphContainer.attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(lenAnimation)
      .attrTween("transform", () => {
        return ( t ) => {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", () => {
        graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        updateHaloRadius();
      });
  }
  
  graph.locateSearchResult = function (){
    if ( pulseNodeIds && pulseNodeIds.length > 0 ) {
      // move the center of the viewport to this location
      if ( transformAnimation === true ) return; // << prevents incrementing the location id if we are in an animation
      const node = force.nodes()[pulseNodeIds[locationId]];
      locationId++;
      locationId = locationId % pulseNodeIds.length;
      if ( node.id ) node.foreground();
      if ( node.property ) node.property().foreground();
      
      targetLocationZoom(node);
    }
  };
  
  graph.resetSearchHighlight = function (){
    // get all nodes (handle also already filtered nodes )
    pulseNodeIds = [];
    nodeArrayForPulse = [];
    // clear from stored nodes
    const nodes = unfilteredData.nodes;
    const props = unfilteredData.properties;
    let j;
    for ( j = 0; j < nodes.length; j++ ) {
      const node = nodes[j];
      if ( node.removeHalo )
        node.removeHalo();
    }
    for ( j = 0; j < props.length; j++ ) {
      const prop = props[j];
      if ( prop.removeHalo )
        prop.removeHalo();
    }
  };
  
  graph.updatePulseIds = function ( nodeIdArray ){
    pulseNodeIds = [];
    for ( let i = 0; i < nodeIdArray.length; i++ ) {
      const selectedId = nodeIdArray[i];
      const forceId = nodeMap[selectedId];
      if ( forceId !== undefined ) {
        const le_node = force.nodes()[forceId];
        if ( le_node.id ) {
          if ( !pulseNodeIds.includes(forceId) ) {
            pulseNodeIds.push(forceId);
          }
        }
        if ( le_node.property ) {
          if ( !pulseNodeIds.includes(forceId) ) {
            pulseNodeIds.push(forceId);
          }
        }
      }
    }
    locationId = 0;
    if ( pulseNodeIds.length > 0 ) {
      d3.select("#locateSearchResult").classed("highlighted", true);
      d3.select("#locateSearchResult").node().title = "Locate search term";
    }
    else {
      d3.select("#locateSearchResult").classed("highlighted", false);
      d3.select("#locateSearchResult").node().title = "Nothing to locate";
    }
    
  };
  
  graph.highLightNodes = function ( nodeIdArray ){
    if ( nodeIdArray.length === 0 ) {
      return; // nothing to highlight
    }
    pulseNodeIds = [];
    nodeArrayForPulse = nodeIdArray;
    const missedIds = [];

    // identify the force id to highlight
    for ( let i = 0; i < nodeIdArray.length; i++ ) {
      const selectedId = nodeIdArray[i];
      const forceId = nodeMap[selectedId];
      if ( forceId !== undefined ) {
        const le_node = force.nodes()[forceId];
        if ( le_node.id ) {
          if ( !pulseNodeIds.includes(forceId) ) {
            pulseNodeIds.push(forceId);
            le_node.foreground();
            le_node.drawHalo();
          }
        }
        if ( le_node.property ) {
          if ( !pulseNodeIds.includes(forceId) ) {
            pulseNodeIds.push(forceId);
            le_node.property().foreground();
            le_node.property().drawHalo();
          }
        }
      }
      else {
        missedIds.push(selectedId);
      }
    }
    
    // store the highlight on the missed nodes;
    const s_nodes = unfilteredData.nodes;
    const s_props = unfilteredData.properties;
    for ( i = 0; i < missedIds.length; i++ ) {
      const missedId = missedIds[i];
      // search for this in the nodes;
      for ( let n = 0; n < s_nodes.length; n++ ) {
        const nodeId = s_nodes[n].id();
        if ( nodeId === missedId ) {
          s_nodes[n].drawHalo();
        }
      }
      for ( let p = 0; p < s_props.length; p++ ) {
        const propId = s_props[p].id();
        if ( propId === missedId ) {
          s_props[p].drawHalo();
        }
      }
    }
    if ( missedIds.length === nodeIdArray.length ) {
      d3.select("#locateSearchResult").classed("highlighted", false);
    }
    else {
      d3.select("#locateSearchResult").classed("highlighted", true);
    }
    locationId = 0;
    updateHaloRadius();
  };
  
  graph.hideHalos = function (){
    const haloElements = d3.selectAll(".searchResultA,.searchResultB");
    haloElements.classed("hidden", true);
    return haloElements;
  };
  
  function nodeInViewport( node, property ){

    const w = graph.options().width();
    const h = graph.options().height();
    const posXY = getScreenCoords(node.x, node.y, graphTranslation, zoomFactor);
    const x = posXY.x;
    const y = posXY.y;

    const retVal = !(x < 0 || x > w || y < 0 || y > h);
    return retVal;
  }
  
  graph.getBoundingBoxForTex = function (){
    const halos = graph.hideHalos();
    const bbox = graphContainer.node().getBoundingClientRect();
    halos.classed("hidden", false);
    const w = graph.options().width();
    const h = graph.options().height();

    // get the graph coordinates
    const topLeft = getWorldPosFromScreen(0, 0, graphTranslation, zoomFactor);
    const botRight = getWorldPosFromScreen(w, h, graphTranslation, zoomFactor);


    const t_topLeft = getWorldPosFromScreen(bbox.left, bbox.top, graphTranslation, zoomFactor);
    const t_botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, graphTranslation, zoomFactor);
    
    // tighten up the bounding box;
    
    let tX = Math.max(t_topLeft.x, topLeft.x);
    let tY = Math.max(t_topLeft.y, topLeft.y);

    let bX = Math.min(t_botRight.x, botRight.x);
    let bY = Math.min(t_botRight.y, botRight.y);


    // tighten further;
    const allForceNodes = force.nodes();
    const numNodes = allForceNodes.length;
    const visibleNodes = [];
    let bbx;


    const contentBBox = { tx: 1000000000000, ty: 1000000000000, bx: -1000000000000, by: -1000000000000 };

    for ( let i = 0; i < numNodes; i++ ) {
      const node = allForceNodes[i];
      if ( node ) {
        if ( node.property ) {
          if ( nodeInViewport(node, true) ) {
            if ( node.property().labelElement() === undefined ) continue;
            bbx = node.property().labelElement().node().getBoundingClientRect();
            if ( bbx ) {
              contentBBox.tx = Math.min(contentBBox.tx, bbx.left);
              contentBBox.bx = Math.max(contentBBox.bx, bbx.right);
              contentBBox.ty = Math.min(contentBBox.ty, bbx.top);
              contentBBox.by = Math.max(contentBBox.by, bbx.bottom);
            }
          }
        } else {
          if ( nodeInViewport(node, false) ) {
            bbx = node.nodeElement().node().getBoundingClientRect();
            if ( bbx ) {
              contentBBox.tx = Math.min(contentBBox.tx, bbx.left);
              contentBBox.bx = Math.max(contentBBox.bx, bbx.right);
              contentBBox.ty = Math.min(contentBBox.ty, bbx.top);
              contentBBox.by = Math.max(contentBBox.by, bbx.bottom);
            }
          }
        }
      }
    }
    
    const tt_topLeft = getWorldPosFromScreen(contentBBox.tx, contentBBox.ty, graphTranslation, zoomFactor);
    const tt_botRight = getWorldPosFromScreen(contentBBox.bx, contentBBox.by, graphTranslation, zoomFactor);
    
    tX = Math.max(tX, tt_topLeft.x);
    tY = Math.max(tY, tt_topLeft.y);
    
    bX = Math.min(bX, tt_botRight.x);
    bY = Math.min(bY, tt_botRight.y);
    // y axis flip for tex
    return [tX, -tY, bX, -bY];
    
  };
  
  const updateTargetElement = function (){
    const bbox = graphContainer.node().getBoundingClientRect();


    // get the graph coordinates
    const bboxOffset = 50; // default radius of a node;
    const topLeft = getWorldPosFromScreen(bbox.left, bbox.top, graphTranslation, zoomFactor);
    const botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, graphTranslation, zoomFactor);

    let w = graph.options().width();
    if ( graph.options().leftSidebar().isSidebarVisible() === true )
      w -= 200;
    const h = graph.options().height();
    topLeft.x += bboxOffset;
    topLeft.y -= bboxOffset;
    botRight.x -= bboxOffset;
    botRight.y += bboxOffset;

    const g_w = botRight.x - topLeft.x;
    const g_h = botRight.y - topLeft.y;

    // endpoint position calculations
    const posX = 0.5 * (topLeft.x + botRight.x);
    const posY = 0.5 * (topLeft.y + botRight.y);
    let cx = 0.5 * w,
      cy = 0.5 * h;

    if ( graph.options().leftSidebar().isSidebarVisible() === true )
      cx += 200;
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);

    // zoom factor calculations and fail safes;
    let newZoomFactor = 1.0; // fail save if graph and window are squares
    //get the smaller one
    const a = w / g_w;
    const b = h / g_h;
    if ( a < b ) newZoomFactor = a;
    else      newZoomFactor = b;


    // fail saves
    if ( newZoomFactor > zoom.scaleExtent()[1] ) {
      newZoomFactor = zoom.scaleExtent()[1];
    }
    if ( newZoomFactor < zoom.scaleExtent()[0] ) {
      newZoomFactor = zoom.scaleExtent()[0];
    }

    // apply Zooming
    const sP = [cp.x, cp.y, h / zoomFactor];
    const eP = [posX, posY, h / newZoomFactor];


    const pos_intp = d3.interpolateZoom(sP, eP);
    return [pos_intp, cx, cy];

  };
  
  graph.forceRelocationEvent = function ( dynamic ){
    // we need to kill the halo to determine the bounding box;
    const halos = graph.hideHalos();
    const bbox = graphContainer.node().getBoundingClientRect();
    halos.classed("hidden", false);

    // get the graph coordinates
    const bboxOffset = 50; // default radius of a node;
    const topLeft = getWorldPosFromScreen(bbox.left, bbox.top, graphTranslation, zoomFactor);
    const botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, graphTranslation, zoomFactor);

    let w = graph.options().width();
    if ( graph.options().leftSidebar().isSidebarVisible() === true )
      w -= 200;
    const h = graph.options().height();
    topLeft.x += bboxOffset;
    topLeft.y -= bboxOffset;
    botRight.x -= bboxOffset;
    botRight.y += bboxOffset;

    const g_w = botRight.x - topLeft.x;
    const g_h = botRight.y - topLeft.y;

    // endpoint position calculations
    const posX = 0.5 * (topLeft.x + botRight.x);
    const posY = 0.5 * (topLeft.y + botRight.y);
    let cx = 0.5 * w,
      cy = 0.5 * h;

    if ( graph.options().leftSidebar().isSidebarVisible() === true )
      cx += 200;
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);

    // zoom factor calculations and fail safes;
    let newZoomFactor = 1.0; // fail save if graph and window are squares
    //get the smaller one
    const a = w / g_w;
    const b = h / g_h;
    if ( a < b ) newZoomFactor = a;
    else      newZoomFactor = b;


    // fail saves
    if ( newZoomFactor > zoom.scaleExtent()[1] ) {
      newZoomFactor = zoom.scaleExtent()[1];
    }
    if ( newZoomFactor < zoom.scaleExtent()[0] ) {
      newZoomFactor = zoom.scaleExtent()[0];
    }

    // apply Zooming
    const sP = [cp.x, cp.y, h / zoomFactor];
    const eP = [posX, posY, h / newZoomFactor];


    const pos_intp = d3.interpolateZoom(sP, eP);
    let lenAnimation = pos_intp.duration;
    if ( lenAnimation > 2500 ) {
      lenAnimation = 2500;
    }
    graphContainer.attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(lenAnimation)
      .attrTween("transform", () => {
        return ( t ) => {
          if ( dynamic ) {
            const param = updateTargetElement();
            const nV = param[0](t);
            return transform(nV, cx, cy);
          }
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", () => {
        if ( dynamic ) {
          return;
        }

        graphContainer.attr("transform", `translate(${graphTranslation})scale(${zoomFactor})`);
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        graph.options().zoomSlider().updateZoomSliderValue(zoomFactor);


      });
  };
  
  
  graph.isADraggerActive = function (){
    if ( classDragger.mouseButtonPressed === true ||
      domainDragger.mouseButtonPressed === true ||
      rangeDragger.mouseButtonPressed === true ) {
      return true;
    }
    return false;
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
    // just added to be called form outside
    removeEditElements();
  };
  
  function removeEditElements(){
    rangeDragger.hideDragger(true);
    domainDragger.hideDragger(true);
    shadowClone.hideClone(true);
    
    classDragger.hideDragger(true);
    if ( addDataPropertyGroupElement )
      addDataPropertyGroupElement.classed("hidden", true);
    if ( deleteGroupElement )
      deleteGroupElement.classed("hidden", true);
    
    
    if ( hoveredNodeElement ) {
      if ( hoveredNodeElement.pinned() === false ) {
        hoveredNodeElement.locked(graph.paused());
        hoveredNodeElement.frozen(graph.paused());
      }
    }
    if ( hoveredPropertyElement ) {
      if ( hoveredPropertyElement.pinned() === false ) {
        hoveredPropertyElement.locked(graph.paused());
        hoveredPropertyElement.frozen(graph.paused());
      }
    }
    
    
  }
  
  graph.editorMode = function ( val ){
    const create_entry = d3.select("#empty");
    const create_container = d3.select("#emptyContainer");

    const modeOfOpString = d3.select("#modeOfOperationString").node();
    if ( !arguments.length ) {
      create_entry.node().checked = editMode;
      if ( editMode === false ) {
        create_container.node().title = "Enable editing in modes menu to create a new ontology";
        create_entry.node().title = "Enable editing in modes menu to create a new ontology";
        create_entry.style("pointer-events", "none");
      } else {
        create_container.node().title = "Creates a new empty ontology";
        create_entry.node().title = "Creates a new empty ontology";
        d3.select("#useAccuracyHelper").style("color", "#2980b9");
        d3.select("#useAccuracyHelper").style("pointer-events", "auto");
        create_entry.node().disabled = false;
        create_entry.style("pointer-events", "auto");
      }
      
      return editMode;
    }
    graph.options().setEditorModeForDefaultObject(val);
    
    // if (seenEditorHint===false  && val===true){
    //     seenEditorHint=true;
    //     graph.options().warningModule().showEditorHint();
    // }
    editMode = val;
    
    if ( create_entry ) {
      create_entry.classed("disabled", !editMode);
      if ( !editMode ) {
        create_container.node().title = "Enable editing in modes menu to create a new ontology";
        create_entry.node().title = "Enable editing in modes menu to create a new ontology";
        create_entry.node().disabled = true;
        d3.select("#useAccuracyHelper").style("color", "#979797");
        d3.select("#useAccuracyHelper").style("pointer-events", "none");
        create_entry.style("pointer-events", "none");
      } else {
        create_container.node().title = "Creates a new empty ontology";
        create_entry.node().title = "Creates a new empty ontology";
        d3.select("#useAccuracyHelper").style("color", "#2980b9");
        d3.select("#useAccuracyHelper").style("pointer-events", "auto");
        create_entry.style("pointer-events", "auto");
      }
    }
    
    // adjust compact notation
    // selector = compactNotationOption;
    // box =ModuleCheckbox
    const compactNotationContainer = d3.select("#compactnotationModuleCheckbox");
    if ( compactNotationContainer ) {
      compactNotationContainer.classed("disabled", !editMode);
      if ( !editMode ) {
        compactNotationContainer.node().title = "";
        compactNotationContainer.node().disabled = false;
        compactNotationContainer.style("pointer-events", "auto");
        d3.select("#compactNotationOption").style("color", "");
        d3.select("#compactNotationOption").node().title = "";
        options.literalFilter().enabled(true);
        graph.update();
      } else {
        // if editor Mode
        //1) uncheck the element
        d3.select("#compactNotationOption").node().title = "Compact notation can only be used in view mode";
        compactNotationContainer.node().disabled = true;
        compactNotationContainer.node().checked = false;
        options.compactNotationModule().enabled(false);
        options.literalFilter().enabled(false);
        graph.executeCompactNotationModule();
        graph.executeEmptyLiteralFilter();
        graph.lazyRefresh();
        compactNotationContainer.style("pointer-events", "none");
        d3.select("#compactNotationOption").style("color", "#979797");
      }
    }
    
    if ( modeOfOpString ) {
      if ( touchDevice === true ) {
        modeOfOpString.innerHTML = "touch able device detected";
      } else {
        modeOfOpString.innerHTML = "point & click device detected";
      }
    }
    const svgGraph = d3.selectAll(".vowlGraph");

    if ( editMode === true ) {
      options.leftSidebar().showSidebar(options.leftSidebar().getSidebarVisibility(), true);
      options.leftSidebar().hideCollapseButton(false);
      graph.options().editSidebar().updatePrefixUi();
      graph.options().editSidebar().updateElementWidth();
      svgGraph.on("dblclick.zoom", graph.modified_dblClickFunction);
      
    } else {
      svgGraph.on("dblclick.zoom", originalD3_dblClickFunction);
      options.leftSidebar().showSidebar(0);
      options.leftSidebar().hideCollapseButton(true);
      // hide hovered edit elements
      removeEditElements();
    }
    options.sidebar().updateShowedInformation();
    options.editSidebar().updateElementWidth();
    
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
    if ( hoveredNodeElement ) {
      const offsetDist = hoveredNodeElement.actualRadius() + 30;
      if ( minDist > offsetDist ) return null;
      if ( tN.renderType() === "rect" ) return null;
      if ( tN === hoveredNodeElement && minDist <= hoveredNodeElement.actualRadius() ) {
        return tN;
      } else if ( tN === hoveredNodeElement && minDist > hoveredNodeElement.actualRadius() ) {
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
    hoveredPropertyElement = undefined;
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
  /** -- Touch behaviour functions --                   **/
  /** --------------------------------------------------------- **/
  
  graph.setTouchDevice = function ( val ){
    touchDevice = val;
  };
  
  graph.isTouchDevice = function (){
    return touchDevice;
  };
  
  graph.modified_dblClickFunction = function ( event ){

    event.stopPropagation();
    event.preventDefault();
    // get position where we want to add the node;
    const grPos = getClickedScreenCoords(event.clientX, event.clientY, graph.translation(), graph.scaleFactor());
    createNewNodeAtPosition(grPos);
  };

  function doubletap( event ){
    const touch_time = event.timeStamp;
    let numTouchers = 1;
    if ( event && event.touches && event.touches.length )
      numTouchers = event.touches.length;

    if ( touch_time - last_touch_time < 300 && numTouchers === 1 ) {
      event.stopPropagation();
      if ( editMode === true ) {
        //graph.modified_dblClickFunction();
        event.preventDefault();
        event.stopPropagation();
        last_touch_time = touch_time;
        return true;
      }
    }
    last_touch_time = touch_time;
    return false;
  }
  
  
  function touchzoomed( event ){
    forceNotZooming = true;


    const touch_time = event.timeStamp;
    if ( touch_time - last_touch_time < 300 && event.touches.length === 1 ) {
      event.stopPropagation();

      if ( editMode === true ) {
        //graph.modified_dblClickFunction();
        event.preventDefault();
        event.stopPropagation();
        programmaticZoom = true;
        d3.select(".vowlGraph").call(zoom.transform,
          d3.zoomIdentity.translate(graphTranslation[0], graphTranslation[1]).scale(zoomFactor));
        programmaticZoom = false;
        graph.modified_dblTouchFunction(event);
      }
      else {
        forceNotZooming = false;
        if ( originalD3_touchZoomFunction )
          originalD3_touchZoomFunction();
      }
      return;
    }
    forceNotZooming = false;
    last_touch_time = touch_time;
    // TODO: WORK AROUND TO CHECK FOR ORIGINAL FUNCTION
    if ( originalD3_touchZoomFunction )
      originalD3_touchZoomFunction();
  }
  
  graph.modified_dblTouchFunction = function ( event ){
    event.stopPropagation();
    event.preventDefault();
    let xy;
    if ( editMode === true ) {
      xy = d3.pointers(event, d3.selectAll(".vowlGraph").node());
    }
    const grPos = getClickedScreenCoords(xy[0][0], xy[0][1], graph.translation(), graph.scaleFactor());
    createNewNodeAtPosition(grPos);
  };
  
  /** --------------------------------------------------------- **/
  /** -- Hover and Selection functions, adding edit elements --  **/
  /** --------------------------------------------------------- **/
  
  graph.ignoreOtherHoverEvents = function ( val ){
    if ( !arguments.length ) {
      return ignoreOtherHoverEvents;
    }
    else  ignoreOtherHoverEvents = val;
  };
  
  function delayedHiddingHoverElements( tbh ){
    if ( tbh === true ) return;
    if ( hoveredNodeElement ) {
      if ( hoveredNodeElement.editingTextElement === true ) return;
      delayedHider = setTimeout(() => {
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if ( hoveredNodeElement && hoveredNodeElement.pinned() === false && graph.paused() === false && hoveredNodeElement.editingTextElement === false ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }, 1000);
    }
    if ( hoveredPropertyElement ) {
      if ( hoveredPropertyElement.editingTextElement === true ) return;
      clearTimeout(delayedHider);
      delayedHider = setTimeout(() => {
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        rangeDragger.hideDragger(true);
        domainDragger.hideDragger(true);
        shadowClone.hideClone(true);
        if ( hoveredPropertyElement && hoveredPropertyElement.focused() === true && graph.options().drawPropertyDraggerOnHover() === true ) {
          hoveredPropertyElement.labelObject().increasedLoopAngle = false;
          // lazy update
          recalculatePositions();
        }

        if ( hoveredPropertyElement && hoveredPropertyElement.pinned() === false && graph.paused() === false && hoveredPropertyElement.editingTextElement === false ) {
          hoveredPropertyElement.frozen(false);
          hoveredPropertyElement.locked(false);
        }
      }, 1000);
    }

  }
  
  
  // TODO : experimental code for updating dynamic label with and its hover element
  graph.hideHoverPropertyElementsForAnimation = function (){
    deleteGroupElement.classed("hidden", true);
  };
  graph.showHoverElementsAfterAnimation = function ( property, inversed ){
    setDeleteHoverElementPositionProperty(property, inversed);
    deleteGroupElement.classed("hidden", false);
    
  };
  
  function editElementHoverOnHidden(){
    classDragger.nodeElement.classed("classDraggerNodeHovered", true);
    classDragger.nodeElement.classed("classDraggerNode", false);
    editElementHoverOn();
  }
  
  function editElementHoverOutHidden(){
    classDragger.nodeElement.classed("classDraggerNodeHovered", false);
    classDragger.nodeElement.classed("classDraggerNode", true);
    editElementHoverOut();
  }
  
  function editElementHoverOn( touch ){
    if ( touch === true ) return;
    clearTimeout(delayedHider); // ignore touch behaviour
    
  }
  
  graph.killDelayedTimer = function (){
    clearTimeout(delayedHider);
    clearTimeout(shared.nodeFreezer);
  };
  
  
  function editElementHoverOut( tbh ){
    if ( hoveredNodeElement ) {
      if ( graph.ignoreOtherHoverEvents() === true || tbh === true || hoveredNodeElement.editingTextElement === true ) return;
      delayedHider = setTimeout(() => {
        if ( graph.isADraggerActive() === true ) return;
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if ( hoveredNodeElement && hoveredNodeElement.pinned() === false && graph.paused() === false ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }

      }, 1000);
    }
    if ( hoveredPropertyElement ) {
      if ( graph.ignoreOtherHoverEvents() === true || tbh === true || hoveredPropertyElement.editingTextElement === true ) return;
      clearTimeout(delayedHider);
      delayedHider = setTimeout(() => {
        if ( graph.isADraggerActive() === true ) return;
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if ( hoveredPropertyElement && hoveredPropertyElement.pinned() === false && graph.paused() === false ) {
          hoveredPropertyElement.frozen(false);
          hoveredPropertyElement.locked(false);
        }

      }, 1000);
    }
  }
  
  graph.activateHoverElementsForProperties = function ( val, property, inversed, touchBehaviour ){
    if ( editMode === false ) return; // nothing to do;
    
    if ( touchBehaviour === undefined )
      touchBehaviour = false;
    
    if ( val === true ) {
      clearTimeout(delayedHider);
      if ( hoveredPropertyElement ) {
        if ( hoveredPropertyElement.domain() === hoveredPropertyElement.range() ) {
          hoveredPropertyElement.labelObject().increasedLoopAngle = false;
          recalculatePositions();
        }
      }
      
      hoveredPropertyElement = property;
      if ( graph.options().drawPropertyDraggerOnHover() === true ) {
        
        
        if ( property.type() !== "owl:DatatypeProperty" ) {
          if ( property.domain() === property.range() ) {
            property.labelObject().increasedLoopAngle = true;
            recalculatePositions();
          }
          shadowClone.setParentProperty(property, inversed);
          rangeDragger.setParentProperty(property, inversed);
          rangeDragger.hideDragger(false);
          rangeDragger.addMouseEvents();
          domainDragger.setParentProperty(property, inversed);
          domainDragger.hideDragger(false);
          domainDragger.addMouseEvents();
          
          
        } else if ( property.type() === "owl:DatatypeProperty" ) {
          shadowClone.setParentProperty(property, inversed);
          rangeDragger.setParentProperty(property, inversed);
          rangeDragger.hideDragger(true);
          rangeDragger.addMouseEvents();
          domainDragger.setParentProperty(property, inversed);
          domainDragger.hideDragger(false);
          domainDragger.addMouseEvents();
        }
      }
      else { // hide when we dont want that option
        if ( graph.options().drawPropertyDraggerOnHover() === true ) {
          rangeDragger.hideDragger(true);
          domainDragger.hideDragger(true);
          shadowClone.hideClone(true);
          if ( property.domain() === property.range() ) {
            property.labelObject().increasedLoopAngle = false;
            recalculatePositions();
          }
        }
      }
      
      if ( hoveredNodeElement ) {
        if ( hoveredNodeElement && hoveredNodeElement.pinned() === false && graph.paused() === false ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }
      hoveredNodeElement = undefined;
      deleteGroupElement.classed("hidden", false);
      setDeleteHoverElementPositionProperty(property, inversed);
      deleteGroupElement.selectAll("*").on("click", function ( event ){
        if ( touchBehaviour && property.focused() === false ) {
          graph.options().focuserModule().handle(property);
          return;
        }
        graph.removePropertyViaEditor(property);
        event.stopPropagation();
      });
      classDragger.hideDragger(true);
      addDataPropertyGroupElement.classed("hidden", true);
    } else {
      delayedHiddingHoverElements();
    }
  };
  
  graph.updateDraggerElements = function (){
    
    // set opacity style for all elements
    
    rangeDragger.draggerObject.classed("superOpacityElement", !graph.options().showDraggerObject());
    domainDragger.draggerObject.classed("superOpacityElement", !graph.options().showDraggerObject());
    classDragger.draggerObject.classed("superOpacityElement", !graph.options().showDraggerObject());
    
    nodeContainer.selectAll(".superHiddenElement").classed("superOpacityElement", !graph.options().showDraggerObject());
    labelContainer.selectAll(".superHiddenElement").classed("superOpacityElement", !graph.options().showDraggerObject());
    
    deleteGroupElement.selectAll(".superHiddenElement").classed("superOpacityElement", !graph.options().showDraggerObject());
    addDataPropertyGroupElement.selectAll(".superHiddenElement").classed("superOpacityElement", !graph.options().showDraggerObject());
    
    
  };
  
  function setAddDataPropertyHoverElementPosition( node ){
    let delX, delY = 0;
    if ( node.renderType() === "round" ) {
      const scale = 0.5 * Math.sqrt(2.0);
      const oX = scale * node.actualRadius();
      const oY = scale * node.actualRadius();
      delX = node.x - oX;
      delY = node.y + oY;
      addDataPropertyGroupElement.attr("transform", `translate(${delX},${delY})`);
    }
  }
  
  function setDeleteHoverElementPosition( node ){
    let delX, delY = 0;
    if ( node.renderType() === "round" ) {
      const scale = 0.5 * Math.sqrt(2.0);
      const oX = scale * node.actualRadius();
      const oY = scale * node.actualRadius();
      delX = node.x + oX;
      delY = node.y - oY;
    } else {
      delX = node.x + 0.5 * node.width() + 6;
      delY = node.y - 0.5 * node.height() - 6;
    }
    deleteGroupElement.attr("transform", `translate(${delX},${delY})`);
  }

  function setDeleteHoverElementPositionProperty( property, inversed ){
    if ( property && property.labelElement() ) {
      const pos = [property.labelObject().x, property.labelObject().y];
      const widthElement = parseFloat(property.getShapeElement().attr("width"));
      const heightElement = parseFloat(property.getShapeElement().attr("height"));
      let delX = pos[0] + 0.5 * widthElement + 6;
      let delY = pos[1] - 0.5 * heightElement - 6;
      // this is the lower element
      if ( property.labelElement().attr("transform") === "translate(0,15)" )
        delY += 15;
      // this is upper element
      if ( property.labelElement().attr("transform") === "translate(0,-15)" )
        delY -= 15;
      deleteGroupElement.attr("transform", `translate(${delX},${delY})`);
    } else {
      deleteGroupElement.classed("hidden", true);// hide when there is no property
    }
    
    
  }
  
  graph.activateHoverElements = function ( val, node, touchBehaviour ){
    if ( editMode === false ) {
      return; // nothing to do;
    }
    if ( touchBehaviour === undefined ) touchBehaviour = false;
    if ( val === true ) {
      if ( graph.options().drawPropertyDraggerOnHover() === true ) {
        rangeDragger.hideDragger(true);
        domainDragger.hideDragger(true);
        shadowClone.hideClone(true);
      }
      // make them visible
      clearTimeout(delayedHider);
      clearTimeout(shared.nodeFreezer);
      if ( hoveredNodeElement && node.pinned() === false && graph.paused() === false ) {
        hoveredNodeElement.frozen(false);
        hoveredNodeElement.locked(false);
      }
      hoveredNodeElement = node;
      if ( node && node.frozen() === false && node.pinned() === false ) {
        node.frozen(true);
        node.locked(false);
      }
      if ( hoveredPropertyElement && hoveredPropertyElement.focused() === false ) {
        hoveredPropertyElement.labelObject().increasedLoopAngle = false;
        recalculatePositions();
        // update the loopAngles;
        
      }
      hoveredPropertyElement = undefined;
      deleteGroupElement.classed("hidden", false);
      setDeleteHoverElementPosition(node);
      
      
      deleteGroupElement.selectAll("*").on("click", function ( event ){
        if ( touchBehaviour && node.focused() === false ) {
          graph.options().focuserModule().handle(node);
          return;
        }
        graph.removeNodeViaEditor(node);
        event.stopPropagation();
      })
        .on("mouseover", function (){
          editElementHoverOn(node, touchBehaviour);
        })
        .on("mouseout", function (){
          editElementHoverOut(node, touchBehaviour);
        });
      
      addDataPropertyGroupElement.classed("hidden", true);
      classDragger.nodeElement.on("mouseover", editElementHoverOn)
        .on("mouseout", editElementHoverOut);
      classDragger.draggerObject.on("mouseover", editElementHoverOnHidden)
        .on("mouseout", editElementHoverOutHidden);
      
      // add the dragger element;
      if ( node.renderType() === "round" ) {
        classDragger.svgRoot(draggerLayer);
        classDragger.setParentNode(node);
        classDragger.hideDragger(false);
        addDataPropertyGroupElement.classed("hidden", false);
        setAddDataPropertyHoverElementPosition(node);
        addDataPropertyGroupElement.selectAll("*").on("click", function ( event ){
          if ( touchBehaviour && node.focused() === false ) {
            graph.options().focuserModule().handle(node);
            return;
          }
          graph.createDataTypeProperty(node);
          event.stopPropagation();
        })
          .on("mouseover", function (){
            editElementHoverOn(node, touchBehaviour);
          })
          .on("mouseout", function (){
            editElementHoverOut(node, touchBehaviour);
          });
      } else {
        classDragger.hideDragger(true);
        
      }
      
    } else {
      delayedHiddingHoverElements(node, touchBehaviour);
      
    }
  };
  
  
  return graph;
};
