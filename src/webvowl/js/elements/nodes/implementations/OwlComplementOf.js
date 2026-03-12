const SetOperatorNode = require("../SetOperatorNode");

class OwlComplementOf extends SetOperatorNode {
  constructor( graph ){
    super(graph);

    const that = this,
      superDrawFunction = that.draw;

    this.styleClass("complementof")
      .type("owl:complementOf");

    this.draw = ( element ) => {
      superDrawFunction(element);

      const symbol = element.append("g").classed("embedded", true);

      symbol.append("circle")
        .attr("class", "symbol")
        .classed("fineline", true)
        .attr("r", 10);
      symbol.append("path")
        .attr("class", "nofill")
        .attr("d", "m -7,-1.5 12,0 0,6")
        .attr("transform", "scale(.5)");

      symbol.attr("transform",
        `translate(-${(that.radius() - 15) / 100},-${(that.radius() - 15) / 100})`);

      that.postDrawActions();
    };
  }
}
module.exports = OwlComplementOf;
