module.exports = function (){

  const DEFAULT_STATE = true;
  const COLOR_MODES = [
    { type: "same", range: [d3.rgb("#36C"), d3.rgb("#36C")] },
    { type: "gradient", range: [d3.rgb("#36C"), d3.rgb("#EE2867")] } // taken from LD-VOWL
  ];

  const filter = {};
  let nodes,
    properties,
    enabled = DEFAULT_STATE,
    filteredNodes,
    filteredProperties,
    colorModeType = "same";
  
  
  filter.filter = function ( untouchedNodes, untouchedProperties ){
    nodes = untouchedNodes;
    properties = untouchedProperties;
    
    const externalElements = filterExternalElements(nodes.concat(properties));
    
    if ( enabled ) {
      setColorsForExternals(externalElements);
    } else {
      resetBackgroundColors(externalElements);
    }
    
    filteredNodes = nodes;
    filteredProperties = properties;
  };
  
  function filterExternalElements( elements ){
    return elements.filter(( element ) => {
      if ( element.visualAttributes().indexOf("deprecated") >= 0 ) {
        // deprecated is the only attribute which has preference over external
        return false;
      }

      return element.attributes().indexOf("external") >= 0;
    });
  }
  
  function setColorsForExternals( elements ){
    const iriMap = mapExternalsToBaseUri(elements);
    const entries = Array.from(iriMap.entries());

    const colorScale = d3.scaleLinear()
      .domain([0, entries.length - 1])
      .range(COLOR_MODES.find(( m ) => m.type === colorModeType).range)
      .interpolate(d3.interpolateHsl);

    for ( let i = 0; i < entries.length; i++ ) {
      const groupedElements = entries[i][1];
      setBackgroundColorForElements(groupedElements, colorScale(i));
    }
  }
  
  function mapExternalsToBaseUri( elements ){
    const map = new Map();

    elements.forEach(( element ) => {
      const baseIri = element.baseIri();

      if ( !map.has(baseIri) ) {
        map.set(baseIri, []);
      }
      map.get(baseIri).push(element);
    });

    return map;
  }
  
  function setBackgroundColorForElements( elements, backgroundColor ){
    elements.forEach(( element ) => {
      element.backgroundColor(backgroundColor);
    });
  }

  function resetBackgroundColors( elements ){
    console.log("Resetting color");
    elements.forEach(( element ) => {
      element.backgroundColor(null);
    });
  }
  
  filter.colorModeType = function ( p ){
    if ( !arguments.length ) return colorModeType;
    colorModeType = p;
    return filter;
  };
  
  filter.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return filter;
  };
  
  filter.reset = function (){
    enabled = DEFAULT_STATE;
  };
  
  
  // Functions a filter must have
  filter.filteredNodes = function (){
    return filteredNodes;
  };
  
  filter.filteredProperties = function (){
    return filteredProperties;
  };
  
  
  return filter;
};
