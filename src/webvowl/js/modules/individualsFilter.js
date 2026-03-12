const OwlNamedIndividual = require("../elements/nodes/implementations/OwlNamedIndividual");
const RdfTypeProperty = require("../elements/properties/implementations/RdfTypeProperty");

module.exports = function ( graph ){

  const filter = {};
  let nodes,
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
    nodes.forEach(( node ) => {
      node._individualsExpanded = false;
    });

    if ( enabled ) {
      const totalIndividuals = nodes.reduce((sum, n) => sum + (n.individuals ? n.individuals().length : 0), 0);
      console.log("[individuals] enabled, nodes:", nodes.length, "total individuals across classes:", totalIndividuals);
      const injectedNodes = nodes.slice();
      const injectedProperties = properties.slice();
      const seenIndividuals = new Map();

      nodes.forEach(( classNode ) => {
        const individuals = classNode.individuals ? classNode.individuals() : [];
        if ( !individuals || individuals.length === 0 ) return;

        if ( collapseThreshold > 0 && individuals.length > collapseThreshold ) {
          // Badge-only mode: count badge shows automatically via node.individuals().length
          return;
        }

        // Expand: inject OwlNamedIndividual nodes + RdfTypeProperty edges
        // Mark class so RoundNode suppresses the duplicate count badge
        classNode._individualsExpanded = true;

        individuals.forEach(( protoIndividual ) => {
          const iri = protoIndividual.iri();
          let indNode = seenIndividuals.get(iri);

          if ( !indNode ) {
            indNode = new OwlNamedIndividual(graph);
            indNode.id(iri)
              .label(protoIndividual.label())
              .iri(iri)
              .baseIri(classNode.baseIri());

            // Scatter initial position around the first type class
            const angle = Math.random() * 2 * Math.PI;
            const dist = (classNode.radius ? classNode.radius() : 50) + 40;
            indNode.x = (classNode.x || 0) + Math.cos(angle) * dist;
            indNode.y = (classNode.y || 0) + Math.sin(angle) * dist;

            seenIndividuals.set(iri, indNode);
            injectedNodes.push(indNode);
          }

          const edge = new RdfTypeProperty(graph);
          edge.id(iri + "__rdftype__" + classNode.id())
            .domain(indNode).range(classNode);

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
