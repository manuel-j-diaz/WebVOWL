const Label = require("./Label");


/**
 * A link connects at least two VOWL nodes.
 * The properties connecting the VOWL nodes are stored separately into the label.
 * @param domain
 * @param range
 * @param property
 */
class PlainLink {
  constructor( domain, range, property ){
    let layers,
      layerIndex,
      loops,
      loopIndex,
      pathEl;
    const label = new Label(property, this);

    const backPart = require("./linkPart")(domain, label, this),
      frontPart = require("./linkPart")(label, range, this);


    this.layers = function ( p ){
      if ( !arguments.length ) return layers;
      layers = p;
      return this;
    };

    this.layerIndex = function ( p ){
      if ( !arguments.length ) return layerIndex;
      layerIndex = p;
      return this;
    };

    this.loops = function ( p ){
      if ( !arguments.length ) return loops;
      loops = p;
      return this;
    };

    this.loopIndex = function ( p ){
      if ( !arguments.length ) return loopIndex;
      loopIndex = p;
      return this;
    };


    this.domain = function (){
      return domain;
    };

    this.label = function (){
      return label;
    };

    this.linkParts = function (){
      return [frontPart, backPart];
    };

    this.range = function (){
      return range;
    };
    this.pathObj = function ( pE ){
      if ( !arguments.length ) {
        return pathEl;
      }
      pathEl = pE;
    };
  }

  draw( linkGroup ){
    const property = this.label().property();
    const inverse = this.label().inverse();

    property.linkGroup(linkGroup);
    if ( inverse ) {
      inverse.linkGroup(linkGroup);
    }

    const pathElement = linkGroup.append("path");
    pathElement.classed("link-path", true)
      .classed(this.domain().cssClassOfNode(), true)
      .classed(this.range().cssClassOfNode(), true)
      .classed(property.linkType(), true);
    this.pathObj(pathElement);

  }

  inverse(){
    return this.label().inverse();
  }

  isLoop(){
    return this.domain().equals(this.range());
  }

  property(){
    return this.label().property();
  }
}

module.exports = PlainLink;
