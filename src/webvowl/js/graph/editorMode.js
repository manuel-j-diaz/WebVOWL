/**
 * Editor toggle and dragger infrastructure for the graph.
 *
 * Manages edit mode switching, dragger element visibility,
 * compact notation toggling, and edit-element removal.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state.
 */

// ─── removeEditElements ────────────────────────────────────────────────────

function removeEditElements( ctx ){
  ctx.rangeDragger.hideDragger(true);
  ctx.domainDragger.hideDragger(true);
  ctx.shadowClone.hideClone(true);

  ctx.classDragger.hideDragger(true);
  if ( ctx.hoverUI.hoverState.addDataPropertyGroupElement )
    ctx.hoverUI.hoverState.addDataPropertyGroupElement.classed("hidden", true);
  if ( ctx.hoverUI.hoverState.deleteGroupElement )
    ctx.hoverUI.hoverState.deleteGroupElement.classed("hidden", true);

  if ( ctx.hoverUI.hoverState.hoveredNodeElement ) {
    if ( ctx.hoverUI.hoverState.hoveredNodeElement.pinned() === false ) {
      ctx.hoverUI.hoverState.hoveredNodeElement.locked(ctx.graph.paused());
      ctx.hoverUI.hoverState.hoveredNodeElement.frozen(ctx.graph.paused());
    }
  }
  if ( ctx.hoverUI.hoverState.hoveredPropertyElement ) {
    if ( ctx.hoverUI.hoverState.hoveredPropertyElement.pinned() === false ) {
      ctx.hoverUI.hoverState.hoveredPropertyElement.locked(ctx.graph.paused());
      ctx.hoverUI.hoverState.hoveredPropertyElement.frozen(ctx.graph.paused());
    }
  }
}

// ─── isADraggerActive ──────────────────────────────────────────────────────

function isADraggerActive( ctx ){
  if ( ctx.classDragger.mouseButtonPressed === true ||
    ctx.domainDragger.mouseButtonPressed === true ||
    ctx.rangeDragger.mouseButtonPressed === true ) {
    return true;
  }
  return false;
}

// ─── updatePropertyDraggerElements ─────────────────────────────────────────

function updatePropertyDraggerElements( ctx, property ){
  if ( property.type() !== "owl:DatatypeProperty" ) {
    ctx.shadowClone.setParentProperty(property);
    ctx.rangeDragger.setParentProperty(property);
    ctx.rangeDragger.hideDragger(false);
    ctx.rangeDragger.addMouseEvents();
    ctx.domainDragger.setParentProperty(property);
    ctx.domainDragger.hideDragger(false);
    ctx.domainDragger.addMouseEvents();
  }
  else {
    ctx.rangeDragger.hideDragger(true);
    ctx.domainDragger.hideDragger(true);
    ctx.shadowClone.hideClone(true);
  }
}

// ─── editorMode ────────────────────────────────────────────────────────────

function editorMode( ctx, val ){
  const create_entry = d3.select("#empty");
  const create_container = d3.select("#emptyContainer");

  const modeOfOpString = d3.select("#modeOfOperationString").node();
  if ( val === undefined ) {
    create_entry.node().checked = ctx.editMode;
    if ( ctx.editMode === false ) {
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

    return ctx.editMode;
  }
  ctx.graph.options().setEditorModeForDefaultObject(val);

  ctx.setEditMode(val);

  if ( create_entry ) {
    create_entry.classed("disabled", !ctx.editMode);
    if ( !ctx.editMode ) {
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

  const compactNotationContainer = d3.select("#compactnotationModuleCheckbox");
  if ( compactNotationContainer ) {
    compactNotationContainer.classed("disabled", !ctx.editMode);
    if ( !ctx.editMode ) {
      compactNotationContainer.node().title = "";
      compactNotationContainer.node().disabled = false;
      compactNotationContainer.style("pointer-events", "auto");
      d3.select("#compactNotationOption").style("color", "");
      d3.select("#compactNotationOption").node().title = "";
      ctx.options.literalFilter().enabled(true);
      ctx.graph.update();
    } else {
      d3.select("#compactNotationOption").node().title = "Compact notation can only be used in view mode";
      compactNotationContainer.node().disabled = true;
      compactNotationContainer.node().checked = false;
      ctx.options.compactNotationModule().enabled(false);
      ctx.options.literalFilter().enabled(false);
      ctx.graph.executeCompactNotationModule();
      ctx.graph.executeEmptyLiteralFilter();
      ctx.graph.lazyRefresh();
      compactNotationContainer.style("pointer-events", "none");
      d3.select("#compactNotationOption").style("color", "#979797");
    }
  }

  if ( modeOfOpString ) {
    if ( ctx.touchBehavior.isTouchDevice() === true ) {
      modeOfOpString.innerHTML = "touch able device detected";
    } else {
      modeOfOpString.innerHTML = "point & click device detected";
    }
  }
  const svgGraph = d3.selectAll(".vowlGraph");

  if ( ctx.editMode === true ) {
    ctx.options.leftSidebar().showSidebar(ctx.options.leftSidebar().getSidebarVisibility(), true);
    ctx.options.leftSidebar().hideCollapseButton(false);
    ctx.graph.options().editSidebar().updatePrefixUi();
    ctx.graph.options().editSidebar().updateElementWidth();
    svgGraph.on("dblclick.zoom", ctx.graph.modified_dblClickFunction);
  } else {
    svgGraph.on("dblclick.zoom", ctx.originalD3_dblClickFunction);
    ctx.options.leftSidebar().showSidebar(0);
    ctx.options.leftSidebar().hideCollapseButton(true);
    removeEditElements(ctx);
  }
  ctx.options.sidebar().updateShowedInformation();
  ctx.options.editSidebar().updateElementWidth();
}

module.exports = {
  removeEditElements,
  isADraggerActive,
  updatePropertyDraggerElements,
  editorMode,
};
