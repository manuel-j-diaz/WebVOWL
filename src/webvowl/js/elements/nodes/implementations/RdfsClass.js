const RoundNode = require("../RoundNode");

class RdfsClass extends RoundNode {
  constructor( graph ){
    super(graph);

    this.attributes(["rdf"])
      .type("rdfs:Class");
  }
}
module.exports = RdfsClass;
