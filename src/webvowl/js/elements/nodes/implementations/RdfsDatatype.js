const DatatypeNode = require("../DatatypeNode");

class RdfsDatatype extends DatatypeNode {
  constructor( graph ){
    super(graph);
    let dTypeString = "undefined";
    this.attributes(["datatype"])
      .type("rdfs:Datatype")
      .styleClass("datatype");
    this.dType = function ( val ){
      if ( !arguments.length ) return dTypeString;
      dTypeString = val;

    };
  }
}
module.exports = RdfsDatatype;
