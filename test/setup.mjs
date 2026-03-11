import * as d3 from "d3";
globalThis.d3 = d3;

// jsdom returns 0 for offsetWidth; approximate by text length for textTools tests
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
	get() { return this.textContent.length * 8; },
	configurable: true,
});
