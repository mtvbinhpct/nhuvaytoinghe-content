// Khoá, băm và ứng viên tra cứu của từ điển Pāli. DÙNG CHUNG cho script build
// (scripts/dict/build-dict.mjs) và trình duyệt (lookup.ts): hai bên lệch nhau
// một ký tự là tra trượt, nên KHÔNG được có bản thứ hai của các hàm này.

export const DICT_VERSION = "v8";
export const SHARD_COUNT = 4096;

const encoder = new TextEncoder();

/** Chuẩn hoá một từ thành khoá tra: chữ thường, bỏ nháy, ṁ/ṅ → ṃ.
 * @param {string} word
 * @returns {string} */
export function dictKey(word) {
  return word
    .toLowerCase()
    .replace(/['’‘"“”]/g, "")
    .replace(/ṁ/g, "ṃ")
    .replace(/ṅ/g, "ṃ");
}

/** FNV-1a 32-bit trên byte UTF-8. Dùng chung cho mảnh Pāli và mảnh Anh.
 * @param {string} key
 * @returns {number} */
export function fnv1a(key) {
  let h = 0x811c9dc5;
  for (const b of encoder.encode(key)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** @param {string} key @returns {number} */
export function shardOf(key) {
  return fnv1a(key) % SHARD_COUNT;
}

/** @param {number} n @returns {string} */
export function shardName(n) {
  return `${String(n).padStart(4, "0")}.json`;
}

/** @param {string} key @returns {string} */
export function shardPath(key) {
  return `/dict/${DICT_VERSION}/${shardName(shardOf(key))}`;
}

const SHORT = { ā: "a", ī: "i", ū: "u" };

/** @param {string} k @returns {string | null} */
function shortenFinal(k) {
  const s = SHORT[/** @type {keyof typeof SHORT} */ (k.slice(-1))];
  return s ? k.slice(0, -1) + s : null;
}

/** Các khoá thử lần lượt khi tra, khoá chính đứng đầu, không trùng lặp.
 * @param {string} key
 * @returns {string[]} */
export function candidates(key) {
  /** @type {string[]} */
  const out = [key];
  /** @param {string | null} c */
  const add = (c) => {
    if (c && !out.includes(c)) out.push(c);
  };
  add(shortenFinal(key));
  // "-ṃ" đứng trước ngoặc kép bị viết thành "-n" ("pācittiyan”ti").
  if (key.endsWith("n") && key.length > 1) add(`${key.slice(0, -1)}ṃ`);
  if (key.endsWith("nti") && key.length > 4) add(`${key.slice(0, -3)}ṃ`);
  if (key.endsWith("ti") && key.length > 3) {
    const base = key.slice(0, -2);
    add(base);
    add(shortenFinal(base));
  }
  // Ngoặc kép hay thẻ cắt "ti"/"nti" khỏi thân từ. Thử sau cùng, chỉ khi các
  // dạng trên đều trượt:
  //   "‘‘videharaṭṭha’’nti" = videharaṭṭhaṃ + iti → thêm ṃ (chỉ sau a/i/u);
  //   "‘‘aparantajanapado’’ti", "‘‘…bhāvan’’ti" → nối lại "ti" (DPD có dòng
  //   tách cho cả cụm); "‘‘anurūpamida’’nti" → nối lại "nti".
  if (!key.endsWith("ti") && key.length > 1) {
    if (/[aiu]$/.test(key)) add(`${key}ṃ`);
    if (/[aāiīuūeon]$/.test(key)) add(`${key}ti`);
    if (/[aiu]$/.test(key)) add(`${key}nti`);
  }
  return out;
}
