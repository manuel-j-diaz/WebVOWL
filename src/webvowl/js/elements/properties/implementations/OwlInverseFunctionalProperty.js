const BaseProperty = require("../BaseProperty");

class OwlInverseFunctionalProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["inverse functional"])
      .styleClass("inversefunctionalproperty")
      .type("owl:InverseFunctionalProperty");
  }
}

module.exports = OwlInverseFunctionalProperty;
