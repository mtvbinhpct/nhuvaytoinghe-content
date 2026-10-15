# Nguồn dữ liệu từ điển Anh–Việt

Đầu vào của `scripts/dict-en/build-dict-en.mjs` (đầu ra: `web/public/dict-en/<phiên bản>/`).

| Tệp | Nguồn | Trong git |
|---|---|---|
| `stardict_en_vi/` | OVDP `Stardict/English/AnhViet.zip` (FVDP – Hồ Ngọc Đức), GPLv2 | **Không** |
| `patches.tsv` | Vá lỗi mã hoá VNI của OVDP (mất ơ/ã), cột `headword	sai	đúng` | Có |
| `thuat-ngu.tsv` | Lớp thuật ngữ Phật học của dự án, cột `en	vi	pali	note	src` | Có |
| `COPYING` | Toàn văn GPLv2 | Có |

## Tải lại nguồn

```bash
cd data/en-vi
curl -L -o AnhViet.zip "https://downloads.sourceforge.net/project/ovdp/Stardict/English/AnhViet.zip"
unzip -o AnhViet.zip && rm AnhViet.zip
```

sha256 của `AnhViet.zip` đã dùng: `6ff1508004311e916993b4eb84580cee910c89d682028d387763f7f85fc9c442`.

## Giấy phép

Phần dữ liệu Anh–Việt (mảnh `web/public/dict-en/`, gói `otk-dict-en`) phát hành
theo GPLv2. Mã dựng và các bảng ở thư mục này được chép sang repo content
(`mtvbinhpct/nhuvaytoinghe-content`, thư mục `dict-en/`) mỗi lần phát hành gói.
Chủ dự án kiểm giấy phép gốc của FVDP trước khi phát hành.

Mỗi lần sinh lại dữ liệu phải tăng `EN_DICT_VERSION` trong `web/lib/dict/en-key.mjs`.
