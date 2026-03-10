/**
 * A simple incomplete encapsulation of the native Set, which is able to store webvowl
 * elements by using their id.
 */
module.exports = function ( array ){

  var set = {},
    nativeSet = new Set(array ? array.map(function(e){ return e; }) : []);

  set.has = function ( webvowlElement ){
    return nativeSet.has(webvowlElement.id());
  };

  set.add = function ( webvowlElement ){
    nativeSet.add(webvowlElement.id());
    return set;
  };

  set.remove = function ( webvowlElement ){
    return nativeSet.delete(webvowlElement.id());
  };

  set.empty = function (){
    return nativeSet.size === 0;
  };

  set.size = function (){
    return nativeSet.size;
  };

  return set;
};
