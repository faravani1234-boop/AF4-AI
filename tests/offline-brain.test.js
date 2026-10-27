import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../offline-brain.js", import.meta.url), "utf8");
function loadBrain() {
  const window = { getInstantReply: () => null };
  vm.runInNewContext(source, { window, Math, String, Array, Map, Set, Object, RegExp });
  return window;
}

test("corrects common colloquial Persian typos", () => {
  const w = loadBrain();
  assert.equal(w.AF4LocalBrain.correct("سلاام"), "سلام");
  assert.equal(w.AF4LocalBrain.correct("حالم خبه"), "حالم خوبه");
  assert.equal(w.AF4LocalBrain.correct("میخام کمکت کنم"), "میخوام کمکت کنم");
});

test("understands typo-corrected positive mood statement offline", () => {
  const w = loadBrain();
  const answer = w.getInstantReply("حالم خبه");
  assert.equal(typeof answer, "string");
  assert.match(answer, /عالی|خوشحالم|دمت گرم/);
});

test("responds locally to greetings, thanks, and jokes", () => {
  const w = loadBrain();
  assert.match(w.getInstantReply("سلاام"), /سلام|بگو/);
  assert.match(w.getInstantReply("مرسیی"), /خواهش|قربونت|هر وقت/);
  assert.match(w.getInstantReply("یه جوک بگو"), /😂|🤣|😅/);
});

test("keeps existing instant-reply handler in the chain", () => {
  const window = { getInstantReply: (text) => text === "special" ? "existing-handler" : null };
  vm.runInNewContext(source, { window, Math, String, Array, Map, Set, Object, RegExp });
  assert.equal(window.getInstantReply("special"), "existing-handler");
});

test("does not rewrite unrelated words without a confident match", () => {
  const w = loadBrain();
  assert.equal(w.AF4LocalBrain.correct("قزاقستان"), "قزاقستان");
});
