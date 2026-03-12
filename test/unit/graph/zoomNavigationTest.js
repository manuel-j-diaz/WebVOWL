const { transform } = require("../../../src/webvowl/js/graph/zoomNavigation");

/**
 * Minimal mock context for transform().
 * transform() calls d3.select(".vowlGraph").call(zoom.transform, ...),
 * so we need zoom.transform to be a callable function.
 */
function mockZoomCtx( overrides ){
  const state = {
    zoomFactor: 1.0,
    graphTranslation: [0, 0],
    programmaticZoom: false,
    calls: [],
  };

  // Create a stub SVG element so d3.select(".vowlGraph") finds something
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("vowlGraph");
  document.body.appendChild(svg);

  return Object.assign({
    graph: {
      options: () => ({
        height: () => overrides.height || 600,
        width: () => overrides.width || 800,
        zoomSlider: () => ({
          updateZoomSliderValue: ( val ) => { state.calls.push({ zoomSlider: val }); },
        }),
      }),
    },
    // zoom.transform must be a function for d3 selection.call()
    zoom: { transform: function (){} },
    setZoomFactor: ( val ) => { state.zoomFactor = val; },
    setGraphTranslation: ( val ) => { state.graphTranslation = val; },
    setProgrammaticZoom: ( val ) => { state.programmaticZoom = val; },
    updateHaloRadius: () => { state.calls.push("updateHaloRadius"); },
    _state: state,
    _cleanup: () => { if ( svg.parentNode ) svg.parentNode.removeChild(svg); },
  }, overrides);
}

describe("zoomNavigation", () => {
  describe("transform", () => {
    afterEach(() => {
      // Clean up any leftover DOM elements
      document.querySelectorAll(".vowlGraph").forEach(( el ) => el.remove());
    });

    it("computes zoomFactor from height / p[2]", () => {
      const ctx = mockZoomCtx({ height: 600 });
      transform(ctx, [100, 200, 300], 400, 300);
      // zoomFactor = 600 / 300 = 2.0
      expect(ctx._state.zoomFactor).toBe(2.0);
      ctx._cleanup();
    });

    it("computes graphTranslation from center minus p*zoom", () => {
      const ctx = mockZoomCtx({ height: 600 });
      const result = transform(ctx, [100, 200, 300], 400, 300);
      // zoomFactor = 2.0
      // tx = 400 - 100*2 = 200, ty = 300 - 200*2 = -100
      expect(ctx._state.graphTranslation[0]).toBe(200);
      expect(ctx._state.graphTranslation[1]).toBe(-100);
      expect(result).toContain("translate(");
      expect(result).toContain("scale(");
      ctx._cleanup();
    });

    it("returns a valid CSS transform string", () => {
      const ctx = mockZoomCtx({ height: 800 });
      const result = transform(ctx, [0, 0, 800], 0, 0);
      // zoomFactor = 800/800 = 1, tx = 0-0 = 0, ty = 0-0 = 0
      expect(result).toBe("translate(0,0)scale(1)");
      ctx._cleanup();
    });

    it("calls updateHaloRadius", () => {
      const ctx = mockZoomCtx({ height: 600 });
      transform(ctx, [50, 50, 600], 300, 300);
      expect(ctx._state.calls).toContain("updateHaloRadius");
      ctx._cleanup();
    });

    it("restores programmaticZoom to false after the call", () => {
      const ctx = mockZoomCtx({ height: 600 });
      transform(ctx, [50, 50, 600], 300, 300);
      expect(ctx._state.programmaticZoom).toBe(false);
      ctx._cleanup();
    });

    it("updates zoomSlider with computed factor", () => {
      const ctx = mockZoomCtx({ height: 900 });
      transform(ctx, [0, 0, 300], 0, 0);
      // zoomFactor = 900/300 = 3
      const sliderCall = ctx._state.calls.find(( c ) => typeof c === "object" && c.zoomSlider !== undefined);
      expect(sliderCall.zoomSlider).toBe(3);
      ctx._cleanup();
    });
  });
});
