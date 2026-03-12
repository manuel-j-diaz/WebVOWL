const RoundNode = require("../RoundNode");

class OwlThing extends RoundNode {
  constructor( graph ){
    super(graph);

    const superDrawFunction = this.draw;

    this.label("Thing")
      .type("owl:Thing")
      .iri("http://www.w3.org/2002/07/owl#Thing")
      .radius(30);

    this.draw = ( element ) => {
      superDrawFunction(element, ["white", "dashed"]);
    };
  }
}
module.exports = OwlThing;
