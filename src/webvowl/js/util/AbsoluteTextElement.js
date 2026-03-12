const textTools = require("./textTools")();
const AbstractTextElement = require("./AbstractTextElement");

class AbsoluteTextElement extends AbstractTextElement {
  constructor( container, backgroundColor ){
    super(container, backgroundColor);
  }

  addText( text, yShift, prefix, suffix ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.default, yShift, prefix, suffix);
    }
  }

  addSubText( text, yShift ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.subtext, yShift, "(", ")");
    }
  }

  addEquivalents( text, yShift ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.default, yShift);
    }
  }

  addInstanceCount( instanceCount, yShift ){
    if ( instanceCount ) {
      this.addTextline(instanceCount.toString(), this.CSS_CLASSES.instanceCount, yShift);
    }
  }

  addTextline( text, style, yShift, prefix, postfix ){
    const truncatedText = textTools.truncate(text, this._textBlock().datum().textWidth(yShift), style);

    const tspan = this._textBlock().append("tspan")
      .classed(this.CSS_CLASSES.default, true)
      .classed(style, true)
      .text(this._applyPreAndPostFix(truncatedText, prefix, postfix))
      .attr("x", 0);
    this._repositionTextLine(tspan, yShift);
  }

  _repositionTextLine( tspan, yShift ){
    const fontSizeProperty = window.getComputedStyle(tspan.node()).getPropertyValue("font-size");
    const fontSize = parseFloat(fontSizeProperty);

    /* BBox height is not supported in Firefox for tspans and dominant-baseline doesn't work in some SVG editors */
    const approximatedShiftForVerticalCentering = (1 / 3) * fontSize;

    tspan.attr("y", `${approximatedShiftForVerticalCentering + (yShift || 0)}px`);
  }
}

module.exports = AbsoluteTextElement;
