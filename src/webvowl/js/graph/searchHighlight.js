/**
 * Search, highlight, and halo-radius subsystem for the graph.
 *
 * Manages search result highlighting, halo rendering, viewport-based halo
 * scaling, and search result location cycling.
 *
 * Each function takes an explicit `ctx` context object providing access to graph state:
 *   graph, force, unfilteredData, graphTranslation, zoomFactor,
 *   transformAnimation, targetLocationZoom
 */
const { getScreenCoords } = require("./coordinateUtils");

// ─── Mutable state ──────────────────────────────────────────────────────────

const searchState = {
  pulseNodeIds: [],
  nodeArrayForPulse: [],
  nodeMap: [],
  locationId: 0,
};

// ─── Node map ───────────────────────────────────────────────────────────────

function getNodeMapForSearch(){
  return searchState.nodeMap;
}

function updateNodeMap( ctx ){
  searchState.nodeMap = [];
  let node;
  for ( let j = 0; j < ctx.force.nodes().length; j++ ) {
    node = ctx.force.nodes()[j];
    if ( node.id ) {
      searchState.nodeMap[node.id()] = j;
      const eqs = node.equivalents();
      if ( eqs.length > 0 ) {
        for ( let e = 0; e < eqs.length; e++ ) {
          const eqObject = eqs[e];
          searchState.nodeMap[eqObject.id()] = j;
        }
      }
    }
    if ( node.property ) {
      searchState.nodeMap[node.property().id()] = j;
      const inverse = node.inverse();
      if ( inverse ) {
        searchState.nodeMap[inverse.id()] = j;
      }
    }
  }
}

// ─── Halo styles ────────────────────────────────────────────────────────────

function updateHaloStyles( ctx ){
  let haloElement;
  let halo;
  let node;
  for ( let j = 0; j < ctx.force.nodes().length; j++ ) {
    node = ctx.force.nodes()[j];
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

// ─── Halo radius ────────────────────────────────────────────────────────────

function updateHaloRadius( ctx ){
  if ( searchState.pulseNodeIds && searchState.pulseNodeIds.length > 0 ) {
    const forceNodes = ctx.force.nodes();
    for ( let i = 0; i < searchState.pulseNodeIds.length; i++ ) {
      const node = forceNodes[searchState.pulseNodeIds[i]];
      if ( node ) {
        if ( node.property ) {
          if ( node.property().inverse ) {
            const searchString = ctx.graph.options().searchMenu().getSearchString().toLowerCase();
            const name = node.property().labelForCurrentLanguage().toLowerCase();
            if ( name === searchString ) computeDistanceToCenter(ctx, node);
            else {
              node.property().removeHalo();
              if ( node.property().inverse() ) {
                if ( !node.property().inverse().getHalos() )
                  node.property().inverse().drawHalo();
                computeDistanceToCenter(ctx, node, true);
              }
              if ( node.property().equivalents() ) {
                const eq = node.property().equivalents();
                for ( let e = 0; e < eq.length; e++ ) {
                  if ( !eq[e].getHalos() )
                    eq[e].drawHalo();
                }
                if ( !node.property().getHalos() )
                  node.property().drawHalo();
                computeDistanceToCenter(ctx, node, false);

              }
            }
          }
        }
        computeDistanceToCenter(ctx, node);
      }
    }
  }
}

function computeDistanceToCenter( ctx, node, inverse ){
  let container = node;
  const w = ctx.graph.options().width();
  const h = ctx.graph.options().height();
  let posXY = getScreenCoords(node.x, node.y, ctx.graphTranslation, ctx.zoomFactor);

  let highlightOfInv = false;

  if ( inverse && inverse === true ) {
    highlightOfInv = true;
    posXY = getScreenCoords(node.x, node.y + 20, ctx.graphTranslation, ctx.zoomFactor);
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
    const graphTranslation = ctx.graphTranslation;
    const zoomFactor = ctx.zoomFactor;
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
      const aCircHalo = container.getHalos().select("circle");
      aCircHalo.classed("hidden", true);

      container.getHalos().select("rect").classed("hidden", false);
      container.getHalos().select("circle").classed("hidden", true);
    }
  }
}

// ─── Locate / reset / highlight ─────────────────────────────────────────────

function locateSearchResult( ctx ){
  if ( searchState.pulseNodeIds && searchState.pulseNodeIds.length > 0 ) {
    if ( ctx.transformAnimation === true ) return;
    const node = ctx.force.nodes()[searchState.pulseNodeIds[searchState.locationId]];
    searchState.locationId++;
    searchState.locationId = searchState.locationId % searchState.pulseNodeIds.length;
    if ( node.id ) node.foreground();
    if ( node.property ) node.property().foreground();

    ctx.targetLocationZoom(node);
  }
}

function resetSearchHighlight( ctx ){
  searchState.pulseNodeIds = [];
  searchState.nodeArrayForPulse = [];
  const nodes = ctx.unfilteredData.nodes;
  const props = ctx.unfilteredData.properties;
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
}

function updatePulseIds( ctx, nodeIdArray ){
  searchState.pulseNodeIds = [];
  for ( let i = 0; i < nodeIdArray.length; i++ ) {
    const selectedId = nodeIdArray[i];
    const forceId = searchState.nodeMap[selectedId];
    if ( forceId !== undefined ) {
      const le_node = ctx.force.nodes()[forceId];
      if ( le_node.id ) {
        if ( !searchState.pulseNodeIds.includes(forceId) ) {
          searchState.pulseNodeIds.push(forceId);
        }
      }
      if ( le_node.property ) {
        if ( !searchState.pulseNodeIds.includes(forceId) ) {
          searchState.pulseNodeIds.push(forceId);
        }
      }
    }
  }
  searchState.locationId = 0;
  if ( searchState.pulseNodeIds.length > 0 ) {
    d3.select("#locateSearchResult").classed("highlighted", true);
    d3.select("#locateSearchResult").node().title = "Locate search term";
  }
  else {
    d3.select("#locateSearchResult").classed("highlighted", false);
    d3.select("#locateSearchResult").node().title = "Nothing to locate";
  }
}

function highLightNodes( ctx, nodeIdArray ){
  if ( nodeIdArray.length === 0 ) {
    return; // nothing to highlight
  }
  searchState.pulseNodeIds = [];
  searchState.nodeArrayForPulse = nodeIdArray;
  const missedIds = [];

  // identify the force id to highlight
  for ( let i = 0; i < nodeIdArray.length; i++ ) {
    const selectedId = nodeIdArray[i];
    const forceId = searchState.nodeMap[selectedId];
    if ( forceId !== undefined ) {
      const le_node = ctx.force.nodes()[forceId];
      if ( le_node.id ) {
        if ( !searchState.pulseNodeIds.includes(forceId) ) {
          searchState.pulseNodeIds.push(forceId);
          le_node.foreground();
          le_node.drawHalo();
        }
      }
      if ( le_node.property ) {
        if ( !searchState.pulseNodeIds.includes(forceId) ) {
          searchState.pulseNodeIds.push(forceId);
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
  const s_nodes = ctx.unfilteredData.nodes;
  const s_props = ctx.unfilteredData.properties;
  for ( let i = 0; i < missedIds.length; i++ ) {
    const missedId = missedIds[i];
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
  searchState.locationId = 0;
  updateHaloRadius(ctx);
}

function hideHalos(){
  const haloElements = d3.selectAll(".searchResultA,.searchResultB");
  haloElements.classed("hidden", true);
  return haloElements;
}

function nodeInViewport( ctx, node ){
  const w = ctx.graph.options().width();
  const h = ctx.graph.options().height();
  const posXY = getScreenCoords(node.x, node.y, ctx.graphTranslation, ctx.zoomFactor);
  const x = posXY.x;
  const y = posXY.y;

  return !(x < 0 || x > w || y < 0 || y > h);
}

module.exports = {
  searchState,
  getNodeMapForSearch,
  updateNodeMap,
  updateHaloStyles,
  updateHaloRadius,
  computeDistanceToCenter,
  locateSearchResult,
  resetSearchHighlight,
  updatePulseIds,
  highLightNodes,
  hideHalos,
  nodeInViewport,
};
