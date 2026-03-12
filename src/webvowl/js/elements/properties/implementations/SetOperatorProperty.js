const BaseProperty = require("../BaseProperty");

class SetOperatorProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    this.labelVisible(false)
      .linkType("dashed")
      .markerType("white")
      .styleClass("setoperatorproperty")
      .type("setOperatorProperty");
  }
}

module.exports = SetOperatorProperty;
