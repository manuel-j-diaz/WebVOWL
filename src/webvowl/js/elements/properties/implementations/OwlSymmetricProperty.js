const BaseProperty = require("../BaseProperty");

class OwlSymmetricProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["symmetric"])
      .styleClass("symmetricproperty")
      .type("owl:SymmetricProperty");
  }
}

module.exports = OwlSymmetricProperty;
