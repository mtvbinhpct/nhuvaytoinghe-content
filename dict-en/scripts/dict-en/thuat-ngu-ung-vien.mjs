// Đề xuất ứng viên thuật ngữ Phật học Anh → Việt. Một lần, có người duyệt (§4.2).
//   node scripts/dict-en/thuat-ngu-ung-vien.mjs
// Ra data/en-vi/thuat-ngu-ung-vien.tsv: en, pali, dice, both, freq, ovdp,
// pali_vi, minh_chau, toat_yeu — sắp theo freq giảm dần.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { candidates, dictKey, shardName, shardOf, SHARD_COUNT, DICT_VERSION } from '../../web/lib/dict/key.mjs';
import { enKey } from '../../web/lib/dict/en-key.mjs';
import { resolveForm } from './forms.mjs';
import { buildEntries, loadPatches, readStarDict } from './ovdp.mjs';
import { plainText, tokenize } from './tokens.mjs';

export const dice = (both, a, b) => (2 * both) / (a + b);

export function parsePhuLuc(md) {
  const out = new Map();
  for (const line of md.split('\n')) {
    if (!line.startsWith('|') || line.includes('⚠') || line.startsWith('|---')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || !cells[0].startsWith('*')) continue;
    const pali = cells[0].replace(/\*/g, '').split('/')[0].trim();
    const toatYeu = cells[2].replace(/\s*\([^)]*\)\s*$/, '').trim();
    out.set(pali, { minhChau: cells[1], toatYeu });
  }
  return out;
}

export function pickPairs(rows, { topN, minBoth, minDice }) {
  const cE = new Map();
  const cP = new Map();
  const cEP = new Map();
  const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of rows) {
    const es = new Set(r.en);
    const ps = new Set(r.pali);
    es.forEach((e) => inc(cE, e));
    ps.forEach((p) => inc(cP, p));
    for (const e of es) for (const p of ps) inc(cEP, `${e}\u0000${p}`);
  }
  const top = new Set([...cE].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([e]) => e));
  const best = new Map();
  for (const [k, both] of cEP) {
    const [e, p] = k.split('\u0000');
    if (!top.has(e) || both < minBoth) continue;
    const d = dice(both, cE.get(e), cP.get(p));
    if (d < minDice) continue;
    const cur = best.get(e);
    if (!cur || d > cur.dice) best.set(e, { en: e, pali: p, dice: d, both, freq: cE.get(e) });
  }
  return [...best.values()].sort((a, b) => b.freq - a.freq);
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const shardDir = path.join(root, 'web/public/dict', DICT_VERSION);
  const shards = Array.from({ length: SHARD_COUNT }, (_, n) =>
    JSON.parse(fs.readFileSync(path.join(shardDir, shardName(n)), 'utf8')),
  );
  const paliHead = (word) => {
    const key = dictKey(word);
    for (const k of key ? candidates(key) : []) {
      const rec = shards[shardOf(k)][k];
      if (!rec?.h?.length) continue;
      // Ưu tiên mục DPD trùng đúng khoá (taṇhā → "taṇhā 1", không phải tính từ "taṇha").
      const strip = (h) => h[0].replace(/ \d+(\.\d+)?$/, '');
      const hit = rec.h.find((h) => strip(h) === k) ?? rec.h[0];
      return { head: strip(hit), vi: hit[2] };
    }
    return null;
  };
  const dict = buildEntries(
    readStarDict(path.join(root, 'data/en-vi/stardict_en_vi/en_vi')),
    loadPatches(path.join(root, 'data/en-vi/patches.tsv')),
  );
  const has = (k) => dict.entries.has(k);
  const lemma = (t) => {
    const k = enKey(t);
    return resolveForm(k, has, dict.irregular).heads[0] ?? k;
  };
  const paliVi = new Map();
  const rows = [];
  for (const name of ['nhuvaytoinghe-sutta.db', 'nhuvaytoinghe-vinaya.db']) {
    const db = new DatabaseSync(path.join(root, name), { readOnly: true });
    for (const { en, pali } of db.prepare("SELECT en, pali FROM segment WHERE en <> '' AND pali <> ''").all()) {
      const ps = [];
      for (const t of tokenize(plainText(pali))) {
        const h = paliHead(t);
        if (h) {
          ps.push(h.head);
          paliVi.set(h.head, h.vi);
        }
      }
      rows.push({ en: tokenize(plainText(en)).map(lemma), pali: ps });
    }
    db.close();
  }
  const phuLuc = parsePhuLuc(fs.readFileSync(path.join(root, 'docs/toat-yeu/thuat-ngu-phu-luc.md'), 'utf8'));
  const pairs = pickPairs(rows, { topN: 5000, minBoth: 5, minDice: 0.3 });
  const firstSense = (k) => dict.entries.get(k)?.[2]?.[0]?.[1]?.[0] ?? '';
  const lines = ['en\tpali\tdice\tboth\tfreq\tovdp\tpali_vi\tminh_chau\ttoat_yeu'];
  for (const p of pairs) {
    const pl = phuLuc.get(p.pali);
    lines.push([p.en, p.pali, p.dice.toFixed(3), p.both, p.freq, firstSense(p.en), paliVi.get(p.pali) ?? '', pl?.minhChau ?? '', pl?.toatYeu ?? ''].join('\t'));
  }
  fs.writeFileSync(path.join(root, 'data/en-vi/thuat-ngu-ung-vien.tsv'), `${lines.join('\n')}\n`);
  console.log(`${pairs.length} ứng viên`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
