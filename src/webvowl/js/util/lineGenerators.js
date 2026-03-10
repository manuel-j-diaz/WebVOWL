module.exports = {
  curveFunction: d3.line().x(function(d){ return d.x; }).y(function(d){ return d.y; }).curve(d3.curveCardinal),
  loopFunction: d3.line().x(function(d){ return d.x; }).y(function(d){ return d.y; }).curve(d3.curveCardinal.tension(-1)),
  closedFunction: d3.line().x(function(d){ return d.x; }).y(function(d){ return d.y; }).curve(d3.curveBasisClosed)
};
