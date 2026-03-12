/**
 * Zoom, pan, and viewport-navigation subsystem for the graph.
 *
 * Manages zoom-in/out, slider zoom, reset, target-location animations,
 * bounding-box computation, and forced relocation events.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state.
 */
const { getWorldPosFromScreen } = require("./coordinateUtils");

// ─── transform helper ──────────────────────────────────────────────────────

/**
 * One iteration step for the locate-target animation.
 * Pure math: computes new zoomFactor + graphTranslation, syncs the D3 zoom
 * transform, and returns a CSS transform string.
 */
function transform( ctx, p, cx, cy ){
  const newZoomFactor = ctx.graph.options().height() / p[2];
  const newTranslation = [(cx - p[0] * newZoomFactor), (cy - p[1] * newZoomFactor)];
  ctx.setZoomFactor(newZoomFactor);
  ctx.setGraphTranslation(newTranslation);
  ctx.updateHaloRadius();
  ctx.setProgrammaticZoom(true);
  d3.select(".vowlGraph").call(ctx.zoom.transform,
    d3.zoomIdentity.translate(newTranslation[0], newTranslation[1]).scale(newZoomFactor));
  ctx.setProgrammaticZoom(false);
  ctx.graph.options().zoomSlider().updateZoomSliderValue(newZoomFactor);
  return `translate(${newTranslation[0]},${newTranslation[1]})scale(${newZoomFactor})`;
}

// ─── zoomed (D3 zoom event handler) ────────────────────────────────────────

function zoomed( ctx, event ){
  if ( ctx.touchState.forceNotZooming === true ) {
    ctx.setProgrammaticZoom(true);
    d3.select(".vowlGraph").call(ctx.zoom.transform,
      d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
    ctx.setProgrammaticZoom(false);
    return;
  }

  if ( ctx.programmaticZoom ) return;
  let zoomEventByMWheel = false;
  if ( event.sourceEvent ) {
    if ( event.sourceEvent.deltaY ) zoomEventByMWheel = true;
  }
  if ( zoomEventByMWheel === false ) {
    if ( ctx.transformAnimation === true ) {
      return;
    }
    ctx.setZoomFactor(event.transform.k);
    ctx.setGraphTranslation([event.transform.x, event.transform.y]);
    ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
    ctx.updateHaloRadius();
    ctx.graph.options().zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
    if ( ctx.options.useCanvasRenderer() ) {
      ctx.canvasRenderer.render(ctx.classNodes, ctx.labelNodes, ctx.links, ctx.properties, ctx.zoomFactor, ctx.graphTranslation, ctx.math);
    }
    return;
  }
  /** animate the transition **/
  const prevZoomFactor = ctx.zoomFactor;
  const prevTranslation = ctx.graphTranslation.slice();
  ctx.setZoomFactor(event.transform.k);
  ctx.setGraphTranslation([event.transform.x, event.transform.y]);
  ctx.graphContainer.transition()
    .tween("attr.translate", () => {
      const interpZoom = d3.interpolateNumber(prevZoomFactor, ctx.zoomFactor);
      const interpTx = d3.interpolateNumber(prevTranslation[0], ctx.graphTranslation[0]);
      const interpTy = d3.interpolateNumber(prevTranslation[1], ctx.graphTranslation[1]);
      return ( t ) => {
        ctx.setTransformAnimation(true);
        ctx.updateHaloRadius();
        ctx.graph.options().zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
        if ( ctx.options.useCanvasRenderer() ) {
          ctx.canvasRenderer.render(ctx.classNodes, ctx.labelNodes, ctx.links, ctx.properties,
            interpZoom(t), [interpTx(t), interpTy(t)], ctx.math);
        }
      };
    })
    .on("end", () => {
      ctx.setTransformAnimation(false);
      if ( ctx.options.useCanvasRenderer() ) {
        ctx.canvasRenderer.render(ctx.classNodes, ctx.labelNodes, ctx.links, ctx.properties, ctx.zoomFactor, ctx.graphTranslation, ctx.math);
      }
    })
    .attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`)
    .ease(d3.easeLinear)
    .duration(250);
}

// ─── setSliderZoom ─────────────────────────────────────────────────────────

function setSliderZoom( ctx, val ){
  const cx = 0.5 * ctx.graph.options().width();
  const cy = 0.5 * ctx.graph.options().height();
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);
  const sP = [cp.x, cp.y, ctx.graph.options().height() / ctx.zoomFactor];
  const eP = [cp.x, cp.y, ctx.graph.options().height() / val];
  const pos_intp = d3.interpolateZoom(sP, eP);

  ctx.graphContainer.attr("transform", transform(ctx, sP, cx, cy))
    .transition()
    .duration(1)
    .attrTween("transform", () => {
      return ( t ) => {
        return transform(ctx, pos_intp(t), cx, cy);
      };
    })
    .on("end", () => {
      ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom.transform,
        d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
      ctx.setProgrammaticZoom(false);
      ctx.graph.options().zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
    });
}

// ─── setZoom / setTranslation ──────────────────────────────────────────────

function setZoom( ctx, value ){
  ctx.setZoomFactor(value);
  ctx.setProgrammaticZoom(true);
  d3.select(".vowlGraph").call(ctx.zoom.transform,
    d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(value));
  ctx.setProgrammaticZoom(false);
}

function setTranslation( ctx, translation ){
  ctx.setGraphTranslation([translation[0], translation[1]]);
  ctx.setProgrammaticZoom(true);
  d3.select(".vowlGraph").call(ctx.zoom.transform,
    d3.zoomIdentity.translate(translation[0], translation[1]).scale(ctx.zoomFactor));
  ctx.setProgrammaticZoom(false);
}

// ─── reset ─────────────────────────────────────────────────────────────────

function reset( ctx ){
  const w = 0.5 * ctx.graph.options().width();
  const h = 0.5 * ctx.graph.options().height();
  const tx = w - ctx.defaultZoom * w;
  const ty = h - ctx.defaultZoom * h;
  ctx.setGraphTranslation([tx, ty]);
  ctx.setZoomFactor(ctx.defaultZoom);
  ctx.setProgrammaticZoom(true);
  d3.select(".vowlGraph").call(ctx.zoom.transform,
    d3.zoomIdentity.translate(tx, ty).scale(ctx.defaultZoom));
  ctx.setProgrammaticZoom(false);
}

// ─── zoomIn / zoomOut ──────────────────────────────────────────────────────

function zoomIn( ctx ){
  const minMag = ctx.options.minMagnification(),
    maxMag = ctx.options.maxMagnification();
  const stepSize = (maxMag - minMag) / 10;
  let val = ctx.zoomFactor + stepSize;
  if ( val > maxMag ) val = maxMag;
  const cx = 0.5 * ctx.graph.options().width();
  const cy = 0.5 * ctx.graph.options().height();
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);
  const sP = [cp.x, cp.y, ctx.graph.options().height() / ctx.zoomFactor];
  const eP = [cp.x, cp.y, ctx.graph.options().height() / val];
  const pos_intp = d3.interpolateZoom(sP, eP);

  ctx.graphContainer.attr("transform", transform(ctx, sP, cx, cy))
    .transition()
    .duration(250)
    .attrTween("transform", () => {
      return ( t ) => {
        return transform(ctx, pos_intp(t), cx, cy);
      };
    })
    .on("end", () => {
      ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom.transform,
        d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
      ctx.setProgrammaticZoom(false);
      ctx.updateHaloRadius();
      ctx.options.zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
    });
}

function zoomOut( ctx ){
  const minMag = ctx.options.minMagnification(),
    maxMag = ctx.options.maxMagnification();
  const stepSize = (maxMag - minMag) / 10;
  let val = ctx.zoomFactor - stepSize;
  if ( val < minMag ) val = minMag;

  const cx = 0.5 * ctx.graph.options().width();
  const cy = 0.5 * ctx.graph.options().height();
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);
  const sP = [cp.x, cp.y, ctx.graph.options().height() / ctx.zoomFactor];
  const eP = [cp.x, cp.y, ctx.graph.options().height() / val];
  const pos_intp = d3.interpolateZoom(sP, eP);

  ctx.graphContainer.attr("transform", transform(ctx, sP, cx, cy))
    .transition()
    .duration(250)
    .attrTween("transform", () => {
      return ( t ) => {
        return transform(ctx, pos_intp(t), cx, cy);
      };
    })
    .on("end", () => {
      ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom.transform,
        d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
      ctx.setProgrammaticZoom(false);
      ctx.updateHaloRadius();
      ctx.options.zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
    });
}

// ─── targetLocationZoom ────────────────────────────────────────────────────

function targetLocationZoom( ctx, target ){
  const cx = 0.5 * ctx.graph.options().width();
  const cy = 0.5 * ctx.graph.options().height();
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);
  const sP = [cp.x, cp.y, ctx.graph.options().height() / ctx.zoomFactor];

  const zoomLevel = Math.max(ctx.defaultZoom + 0.5 * ctx.defaultZoom, ctx.defaultTargetZoom);
  const eP = [target.x, target.y, ctx.graph.options().height() / zoomLevel];
  const pos_intp = d3.interpolateZoom(sP, eP);

  let lenAnimation = pos_intp.duration;
  if ( lenAnimation > 2500 ) {
    lenAnimation = 2500;
  }

  ctx.graphContainer.attr("transform", transform(ctx, sP, cx, cy))
    .transition()
    .duration(lenAnimation)
    .attrTween("transform", () => {
      return ( t ) => {
        return transform(ctx, pos_intp(t), cx, cy);
      };
    })
    .on("end", () => {
      ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom.transform,
        d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
      ctx.setProgrammaticZoom(false);
      ctx.updateHaloRadius();
    });
}

// ─── getBoundingBoxForTex ──────────────────────────────────────────────────

function getBoundingBoxForTex( ctx ){
  const halos = ctx.hideHalos();
  const bbox = ctx.graphContainer.node().getBoundingClientRect();
  halos.classed("hidden", false);
  const w = ctx.graph.options().width();
  const h = ctx.graph.options().height();

  const topLeft = getWorldPosFromScreen(0, 0, ctx.graphTranslation, ctx.zoomFactor);
  const botRight = getWorldPosFromScreen(w, h, ctx.graphTranslation, ctx.zoomFactor);

  const t_topLeft = getWorldPosFromScreen(bbox.left, bbox.top, ctx.graphTranslation, ctx.zoomFactor);
  const t_botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, ctx.graphTranslation, ctx.zoomFactor);

  let tX = Math.max(t_topLeft.x, topLeft.x);
  let tY = Math.max(t_topLeft.y, topLeft.y);

  let bX = Math.min(t_botRight.x, botRight.x);
  let bY = Math.min(t_botRight.y, botRight.y);

  const allForceNodes = ctx.force.nodes();
  const numNodes = allForceNodes.length;
  let bbx;

  const contentBBox = { tx: 1000000000000, ty: 1000000000000, bx: -1000000000000, by: -1000000000000 };

  for ( let i = 0; i < numNodes; i++ ) {
    const node = allForceNodes[i];
    if ( node ) {
      if ( node.property ) {
        if ( ctx.nodeInViewport(node, true) ) {
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
        if ( ctx.nodeInViewport(node, false) ) {
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

  const tt_topLeft = getWorldPosFromScreen(contentBBox.tx, contentBBox.ty, ctx.graphTranslation, ctx.zoomFactor);
  const tt_botRight = getWorldPosFromScreen(contentBBox.bx, contentBBox.by, ctx.graphTranslation, ctx.zoomFactor);

  tX = Math.max(tX, tt_topLeft.x);
  tY = Math.max(tY, tt_topLeft.y);

  bX = Math.min(bX, tt_botRight.x);
  bY = Math.min(bY, tt_botRight.y);
  // y axis flip for tex
  return [tX, -tY, bX, -bY];
}

// ─── updateTargetElement ───────────────────────────────────────────────────

function updateTargetElement( ctx ){
  const bbox = ctx.graphContainer.node().getBoundingClientRect();

  const bboxOffset = 50;
  const topLeft = getWorldPosFromScreen(bbox.left, bbox.top, ctx.graphTranslation, ctx.zoomFactor);
  const botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, ctx.graphTranslation, ctx.zoomFactor);

  let w = ctx.graph.options().width();
  if ( ctx.graph.options().leftSidebar().isSidebarVisible() === true )
    w -= 200;
  const h = ctx.graph.options().height();
  topLeft.x += bboxOffset;
  topLeft.y -= bboxOffset;
  botRight.x -= bboxOffset;
  botRight.y += bboxOffset;

  const g_w = botRight.x - topLeft.x;
  const g_h = botRight.y - topLeft.y;

  const posX = 0.5 * (topLeft.x + botRight.x);
  const posY = 0.5 * (topLeft.y + botRight.y);
  let cx = 0.5 * w,
    cy = 0.5 * h;

  if ( ctx.graph.options().leftSidebar().isSidebarVisible() === true )
    cx += 200;
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);

  let newZoomFactor = 1.0;
  const a = w / g_w;
  const b = h / g_h;
  if ( a < b ) newZoomFactor = a;
  else      newZoomFactor = b;

  if ( newZoomFactor > ctx.zoom.scaleExtent()[1] ) {
    newZoomFactor = ctx.zoom.scaleExtent()[1];
  }
  if ( newZoomFactor < ctx.zoom.scaleExtent()[0] ) {
    newZoomFactor = ctx.zoom.scaleExtent()[0];
  }

  const sP = [cp.x, cp.y, h / ctx.zoomFactor];
  const eP = [posX, posY, h / newZoomFactor];

  const pos_intp = d3.interpolateZoom(sP, eP);
  return [pos_intp, cx, cy];
}

// ─── forceRelocationEvent ──────────────────────────────────────────────────

function forceRelocationEvent( ctx, dynamic ){
  const halos = ctx.hideHalos();
  const bbox = ctx.graphContainer.node().getBoundingClientRect();
  halos.classed("hidden", false);

  const bboxOffset = 50;
  const topLeft = getWorldPosFromScreen(bbox.left, bbox.top, ctx.graphTranslation, ctx.zoomFactor);
  const botRight = getWorldPosFromScreen(bbox.right, bbox.bottom, ctx.graphTranslation, ctx.zoomFactor);

  let w = ctx.graph.options().width();
  if ( ctx.graph.options().leftSidebar().isSidebarVisible() === true )
    w -= 200;
  const h = ctx.graph.options().height();
  topLeft.x += bboxOffset;
  topLeft.y -= bboxOffset;
  botRight.x -= bboxOffset;
  botRight.y += bboxOffset;

  const g_w = botRight.x - topLeft.x;
  const g_h = botRight.y - topLeft.y;

  const posX = 0.5 * (topLeft.x + botRight.x);
  const posY = 0.5 * (topLeft.y + botRight.y);
  let cx = 0.5 * w,
    cy = 0.5 * h;

  if ( ctx.graph.options().leftSidebar().isSidebarVisible() === true )
    cx += 200;
  const cp = getWorldPosFromScreen(cx, cy, ctx.graphTranslation, ctx.zoomFactor);

  let newZoomFactor = 1.0;
  const a = w / g_w;
  const b = h / g_h;
  if ( a < b ) newZoomFactor = a;
  else      newZoomFactor = b;

  if ( newZoomFactor > ctx.zoom.scaleExtent()[1] ) {
    newZoomFactor = ctx.zoom.scaleExtent()[1];
  }
  if ( newZoomFactor < ctx.zoom.scaleExtent()[0] ) {
    newZoomFactor = ctx.zoom.scaleExtent()[0];
  }

  const sP = [cp.x, cp.y, h / ctx.zoomFactor];
  const eP = [posX, posY, h / newZoomFactor];

  const pos_intp = d3.interpolateZoom(sP, eP);
  let lenAnimation = pos_intp.duration;
  if ( lenAnimation > 2500 ) {
    lenAnimation = 2500;
  }
  ctx.graphContainer.attr("transform", transform(ctx, sP, cx, cy))
    .transition()
    .duration(lenAnimation)
    .attrTween("transform", () => {
      return ( t ) => {
        if ( dynamic ) {
          const param = updateTargetElement(ctx);
          const nV = param[0](t);
          return transform(ctx, nV, cx, cy);
        }
        return transform(ctx, pos_intp(t), cx, cy);
      };
    })
    .on("end", () => {
      if ( dynamic ) {
        return;
      }

      ctx.graphContainer.attr("transform", `translate(${ctx.graphTranslation})scale(${ctx.zoomFactor})`);
      ctx.setProgrammaticZoom(true);
      d3.select(".vowlGraph").call(ctx.zoom.transform,
        d3.zoomIdentity.translate(ctx.graphTranslation[0], ctx.graphTranslation[1]).scale(ctx.zoomFactor));
      ctx.setProgrammaticZoom(false);
      ctx.graph.options().zoomSlider().updateZoomSliderValue(ctx.zoomFactor);
    });
}

module.exports = {
  transform,
  zoomed,
  setSliderZoom,
  setZoom,
  setTranslation,
  reset,
  zoomIn,
  zoomOut,
  targetLocationZoom,
  getBoundingBoxForTex,
  updateTargetElement,
  forceRelocationEvent,
};
