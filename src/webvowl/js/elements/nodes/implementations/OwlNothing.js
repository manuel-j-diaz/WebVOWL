const OwlThing = require("./OwlThing");

class OwlNothing extends OwlThing {
  constructor( graph ){
    super(graph);

    this.label("Nothing")
      .type("owl:Nothing")
      .iri("http://www.w3.org/2002/07/owl#Nothing");
  }
}
module.exports = OwlNothing;
