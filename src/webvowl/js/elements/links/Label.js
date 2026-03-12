/**
 * A label represents the element(s) which further describe a link.
 * It encapsulates the property and its inverse property.
 * @param property the property; the inverse is inferred
 * @param link the link this label belongs to
 */
class Label {
  constructor( property, link ){
    this.link = function (){
      return link;
    };

    this.property = function (){
      return property;
    };

    // "Forward" the fixed value set on the property to avoid having to access this container
    Object.defineProperty(this, "fixed", {
      get: function (){
        const inverseFixed = property.inverse() ? property.inverse().fixed : false;
        return property.fixed || inverseFixed;
      },
      set: function ( v ){
        property.fixed = v;
        if ( property.inverse() ) property.inverse().fixed = v;
      }
    });
    this.frozen = property.frozen;
    this.locked = property.locked;
    this.pinned = property.pinned;
  }

  actualRadius(){
    return this.property().actualRadius();
  }

  draw( container ){
    return this.property().draw(container);
  }

  inverse(){
    return this.property().inverse();
  }

  equals( other ){
    if ( !other ) {
      return false;
    }

    const instance = other instanceof Label;
    const equalProperty = this.property().equals(other.property());

    let equalInverse = false;
    if ( this.inverse() ) {
      equalInverse = this.inverse().equals(other.inverse());
    } else if ( !other.inverse() ) {
      equalInverse = true;
    }

    return instance && equalProperty && equalInverse;
  }
}

module.exports = Label;
