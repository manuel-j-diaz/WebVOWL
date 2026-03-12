const BaseProperty = require("../BaseProperty");

class OwlDeprecatedProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["deprecated"])
      .styleClass("deprecatedproperty")
      .type("owl:DeprecatedProperty");
  }
}

module.exports = OwlDeprecatedProperty;
