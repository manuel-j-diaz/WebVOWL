var OwlNamedIndividual = require("../elements/nodes/implementations/OwlNamedIndividual");
var RdfTypeProperty = require("../elements/properties/implementations/RdfTypeProperty");

module.exports = function ( graph ){

  var filter = {},
    nodes,
    properties,
    enabled = false,
    collapseThreshold = 0,
    filteredNodes,
    filteredProperties;

  /**
   * When enabled, injects OwlNamedIndividual nodes and RdfTypeProperty edges
   * for each class that has individuals. Respects collapseThreshold: if a class
   * has more individuals than the threshold (and threshold > 0), only the count
   * badge is shown (no node injection).
   */
  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;

    // Reset expansion flag from any previous run on these shared node objects
    nodes.forEach(function ( node ){
      node._individualsExpanded = false;
    });

    if ( enabled ) {
      var totalIndividuals = nodes.reduce(function(sum, n){ return sum + (n.individuals ? n.individuals().length : 0); }, 0);
      console.log("[individuals] enabled, nodes:", nodes.length, "total individuals across classes:", totalIndividuals);
      var injectedNodes = nodes.slice();
      var injectedProperties = properties.slice();

      nodes.forEach(function ( classNode ){
        var individuals = classNode.individuals ? classNode.individuals() : [];
        if ( !individuals || individuals.length === 0 ) return;

        if ( collapseThreshold > 0 && individuals.length > collapseThreshold ) {
          // Badge-only mode: count badge shows automatically via node.individuals().length
          return;
        }

        // Expand: inject OwlNamedIndividual nodes + RdfTypeProperty edges
        // Mark class so RoundNode suppresses the duplicate count badge
        classNode._individualsExpanded = true;

        individuals.forEach(function ( protoIndividual ){
          var indNode = new OwlNamedIndividual(graph);
          indNode.id(protoIndividual.iri())
            .label(protoIndividual.label())
            .iri(protoIndividual.iri())
            .baseIri(classNode.baseIri());
          indNode.ownerClass = classNode;

          // Scatter initial position around the owner class
          var angle = Math.random() * 2 * Math.PI;
          var dist = (classNode.radius ? classNode.radius() : 50) + 40;
          indNode.x = (classNode.x || 0) + Math.cos(angle) * dist;
          indNode.y = (classNode.y || 0) + Math.sin(angle) * dist;
          indNode.px = indNode.x;
          indNode.py = indNode.y;

          var edge = new RdfTypeProperty(graph);
          edge.id(protoIndividual.iri() + "__rdftype")
            .domain(indNode).range(classNode);

          injectedNodes.push(indNode);
          injectedProperties.push(edge);
        });
      });

      console.log("[individuals] injected", injectedNodes.length - nodes.length, "individual nodes,", injectedProperties.length - properties.length, "rdftype edges");
      filteredNodes = injectedNodes;
      filteredProperties = injectedProperties;
    } else {
      filteredNodes = nodes;
      filteredProperties = properties;
    }
  };

  filter.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return filter;
  };

  filter.collapseThreshold = function ( p ){
    if ( !arguments.length ) return collapseThreshold;
    collapseThreshold = p;
    return filter;
  };

  filter.filteredNodes = function (){
    return filteredNodes;
  };

  filter.filteredProperties = function (){
    return filteredProperties;
  };

  return filter;
};
