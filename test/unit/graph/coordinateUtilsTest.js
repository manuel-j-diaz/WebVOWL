const { getWorldPosFromScreen, getScreenCoords, getClickedScreenCoords } =
	require("../../../src/webvowl/js/graph/coordinateUtils");

describe("coordinateUtils", () => {
	describe("getWorldPosFromScreen", () => {
		it("converts with numeric scale", () => {
			const r = getWorldPosFromScreen(100, 200, [10, 20], 2);
			expect(r.x).toBe(45);  // (100-10)/2
			expect(r.y).toBe(90);  // (200-20)/2
		});

		it("converts with array scale", () => {
			const r = getWorldPosFromScreen(100, 200, [10, 20], [2]);
			expect(r.x).toBe(45);
			expect(r.y).toBe(90);
		});

		it("identity transform returns same coords", () => {
			const r = getWorldPosFromScreen(50, 100, [0, 0], 1);
			expect(r.x).toBe(50);
			expect(r.y).toBe(100);
		});

		it("handles negative translation", () => {
			const r = getWorldPosFromScreen(10, 20, [-10, -20], 1);
			expect(r.x).toBe(20);  // (10-(-10))/1
			expect(r.y).toBe(40);  // (20-(-20))/1
		});
	});

	describe("getScreenCoords", () => {
		it("converts with numeric scale", () => {
			const r = getScreenCoords(45, 90, [10, 20], 2);
			expect(r.x).toBe(100); // 45*2 + 10
			expect(r.y).toBe(200); // 90*2 + 20
		});

		it("converts with array scale", () => {
			const r = getScreenCoords(45, 90, [10, 20], [2]);
			expect(r.x).toBe(100);
			expect(r.y).toBe(200);
		});

		it("identity transform returns same coords", () => {
			const r = getScreenCoords(50, 100, [0, 0], 1);
			expect(r.x).toBe(50);
			expect(r.y).toBe(100);
		});
	});

	describe("round-trip", () => {
		it("world → screen → world preserves coordinates", () => {
			const translate = [30, 50];
			const scale = 1.5;
			const screen = getScreenCoords(100, 200, translate, scale);
			const world = getWorldPosFromScreen(screen.x, screen.y, translate, scale);
			expect(world.x).toBeCloseTo(100);
			expect(world.y).toBeCloseTo(200);
		});

		it("screen → world → screen preserves coordinates", () => {
			const translate = [-15, 40];
			const scale = 0.75;
			const world = getWorldPosFromScreen(200, 300, translate, scale);
			const screen = getScreenCoords(world.x, world.y, translate, scale);
			expect(screen.x).toBeCloseTo(200);
			expect(screen.y).toBeCloseTo(300);
		});

		it("round-trip works with array scale", () => {
			const translate = [10, 20];
			const scale = [3];
			const screen = getScreenCoords(50, 60, translate, scale);
			const world = getWorldPosFromScreen(screen.x, screen.y, translate, scale);
			expect(world.x).toBeCloseTo(50);
			expect(world.y).toBeCloseTo(60);
		});
	});

	describe("getClickedScreenCoords", () => {
		it("behaves identically to getWorldPosFromScreen", () => {
			const translate = [15, 25];
			const scale = 2.5;
			const a = getWorldPosFromScreen(100, 200, translate, scale);
			const b = getClickedScreenCoords(100, 200, translate, scale);
			expect(b.x).toBe(a.x);
			expect(b.y).toBe(a.y);
		});

		it("matches with array scale too", () => {
			const translate = [5, 10];
			const scale = [1.2];
			const a = getWorldPosFromScreen(80, 160, translate, scale);
			const b = getClickedScreenCoords(80, 160, translate, scale);
			expect(b.x).toBe(a.x);
			expect(b.y).toBe(a.y);
		});
	});
});
