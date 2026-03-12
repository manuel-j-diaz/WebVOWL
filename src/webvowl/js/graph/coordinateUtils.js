/**
 * Pure coordinate-transform helpers used by the graph viewport.
 * These have no dependency on graph state — all inputs are explicit parameters.
 */

function getWorldPosFromScreen( x, y, translate, scale ){
  const temp = scale[0];
  let xn, yn;
  if ( temp ) {
    xn = (x - translate[0]) / temp;
    yn = (y - translate[1]) / temp;
  } else {
    xn = (x - translate[0]) / scale;
    yn = (y - translate[1]) / scale;
  }
  return { x: xn, y: yn };
}

function getScreenCoords( x, y, translate, scale ){
  const temp = scale[0];
  let xn, yn;
  if ( temp ) {
    xn = x * temp + translate[0];
    yn = y * temp + translate[1];
  } else {
    xn = x * scale + translate[0];
    yn = y * scale + translate[1];
  }
  return { x: xn, y: yn };
}

function getClickedScreenCoords( x, y, translate, scale ){
  const temp = scale[0];
  let xn, yn;
  if ( temp ) {
    xn = (x - translate[0]) / temp;
    yn = (y - translate[1]) / temp;
  } else {
    xn = (x - translate[0]) / scale;
    yn = (y - translate[1]) / scale;
  }
  return { x: xn, y: yn };
}

module.exports = { getWorldPosFromScreen, getScreenCoords, getClickedScreenCoords };
