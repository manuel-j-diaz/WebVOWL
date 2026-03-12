const BaseProperty = require("../BaseProperty");

class OwlFunctionalProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["functional"])
      .styleClass("functionalproperty")
      .type("owl:FunctionalProperty");
  }
}

module.exports = OwlFunctionalProperty;
