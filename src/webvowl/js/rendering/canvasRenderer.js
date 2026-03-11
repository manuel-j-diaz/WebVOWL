/**
 * Canvas renderer for WebVOWL.
 * Draws all visual elements to a <canvas> placed behind the SVG.
 * SVG elements remain in DOM for event handling but are hidden via .canvas-mode CSS.
 */
module.exports = function () {
  var renderer = {},
    canvas, ctx, dpr,
    width, height,
    canvasCurveGen, canvasLoopGen;

  // Current frame render state, stored for viewport culling helpers
  var _zoom = 1, _tx = 0, _ty = 0;

  // Offscreen bitmap cache for node backgrounds: key → { canvas, cx }
  var nodeCache = {};

  var CARDINALITY_HDISTANCE = 20,
    CARDINALITY_VDISTANCE = 10;

  // Fill colors from vowl.css
  var FILL_COLORS = {
    "class": "#acf",
    "object": "#acf",
    "disjoint": "#acf",
    "objectproperty": "#acf",
    "disjointwith": "#acf",
    "equivalentproperty": "#acf",
    "transitiveproperty": "#acf",
    "functionalproperty": "#acf",
    "inversefunctionalproperty": "#acf",
    "symmetricproperty": "#acf",
    "allvaluesfromproperty": "#acf",
    "somevaluesfromproperty": "#acf",
    "datatypeproperty": "#9c6",
    "rdf": "#c9c",
    "rdfproperty": "#c9c",
    "literal": "#fc3",
    "datatype": "#fc3",
    "deprecated": "#ccc",
    "deprecatedproperty": "#ccc",
    "individual": "#fca",
    "subclass": "#ecf0f1",
    "subclassproperty": "#ecf0f1",
    "symbol": "#69c"
  };

  // Special stroke colors from vowl.css
  var STROKE_COLORS = {
    "individual": "#b74",
    "rdftype": "#b74",
    "values-from": "#69c"
  };


  renderer.setup = function (containerSelector, w, h) {
    dpr = window.devicePixelRatio || 1;
    width = w;
    height = h;

    canvas = document.createElement("canvas");
    canvas.className = "vowlCanvas";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx = canvas.getContext("2d");

    var container = document.querySelector(containerSelector);
    if (!container) return;
    // Insert before SVG so canvas is behind it
    container.insertBefore(canvas, container.firstChild);

    // D3 line generators bound to the canvas context
    canvasCurveGen = d3.line()
      .x(function (d) { return d.x; })
      .y(function (d) { return d.y; })
      .curve(d3.curveCardinal)
      .context(ctx);

    canvasLoopGen = d3.line()
      .x(function (d) { return d.x; })
      .y(function (d) { return d.y; })
      .curve(d3.curveCardinal.tension(-1))
      .context(ctx);
  };


  renderer.resize = function (w, h) {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  };


  renderer.render = function (classNodes, labelNodes, links, properties, zoomFactor, graphTranslation, math) {
    if (!ctx) return;

    // Store frame state for viewport culling
    _zoom = zoomFactor;
    _tx = graphTranslation[0];
    _ty = graphTranslation[1];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(
      dpr * zoomFactor, 0,
      0, dpr * zoomFactor,
      dpr * graphTranslation[0], dpr * graphTranslation[1]
    );

    // Draw in same layer order as SVG: links → cardinalities → labels → nodes → halos
    drawLinks(links, math);
    drawCardinalities(properties, math);
    drawLabels(labelNodes);
    drawNodes(classNodes);
    drawHalos(classNodes, properties);

    ctx.restore();
  };


  renderer.destroy = function () {
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
  };


  renderer.canvas = function () {
    return canvas;
  };


  /** Invalidate the offscreen node shape cache (call after color theme changes). */
  renderer.clearNodeCache = function () {
    nodeCache = {};
  };


  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns true if the bounding circle at (x, y) with given margin is at least
   * partially within the logical viewport.
   */
  function isInViewport(x, y, margin) {
    var sx = x * _zoom + _tx;
    var sy = y * _zoom + _ty;
    var m = margin * _zoom;
    return sx + m > 0 && sx - m < width && sy + m > 0 && sy - m < height;
  }

  function getFillColor(element) {
    if (element.backgroundColor && element.backgroundColor()) {
      return element.backgroundColor();
    }
    var sc = element.styleClass ? element.styleClass() : null;
    return (sc && FILL_COLORS[sc]) ? FILL_COLORS[sc] : "#acf";
  }

  function getStrokeColor(element) {
    var sc = element.styleClass ? element.styleClass() : null;
    return (sc && STROKE_COLORS[sc]) ? STROKE_COLORS[sc] : "#000";
  }

  /**
   * Draws a rounded rectangle path on context `c`.
   */
  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  /**
   * Returns (or creates) an offscreen canvas bitmap for a node's background shape.
   * Only used for non-interactive (non-hovered, non-focused) nodes.
   * @param {string} sc   styleClass
   * @param {number} r    radius (ignored for rect nodes)
   * @param {string} fill fill color
   * @param {string} stroke stroke color
   * @param {boolean} isRect rectangular representation
   */
  function getNodeBitmap(sc, r, fill, stroke, isRect) {
    var key = sc + "_" + r + "_" + fill + "_" + stroke + "_" + isRect;
    if (!nodeCache[key]) {
      var margin = 4;
      var sz = isRect ? 92 : (r + margin) * 2;
      var off = document.createElement("canvas");
      off.width = off.height = sz;
      var c = off.getContext("2d");
      var cx = sz / 2;
      c.fillStyle = fill;
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      if (isRect) {
        roundedRect(c, cx - 40, cx - 40, 80, 80, 4);
      } else {
        c.beginPath();
        c.arc(cx, cx, r, 0, 2 * Math.PI);
      }
      c.fill();
      c.stroke();
      nodeCache[key] = { canvas: off, cx: cx };
    }
    return nodeCache[key];
  }

  // Word-wrap text to fit within maxWidth. Returns array of lines.
  function getWrappedLines(text, maxWidth) {
    ctx.font = "12px Helvetica, Arial, sans-serif";
    if (!text) return [""];
    if (ctx.measureText(text).width <= maxWidth) return [text];
    var words = text.split(/\s+/);
    var lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    // Truncate any line that's still too long (single long word)
    return lines.map(function (l) {
      if (ctx.measureText(l).width <= maxWidth) return l;
      while (l.length > 0 && ctx.measureText(l + "\u2026").width > maxWidth) l = l.slice(0, -1);
      return l + "\u2026";
    });
  }

  // Draw lines centered at (0,0) with given line height.
  function drawWrappedText(lines, lineHeight) {
    var lh = lineHeight || 14;
    var startY = -((lines.length - 1) * lh) / 2;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, startY + i * lh);
    }
  }


  // ── Nodes ─────────────────────────────────────────────────────────────────

  function drawNodes(classNodes) {
    for (var i = 0; i < classNodes.length; i++) {
      drawNode(classNodes[i]);
    }
  }

  function drawNode(node) {
    if (node.x === undefined) return;

    var r = node.actualRadius ? node.actualRadius() : 30;
    var isRect = node.getRectangularRepresentation && node.getRectangularRepresentation();

    // Viewport culling: skip nodes entirely outside the visible area
    var cullMargin = isRect ? 50 : r + 10;
    if (!isInViewport(node.x, node.y, cullMargin)) return;

    ctx.save();
    ctx.translate(node.x, node.y);

    var fill = getFillColor(node);
    var stroke = getStrokeColor(node);
    var attrs = node.attributes ? node.attributes() : [];
    var isHovered = node.mouseEntered && node.mouseEntered();
    var isFocused = node.focused && node.focused();

    if (attrs.indexOf("deprecated") > -1) fill = "#ccc";
    if (isHovered) fill = "#f00";
    if (isFocused) {
      stroke = "#f00";
      ctx.lineWidth = 4;
    } else {
      ctx.lineWidth = 2;
    }
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    if (!isHovered && !isFocused) {
      // Use offscreen bitmap cache for normal-state nodes
      var sc = node.styleClass ? node.styleClass() : "class";
      var cached = getNodeBitmap(sc, r, fill, stroke, isRect);
      ctx.drawImage(cached.canvas, -cached.cx, -cached.cx);
    } else {
      // Draw directly for interactive state (hovered / focused)
      if (isRect) {
        roundedRect(ctx, -40, -40, 80, 80, 4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2 * Math.PI);
      }
      ctx.fill();
      ctx.stroke();
    }

    // Label text with word-wrap
    var label = node.labelForCurrentLanguage ? node.labelForCurrentLanguage() : "";
    if (label) {
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var textMaxWidth = isRect ? 72 : r * 1.8;
      drawWrappedText(getWrappedLines(label, textMaxWidth));
    }

    if (node.pinned && node.pinned()) drawPinIndicator(node);

    ctx.restore();
  }

  function drawPinIndicator(node) {
    var r = node.actualRadius ? node.actualRadius() : 30;
    var dx = (-3.5 / 5) * r,
      dy = (-7 / 10) * r;
    ctx.save();
    ctx.fillStyle = "#e33";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dx, dy, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }


  // ── Property Labels ───────────────────────────────────────────────────────

  function drawLabels(labelNodes) {
    for (var i = 0; i < labelNodes.length; i++) {
      drawLabel(labelNodes[i]);
    }
  }

  function drawLabel(labelNode) {
    var prop = labelNode.property ? labelNode.property() : null;
    if (!prop) return;
    if (!prop.labelVisible || !prop.labelVisible()) return;
    if (labelNode.x === undefined) return;

    // Viewport culling for labels
    var w = prop.width ? prop.width() : 80;
    var h = prop.height ? prop.height() : 28;
    if (!isInViewport(labelNode.x, labelNode.y, Math.max(w, h) / 2 + 10)) return;

    drawPropertyRect(prop, labelNode.x, labelNode.y);

    // Inverse label (drawn offset below the primary)
    var inv = labelNode.inverse ? labelNode.inverse() : null;
    if (inv && inv.labelVisible && inv.labelVisible()) {
      drawPropertyRect(inv, labelNode.x, labelNode.y + h / 2 + 1);
    }
  }

  function drawPropertyRect(prop, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    var w = prop.width ? prop.width() : 80;
    var h = prop.height ? prop.height() : 28;

    var fill = getFillColor(prop);
    var attrs = prop.attributes ? prop.attributes() : [];
    if (attrs.indexOf("deprecated") > -1) fill = "#ccc";
    ctx.fillStyle = prop.mouseEntered && prop.mouseEntered() ? "#f00" : fill;
    ctx.strokeStyle = prop.focused && prop.focused() ? "#f00" : "#000";
    ctx.lineWidth = prop.focused && prop.focused() ? 4 : 2;

    roundedRect(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    // Skip border for background-blending labels (e.g. subclass: fill matches graph bg)
    if (fill !== "#ecf0f1") {
      ctx.stroke();
    }

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var propLabel = prop.labelForCurrentLanguage ? prop.labelForCurrentLanguage() : "";
    drawWrappedText(getWrappedLines(propLabel, w - 8));

    ctx.restore();
  }


  // ── Links ─────────────────────────────────────────────────────────────────

  function drawLinks(links, math) {
    for (var i = 0; i < links.length; i++) {
      drawLink(links[i], math);
    }
  }

  function drawLink(link, math) {
    var prop = link.label().property();
    var linkType = prop.linkType ? prop.linkType() : "normal";

    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (prop.mouseEntered && prop.mouseEntered()) {
      ctx.strokeStyle = "#f00";
    } else if (linkType === "rdftype") {
      ctx.strokeStyle = "#b74";
      ctx.globalAlpha = 0.6;
    }
    if (linkType === "dashed" || linkType === "anonymous") {
      ctx.setLineDash([8, 8]);
    } else if (linkType === "dotted") {
      ctx.setLineDash([3, 3]);
    }

    if (link.isLoop()) {
      var loopPoints = math.calculateLoopPoints(link);
      canvasLoopGen(loopPoints);
      ctx.stroke();
    } else {
      var curvePoint = link.label();
      var pathStart = math.calculateIntersection(curvePoint, link.domain(), 1);
      var pathEnd = math.calculateIntersection(curvePoint, link.range(), 1);
      canvasCurveGen([pathStart, curvePoint, pathEnd]);
      ctx.stroke();

      if (prop.linkHasMarker && prop.linkHasMarker()) {
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        var markerType = prop.markerType ? prop.markerType() : "filled";
        drawArrow(pathEnd, curvePoint, markerType);
        var inv = link.inverse ? link.inverse() : null;
        if (inv) {
          var invMarkerType = inv.markerType ? inv.markerType() : "filled";
          drawArrow(pathStart, curvePoint, invMarkerType);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draws an arrowhead at `tip` pointing away from `toward`.
   * Shape matches the SVG marker: tip at (0,0), base at (-12,±8).
   * markerType: "filled" = black fill, "white" = white fill + black stroke, else outline only.
   */
  function drawArrow(tip, toward, markerType) {
    var dx = tip.x - toward.x,
      dy = tip.y - toward.y,
      angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-12, -8);
    ctx.closePath();

    if (markerType === "filled") {
      ctx.fillStyle = "#000";
      ctx.fill();
    } else if (markerType === "white") {
      ctx.fillStyle = "#ecf0f1";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }


  // ── Cardinalities ─────────────────────────────────────────────────────────

  function drawCardinalities(properties, math) {
    for (var i = 0; i < properties.length; i++) {
      var prop = properties[i];
      if (!prop.generateCardinalityText) continue;
      var cardText = prop.generateCardinalityText();
      if (!cardText) continue;
      if (!prop.link || !prop.link()) continue;

      var label = prop.link().label();
      var pos = math.calculateIntersection(label, prop.range(), CARDINALITY_HDISTANCE);
      var normalV = math.calculateNormalVector(label, prop.range(), CARDINALITY_VDISTANCE);

      ctx.save();
      ctx.font = "10px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = prop.mouseEntered && prop.mouseEntered() ? "#f00" : "#000";
      ctx.fillText(cardText, pos.x + normalV.x, pos.y + normalV.y);
      ctx.restore();
    }
  }


  // ── Halos (search highlight rings) ────────────────────────────────────────

  function drawHalos(classNodes, properties) {
    for (var i = 0; i < classNodes.length; i++) {
      var node = classNodes[i];
      if (node.halo && node.halo() && node.x !== undefined) {
        drawNodeHalo(node);
      }
    }
    for (var j = 0; j < properties.length; j++) {
      var prop = properties[j];
      if (prop.halo && prop.halo() && prop.link && prop.link()) {
        drawPropertyHalo(prop);
      }
    }
  }

  function drawNodeHalo(node) {
    var isRect = node.getRectangularRepresentation && node.getRectangularRepresentation();
    ctx.save();
    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 5;
    if (isRect) {
      roundedRect(ctx, node.x - 45, node.y - 45, 90, 90, 6);
    } else {
      ctx.translate(node.x, node.y);
      var r = (node.actualRadius ? node.actualRadius() : 30) + 8;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPropertyHalo(prop) {
    var label = prop.link().label();
    if (label.x === undefined) return;
    var w = (prop.width ? prop.width() : 80) + 16;
    var h = (prop.height ? prop.height() : 28) + 16;
    ctx.save();
    ctx.translate(label.x, label.y);
    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 5;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.stroke();
    ctx.restore();
  }


  return renderer;
};
