// Block registry for the staging framework. Block modules self-register their
// factory by name; the scene then lists block NAMES (an order array) instead of
// importing every factory. Adding a block = create blocks/<name>.js that calls
// defineBlock(...) + add its name to the scene's order array.

import { makeStage } from "./timeline.js";

const _factories = new Map();

// register a block factory under a unique name. Idempotent re-register (HMR-safe).
export function defineBlock(name, factory) {
  _factories.set(name, factory);
}

export function hasBlock(name) {
  return _factories.has(name);
}

// build a stage from an ordered list of block names + shared deps. Each factory
// is called with deps and must return a block descriptor (see stage/timeline.js).
// Order is preserved (producers before consumers).
export function buildStage(order, deps) {
  const blocks = order.map((name) => {
    const f = _factories.get(name);
    if (!f) throw new Error(`stage: no block registered as "${name}"`);
    return f(deps);
  });
  return makeStage(blocks);
}
