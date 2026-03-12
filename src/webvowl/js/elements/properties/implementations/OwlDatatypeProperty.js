const BaseProperty = require("../BaseProperty");

class OwlDatatypeProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["datatype"])
      .styleClass("datatypeproperty")
      .type("owl:DatatypeProperty");
  }
}

module.exports = OwlDatatypeProperty;
