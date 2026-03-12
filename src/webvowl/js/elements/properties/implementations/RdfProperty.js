const BaseProperty = require("../BaseProperty");

class RdfProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["rdf"])
      .styleClass("rdfproperty")
      .type("rdf:Property");
  }
}

module.exports = RdfProperty;
