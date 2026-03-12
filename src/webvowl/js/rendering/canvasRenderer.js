/**
 * Canvas renderer for WebVOWL.
 * Draws all visual elements to a <canvas> placed behind the SVG.
 * SVG elements remain in DOM for event handling but are hidden via .canvas-mode CSS.
 */
const theme = require("./vowlTheme");

module.exports = function () {
  const renderer = {};
  let canvas, ctx, dpr,
    width, height,
    canvasCurveGen, canvasLoopGen;

  let _collapsingModule = null;
  renderer.collapsingModule = function (m) {
    if (!arguments.length) return _collapsingModule;
    _collapsingModule = m;
    return renderer;
  };

  // Current frame render state, stored for viewport culling helpers
  let _zoom = 1, _tx = 0, _ty = 0;

  const CARDINALITY_HDISTANCE = 20,
    CARDINALITY_VDISTANCE = 10;


  renderer.setup = function (containerSelector, w, h) {
    dpr = window.devicePixelRatio || 1;
    width = w;
    height = h;

    canvas = document.createElement("canvas");
    canvas.className = "vowlCanvas";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx = canvas.getContext("2d");

    const container = document.querySelector(containerSelector);
    if (!container) return;
    // Insert before SVG so canvas is behind it
    container.insertBefore(canvas, container.firstChild);

    // D3 line generators bound to the canvas context
    canvasCurveGen = d3.line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveCardinal)
      .context(ctx);

    canvasLoopGen = d3.line()
      .x((d) => d.x)
      .y((d) => d.y)
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
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
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


  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns true if the bounding circle at (x, y) with given margin is at least
   * partially within the logical viewport.
   */
  function isInViewport(x, y, margin) {
    const sx = x * _zoom + _tx;
    const sy = y * _zoom + _ty;
    const m = margin * _zoom;
    return sx + m > 0 && sx - m < width && sy + m > 0 && sy - m < height;
  }

  function getFillColor(element) {
    if (element.backgroundColor && element.backgroundColor()) {
      return element.backgroundColor();
    }
    const sc = element.styleClass ? element.styleClass() : null;
    return (sc && theme.FILL[sc]) ? theme.FILL[sc] : theme.FILL_DEFAULT;
  }

  function getStrokeColor(element) {
    const sc = element.styleClass ? element.styleClass() : null;
    return (sc && theme.STROKE[sc]) ? theme.STROKE[sc] : theme.STROKE_DEFAULT;
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

  // Word-wrap text to fit within maxWidth. Returns array of lines.
  function getWrappedLines(text, maxWidth) {
    ctx.font = "12px Helvetica, Arial, sans-serif";
    if (!text) return [""];
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    // Truncate any line that's still too long (single long word)
    return lines.map((l) => {
      if (ctx.measureText(l).width <= maxWidth) return l;
      while (l.length > 0 && ctx.measureText(`${l}\u2026`).width > maxWidth) l = l.slice(0, -1);
      return `${l}\u2026`;
    });
  }

  // Draw lines centered at (0,0) with given line height.
  function drawWrappedText(lines, lineHeight) {
    const lh = lineHeight || 14;
    const startY = -((lines.length - 1) * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, startY + i * lh);
    }
  }


  // ── Nodes ─────────────────────────────────────────────────────────────────

  function drawNodes(classNodes) {
    for (const node of classNodes) {
      drawNode(node);
    }
  }

  function drawNode(node) {
    if (node.x === undefined) return;

    const r = node.actualRadius ? node.actualRadius() : 30;
    const isRect = node.getRectangularRepresentation && node.getRectangularRepresentation();

    // Viewport culling: skip nodes entirely outside the visible area
    const cullMargin = isRect ? 50 : r + (node.collapsible && node.collapsible() ? 24 : 10);
    if (!isInViewport(node.x, node.y, cullMargin)) return;

    ctx.save();
    ctx.translate(node.x, node.y);

    let fill = getFillColor(node);
    let stroke = getStrokeColor(node);
    const attrs = node.attributes ? node.attributes() : [];
    const isHovered = node.mouseEntered && node.mouseEntered();
    const isFocused = node.focused && node.focused();

    if (attrs.includes("deprecated")) fill = theme.FILL.deprecated;
    if (isHovered) fill = theme.HOVERED;
    const isCollapsed = _collapsingModule && _collapsingModule.isCollapsed(node.id());
    if (isFocused) {
      stroke = theme.FOCUSED_STROKE;
      ctx.lineWidth = 4;
    } else if (isCollapsed) {
      ctx.lineWidth = 3;
    } else {
      ctx.lineWidth = 2;
    }
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    if (isCollapsed) ctx.setLineDash([8, 4]);

    if (isRect) {
      roundedRect(ctx, -40, -40, 80, 80, 4);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
    }
    ctx.fill();
    ctx.stroke();

    if (isCollapsed) ctx.setLineDash([]);

    // Label text with word-wrap
    const label = node.labelForCurrentLanguage ? node.labelForCurrentLanguage() : "";
    if (label) {
      ctx.fillStyle = theme.TEXT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textMaxWidth = isRect ? 72 : r * 1.8;
      drawWrappedText(getWrappedLines(label, textMaxWidth));
    }

    if (node.pinned && node.pinned()) drawPinIndicator(node);
    if (node.collapsible && node.collapsible()) drawCollapseButton(node);

    ctx.restore();
  }

  function drawCollapseButton(node) {
    const r = node.actualRadius ? node.actualRadius() : 30;
    const isCollapsed = _collapsingModule && _collapsingModule.isCollapsed(node.id());
    const isHovered = node._collapseHovered;

    ctx.save();
    ctx.translate(0, r);

    // Button circle
    ctx.fillStyle = isHovered ? theme.COLLAPSE_HOVER : theme.COLLAPSE_BTN;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, 2 * Math.PI);
    ctx.fill();

    // +/- lines
    ctx.strokeStyle = theme.STROKE_DEFAULT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();

    if (isCollapsed) {
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPinIndicator(node) {
    const r = node.actualRadius ? node.actualRadius() : 30;
    const dx = (-3.5 / 5) * r,
      dy = (-7 / 10) * r;
    ctx.save();
    ctx.fillStyle = theme.PIN;
    ctx.strokeStyle = theme.PIN_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dx, dy, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }


  // ── Property Labels ───────────────────────────────────────────────────────

  function drawLabels(labelNodes) {
    for (const labelNode of labelNodes) {
      drawLabel(labelNode);
    }
  }

  function drawLabel(labelNode) {
    const prop = labelNode.property ? labelNode.property() : null;
    if (!prop) return;
    if (!prop.labelVisible || !prop.labelVisible()) return;
    if (labelNode.x === undefined) return;

    // Viewport culling for labels
    const w = prop.width ? prop.width() : 80;
    const h = prop.height ? prop.height() : 28;
    if (!isInViewport(labelNode.x, labelNode.y, Math.max(w, h) / 2 + 10)) return;

    drawPropertyRect(prop, labelNode.x, labelNode.y);

    // Inverse label (drawn offset below the primary)
    const inv = labelNode.inverse ? labelNode.inverse() : null;
    if (inv && inv.labelVisible && inv.labelVisible()) {
      drawPropertyRect(inv, labelNode.x, labelNode.y + h / 2 + 1);
    }
  }

  function drawPropertyRect(prop, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    const w = prop.width ? prop.width() : 80;
    const h = prop.height ? prop.height() : 28;

    let fill = getFillColor(prop);
    const attrs = prop.attributes ? prop.attributes() : [];
    if (attrs.includes("deprecated")) fill = theme.FILL.deprecated;
    ctx.fillStyle = prop.mouseEntered && prop.mouseEntered() ? theme.HOVERED : fill;
    ctx.strokeStyle = prop.focused && prop.focused() ? theme.FOCUSED_STROKE : theme.STROKE_DEFAULT;
    ctx.lineWidth = prop.focused && prop.focused() ? 4 : 2;

    roundedRect(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    // Skip border for background-blending labels (e.g. subclass: fill matches graph bg)
    if (fill !== theme.SUBCLASS_BG) {
      ctx.stroke();
    }

    ctx.fillStyle = theme.TEXT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const propLabel = prop.labelForCurrentLanguage ? prop.labelForCurrentLanguage() : "";
    drawWrappedText(getWrappedLines(propLabel, w - 8));

    ctx.restore();
  }


  // ── Links ─────────────────────────────────────────────────────────────────

  function drawLinks(links, math) {
    for (const link of links) {
      drawLink(link, math);
    }
  }

  function drawLink(link, math) {
    const prop = link.label().property();
    const linkType = prop.linkType ? prop.linkType() : "normal";

    ctx.save();
    ctx.strokeStyle = theme.LINK_DEFAULT;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (prop.mouseEntered && prop.mouseEntered()) {
      ctx.strokeStyle = theme.HOVERED;
    } else if (linkType === "rdftype") {
      ctx.strokeStyle = theme.LINK_RDFTYPE;
      ctx.globalAlpha = theme.RDFTYPE_ALPHA;
    }
    if (linkType === "dashed" || linkType === "anonymous") {
      ctx.setLineDash([8, 8]);
    } else if (linkType === "dotted") {
      ctx.setLineDash([3, 3]);
    }

    if (link.isLoop()) {
      const loopPoints = math.calculateLoopPoints(link);
      canvasLoopGen(loopPoints);
      ctx.stroke();
    } else {
      const curvePoint = link.label();
      const pathStart = math.calculateIntersection(curvePoint, link.domain(), 1);
      const pathEnd = math.calculateIntersection(curvePoint, link.range(), 1);
      canvasCurveGen([pathStart, curvePoint, pathEnd]);
      ctx.stroke();

      if (prop.linkHasMarker && prop.linkHasMarker()) {
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        const markerType = prop.markerType ? prop.markerType() : "filled";
        drawArrow(pathEnd, curvePoint, markerType);
        const inv = link.inverse ? link.inverse() : null;
        if (inv) {
          const invMarkerType = inv.markerType ? inv.markerType() : "filled";
          drawArrow(pathStart, curvePoint, invMarkerType);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draws an arrowhead at `tip` pointing away from `toward`.
   * Shape matches the SVG marker: tip at (0,0), base at (-12,+-8).
   * markerType: "filled" = black fill, "white" = white fill + black stroke, else outline only.
   */
  function drawArrow(tip, toward, markerType) {
    const dx = tip.x - toward.x,
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
      ctx.fillStyle = theme.ARROW_FILLED;
      ctx.fill();
    } else if (markerType === "white") {
      ctx.fillStyle = theme.ARROW_WHITE;
      ctx.fill();
      ctx.strokeStyle = theme.STROKE_DEFAULT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = theme.STROKE_DEFAULT;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }


  // ── Cardinalities ─────────────────────────────────────────────────────────

  function drawCardinalities(properties, math) {
    for (const prop of properties) {
      if (!prop.generateCardinalityText) continue;
      const cardText = prop.generateCardinalityText();
      if (!cardText) continue;
      if (!prop.link || !prop.link()) continue;

      const label = prop.link().label();
      const pos = math.calculateIntersection(label, prop.range(), CARDINALITY_HDISTANCE);
      const normalV = math.calculateNormalVector(label, prop.range(), CARDINALITY_VDISTANCE);

      ctx.save();
      ctx.font = "10px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = prop.mouseEntered && prop.mouseEntered() ? theme.HOVERED : theme.TEXT;
      ctx.fillText(cardText, pos.x + normalV.x, pos.y + normalV.y);
      ctx.restore();
    }
  }


  // ── Halos (search highlight rings) ────────────────────────────────────────

  function drawHalos(classNodes, properties) {
    for (const node of classNodes) {
      if (node.halo && node.halo() && node.x !== undefined) {
        drawNodeHalo(node);
      }
    }
    for (const prop of properties) {
      if (prop.halo && prop.halo() && prop.link && prop.link()) {
        drawPropertyHalo(prop);
      }
    }
  }

  function drawNodeHalo(node) {
    const isRect = node.getRectangularRepresentation && node.getRectangularRepresentation();
    ctx.save();
    ctx.strokeStyle = theme.HALO;
    ctx.lineWidth = 5;
    if (isRect) {
      roundedRect(ctx, node.x - 45, node.y - 45, 90, 90, 6);
    } else {
      ctx.translate(node.x, node.y);
      const r = (node.actualRadius ? node.actualRadius() : 30) + 8;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPropertyHalo(prop) {
    const label = prop.link().label();
    if (label.x === undefined) return;
    const w = (prop.width ? prop.width() : 80) + 16;
    const h = (prop.height ? prop.height() : 28) + 16;
    ctx.save();
    ctx.translate(label.x, label.y);
    ctx.strokeStyle = theme.HALO;
    ctx.lineWidth = 5;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.stroke();
    ctx.restore();
  }


  return renderer;
};
