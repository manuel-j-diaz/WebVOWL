var BaseProperty = require("../BaseProperty");

module.exports = (function (){

  var o = function ( graph ){
    BaseProperty.apply(this, arguments);

    var that = this,
      superDrawFunction = that.draw;

    this.draw = function ( labelGroup ){
      that.labelVisible(false);
      return superDrawFunction(labelGroup);
    };

    // Disallow overwriting the label
    this.label = function ( p ){
      if ( !arguments.length ) return "type";
      return this;
    };

    this.linkType("dashed")
      .markerType("filled-small")
      .styleClass("rdftype")
      .type("rdf:type");

    that.baseIri("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    that.iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
  };

  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
}());
