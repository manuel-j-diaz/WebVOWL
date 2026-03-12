const BaseProperty = require("../BaseProperty");

class OwlEquivalentProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.styleClass("equivalentproperty")
      .type("owl:equivalentProperty");
  }
}

module.exports = OwlEquivalentProperty;
