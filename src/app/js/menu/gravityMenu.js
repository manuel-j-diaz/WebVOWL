/**
 * Contains the logic for setting up the gravity sliders.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function ( graph ){

  const gravityMenu = {};
  const sliders = [];
  const options = graph.graphOptions();
  const defaultCharge = options.charge();


  /**
   * Adds the gravity sliders to the website.
   */
  gravityMenu.setup = function ( hierarchyLayout, radialLayout ){
    const menuEntry = d3.select("#m_gravity");
    menuEntry.on("mouseover", () => {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
    if ( hierarchyLayout ) {
      addLayoutToggle("#layoutToggleOption", hierarchyLayout, radialLayout);
    }
    addDistanceSlider("#classSliderOption", "class", "Class distance", options.classDistance);
    addDistanceSlider("#datatypeSliderOption", "datatype", "Datatype distance", options.datatypeDistance);
    addSeparationSlider("#nodeSeparationSliderOption", "nodeSeparation", "Node separation", options.nodeSeparation);
    addSeparationSlider("#levelSeparationSliderOption", "levelSeparation", "Level separation", options.levelSeparation);
  };

  function addLayoutToggle( selector, hierarchyLayout, radialLayout ){
    const container = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true);

    container.append("span")
      .classed("description", true)
      .text("Layout: ");

    const forceRadio = container.append("input")
      .attr("type", "radio")
      .attr("name", "layoutMode")
      .attr("id", "layoutForceRadio")
      .attr("value", "force")
      .property("checked", !hierarchyLayout.enabled() && !(radialLayout && radialLayout.enabled()));

    container.append("label")
      .attr("for", "layoutForceRadio")
      .text("Force");

    const hierarchyRadio = container.append("input")
      .attr("type", "radio")
      .attr("name", "layoutMode")
      .attr("id", "layoutHierarchyRadio")
      .attr("value", "hierarchy")
      .property("checked", hierarchyLayout.enabled());

    container.append("label")
      .attr("for", "layoutHierarchyRadio")
      .text("Hierarchy");

    if ( radialLayout ) {
      const radialRadio = container.append("input")
        .attr("type", "radio")
        .attr("name", "layoutMode")
        .attr("id", "layoutRadialRadio")
        .attr("value", "radial")
        .property("checked", radialLayout.enabled());

      container.append("label")
        .attr("for", "layoutRadialRadio")
        .text("Radial");

      radialRadio.on("change", () => {
        if ( radialRadio.property("checked") ) {
          hierarchyLayout.enabled(false);
          radialLayout.enabled(true);
          graph.update();
        }
      });
    }

    forceRadio.on("change", () => {
      if ( forceRadio.property("checked") ) {
        hierarchyLayout.enabled(false);
        if ( radialLayout ) radialLayout.enabled(false);
        graph.update();
      }
    });

    hierarchyRadio.on("change", () => {
      if ( hierarchyRadio.property("checked") ) {
        hierarchyLayout.enabled(true);
        if ( radialLayout ) radialLayout.enabled(false);
        graph.update();
      }
    });
  }

  function addDistanceSlider( selector, identifier, label, distanceFunction ){
    const defaultLinkDistance = distanceFunction();

    const sliderContainer = d3.select(selector)
      .append("div")
      .datum({ distanceFunction: distanceFunction }) // connect the options-function with the slider
      .classed("distanceSliderContainer", true);

    const slider = sliderContainer.append("input")
      .attr("id", `${identifier}DistanceSlider`)
      .attr("type", "range")
      .attr("min", 10)
      .attr("max", 600)
      .attr("value", distanceFunction())
      .attr("step", 10);

    sliderContainer.append("label")
      .classed("description", true)
      .attr("for", `${identifier}DistanceSlider`)
      .text(label);

    const sliderValueLabel = sliderContainer.append("label")
      .classed("value", true)
      .attr("for", `${identifier}DistanceSlider`)
      .text(distanceFunction());

    // Store slider for easier resetting
    sliders.push(slider);

    slider.on("focusout", () => {
      graph.updateStyle();
    });

    slider.on("input", () => {
      const distance = slider.property("value");
      distanceFunction(distance);
      adjustCharge(defaultLinkDistance);
      sliderValueLabel.text(distance);
      graph.updateStyle();
    });

    // add wheel event to the slider
    slider.on("wheel", ( event ) => {
      const wheelEvent = event;
      let offset;
      if ( wheelEvent.deltaY < 0 ) offset = 10;
      if ( wheelEvent.deltaY > 0 ) offset = -10;
      const oldVal = parseInt(slider.property("value"));
      const newSliderValue = oldVal + offset;
      if ( newSliderValue !== oldVal ) {
        slider.property("value", newSliderValue);
        distanceFunction(newSliderValue);
        slider.on("input")(); // << set text and update the graphStyles
      }
      event.preventDefault();
    });
  }

  function addSeparationSlider( selector, identifier, label, separationFunction ){
    const sliderContainer = d3.select(selector)
      .append("div")
      .datum({ distanceFunction: separationFunction })
      .classed("distanceSliderContainer", true);

    const slider = sliderContainer.append("input")
      .attr("id", `${identifier}Slider`)
      .attr("type", "range")
      .attr("min", 50)
      .attr("max", 500)
      .attr("value", separationFunction())
      .attr("step", 10);

    sliderContainer.append("label")
      .classed("description", true)
      .attr("for", `${identifier}Slider`)
      .text(label);

    const sliderValueLabel = sliderContainer.append("label")
      .classed("value", true)
      .attr("for", `${identifier}Slider`)
      .text(separationFunction());

    sliders.push(slider);

    slider.on("focusout", () => {
      graph.update();
    });

    slider.on("input", () => {
      const value = +slider.property("value");
      separationFunction(value);
      sliderValueLabel.text(value);
      graph.update();
    });

    slider.on("wheel", ( event ) => {
      const wheelEvent = event;
      let offset;
      if ( wheelEvent.deltaY < 0 ) offset = 10;
      if ( wheelEvent.deltaY > 0 ) offset = -10;
      const oldVal = parseInt(slider.property("value"));
      const newVal = oldVal + offset;
      if ( newVal !== oldVal ) {
        slider.property("value", newVal);
        separationFunction(newVal);
        slider.on("input")();
      }
      event.preventDefault();
    });
  }

  function adjustCharge( defaultLinkDistance ){
    const greaterDistance = Math.max(options.classDistance(), options.datatypeDistance());
    const ratio = greaterDistance / defaultLinkDistance;
    const newCharge = defaultCharge * ratio;

    options.charge(newCharge);
  }

  /**
   * Resets the gravity sliders to their default.
   */
  gravityMenu.reset = function (){
    sliders.forEach(( slider ) => {
      slider.property("value", ( d ) => d.distanceFunction());
      slider.on("input")();
    });
  };


  return gravityMenu;
};
