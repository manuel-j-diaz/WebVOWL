const RoundNode = require("../RoundNode");

module.exports = (function (){

  const o = function ( graph ){
    RoundNode.apply(this, arguments);

    const that = this,
      superDraw = that.draw;

    this.type("owl:NamedIndividual");
    this.radius(18);

    // Back-reference to the class this individual belongs to (set by individualsFilter)
    this.ownerClass = null;

    this.draw = ( parentElement ) => {
      return superDraw.call(that, parentElement, ["individual", "abox"]);
    };
  };

  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;

  return o;
}());
