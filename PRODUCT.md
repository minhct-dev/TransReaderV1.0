# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sinh viên, lập trình viên, nghiên cứu sinh và người học ngoại ngữ—đặc biệt người học tiếng Anh, Nhật, Trung và Việt—đọc tài liệu chuyên ngành, sách báo, ebook hoặc tài liệu kỹ thuật bằng ngôn ngữ nước ngoài.

## Product Purpose

TransReader giúp người dùng đọc hiểu liên tục trong tài liệu ngoại ngữ mà không phải rời ứng dụng để mở Google Translate, tra từ điển riêng hoặc sao chép thủ công từ vựng. Thành công được đo bằng phản hồi gần như tức thì, thao tác đơn giản không gây xao nhãng, và cảm giác đọc liền mạch.

## Positioning

TransReader là trình đọc tài liệu có tra cứu theo ngữ cảnh không chặn luồng đọc: bôi đen một từ để xem từ điển chi tiết, hoặc bôi đen một đoạn để dịch song ngữ ngay tại con trỏ. Dữ liệu cache và từ vựng được lưu cục bộ để tra cứu đã lưu không cần Internet.

## Operating Context

Người dùng mở và đọc tài liệu dài, bôi đen từ hoặc đoạn ngay trong trang đọc, xem kết quả tại popover, nghe phát âm, lưu từ vào danh sách học và tiếp tục đọc. Popover tự biến mất khi click ra ngoài và không chiếm dụng không gian đọc. Ứng dụng là desktop cross-platform cho Windows, macOS và Linux.

## Capabilities and Constraints

- Hỗ trợ PDF, EPUB, TXT và Markdown (.md).
- Từ điển dùng Free Dictionary API kết hợp cache SQLite với chỉ mục B-tree.
- Dịch dùng Google Translate GTX endpoint, cho phép chuyển đổi ngôn ngữ đích vi, en, zh và ja.
- Từ vựng, lịch sử đọc và cache lưu hoàn toàn trong SQLite cục bộ.
- Tra cứu từ đã cache hoạt động không cần Internet.
- Local-first: mục tiêu cache lookup dưới 5ms và UI phải phản hồi bằng skeleton loader khi đang tải.
- Không thu thập dữ liệu cá nhân hoặc lịch sử đọc sách.
- Backend: Rust, Tauri v2, SQLite (rusqlite), reqwest.
- Frontend: React, TypeScript và Tailwind CSS.

## Brand Commitments

Tên sản phẩm là TransReader. Triết lý sản phẩm: Minimalist, High-Performance và Developer/Learner Friendly.

## Evidence on Hand

- Mã nguồn hiện có trong `src/` và `src-tauri/`.
- Tài liệu hướng dẫn chạy tại `README.md`.
- Chưa có testimonial, benchmark công khai hoặc nội dung marketing được xác nhận; không được tự tạo các bằng chứng này.

## Product Principles

1. Giữ luồng đọc liền mạch và không chặn ngữ cảnh.
2. Ưu tiên phản hồi tức thì và tốc độ local-first.
3. Đưa đúng công cụ vào đúng vị trí người dùng đang đọc.
4. Giảm tối đa xao nhãng và yêu cầu chuyển ngữ cảnh.
5. Bảo vệ dữ liệu đọc và từ vựng bằng lưu trữ cục bộ.

## Accessibility & Inclusion

Ưu tiên giao diện dễ sử dụng, thao tác chạm là dùng và hỗ trợ người học nhiều ngôn ngữ. Các tiêu chuẩn trợ năng cụ thể chưa được xác nhận; cần giữ tương tác bàn phím, focus rõ ràng, nhãn accessible và tương phản đạt chuẩn trong các surface sau.
