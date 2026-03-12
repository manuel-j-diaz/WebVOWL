const BaseProperty = require("../BaseProperty");

class RdfsSubClassOf extends BaseProperty {
  constructor( graph ){
    super(graph);

    const that = this,
      superDrawFunction = that.draw,
      label = "Subclass of";

    this.draw = function ( labelGroup ){
      that.labelVisible(!graph.options().compactNotation());
      return superDrawFunction(labelGroup);
    };

    // Disallow overwriting the label
    this.label = function ( p ){
      if ( !arguments.length ) return label;
      return this;
    };

    this.linkType("dotted")
      .markerType("white")
      .styleClass("subclass")
      .type("rdfs:subClassOf");

    that.baseIri("http://www.w3.org/2000/01/rdf-schema#");
    that.iri("http://www.w3.org/2000/01/rdf-schema#subClassOf");
  }
}

module.exports = RdfsSubClassOf;
