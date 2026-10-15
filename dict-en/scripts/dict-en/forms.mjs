// Dạng từ tiếng Anh → các headword OVDP. Chạy LÚC BUILD trên tập từ đóng của
// kho; máy người dùng chỉ tra khớp. Spec §3.4.

/** Bất quy tắc mà dòng từ loại của OVDP không ghi. */
export const MANUAL_IRREGULAR = {
  men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth',
  geese: 'goose', mice: 'mouse', people: 'person', wives: 'wife', knives: 'knife',
  leaves: 'leaf', selves: 'self', themselves: 'themselves', ourselves: 'ourselves',
  being: 'be', am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do', said: 'say',
  made: 'make', went: 'go', gone: 'go', came: 'come', saw: 'see', seen: 'see',
  knew: 'know', known: 'know', thought: 'think', took: 'take', taken: 'take',
  gave: 'give', given: 'give', got: 'get', found: 'find', felt: 'feel', told: 'tell',
  heard: 'hear', sat: 'sit', stood: 'stand', spoke: 'speak', spoken: 'speak',
  became: 'become', arose: 'arise', arisen: 'arise', ate: 'eat', eaten: 'eat',
  fell: 'fall', fallen: 'fall', led: 'lead', brought: 'bring', held: 'hold',
  kept: 'keep', slept: 'sleep', taught: 'teach', understood: 'understand',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', laid: 'lay', lain: 'lie',
  bound: 'bind', born: 'bear', borne: 'bear', ran: 'run', left: 'leave', lost: 'lose',
  cannot: 'can',
};

const CONTRACTIONS = { "won't": 'will', "can't": 'can', "shan't": 'shall' };
const CLITICS = ["n't", "'re", "'ve", "'ll", "'m", "'d", "'s"];

const NOUN_ADJ_RULES = [
  ['ies', 'y'], ['ier', 'y'], ['iest', 'y'], ['ily', 'y'], ['iness', 'y'],
  ['es', ''], ['s', ''], ['er', ''], ['er', 'e'], ['est', ''], ['est', 'e'], ['ly', ''], ['ness', ''],
];
const VERB_RULES = [['ied', 'y'], ['ed', ''], ['ed', 'e'], ['ing', ''], ['ing', 'e']];
const DOUBLED = /([bdgklmnprt])\1$/;

function bySuffix(form, rules, has) {
  const out = [];
  for (const [suf, rep] of rules) {
    if (!form.endsWith(suf)) continue;
    const stem = form.slice(0, -suf.length);
    const base = stem + rep;
    if (base.length >= 3 && has(base)) out.push(base);
    if (rep === '' && DOUBLED.test(stem) && has(stem.slice(0, -1)) && stem.length - 1 >= 3) out.push(stem.slice(0, -1));
  }
  return out;
}

function irregularOf(form, irregular, has) {
  const list = [...(irregular.get(form) ?? [])];
  const manual = MANUAL_IRREGULAR[form];
  if (manual && !list.includes(manual)) list.push(manual);
  return list.filter(has);
}

function lemmas(form, has, irregular) {
  const out = [];
  const add = (k) => {
    if (!out.includes(k)) out.push(k);
  };
  const exact = has(form);
  if (exact) add(form);
  for (const k of irregularOf(form, irregular, has)) add(k);
  for (const k of bySuffix(form, VERB_RULES, has)) add(k);
  if (!exact) for (const k of bySuffix(form, NOUN_ADJ_RULES, has)) add(k);
  return out;
}

export function resolveForm(form, has, irregular) {
  let heads = lemmas(form, has, irregular);
  if (heads.length === 0 && form.includes("'")) {
    const whole = CONTRACTIONS[form];
    if (whole && has(whole)) heads = [whole];
    else {
      const clitic = CLITICS.find((c) => form.endsWith(c) && form.length > c.length);
      if (clitic) heads = lemmas(form.slice(0, -clitic.length), has, irregular);
    }
  }
  if (heads.length > 0 || !form.includes('-')) return { heads, parts: null };
  const parts = form.split('-').filter(Boolean);
  const any = parts.some((p) => resolveForm(p, has, irregular).heads.length > 0);
  return { heads: [], parts: any ? parts : null };
}
