# 🎯 HƯỚNG DẪN TEST TRỰC QUAN GIAO DIỆN (LUỒNG 5 - 6 - 7)
### Hệ thống: AI Project & Productivity System
**Phân hệ:** Member 2 — *Team Tracking & Bottleneck Detection*  
**Công nghệ:** Next.js 16 (Giao diện web) + n8n (Tự động hóa) + PostgreSQL (Cơ sở dữ liệu)

---

## 🖥️ CHUẨN BỊ MÀN HÌNH DEMO (Mở 2 Tab song song)

Để thầy cô theo dõi trực quan nhất, bạn hãy mở 2 tab trình duyệt cạnh nhau:
* **Tab Trái (Giao diện người dùng):** [`http://localhost:3000`](http://localhost:3000) (Kanban Board)
* **Tab Phải (Hệ thống n8n):** [`http://localhost:5678`](http://localhost:5678) (Các Workflow tự động)

---

## 🎬 LUỒNG 5: REALTIME STATUS TRACKER (Theo dõi trạng thái thời gian thực)
> **Ý nghĩa thực tế:** Khi lập trình viên thao tác trên bảng Kanban, hệ thống ngay lập tức bắt sự kiện Webhook, ghi lại nhật ký hoạt động (Audit log) và tự động tính toán thời gian hoàn thành (Lead Time).

### 🖱️ Các bước thao tác trực tiếp trên giao diện:

#### Bước 1: Tạo một Task mới ngay trên Web
1. Tại tab Web ([`http://localhost:3000`](http://localhost:3000)), bấm vào nút màu tím **`+ Thêm Task`** (ở góc trên bên phải, cạnh ô chọn Dự án).
2. Một hộp thoại hiện ra, bạn điền nhanh:
   * **Tiêu đề task:** `Tích hợp cổng thanh toán VNPay`
   * **Người thực hiện:** Chọn `Van Huy`
   * **Độ ưu tiên:** Chọn `HIGH`
   * **Hạn chót:** Chọn một ngày bất kỳ trong tương lai.
3. Bấm **`Tạo Task`**.
   * 👀 **Quan sát thấy ngay:** Một thẻ Task mới tinh xuất hiện ngay ở cột **📝 To Do (Cần làm)**.

#### Bước 2: Kéo thả chuột đổi trạng thái (Bắt đầu làm task)
1. Dùng chuột **kéo thả (Drag & Drop)** thẻ task `Tích hợp cổng thanh toán VNPay` từ cột **To Do** sang cột **In Progress (Đang làm)**.
2. 👀 **Quan sát trên màn hình Web:**
   * Thông báo màu xanh lá *"Đã cập nhật trạng thái"* hiện lên ở góc phải.
   * Thẻ task đã nằm gọn gàng bên cột **In Progress**.
   * Nhìn xuống phần **Activity History** ở đáy trang: Lập tức xuất hiện một dòng log mới:
     > *"Van Huy đã chuyển trạng thái từ TODO ➔ IN_PROGRESS"*

#### Bước 3: Kiểm chứng Webhook tự động trên n8n
1. Chuyển sang Tab n8n, mở workflow **`Flow 5 - Realtime Status Tracker`**.
2. Bấm vào tab **`Executions`** ở thanh trên cùng.
3. 👀 **Quan sát:** Xuất hiện một dòng thực thi thành công màu xanh lá **`✓ Success`** vừa chạy cách đây vài giây.
   * Bấm vào xem execution: Dữ liệu JSON `task_id`, `old_status: "TODO"`, `new_status: "IN_PROGRESS"` đã được truyền từ Web sang n8n trơn tru không lỗi.

---

## 🎬 LUỒNG 6: STUCK TASK DETECTION (Radar cảnh báo Task bị kẹt > 24h)
> **Ý nghĩa thực tế:** Trong nhóm làm việc, có những task "ngâm" nhiều ngày không ai động tới nhưng vẫn để trạng thái đang làm. Cron job của Luồng 6 tự động rà soát, phát hiện và bật đèn đỏ cảnh báo trực tiếp trên màn hình quản lý.

### 🖱️ Các bước thao tác trực tiếp trên giao diện:

#### Bước 1: Kích hoạt radar quét trên n8n
*(Trong thực tế Luồng 6 chạy tự động theo lịch Cron 2 tiếng/lần; khi demo ta kích hoạt bằng tay để thầy cô thấy ngay kết quả)*
1. Tại Tab n8n, mở workflow **`Flow 6 - Stuck Task Detection`**.
2. Bấm vào nút màu cam **`Test workflow`** (hoặc nút Play của node đầu tiên).
3. 👀 **Quan sát:** Các node n8n chạy sáng đèn xanh lần lượt:
   * Node quét Database tìm thấy các task không có hoạt động quá 24h.
   * Node phân loại mức độ nghiêm trọng: Task kẹt trên 72h ➔ Gắn nhãn `CRITICAL`.
   * Node cuối cùng cập nhật cờ `is_bottleneck = true` vào cơ sở dữ liệu.

#### Bước 2: Quan sát cảnh báo đỏ xuất hiện trên giao diện Web
1. Quay lại Tab Web ([`http://localhost:3000`](http://localhost:3000)), bấm **`F5`** (Tải lại trang).
2. 👀 **Quan sát thấy ngay:**
   * Ngay dưới 4 cột Kanban xuất hiện một khung cảnh báo nổi bật màu đỏ-cam:
     > **🚨 Stuck Task Alert (Luồng 6 – Cron)**  
     > Hiển thị các task bị kẹt:
     > * Thẻ task: `"Tối ưu query database chậm"`
     > * Huy hiệu đỏ: **`CRITICAL`**
     > * Thời gian bị ngâm: **`3d 0h`** (Kẹt 3 ngày không có cập nhật).

---

## 🎬 LUỒNG 7: AI BOTTLENECK DIAGNOSTIC (Bác sĩ AI chẩn đoán & đề xuất giải pháp)
> **Ý nghĩa thực tế:** Nếu Luồng 6 chỉ phát hiện "ở đâu có tắc nghẽn", thì Luồng 7 đóng vai trò "Bác sĩ trưởng khoa": Gom toàn bộ dữ liệu dự án, phân tích 4 nhóm nguyên nhân gốc rễ (task trễ hạn, quá tải nhân sự, lệch tải công việc) và gọi AI Gemini đưa ra giải pháp điều chuyển cụ thể.

### 🖱️ Các bước thao tác trực tiếp trên giao diện:

#### Bước 1: Kích hoạt Chẩn đoán AI trên n8n
1. Tại Tab n8n, mở workflow **`Flow 7 - AI Bottleneck Diagnostic`**.
2. Bấm vào nút màu cam **`Test workflow`**.
3. 👀 **Quan sát dòng chảy thông minh của Luồng 7:**
   * Node `HTTP - Collect All Data`: Gọi API gom toàn bộ task, deadline và thành viên dự án.
   * Node `Code - Analyze Bottlenecks`: Thuật toán tự động phát hiện các nguy cơ:
     + Có task quá hạn (Overdue tasks)
     + Thành viên bị quá tải (Member Overload)
   * Node `HTTP - AI Analysis (Gemini)`: Gửi dữ liệu cho AI phân tích nguyên nhân cốt lõi. *(Đặc biệt: Nếu mạng mất kết nối hoặc AI quá tải, Smart Fallback tự kích hoạt giúp luồng không bao giờ bị đứt!)*
   * Node `Switch - Severity Router`: Phân loại mức độ nghiêm trọng để lưu vào Database.
   * Node cuối cùng `Code - Build Final Summary`: Chạy thành công màu xanh lá.

#### Bước 2: Xem kết quả chẩn đoán chi tiết của AI
1. Nhấp đúp chuột vào node cuối cùng **`Code - Build Final Summary`** trên màn hình n8n.
2. Nhìn sang khung **OUTPUT** bên phải: Bạn sẽ thấy bản tóm tắt phân tích hoàn chỉnh:
   * `total_issues_detected`: Tổng số điểm nghẽn phát hiện.
   * `severity_breakdown`: Số lượng theo mức độ (CRITICAL, HIGH, MEDIUM).
3. Hoặc mở tab mới vào trang tổng quan: [`http://localhost:3000/planning`](http://localhost:3000/planning) để thấy toàn bộ các khuyến nghị điều phối công việc do AI đề xuất.

---

## 🏆 TỔNG KẾT KỊCH BẢN ĐỂ NÓI VỚI GIẢNG VIÊN

| Luồng | Thao tác Demo | Kết quả nhìn thấy trực quan | Giá trị thực tế |
|---|---|---|---|
| **Luồng 5** | Bấm `+ Thêm Task` ➔ Kéo thả từ `To Do` sang `In Progress` | Toast thông báo xanh, Activity Log nhảy dòng tức thì, n8n Executions báo Success | Tự động hóa 100% nhật ký tiến độ, không cần ai phải báo cáo bằng tay. |
| **Luồng 6** | Bấm `Test workflow` trên n8n ➔ F5 Web | Khung đỏ **🚨 Stuck Task Alert** hiện ngay dưới Kanban kèm số giờ kẹt | Đóng vai trò như "Radar cảnh báo sớm", chống trôi việc, ngâm việc. |
| **Luồng 7** | Bấm `Test workflow` trên n8n ➔ Xem Summary | AI phân tích nguyên nhân gốc rễ và đề xuất cách phân bổ lại nhân sự | Đóng vai trò "Bác sĩ AI", hỗ trợ Project Manager ra quyết định chính xác. |
