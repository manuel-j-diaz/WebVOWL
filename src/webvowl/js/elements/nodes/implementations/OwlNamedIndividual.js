const RoundNode = require("../RoundNode");

class OwlNamedIndividual extends RoundNode {
  constructor( graph ){
    super(graph);

    const that = this,
      superDraw = that.draw;

    this.type("owl:NamedIndividual");
    this.radius(18);

    // Back-reference to the class this individual belongs to (set by individualsFilter)
    this.ownerClass = null;

    this.draw = ( parentElement ) => {
      return superDraw.call(that, parentElement, ["individual", "abox"]);
    };
  }
}
module.exports = OwlNamedIndividual;
