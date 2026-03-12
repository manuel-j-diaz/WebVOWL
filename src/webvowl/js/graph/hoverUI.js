/**
 * Hover and selection UI subsystem for the graph.
 *
 * Manages edit-mode hover overlays (delete button, add-data-property button),
 * dragger activation/deactivation, and delayed element hiding.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state:
 *   graph, classDragger, rangeDragger, domainDragger, shadowClone, shared,
 *   editMode, editContainer, draggerLayer, nodeContainer, labelContainer,
 *   recalculatePositions
 */

// ─── Mutable state ──────────────────────────────────────────────────────────

const hoverState = {
  deleteGroupElement: undefined,
  addDataPropertyGroupElement: undefined,
  delayedHider: undefined,
  hoveredNodeElement: null,
  hoveredPropertyElement: null,
  ignoreOtherHoverEvents: false,
};

// ─── Edit element generation ────────────────────────────────────────────────

function generateEditElements( ctx ){
  hoverState.addDataPropertyGroupElement = ctx.editContainer.append('g')
    .classed("hidden-in-export", true)
    .classed("hidden", true)
    .classed("addDataPropertyElement", true)
    .attr("transform", `translate(${0},${0})`);


  hoverState.addDataPropertyGroupElement.append("circle")
  // .classed("deleteElement", true)
    .attr("r", 12)
    .attr("cx", 0)
    .attr("cy", 0)
    .append("title").text("Add Datatype Property");

  hoverState.addDataPropertyGroupElement.append("line")
  // .classed("deleteElementIcon ",true)
    .attr("x1", -8)
    .attr("y1", 0)
    .attr("x2", 8)
    .attr("y2", 0)
    .append("title").text("Add Datatype Property");

  hoverState.addDataPropertyGroupElement.append("line")
  // .classed("deleteElementIcon",true)
    .attr("x1", 0)
    .attr("y1", -8)
    .attr("x2", 0)
    .attr("y2", 8)
    .append("title").text("Add Datatype Property");

  if ( ctx.graph.options().useAccuracyHelper() ) {
    hoverState.addDataPropertyGroupElement.append("circle")
      .attr("r", 15)
      .attr("cx", -7)
      .attr("cy", 7)
      .classed("superHiddenElement", true)
      .classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  }


  hoverState.deleteGroupElement = ctx.editContainer.append('g')
    .classed("hidden-in-export", true)
    .classed("hidden", true)
    .classed("deleteParentElement", true)
    .attr("transform", `translate(${0},${0})`);

  hoverState.deleteGroupElement.append("circle")
    .attr("r", 12)
    .attr("cx", 0)
    .attr("cy", 0)
    .append("title").text("Delete This Node");

  const crossLen = 5;
  hoverState.deleteGroupElement.append("line")
    .attr("x1", -crossLen)
    .attr("y1", -crossLen)
    .attr("x2", crossLen)
    .attr("y2", crossLen)
    .append("title").text("Delete This Node");

  hoverState.deleteGroupElement.append("line")
    .attr("x1", crossLen)
    .attr("y1", -crossLen)
    .attr("x2", -crossLen)
    .attr("y2", crossLen)
    .append("title").text("Delete This Node");

  if ( ctx.graph.options().useAccuracyHelper() ) {
    hoverState.deleteGroupElement.append("circle")
      .attr("r", 15)
      .attr("cx", 7)
      .attr("cy", -7)
      .classed("superHiddenElement", true)
      .classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  }


}

// ─── Ignore hover events getter/setter ──────────────────────────────────────

function ignoreOtherHoverEvents( val ){
  if ( !arguments.length ) {
    return hoverState.ignoreOtherHoverEvents;
  }
  else  hoverState.ignoreOtherHoverEvents = val;
}

// ─── Delayed hiding ─────────────────────────────────────────────────────────

function delayedHiddingHoverElements( ctx, tbh ){
  if ( tbh === true ) return;
  if ( hoverState.hoveredNodeElement ) {
    if ( hoverState.hoveredNodeElement.editingTextElement === true ) return;
    hoverState.delayedHider = setTimeout(() => {
      hoverState.deleteGroupElement.classed("hidden", true);
      hoverState.addDataPropertyGroupElement.classed("hidden", true);
      ctx.classDragger.hideDragger(true);
      if ( hoverState.hoveredNodeElement && hoverState.hoveredNodeElement.pinned() === false && ctx.graph.paused() === false && hoverState.hoveredNodeElement.editingTextElement === false ) {
        hoverState.hoveredNodeElement.frozen(false);
        hoverState.hoveredNodeElement.locked(false);
      }
    }, 1000);
  }
  if ( hoverState.hoveredPropertyElement ) {
    if ( hoverState.hoveredPropertyElement.editingTextElement === true ) return;
    clearTimeout(hoverState.delayedHider);
    hoverState.delayedHider = setTimeout(() => {
      hoverState.deleteGroupElement.classed("hidden", true);
      hoverState.addDataPropertyGroupElement.classed("hidden", true);
      ctx.classDragger.hideDragger(true);
      ctx.rangeDragger.hideDragger(true);
      ctx.domainDragger.hideDragger(true);
      ctx.shadowClone.hideClone(true);
      if ( hoverState.hoveredPropertyElement && hoverState.hoveredPropertyElement.focused() === true && ctx.graph.options().drawPropertyDraggerOnHover() === true ) {
        hoverState.hoveredPropertyElement.labelObject().increasedLoopAngle = false;
        // lazy update
        ctx.recalculatePositions();
      }

      if ( hoverState.hoveredPropertyElement && hoverState.hoveredPropertyElement.pinned() === false && ctx.graph.paused() === false && hoverState.hoveredPropertyElement.editingTextElement === false ) {
        hoverState.hoveredPropertyElement.frozen(false);
        hoverState.hoveredPropertyElement.locked(false);
      }
    }, 1000);
  }

}

// ─── Hide/show for animation ────────────────────────────────────────────────

// TODO : experimental code for updating dynamic label with and its hover element
function hideHoverPropertyElementsForAnimation(){
  hoverState.deleteGroupElement.classed("hidden", true);
}

function showHoverElementsAfterAnimation( property, inversed ){
  setDeleteHoverElementPositionProperty(property, inversed);
  hoverState.deleteGroupElement.classed("hidden", false);

}

// ─── Edit element hover handlers ────────────────────────────────────────────

function editElementHoverOnHidden( ctx ){
  ctx.classDragger.nodeElement.classed("classDraggerNodeHovered", true);
  ctx.classDragger.nodeElement.classed("classDraggerNode", false);
  editElementHoverOn();
}

function editElementHoverOutHidden( ctx ){
  ctx.classDragger.nodeElement.classed("classDraggerNodeHovered", false);
  ctx.classDragger.nodeElement.classed("classDraggerNode", true);
  editElementHoverOut(ctx);
}

function editElementHoverOn( touch ){
  if ( touch === true ) return;
  clearTimeout(hoverState.delayedHider); // ignore touch behaviour

}

function killDelayedTimer( ctx ){
  clearTimeout(hoverState.delayedHider);
  clearTimeout(ctx.shared.nodeFreezer);
}


function editElementHoverOut( ctx, tbh ){
  if ( hoverState.hoveredNodeElement ) {
    if ( hoverState.ignoreOtherHoverEvents === true || tbh === true || hoverState.hoveredNodeElement.editingTextElement === true ) return;
    hoverState.delayedHider = setTimeout(() => {
      if ( ctx.graph.isADraggerActive() === true ) return;
      hoverState.deleteGroupElement.classed("hidden", true);
      hoverState.addDataPropertyGroupElement.classed("hidden", true);
      ctx.classDragger.hideDragger(true);
      if ( hoverState.hoveredNodeElement && hoverState.hoveredNodeElement.pinned() === false && ctx.graph.paused() === false ) {
        hoverState.hoveredNodeElement.frozen(false);
        hoverState.hoveredNodeElement.locked(false);
      }

    }, 1000);
  }
  if ( hoverState.hoveredPropertyElement ) {
    if ( hoverState.ignoreOtherHoverEvents === true || tbh === true || hoverState.hoveredPropertyElement.editingTextElement === true ) return;
    clearTimeout(hoverState.delayedHider);
    hoverState.delayedHider = setTimeout(() => {
      if ( ctx.graph.isADraggerActive() === true ) return;
      hoverState.deleteGroupElement.classed("hidden", true);
      hoverState.addDataPropertyGroupElement.classed("hidden", true);
      ctx.classDragger.hideDragger(true);
      if ( hoverState.hoveredPropertyElement && hoverState.hoveredPropertyElement.pinned() === false && ctx.graph.paused() === false ) {
        hoverState.hoveredPropertyElement.frozen(false);
        hoverState.hoveredPropertyElement.locked(false);
      }

    }, 1000);
  }
}

// ─── Hover element positioning ──────────────────────────────────────────────

function setAddDataPropertyHoverElementPosition( node ){
  let delX, delY = 0;
  if ( node.renderType() === "round" ) {
    const scale = 0.5 * Math.sqrt(2.0);
    const oX = scale * node.actualRadius();
    const oY = scale * node.actualRadius();
    delX = node.x - oX;
    delY = node.y + oY;
    hoverState.addDataPropertyGroupElement.attr("transform", `translate(${delX},${delY})`);
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
  hoverState.deleteGroupElement.attr("transform", `translate(${delX},${delY})`);
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
    hoverState.deleteGroupElement.attr("transform", `translate(${delX},${delY})`);
  } else {
    hoverState.deleteGroupElement.classed("hidden", true);// hide when there is no property
  }


}

// ─── Activate hover elements for properties ─────────────────────────────────

function activateHoverElementsForProperties( ctx, val, property, inversed, touchBehaviour ){
  if ( ctx.editMode === false ) return; // nothing to do;

  if ( touchBehaviour === undefined )
    touchBehaviour = false;

  if ( val === true ) {
    clearTimeout(hoverState.delayedHider);
    if ( hoverState.hoveredPropertyElement ) {
      if ( hoverState.hoveredPropertyElement.domain() === hoverState.hoveredPropertyElement.range() ) {
        hoverState.hoveredPropertyElement.labelObject().increasedLoopAngle = false;
        ctx.recalculatePositions();
      }
    }

    hoverState.hoveredPropertyElement = property;
    if ( ctx.graph.options().drawPropertyDraggerOnHover() === true ) {


      if ( property.type() !== "owl:DatatypeProperty" ) {
        if ( property.domain() === property.range() ) {
          property.labelObject().increasedLoopAngle = true;
          ctx.recalculatePositions();
        }
        ctx.shadowClone.setParentProperty(property, inversed);
        ctx.rangeDragger.setParentProperty(property, inversed);
        ctx.rangeDragger.hideDragger(false);
        ctx.rangeDragger.addMouseEvents();
        ctx.domainDragger.setParentProperty(property, inversed);
        ctx.domainDragger.hideDragger(false);
        ctx.domainDragger.addMouseEvents();


      } else if ( property.type() === "owl:DatatypeProperty" ) {
        ctx.shadowClone.setParentProperty(property, inversed);
        ctx.rangeDragger.setParentProperty(property, inversed);
        ctx.rangeDragger.hideDragger(true);
        ctx.rangeDragger.addMouseEvents();
        ctx.domainDragger.setParentProperty(property, inversed);
        ctx.domainDragger.hideDragger(false);
        ctx.domainDragger.addMouseEvents();
      }
    }
    else { // hide when we dont want that option
      if ( ctx.graph.options().drawPropertyDraggerOnHover() === true ) {
        ctx.rangeDragger.hideDragger(true);
        ctx.domainDragger.hideDragger(true);
        ctx.shadowClone.hideClone(true);
        if ( property.domain() === property.range() ) {
          property.labelObject().increasedLoopAngle = false;
          ctx.recalculatePositions();
        }
      }
    }

    if ( hoverState.hoveredNodeElement ) {
      if ( hoverState.hoveredNodeElement && hoverState.hoveredNodeElement.pinned() === false && ctx.graph.paused() === false ) {
        hoverState.hoveredNodeElement.frozen(false);
        hoverState.hoveredNodeElement.locked(false);
      }
    }
    hoverState.hoveredNodeElement = undefined;
    hoverState.deleteGroupElement.classed("hidden", false);
    setDeleteHoverElementPositionProperty(property, inversed);
    hoverState.deleteGroupElement.selectAll("*").on("click", function ( event ){
      if ( touchBehaviour && property.focused() === false ) {
        ctx.graph.options().focuserModule().handle(property);
        return;
      }
      ctx.graph.removePropertyViaEditor(property);
      event.stopPropagation();
    });
    ctx.classDragger.hideDragger(true);
    hoverState.addDataPropertyGroupElement.classed("hidden", true);
  } else {
    delayedHiddingHoverElements(ctx);
  }
}

// ─── Update dragger elements ────────────────────────────────────────────────

function updateDraggerElements( ctx ){

  // set opacity style for all elements

  ctx.rangeDragger.draggerObject.classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  ctx.domainDragger.draggerObject.classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  ctx.classDragger.draggerObject.classed("superOpacityElement", !ctx.graph.options().showDraggerObject());

  ctx.nodeContainer.selectAll(".superHiddenElement").classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  ctx.labelContainer.selectAll(".superHiddenElement").classed("superOpacityElement", !ctx.graph.options().showDraggerObject());

  hoverState.deleteGroupElement.selectAll(".superHiddenElement").classed("superOpacityElement", !ctx.graph.options().showDraggerObject());
  hoverState.addDataPropertyGroupElement.selectAll(".superHiddenElement").classed("superOpacityElement", !ctx.graph.options().showDraggerObject());


}

// ─── Activate hover elements for nodes ──────────────────────────────────────

function activateHoverElements( ctx, val, node, touchBehaviour ){
  if ( ctx.editMode === false ) {
    return; // nothing to do;
  }
  if ( touchBehaviour === undefined ) touchBehaviour = false;
  if ( val === true ) {
    if ( ctx.graph.options().drawPropertyDraggerOnHover() === true ) {
      ctx.rangeDragger.hideDragger(true);
      ctx.domainDragger.hideDragger(true);
      ctx.shadowClone.hideClone(true);
    }
    // make them visible
    clearTimeout(hoverState.delayedHider);
    clearTimeout(ctx.shared.nodeFreezer);
    if ( hoverState.hoveredNodeElement && node.pinned() === false && ctx.graph.paused() === false ) {
      hoverState.hoveredNodeElement.frozen(false);
      hoverState.hoveredNodeElement.locked(false);
    }
    hoverState.hoveredNodeElement = node;
    if ( node && node.frozen() === false && node.pinned() === false ) {
      node.frozen(true);
      node.locked(false);
    }
    if ( hoverState.hoveredPropertyElement && hoverState.hoveredPropertyElement.focused() === false ) {
      hoverState.hoveredPropertyElement.labelObject().increasedLoopAngle = false;
      ctx.recalculatePositions();
      // update the loopAngles;

    }
    hoverState.hoveredPropertyElement = undefined;
    hoverState.deleteGroupElement.classed("hidden", false);
    setDeleteHoverElementPosition(node);


    hoverState.deleteGroupElement.selectAll("*").on("click", function ( event ){
      if ( touchBehaviour && node.focused() === false ) {
        ctx.graph.options().focuserModule().handle(node);
        return;
      }
      ctx.graph.removeNodeViaEditor(node);
      event.stopPropagation();
    })
      .on("mouseover", function (){
        editElementHoverOn(node, touchBehaviour);
      })
      .on("mouseout", function (){
        editElementHoverOut(ctx, node, touchBehaviour);
      });

    hoverState.addDataPropertyGroupElement.classed("hidden", true);
    ctx.classDragger.nodeElement.on("mouseover", editElementHoverOn)
      .on("mouseout", function (){ editElementHoverOut(ctx); });
    ctx.classDragger.draggerObject.on("mouseover", function (){ editElementHoverOnHidden(ctx); })
      .on("mouseout", function (){ editElementHoverOutHidden(ctx); });

    // add the dragger element;
    if ( node.renderType() === "round" ) {
      ctx.classDragger.svgRoot(ctx.draggerLayer);
      ctx.classDragger.setParentNode(node);
      ctx.classDragger.hideDragger(false);
      hoverState.addDataPropertyGroupElement.classed("hidden", false);
      setAddDataPropertyHoverElementPosition(node);
      hoverState.addDataPropertyGroupElement.selectAll("*").on("click", function ( event ){
        if ( touchBehaviour && node.focused() === false ) {
          ctx.graph.options().focuserModule().handle(node);
          return;
        }
        ctx.graph.createDataTypeProperty(node);
        event.stopPropagation();
      })
        .on("mouseover", function (){
          editElementHoverOn(node, touchBehaviour);
        })
        .on("mouseout", function (){
          editElementHoverOut(ctx, node, touchBehaviour);
        });
    } else {
      ctx.classDragger.hideDragger(true);

    }

  } else {
    delayedHiddingHoverElements(ctx, node, touchBehaviour);

  }
}

module.exports = {
  hoverState,
  generateEditElements,
  ignoreOtherHoverEvents,
  delayedHiddingHoverElements,
  hideHoverPropertyElementsForAnimation,
  showHoverElementsAfterAnimation,
  editElementHoverOnHidden,
  editElementHoverOutHidden,
  editElementHoverOn,
  editElementHoverOut,
  killDelayedTimer,
  activateHoverElementsForProperties,
  updateDraggerElements,
  setAddDataPropertyHoverElementPosition,
  setDeleteHoverElementPosition,
  setDeleteHoverElementPositionProperty,
  activateHoverElements,
};
