const BaseProperty = require("../BaseProperty");

class OwlObjectProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.attributes(["object"])
      .styleClass("objectproperty")
      .type("owl:ObjectProperty");
  }
}

module.exports = OwlObjectProperty;
