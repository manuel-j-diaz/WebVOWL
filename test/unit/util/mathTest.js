describe("Math utility functions", function () {
	var math;

	beforeEach(function () {
		math = require("../../../src/webvowl/js/util/math")();
	});

	describe("calculateNormalVector", function () {
		it("should compute perpendicular vector for horizontal line", function () {
			var result = math.calculateNormalVector({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
			expect(result.x).toBeCloseTo(0, 5);
			expect(result.y).toBeCloseTo(5, 5);
		});

		it("should compute perpendicular vector for vertical line", function () {
			var result = math.calculateNormalVector({ x: 0, y: 0 }, { x: 0, y: 10 }, 5);
			expect(result.x).toBeCloseTo(-5, 5);
			expect(result.y).toBeCloseTo(0, 5);
		});

		it("should compute perpendicular vector for diagonal line", function () {
			var result = math.calculateNormalVector({ x: 0, y: 0 }, { x: 10, y: 10 }, Math.SQRT2);
			// normal of (10,10) is (-10,10), normalized * sqrt(2)
			expect(result.x).toBeCloseTo(-1, 5);
			expect(result.y).toBeCloseTo(1, 5);
		});

		it("should return zero vector for coincident points", function () {
			var result = math.calculateNormalVector({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);
			expect(result.x).toBeCloseTo(0, 5);
			expect(result.y).toBeCloseTo(0, 5);
		});
	});

	describe("calculateCenter", function () {
		it("should compute midpoint of two points", function () {
			var result = math.calculateCenter({ x: 0, y: 0 }, { x: 10, y: 20 });
			expect(result.x).toBe(5);
			expect(result.y).toBe(10);
		});

		it("should handle negative coordinates", function () {
			var result = math.calculateCenter({ x: -10, y: -20 }, { x: 10, y: 20 });
			expect(result.x).toBe(0);
			expect(result.y).toBe(0);
		});

		it("should return same point when both points are identical", function () {
			var result = math.calculateCenter({ x: 7, y: 3 }, { x: 7, y: 3 });
			expect(result.x).toBe(7);
			expect(result.y).toBe(3);
		});
	});

	describe("calculateIntersection", function () {
		it("should compute intersection point on target border", function () {
			var source = { x: 0, y: 0 },
				target = { x: 100, y: 0, distanceToBorder: function () { return 10; } };

			var result = math.calculateIntersection(source, target, 5);

			// length=100, innerDistance=10, additionalDistance=5, ratio=(100-15)/100=0.85
			expect(result.x).toBeCloseTo(85, 5);
			expect(result.y).toBeCloseTo(0, 5);
		});

		it("should return source position when source and target coincide", function () {
			var source = { x: 50, y: 50 },
				target = { x: 50, y: 50, distanceToBorder: function () { return 10; } };

			var result = math.calculateIntersection(source, target, 0);
			expect(result.x).toBe(50);
			expect(result.y).toBe(50);
		});
	});

	describe("getLoopPoints", function () {
		it("should return two fix points for a loop link", function () {
			var node = { x: 100, y: 100, actualRadius: function () { return 50; } };
			var label = { x: 100, y: 0 }; // above node
			label.increasedLoopAngle = false;
			var link = {
				domain: function () { return node; },
				label: function () { return label; },
				loops: function () { return [link]; }
			};

			var result = math.getLoopPoints(link);
			expect(result.length).toBe(2);
			expect(result[0]).toHaveProperty("x");
			expect(result[0]).toHaveProperty("y");
			expect(result[1]).toHaveProperty("x");
			expect(result[1]).toHaveProperty("y");
		});
	});

	describe("calculateLoopPath", function () {
		it("should return an SVG path string for a loop link", function () {
			var node = { x: 100, y: 100, actualRadius: function () { return 50; } };
			var label = { x: 100, y: 0 };
			label.increasedLoopAngle = false;
			var link = {
				domain: function () { return node; },
				label: function () { return label; },
				loops: function () { return [link]; }
			};

			var result = math.calculateLoopPath(link);
			expect(typeof result).toBe("string");
			expect(result).toMatch(/^M/); // SVG path starts with M
		});
	});

	describe("calculateLoopPoints", function () {
		it("should return [fixPoint1, label, fixPoint2]", function () {
			var node = { x: 100, y: 100, actualRadius: function () { return 50; } };
			var label = { x: 100, y: 0 };
			label.increasedLoopAngle = false;
			var link = {
				domain: function () { return node; },
				label: function () { return label; },
				loops: function () { return [link]; }
			};

			var result = math.calculateLoopPoints(link);
			expect(result.length).toBe(3);
			expect(result[1]).toBe(label);
		});
	});
});
