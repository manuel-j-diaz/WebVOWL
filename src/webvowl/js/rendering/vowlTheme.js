/**
 * Shared VOWL color theme — single source of truth for canvas rendering.
 * Values mirror vowl.css so that SVG and canvas modes look identical.
 */

// Fill colors keyed by element styleClass()
const FILL = {
  "class":                     "#acf",
  "object":                    "#acf",
  "disjoint":                  "#acf",
  "objectproperty":            "#acf",
  "disjointwith":              "#acf",
  "equivalentproperty":        "#acf",
  "transitiveproperty":        "#acf",
  "functionalproperty":        "#acf",
  "inversefunctionalproperty": "#acf",
  "symmetricproperty":         "#acf",
  "allvaluesfromproperty":     "#acf",
  "somevaluesfromproperty":    "#acf",
  "datatypeproperty":          "#9c6",
  "rdf":                       "#c9c",
  "rdfproperty":               "#c9c",
  "literal":                   "#fc3",
  "datatype":                  "#fc3",
  "deprecated":                "#ccc",
  "deprecatedproperty":        "#ccc",
  "individual":                "#fca",
  "subclass":                  "#ecf0f1",
  "subclassproperty":          "#ecf0f1",
  "symbol":                    "#69c"
};

const FILL_DEFAULT = "#acf";

// Stroke colors keyed by element styleClass()
const STROKE = {
  "individual": "#b74",
  "rdftype":    "#b74",
  "values-from": "#69c"
};

const STROKE_DEFAULT = "#000";

// Semantic colors used by both SVG and canvas renderers
const HOVERED        = "#f00";
const FOCUSED_STROKE = "#f00";
const HALO           = "#f00";
const TEXT           = "#000";
const PIN            = "#e33";
const PIN_STROKE     = "#fff";
const COLLAPSE_BTN   = "#f00";
const COLLAPSE_HOVER = "#29f";
const ARROW_FILLED   = "#000";
const ARROW_WHITE    = "#ecf0f1";
const SUBCLASS_BG    = "#ecf0f1";
const LINK_DEFAULT   = "#000";
const LINK_RDFTYPE   = "#b74";
const RDFTYPE_ALPHA  = 0.6;

module.exports = {
  FILL, FILL_DEFAULT,
  STROKE, STROKE_DEFAULT,
  HOVERED, FOCUSED_STROKE, HALO, TEXT,
  PIN, PIN_STROKE,
  COLLAPSE_BTN, COLLAPSE_HOVER,
  ARROW_FILLED, ARROW_WHITE, SUBCLASS_BG,
  LINK_DEFAULT, LINK_RDFTYPE, RDFTYPE_ALPHA
};
