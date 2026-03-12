const RoundNode = require("../RoundNode");

class OwlDeprecatedClass extends RoundNode {
  constructor( graph ){
    super(graph);

    this.attributes(["deprecated"])
      .type("owl:DeprecatedClass")
      .styleClass("deprecated")
      .indications(["deprecated"]);
  }
}
module.exports = OwlDeprecatedClass;
