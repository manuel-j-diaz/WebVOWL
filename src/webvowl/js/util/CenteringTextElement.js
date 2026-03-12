const textTools = require("./textTools")();
const AbstractTextElement = require("./AbstractTextElement");

class CenteringTextElement extends AbstractTextElement {
  constructor( container, backgroundColor ){
    super(container, backgroundColor);
    this.storedFullTextLines = [];
    this.storedSpanArrays = [];
    this.storedStyle = [];
  }

  addText( text, prefix, suffix ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.default, prefix, suffix);
    }
  }

  addSubText( text ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.subtext, "(", ")");
    }
  }

  addEquivalents( text ){
    if ( text ) {
      this.addTextline(text, this.CSS_CLASSES.default);
    }
  }

  addInstanceCount( instanceCount ){
    if ( instanceCount ) {
      this.addTextline(instanceCount.toString(), this.CSS_CLASSES.instanceCount);
    }
  }

  saveCorrespondingSpan( correspondingSpan ){
    this.storedSpanArrays.push(correspondingSpan);
  }

  saveFullTextLine( fullText ){
    this.storedFullTextLines.push(fullText);
  }

  saveStyle( style ){
    this.storedStyle.push(style);
  }

  updateAllTextElements(){
    // TODO : TEST THIS postPrefix >>>  _applyPreAndPostFix
    for ( let i = 0; i < this.storedSpanArrays.length; i++ ) {
      const truncatedText = textTools.truncate(this.storedFullTextLines[i], this._textBlock().datum().textWidth(), this.storedStyle[i]);
      this.storedSpanArrays[i].text(truncatedText);
    }
  }

  addTextline( text, style, prefix, postfix ){
    const truncatedText = textTools.truncate(text, this._textBlock().datum().textWidth(), style);
    this.saveFullTextLine(text);
    this.saveStyle(style);
    const tspan = this._textBlock().append("tspan")
      .classed(this.CSS_CLASSES.default, true)
      .classed(style, true)
      .text(this._applyPreAndPostFix(truncatedText, prefix, postfix))
      .attr("x", 0);
    this._repositionTextLine(tspan);
    this.saveCorrespondingSpan(tspan);

    this._repositionTextBlock();
  }

  _repositionTextLine( tspan ){
    const fontSizeProperty = window.getComputedStyle(tspan.node()).getPropertyValue("font-size");
    const fontSize = parseFloat(fontSizeProperty);

    const siblingCount = this._lineCount() - 1;
    const lineDistance = siblingCount > 0 ? this.LINE_DISTANCE : 0;

    tspan.attr("dy", `${fontSize + lineDistance}px`);
  }

  getTextBox(){
    return this._textBlock();
  }

  _repositionTextBlock(){
    // Nothing to do if no child elements exist
    const lineCount = this._lineCount();
    if ( lineCount < 1 ) {
      this._textBlock().attr("y", 0);
      return;
    }

    const textBlockHeight = this._textBlock().node().getBBox().height;
    this._textBlock().attr("y", `${-textBlockHeight * 0.5}px`);
  }

  _lineCount(){
    return this._textBlock().property("childElementCount");
  }
}

module.exports = CenteringTextElement;
