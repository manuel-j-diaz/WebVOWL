const elementTools = require("../util/elementTools")();

module.exports = function (){
  const pap = {};
  let enabled = false;
  const pinnedElements = [];
  
  pap.addPinnedElement = function ( element ){
    // check if element is already in list
    const indexInArray = pinnedElements.indexOf(element);
    if ( indexInArray === -1 ) {
      pinnedElements.push(element);
    }
  };
  
  pap.handle = function ( selection, forced, currentEvent ){
    if ( !enabled ) {
      return;
    }
    
    if ( !forced ) {
      if ( wasNotDragged(currentEvent) ) {
        return;
      }
    }
    if ( elementTools.isProperty(selection) ) {
      if ( selection.inverse() && selection.inverse().pinned() ) {
        return;
      } else if ( hasNoParallelProperties(selection) ) {
        return;
      }
    }
    
    if ( !selection.pinned() ) {
      selection.drawPin();
      pap.addPinnedElement(selection);
    }
  };
  
  function wasNotDragged( currentEvent ){
    return !(currentEvent && currentEvent.defaultPrevented);
  }

  function hasNoParallelProperties( property ){
    return property.domain().links().filter(( x ) => property.range().links().indexOf(x) !== -1).length === 1;
  }
  
  pap.enabled = function ( p ){
    if ( !arguments.length ) return enabled;
    enabled = p;
    return pap;
  };
  
  pap.reset = function (){
    pinnedElements.forEach(( element ) => {
      element.removePin();
    });
    // Clear the array of stored nodes
    pinnedElements.length = 0;
  };
  
  return pap;
};
