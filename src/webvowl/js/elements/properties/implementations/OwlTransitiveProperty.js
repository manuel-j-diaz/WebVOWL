const BaseProperty = require("../BaseProperty");

class OwlTransitiveProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["transitive"])
      .styleClass("transitiveproperty")
      .type("owl:TransitiveProperty");
  }
}

module.exports = OwlTransitiveProperty;
