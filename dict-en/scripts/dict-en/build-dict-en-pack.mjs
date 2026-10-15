// Đóng gói từ điển Anh–Việt cho app mobile: đọc các mảnh JSON của web
// (web/public/dict-en/<EN_DICT_VERSION>/, sinh bởi build-dict-en.mjs) và ghi một
// tệp SQLite riêng (gói otk-dict-en, khoá manifest `dict_en`). Dữ liệu GPLv2:
// gói luôn tải tách rời, không nhúng vào app (spec 2026-10-14 §6.2, §8).
//
//   node scripts/dict-en/build-dict-en-pack.mjs --version 1 \
//     --url-base https://github.com/mtvbinhpct/nhuvaytoinghe-content/releases/download/dict-en-pack-v1
//
// Ra build/content-packs/otk-dict-en-v<N>.db(.gz) và cập nhật mục `dict_en` trong
// build/content-packs/manifest.json (curl manifest live về đó TRƯỚC khi chạy).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import zlib from 'node:zlib';
import { EN_DICT_VERSION } from '../../web/lib/dict/en-key.mjs';

/** Mục OVDP và mục thuật ngữ trùng nhau giữa các dạng từ chỉ lưu MỘT lần (`head`,
 *  `gloss`); `form.h`/`form.g` là danh sách id theo thứ tự. */
export function buildEnPackDb(shardDir, outDb, info) {
  fs.rmSync(outDb, { force: true });
  const db = new DatabaseSync(outDb);
  db.exec(`
    CREATE TABLE head(id INTEGER PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE gloss(id INTEGER PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE form(key TEXT PRIMARY KEY, h TEXT, g TEXT, p TEXT) WITHOUT ROWID;
    CREATE TABLE pack_info(k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
  const intern = (table) => {
    const ins = db.prepare(`INSERT INTO ${table} VALUES (?, ?)`);
    const ids = new Map();
    return {
      ids,
      id(value) {
        const v = JSON.stringify(value);
        let id = ids.get(v);
        if (id === undefined) {
          id = ids.size + 1;
          ids.set(v, id);
          ins.run(id, v);
        }
        return id;
      },
    };
  };
  const heads = intern('head');
  const glosses = intern('gloss');
  const insForm = db.prepare('INSERT INTO form VALUES (?, ?, ?, ?)');
  let forms = 0;
  db.exec('BEGIN');
  for (const name of fs.readdirSync(shardDir).sort()) {
    if (!name.endsWith('.json')) continue;
    const shard = JSON.parse(fs.readFileSync(path.join(shardDir, name), 'utf8'));
    for (const [key, rec] of Object.entries(shard)) {
      insForm.run(
        key,
        rec.h ? rec.h.map((e) => heads.id(e)).join(',') : null,
        rec.g ? rec.g.map((g) => glosses.id(g)).join(',') : null,
        rec.p ? JSON.stringify(rec.p) : null,
      );
      forms++;
    }
  }
  const insInfo = db.prepare('INSERT INTO pack_info VALUES (?, ?)');
  insInfo.run('en_dict_version', info.enDictVersion);
  insInfo.run('built_at', info.builtAt);
  insInfo.run('forms', String(forms));
  insInfo.run('heads', String(heads.ids.size));
  insInfo.run('glosses', String(glosses.ids.size));
  db.exec('COMMIT');
  db.exec('VACUUM');
  db.close();
  return { forms, heads: heads.ids.size, glosses: glosses.ids.size };
}

/** Ghi mục `dict_en`, giữ nguyên mọi mục khác của manifest. */
export function updateManifest(manifestPath, entry) {
  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  manifest.dict_en = entry;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

function main() {
  const version = Number(arg('version'));
  const urlBase = arg('url-base');
  if (!Number.isInteger(version) || version < 1 || !urlBase) {
    console.error('Dùng: build-dict-en-pack.mjs --version N --url-base URL');
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const shardDir = path.join(root, 'web/public/dict-en', EN_DICT_VERSION);
  const outDir = path.join(root, 'build/content-packs');
  fs.mkdirSync(outDir, { recursive: true });
  const outDb = path.join(outDir, `otk-dict-en-v${version}.db`);
  const stat = buildEnPackDb(shardDir, outDb, {
    enDictVersion: EN_DICT_VERSION,
    builtAt: new Date().toISOString(),
  });
  const raw = fs.readFileSync(outDb);
  const gz = zlib.gzipSync(raw, { level: 9 });
  const gzName = `otk-dict-en-v${version}.db.gz`;
  fs.writeFileSync(path.join(outDir, gzName), gz);
  const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
  updateManifest(path.join(outDir, 'manifest.json'), {
    url: `${urlBase.replace(/\/+$/, '')}/${gzName}`,
    version,
    bytes: gz.length,
    sha256,
  });
  console.log({ ...stat, dbBytes: raw.length, gzBytes: gz.length, sha256 });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
