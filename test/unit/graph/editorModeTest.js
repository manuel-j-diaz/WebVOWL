const { isADraggerActive } = require("../../../src/webvowl/js/graph/editorMode");

function mockDragger( pressed ){
  return { mouseButtonPressed: pressed };
}

describe("editorMode", () => {
  describe("isADraggerActive", () => {
    it("returns false when no draggers are pressed", () => {
      const ctx = {
        classDragger: mockDragger(false),
        domainDragger: mockDragger(false),
        rangeDragger: mockDragger(false),
      };
      expect(isADraggerActive(ctx)).toBe(false);
    });

    it("returns true when classDragger is pressed", () => {
      const ctx = {
        classDragger: mockDragger(true),
        domainDragger: mockDragger(false),
        rangeDragger: mockDragger(false),
      };
      expect(isADraggerActive(ctx)).toBe(true);
    });

    it("returns true when rangeDragger is pressed", () => {
      const ctx = {
        classDragger: mockDragger(false),
        domainDragger: mockDragger(false),
        rangeDragger: mockDragger(true),
      };
      expect(isADraggerActive(ctx)).toBe(true);
    });

    it("returns true when domainDragger is pressed", () => {
      const ctx = {
        classDragger: mockDragger(false),
        domainDragger: mockDragger(true),
        rangeDragger: mockDragger(false),
      };
      expect(isADraggerActive(ctx)).toBe(true);
    });

    it("returns true when multiple draggers are pressed", () => {
      const ctx = {
        classDragger: mockDragger(true),
        domainDragger: mockDragger(true),
        rangeDragger: mockDragger(true),
      };
      expect(isADraggerActive(ctx)).toBe(true);
    });
  });
});
