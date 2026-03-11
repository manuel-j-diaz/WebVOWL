module.exports = {
  curveFunction: d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveCardinal),
  loopFunction: d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveCardinal.tension(-1)),
  closedFunction: d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveBasisClosed)
};
