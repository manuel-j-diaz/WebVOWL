/**
 * Touch behaviour functions for graph interaction.
 *
 * Manages touch device detection, double-tap detection, and touch-zoom overrides
 * for edit-mode node creation on touch devices.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state.
 */
const { getClickedScreenCoords } = require("./coordinateUtils");

// ─── Mutable state ──────────────────────────────────────────────────────────

const touchState = {
  touchDevice: false,
  last_touch_time: undefined,
  forceNotZooming: false,
};

// ─── Public API ─────────────────────────────────────────────────────────────

function setTouchDevice( val ){
  touchState.touchDevice = val;
}

function isTouchDevice(){
  return touchState.touchDevice;
}

/**
 * Edit-mode double-click handler: creates a new node at the clicked position.
 */
function modified_dblClickFunction( ctx, event ){
  event.stopPropagation();
  event.preventDefault();
  const grPos = getClickedScreenCoords(event.clientX, event.clientY, ctx.graph.translation(), ctx.graph.scaleFactor());
  ctx.createNewNodeAtPosition(grPos);
}

/**
 * Touch double-tap detection (< 300 ms between single-finger touches in edit mode).
 */
function doubletap( ctx, event ){
  const touch_time = event.timeStamp;
  let numTouchers = 1;
  if ( event && event.touches && event.touches.length )
    numTouchers = event.touches.length;

  if ( touch_time - touchState.last_touch_time < 300 && numTouchers === 1 ) {
    event.stopPropagation();
    if ( ctx.editMode() ) {
      event.preventDefault();
      event.stopPropagation();
      touchState.last_touch_time = touch_time;
      return true;
    }
  }
  touchState.last_touch_time = touch_time;
  return false;
}

/**
 * Touch-zoom handler: intercepts D3's touch zoom to detect double-taps.
 * In edit mode, prevents zoom and creates a node instead; otherwise delegates to D3.
 */
function touchzoomed( ctx, event ){
  touchState.forceNotZooming = true;

  const touch_time = event.timeStamp;
  if ( touch_time - touchState.last_touch_time < 300 && event.touches.length === 1 ) {
    event.stopPropagation();

    if ( ctx.editMode() ) {
      event.preventDefault();
      event.stopPropagation();
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom().transform,
        d3.zoomIdentity.translate(ctx.graphTranslation()[0], ctx.graphTranslation()[1]).scale(ctx.zoomFactor()));
      ctx.setProgrammaticZoom(false);
      modified_dblTouchFunction(ctx, event);
    }
    else {
      touchState.forceNotZooming = false;
      if ( ctx.originalD3_touchZoomFunction() )
        ctx.originalD3_touchZoomFunction()();
    }
    return;
  }
  touchState.forceNotZooming = false;
  touchState.last_touch_time = touch_time;
  if ( ctx.originalD3_touchZoomFunction() )
    ctx.originalD3_touchZoomFunction()();
}

/**
 * Touch equivalent of double-click: creates a new node at touch position.
 */
function modified_dblTouchFunction( ctx, event ){
  event.stopPropagation();
  event.preventDefault();
  let xy;
  if ( ctx.editMode() ) {
    xy = d3.pointers(event, d3.selectAll(".vowlGraph").node());
  }
  const grPos = getClickedScreenCoords(xy[0][0], xy[0][1], ctx.graph.translation(), ctx.graph.scaleFactor());
  ctx.createNewNodeAtPosition(grPos);
}

module.exports = {
  touchState,
  setTouchDevice,
  isTouchDevice,
  modified_dblClickFunction,
  doubletap,
  touchzoomed,
  modified_dblTouchFunction,
};
