const RoundNode = require("../RoundNode");

class RdfsResource extends RoundNode {
  constructor( graph ){
    super(graph);

    const superDrawFunction = this.draw;

    this.attributes(["rdf"])
      .label("Resource")
      .radius(30)
      .styleClass("rdfsresource")
      .type("rdfs:Resource");

    this.draw = ( element ) => {
      superDrawFunction(element, ["rdf", "dashed"]);
    };
  }
}
module.exports = RdfsResource;
