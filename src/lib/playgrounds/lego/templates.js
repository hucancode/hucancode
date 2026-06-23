// Template registry: every buildable model in one list, so the playground can
// offer them in a picker. Each entry re-exports a model file's { MODEL, PALETTE,
// VIEW }. PALETTE is the union of all color keys (identical keys share a hex), so
// one merged palette resolves colors for any template.

import * as head from "./dragon.js";
import * as body from "./dragon_body.js";
import * as arm from "./dragon_arm.js";
import * as leg from "./dragon_leg.js";
import * as tail from "./dragon_tail.js";
import * as eagle from "./eagle.js";

export const TEMPLATES = [
  { id: "dragon-body", name: "Dragon Body", ...body },
  { id: "dragon-head", name: "Dragon Head", ...head },
  { id: "dragon-arm", name: "Dragon Arm", ...arm },
  { id: "dragon-leg", name: "Dragon Leg", ...leg },
  { id: "dragon-tail", name: "Dragon Tail", ...tail },
  { id: "eagle", name: "Eagle", ...eagle },
];

// merged palette: later entries win on key collisions (all share the same hex)
export const PALETTE = Object.assign({}, ...TEMPLATES.map((t) => t.PALETTE ?? {}));

export const DEFAULT = TEMPLATES[0];
export const MODEL = DEFAULT.MODEL;
export const VIEW = DEFAULT.VIEW;
