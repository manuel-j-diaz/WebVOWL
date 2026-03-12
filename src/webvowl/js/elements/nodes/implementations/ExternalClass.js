const RoundNode = require("../RoundNode");

class ExternalClass extends RoundNode {
  constructor( graph ){
    super(graph);

    this.attributes(["external"])
      .type("ExternalClass");
  }
}
module.exports = ExternalClass;
