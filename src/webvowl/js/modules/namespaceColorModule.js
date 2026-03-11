// D3 Paired palette: 6 pairs (12 colors), hardcoded hex
// Index [i*2] = light (ABox individual), index [i*2+1] = dark (TBox class)
const PAIRED = [
  "#a6cee3", "#1f78b4",  // pair 0: light blue / dark blue
  "#b2df8a", "#33a02c",  // pair 1: light green / dark green
  "#fb9a99", "#e31a1c",  // pair 2: light red / dark red
  "#fdbf6f", "#ff7f00",  // pair 3: light orange / dark orange
  "#cab2d6", "#6a3d9a",  // pair 4: light purple / dark purple
  "#ffff99", "#b15928"   // pair 5: light yellow / dark brown
];
const NEUTRAL_GRAY = "#aaaaaa";

module.exports = function (){

  const filter = {};
  let nodes,
    properties,
    enabled = false,
    filteredNodes,
    filteredProperties;

  /**
   * Assigns backgroundColor to each node based on its baseIri namespace.
   * TBox classes get the dark color of a pair; ABox individuals get the light color.
   * 7th+ namespace gets neutral gray. Overrides colorExternalsSwitch (runs after it).
   */
  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if ( enabled ) {
      applyNamespaceColors(nodes);
    } else {
      resetNamespaceColors(nodes);
    }

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  function buildNamespaceIndex( nodeList ){
    const indexMap = {};
    let count = 0;
    nodeList.forEach(( node ) => {
      const baseIri = node.baseIri ? node.baseIri() : undefined;
      if ( baseIri && !(baseIri in indexMap) ) {
        indexMap[baseIri] = count++;
      }
    });
    return indexMap;
  }

  function applyNamespaceColors( nodeList ){
    const nsIndex = buildNamespaceIndex(nodeList);
    nodeList.forEach(( node ) => {
      const baseIri = node.baseIri ? node.baseIri() : undefined;
      if ( !baseIri ) return;
      const idx = nsIndex[baseIri];
      const isIndividual = node.type && node.type() === "owl:NamedIndividual";
      let color;
      if ( idx >= 6 ) {
        color = NEUTRAL_GRAY;
      } else if ( isIndividual ) {
        color = PAIRED[idx * 2];      // light fill = ABox
      } else {
        color = PAIRED[idx * 2 + 1]; // dark fill = TBox
      }
      node.backgroundColor(color);
    });
  }

  function resetNamespaceColors( nodeList ){
    nodeList.forEach(( node ) => {
      node.backgroundColor(null);
    });
  }

  filter.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return filter;
  };

  filter.reset = function (){
    enabled = false;
  };

  filter.filteredNodes = function (){
    return filteredNodes;
  };

  filter.filteredProperties = function (){
    return filteredProperties;
  };

  return filter;
};
