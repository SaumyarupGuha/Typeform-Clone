import type { Option, Question } from "./types";

/**
 * One random number per page load. Choice order must be identical for the screen and
 * for the letter hotkeys, so the shuffle is seeded with this instead of Math.random()
 * being called on every render.
 */
const SESSION_SEED = Math.floor(Math.random() * 2 ** 31);

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The options in the order the respondent sees them. `shuffle` is false in the
 * builder, where creators need to see the options in the order they wrote them.
 */
export function orderedOptions(question: Question, shuffle = true): Option[] {
  const options = [...question.options];
  if (question.type === "dropdown" && question.properties.alphabetical === true) {
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }
  if (shuffle && question.type === "multiple_choice" && question.properties.randomize === true) {
    const random = seededRandom(SESSION_SEED + question.id);
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
  }
  return options;
}

/** A, B, C ... for the choice at `index`. */
export function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
