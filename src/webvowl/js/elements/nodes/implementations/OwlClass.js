const RoundNode = require("../RoundNode");

class OwlClass extends RoundNode {
  constructor( graph ){
    super(graph);

    this.type("owl:Class");
  }
}
module.exports = OwlClass;
