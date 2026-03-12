function calculateLuminance( color ){
  return 0.3 * (color.r / 255) + 0.59 * (color.g / 255) + 0.11 * (color.b / 255);
}

class AbstractTextElement {
  constructor( container, backgroundColor ){
    const textBlock = container.append("text")
      .classed("text", true)
      .style("fill", this._getTextColor(backgroundColor))
      .attr("text-anchor", "middle");

    this._textBlock = function (){
      return textBlock;
    };
  }

  translation( x, y ){
    this._textBlock().attr("transform", `translate(${x}, ${y})`);
    return this;
  }

  remove(){
    this._textBlock().remove();
    return this;
  }

  _applyPreAndPostFix( text, prefix, postfix ){
    if ( prefix ) {
      text = `${prefix}${text}`;
    }
    if ( postfix ) {
      text = `${text}${postfix}`;
    }
    return text;
  }

  _getTextColor( rawBackgroundColor ){
    if ( !rawBackgroundColor ) {
      return AbstractTextElement.DARK_TEXT_COLOR;
    }

    const backgroundColor = d3.rgb(rawBackgroundColor);
    if ( calculateLuminance(backgroundColor) > 0.5 ) {
      return AbstractTextElement.DARK_TEXT_COLOR;
    } else {
      return AbstractTextElement.LIGHT_TEXT_COLOR;
    }
  }
}

AbstractTextElement.LINE_DISTANCE = 1;
AbstractTextElement.CSS_CLASSES = {
  default: "text",
  subtext: "subtext",
  instanceCount: "instance-count"
};
AbstractTextElement.DARK_TEXT_COLOR = "#000";
AbstractTextElement.LIGHT_TEXT_COLOR = "#fff";

// Also expose on prototype so subclass instances can access via this.LINE_DISTANCE etc.
AbstractTextElement.prototype.LINE_DISTANCE = AbstractTextElement.LINE_DISTANCE;
AbstractTextElement.prototype.CSS_CLASSES = AbstractTextElement.CSS_CLASSES;
AbstractTextElement.prototype.DARK_TEXT_COLOR = AbstractTextElement.DARK_TEXT_COLOR;
AbstractTextElement.prototype.LIGHT_TEXT_COLOR = AbstractTextElement.LIGHT_TEXT_COLOR;

module.exports = AbstractTextElement;
