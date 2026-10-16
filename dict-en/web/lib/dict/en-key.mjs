// Khoá và mảnh của từ điển Anh–Việt. DÙNG CHUNG cho script build
// (scripts/dict-en/build-dict-en.mjs) và trình duyệt (lookup-en.ts). Bản Dart:
// mobile/lib/features/dict/dict_en_key.dart, khoá chặt bằng
// mobile/test/fixtures/dict_en_key_cases.json.
import { fnv1a } from "./key.mjs";

export const EN_DICT_VERSION = "v2";
export const EN_SHARD_COUNT = 256;

/** @param {string} word @returns {string} */
export function enKey(word) {
  return word.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/^'+|'+$/g, "");
}

/** @param {string} key @returns {string[]} */
export function enCandidates(key) {
  const out = [key];
  if (key.endsWith("'s") && key.length > 2) out.push(key.slice(0, -2));
  return out;
}

/** @param {string} key @returns {number} */
export function enShardOf(key) {
  return fnv1a(key) % EN_SHARD_COUNT;
}

/** @param {number} n @returns {string} */
export function enShardName(n) {
  return `${String(n).padStart(3, "0")}.json`;
}

/** @param {string} key @returns {string} */
export function enShardPath(key) {
  return `/dict-en/${EN_DICT_VERSION}/${enShardName(enShardOf(key))}`;
}
