const DatatypeNode = require("../DatatypeNode");

class RdfsLiteral extends DatatypeNode {
  constructor( graph ){
    super(graph);

    const superDrawFunction = this.draw,
      superLabelFunction = this.label;

    this.attributes(["datatype"])
      .label("Literal")
      .styleClass("literal")
      .type("rdfs:Literal")
      .iri("http://www.w3.org/2000/01/rdf-schema#Literal");

    this.draw = ( element ) => {
      superDrawFunction(element, ["dashed"]);
    };

    this.label = function ( p ){
      if ( !arguments.length ) return superLabelFunction();
      return this;
    };
  }
}
module.exports = RdfsLiteral;
