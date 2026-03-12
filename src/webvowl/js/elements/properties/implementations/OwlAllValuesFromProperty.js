const BaseProperty = require("../BaseProperty");

class OwlAllValuesFromProperty extends BaseProperty {
  constructor( graph ){
    super(graph);

    const superGenerateCardinalityText = this.generateCardinalityText;

    this.linkType("values-from")
      .markerType("filled values-from")
      .styleClass("allvaluesfromproperty")
      .type("owl:allValuesFrom");

    this.generateCardinalityText = function (){
      let cardinalityText = "A";

      const superCardinalityText = superGenerateCardinalityText();
      if ( superCardinalityText ) {
        cardinalityText += `, ${superCardinalityText}`;
      }

      return cardinalityText;
    };
  }
}

module.exports = OwlAllValuesFromProperty;
