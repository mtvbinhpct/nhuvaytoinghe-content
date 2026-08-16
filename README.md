# Như Vầy Tôi Nghe — content packs

Kho phát hành **dữ liệu offline** cho ứng dụng di động [Như Vầy Tôi Nghe](https://nhuvaytoinghe.vercel.app)
— kinh tạng Pāli cùng bản dịch tiếng Việt.

Repo này **không chứa mã nguồn**, chỉ dùng phần Releases để phát hành các gói dữ liệu
mà app tải về lần đầu rồi đọc offline. Gói được sinh từ cơ sở dữ liệu của dự án bằng
`scripts/mobile/build_content_pack.py` (nằm ở repo mã nguồn).

## Các gói

| Gói | Nội dung |
|---|---|
| `otk-core-vN.db.gz` | Chánh tạng: bài kinh, segment Pāli–Việt–Anh, bản dịch nguyên bài, chỉ mục tìm kiếm, lộ trình học pháp |
| `otk-commentary-vN.db.gz` | Chú giải (aṭṭhakathā/ṭīkā), cả Pāli lẫn tiếng Việt |

Mỗi gói là một cơ sở dữ liệu SQLite đã nén gzip. App đọc `manifest.json`
(đặt riêng) để biết phiên bản, dung lượng và sha256 trước khi tải.

## Nguồn bản dịch

- **Thích Minh Châu** — Trường Bộ, Trung Bộ, Tương Ưng, Tăng Chi, một phần Tiểu Bộ
- **Bhikkhu Indacanda** — Tạng Luật và nhiều tập Tiểu Bộ
- **Trần Phương Lan** — một phần Tiểu Bộ
- **Bhikkhu Bodhi** — bản tiếng Anh
- Pāli: Mahāsaṅgīti Tipiṭaka

Bản quyền từng bản dịch được ghi kèm trong dữ liệu (`license`, `copyright_notice`)
và hiển thị ở chân mỗi bài trong app. Phần lớn thuộc diện *permission-required* —
sử dụng theo sự cho phép của đơn vị giữ bản quyền, vui lòng tôn trọng điều đó.
