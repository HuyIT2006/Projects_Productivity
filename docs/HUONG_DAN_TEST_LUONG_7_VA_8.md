# 📘 HƯỚNG DẪN KIỂM THỬ VÀ ĐÁNH GIÁ LUỒNG 7 & 8
### Dự án: AI Project & Productivity System
**Phụ trách:** Thành viên 2 (VanHuy) — *Team Tracking & Bottleneck Detection*  
**Hai luồng triển khai:**
- **Luồng 7:** `AI Bottleneck Diagnostic` (Chẩn đoán tắc nghẽn dự án bằng AI)
- **Luồng 8:** `Member Productivity Scoring (Cron)` (Chấm điểm năng suất thành viên định kỳ)

---

## 📑 MỤC LỤC
1. [Đánh giá độ bám sát của Luồng 7 & 8 với dự án](#1-đánh-giá-độ-bám-sát-của-luồng-7--8-với-dự-án)
2. [Chi tiết Luồng 7: AI Bottleneck Diagnostic](#2-chi-tiết-luồng-7-ai-bottleneck-diagnostic)
   - Ý nghĩa từng Node trong n8n (23 nodes)
   - Kết quả mong muốn (Expected Output)
   - Hướng dẫn các bước kiểm thử End-to-End
3. [Chi tiết Luồng 8: Member Productivity Scoring](#3-chi-tiết-luồng-8-member-productivity-scoring)
   - Ý nghĩa từng Node trong n8n (20 nodes)
   - Kết quả mong muốn (Expected Output)
   - Hướng dẫn các bước kiểm thử End-to-End
4. [Các trường hợp kiểm thử biên (Edge Cases & Fallbacks)](#4-các-trường-hợp-kiểm-thử-biên-edge-cases--fallbacks)
5. [Tổng kết tài nguyên & đường dẫn file](#5-tổng-kết-tài-nguyên--đường-dẫn-file)

---

## 1. ĐÁNH GIÁ ĐỘ BÁM SÁT CỦA LUỒNG 7 & 8 VỚI DỰ ÁN

Hệ thống của Member 2 quản trị 4 luồng có mối liên hệ nhân - quả khép kín:
```
  [Luồng 5: Realtime Tracker] 
          │ (ghi nhận Lead Time, Cycle Time khi task DONE)
          ▼
  [Luồng 6: Stuck Task Alert] 
          │ (bật cờ is_bottleneck = true, ghi STUCK_ALERT vào activity_history)
          ▼
  [Luồng 7: AI Bottleneck Diagnostic] ◄── Đọc cờ bottleneck, task quá hạn, tải member
          │ (phân tích Root Cause, mức độ Severity, đề xuất giải pháp vào PostgreSQL)
          ▼
  [Luồng 8: Member Productivity Scoring] ◄── Đọc Lead Time (L5), Stuck (L6), Bottleneck (L7)
            (chấm điểm 4 thành phần, xếp hạng, cập nhật ngược lại members.productivity_score)
```

### ✅ Bảng đối chiếu tính bám sát:

| Tiêu chí | Hiện trạng thiết kế & triển khai | Đánh giá |
| :--- | :--- | :--- |
| **Bám sát cấu trúc Database** | - Luồng 7 & 8 tận dụng toàn bộ bảng gốc: `members`, `projects`, `tasks`, `task_logs`, `activity_history`.<br>- Tận dụng các trường đặc thù: `members.max_workload`, `members.productivity_score`, `tasks.is_bottleneck`, `tasks.due_date`, `tasks.story_points`.<br>- Bổ sung đúng 2 bảng chuyên biệt: `bottleneck_diagnostics` (L7) và `productivity_scores` (L8), không phá vỡ schema gốc. | **100% Khớp** |
| **Kế thừa dữ liệu Luồng 5 & 6** | - Luồng 7 phân tích chính các task mà Luồng 6 đã gắn cờ `is_bottleneck = TRUE` hoặc không đổi trạng thái > 24h.<br>- Luồng 8 tính điểm dựa trên `lead_time_hours` do Luồng 5 sinh ra, đồng thời trừ điểm nếu thành viên dính cờ `bottleneck` của Luồng 6 & 7. | **Đồng bộ tuyệt đối** |
| **Kiến trúc Next.js API** | - Không gọi trực tiếp DB từ n8n đối với logic phức tạp, mà thông qua Next.js Backend endpoints (`/collect`, `POST`, `GET`).<br>- Đáp ứng đúng chuẩn App Router (`app/api/.../route.ts`), dùng TypeScript và connection pool `pg`. | **Chuẩn kiến trúc** |
| **Môi trường Container (Docker)** | - Endpoint cấu hình chuẩn `http://host.docker.internal:3000` giúp n8n container kết nối thông suốt với máy chủ Next.js chạy trên Host. | **Sẵn sàng triển khai** |
| **An toàn trước lỗi AI** | - Cả 2 luồng đều trang bị Code Node Fallback: Nếu OpenRouter/LLM hết quota hoặc trả về cú pháp sai, n8n tự động phân tích bằng luật logic cục bộ, đảm bảo pipeline không bao giờ bị đứt quãng. | **Khả năng chịu lỗi cao** |

---

## 2. CHI TIẾT LUỒNG 7: AI BOTTLENECK DIAGNOSTIC

* **Mục tiêu:** Quét toàn bộ hệ thống, phát hiện điểm nghẽn (task kẹt, trễ hạn, lệch tải thành viên), phân tích nguyên nhân gốc rễ và đề xuất hành động khắc phục lưu vào DB.
* **File workflow:** `n8n-workflows/member-2/flow-7-ai-bottleneck-diagnostic.json`
* **Số lượng nodes:** **23 nodes**.

### 2.1. Ý nghĩa chi tiết từng Node trong n8n

| STT | Tên Node | Loại Node | Ý nghĩa & Chức năng cụ thể trong dự án |
| :---: | :--- | :--- | :--- |
| **1** | `Schedule - Every 4 Hours` | `scheduleTrigger` | Định thời chạy tự động 4 tiếng một lần (quét định kỳ trong ngày làm việc). |
| **2** | `Manual Trigger` | `manualTrigger` | Cho phép PM/Tester bấm chạy ngay lập tức trên UI n8n mà không cần đợi cron. |
| **3** | `HTTP - Collect All Data` | `httpRequest` | Gửi `GET` đến `/api/diagnostics/collect`. Lấy toàn bộ: Tasks, Members, Stuck Tasks (>24h), Overdue Tasks, Project Health và các chẩn đoán đã tạo gần đây để tránh trùng lặp. |
| **4** | `IF - Has Data` | `if` | Kiểm tra tổng số task (`total_tasks > 0`). Nếu DB rỗng hoặc dự án mới tạo chưa có việc thì chuyển nhánh. |
| **5** | `Code - Analyze Bottlenecks` | `code` | **Trọng tâm tiền xử lý:**<br>- Phân loại 4 nhóm vấn đề: `STUCK_TASKS`, `OVERDUE_DEADLINE`, `MEMBER_OVERLOAD` (vượt `max_workload`), `WORKLOAD_IMBALANCE` (độ lệch tải giữa người cao nhất và thấp nhất).<br>- Lọc trùng: So sánh với chẩn đoán trong 6 giờ gần nhất để tránh báo lặp trừ khi mức độ nghiêm trọng tăng lên. |
| **6** | `IF - Has Issues` | `if` | Kiểm tra xem lượt quét này có phát hiện vấn đề nào cần xử lý hay không. |
| **7** | `Code - Build AI Prompt` | `code` | Định dạng context dữ liệu ngắn gọn, tạo Prompt chuẩn kỹ thuật yêu cầu LLM đóng vai Chuyên gia Quản trị Dự án, bắt buộc trả về mảng JSON thuần túy (không markdown). |
| **8** | `HTTP - AI Analysis (OpenRouter)` | `httpRequest` | Gửi prompt đến LLM (`google/gemini-2.0-flash-001` qua OpenRouter API) với `temperature: 0.3` để đảm bảo tính khách quan và nhất quán. |
| **9** | `Code - Parse AI Response` | `code` | **Lớp bảo vệ dữ liệu:**<br>- Tách lọc JSON từ text của LLM.<br>- Kiểm tra và chuẩn hóa `severity` (CRITICAL, HIGH, MEDIUM, LOW) và `diagnostic_type`.<br>- **Fallback tự động:** Nếu AI lỗi, tự sinh nội dung chẩn đoán theo dữ liệu số liệu thực tế. |
| **10** | `IF - Has Valid Diagnostics` | `if` | Xác thực danh sách chẩn đoán sau khi parse có ít nhất 1 bản ghi hợp lệ. |
| **11** | `Code - Split Diagnostics` | `code` | Tách mảng diagnostics thành các item riêng biệt để n8n đưa vào pipeline xử lý độc lập. |
| **12** | `Switch - Severity Router` | `switch` | Phân nhánh xử lý theo 4 mức độ: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. |
| **13** | `HTTP - Save Critical Diagnostic` | `httpRequest` | Gửi `POST` đến `/api/diagnostics` lưu báo cáo mức `CRITICAL` (kèm cờ `urgent: true`). |
| **14** | `HTTP - Save High Diagnostic` | `httpRequest` | Gửi `POST` đến `/api/diagnostics` lưu báo cáo mức `HIGH`. |
| **15** | `HTTP - Save Medium Diagnostic` | `httpRequest` | Gửi `POST` đến `/api/diagnostics` lưu báo cáo mức `MEDIUM`. |
| **16** | `HTTP - Save Low Diagnostic` | `httpRequest` | Gửi `POST` đến `/api/diagnostics` lưu báo cáo mức `LOW`. |
| **17** | `Merge - All Saved Results` | `merge` | Gom kết quả phản hồi từ 4 nhánh lưu trữ về một luồng duy nhất (`mode: append`). |
| **18** | `Code - Build Final Summary` | `code` | Tổng kết toàn bộ lượt chạy: số chẩn đoán tạo mới, số lỗi, thống kê số lượng theo từng mức độ nghiêm trọng. |
| **19** | `Code - No Issues Found` | `code` | Trả về thông báo thành công: "Không phát hiện bottleneck mới. Hệ thống vận hành bình thường." |
| **20** | `Code - No Data` | `code` | Trả về thông báo: "Không có dữ liệu task nào để phân tích." |
| **21** | `Code - No Valid AI Output` | `code` | Ghi log khi dữ liệu AI không trích xuất được. |
| **22** | `Error Trigger` | `errorTrigger` | Node bắt lỗi hệ thống toàn cục của n8n khi có network error hoặc crash. |
| **23** | `Code - Handle Error` | `code` | Chuẩn hóa thông điệp lỗi và node bị lỗi để phục vụ debug. |

---

### 2.2. Kết quả mong muốn (Expected Output của Luồng 7)

#### A. Đầu ra tại Node cuối cùng của n8n (`Code - Build Final Summary`):
```json
{
  "success": true,
  "flow": "flow7-ai-bottleneck-diagnostic",
  "summary": {
    "total_issues_detected": 3,
    "diagnostics_created": 3,
    "save_errors": 0,
    "ai_parse_success": true,
    "severity_breakdown": {
      "CRITICAL": 1,
      "HIGH": 1,
      "MEDIUM": 1,
      "LOW": 0
    }
  },
  "processed_at": "2026-11-13T10:00:00.000Z"
}
```

#### B. Dữ liệu được ghi vào PostgreSQL (Bảng `bottleneck_diagnostics`):
* Cột `diagnostic_type`: `STUCK_TASKS`, `OVERDUE_DEADLINE`, hoặc `MEMBER_OVERLOAD`.
* Cột `severity`: Phản ánh chính xác độ khẩn (`CRITICAL` đối với task quá hạn nhiều ngày hoặc không cập nhật > 72h).
* Cột `evidence` (JSONB): Chứa bằng chứng rõ ràng (ID task, số giờ không tương tác, tỉ lệ tải % so với `max_workload`).
* Cột `recommendations` (JSONB): Các giải pháp hành động cụ thể (ví dụ: gán lại task, tách nhỏ công việc).
* Bảng `activity_history` xuất hiện bản ghi có `action_type = 'BOTTLENECK_DIAGNOSTIC'`.

---

### 2.3. Các bước kiểm thử Luồng 7

#### Bước 1: Nạp Migration vào Database
Mở terminal chạy lệnh:
```bash
docker exec -i productivity_postgres psql -U postgres -d productivity_db < database/migration-flow7-diagnostics.sql
```
*Kiểm tra:* Lệnh `docker exec -it productivity_postgres psql -U postgres -d productivity_db -c "\d bottleneck_diagnostics"` hiển thị cấu trúc bảng thành công.

#### Bước 2: Khởi động Backend Next.js
```bash
cd apps/web
npm run dev
```
Mở trình duyệt hoặc terminal kiểm tra endpoint:
```bash
curl http://localhost:3000/api/diagnostics/collect
```
*Kỳ vọng:* Trả về JSON chứa `tasks`, `members`, `stuck_tasks`, `overdue_tasks`, `projects`.

#### Bước 3: Import Workflow vào n8n & Thiết lập API Key
1. Truy cập `http://localhost:5678`.
2. Tạo mới Workflow -> Chọn **Import from File** -> Chọn file `n8n-workflows/member-2/flow-7-ai-bottleneck-diagnostic.json`.
3. Bấm vào node **`HTTP - AI Analysis (OpenRouter)`**:
   - Tại mục **Credential for Header Auth**, chọn Credential chứa:
     - Header Name: `Authorization`
     - Header Value: `Bearer <OPENROUTER_API_KEY_CUA_BAN>`
4. Nhấn **Save**.

#### Bước 4: Kích hoạt Test
* Bấm vào nút **"Test step"** hoặc **"Test Workflow"** từ node `Manual Trigger`.
* Quan sát vệt sáng xanh chạy qua từng node:
  `HTTP Collect` ➔ `Analyze` ➔ `Build Prompt` ➔ `AI Analysis` ➔ `Parse` ➔ `Switch Severity` ➔ `HTTP Save` ➔ `Final Summary`.

#### Bước 5: Truy vấn kiểm tra Database
```bash
docker exec -it productivity_postgres psql -U postgres -d productivity_db -c \
"SELECT id, diagnostic_type, severity, title, created_at FROM bottleneck_diagnostics ORDER BY created_at DESC LIMIT 5;"
```

---

## 3. CHI TIẾT LUỒNG 8: MEMBER PRODUCTIVITY SCORING

* **Mục tiêu:** Định kỳ tổng hợp hiệu suất công việc của từng thành viên trong chu kỳ (7 ngày), tính điểm số đa chiều (0–200), xếp loại học lực/năng suất (A+ → F), nhờ AI nhận xét ưu/nhược điểm và cập nhật trực tiếp vào bảng `members`.
* **File workflow:** `n8n-workflows/member-2/flow-8-member-productivity-scoring.json`
* **Số lượng nodes:** **20 nodes**.

### 3.1. Ý nghĩa chi tiết từng Node trong n8n

| STT | Tên Node | Loại Node | Ý nghĩa & Chức năng cụ thể trong dự án |
| :---: | :--- | :--- | :--- |
| **1** | `Schedule - Every 6 Hours` | `scheduleTrigger` | Lập lịch tự động chạy mỗi 6 tiếng (cập nhật điểm năng suất mới nhất). |
| **2** | `Manual Trigger` | `manualTrigger` | Cho phép chạy kiểm thử ngay lập tức. |
| **3** | `HTTP - Collect Member Data` | `httpRequest` | Gửi `GET` đến `/api/productivity-scores/collect?period_days=7`. Thu thập trọn bộ 9 metrics hiệu suất của từng thành viên từ các bảng `task_logs`, `activity_history`, `tasks`. |
| **4** | `IF - Has Members` | `if` | Xác nhận bảng `members` có dữ liệu nhân sự (`members.length > 0`). |
| **5** | `Code - Calculate Scores` | `code` | **Thuật toán tính điểm 4 thành phần:**<br>1. **Completion (30%):** Dựa vào số task hoàn thành so với mức trung bình của team.<br>2. **Timeliness (25%):** Tỉ lệ hoàn thành đúng hạn (dựa vào `due_date` và mốc log `DONE`).<br>3. **Velocity (25%):** Story points đạt được + Thưởng nếu `lead_time < 48h`.<br>4. **Quality (20%):** Bắt đầu từ 100 điểm, phạt trừ điểm nếu có task stuck (-15đ), bottleneck (-20đ), quá hạn (-10đ).<br>- Quy đổi thang điểm **0–200**, gán Grade (A+..F), xác định Trend (IMPROVING/STABLE/DECLINING) so với kỳ trước. |
| **6** | `Code - Build AI Prompt` | `code` | Xây dựng prompt tổng hợp hiệu suất của toàn đội ngũ, yêu cầu LLM viết nhận xét chi tiết: điểm mạnh, điểm cần cải thiện và gợi ý hành động cho từng cá nhân. |
| **7** | `HTTP - AI Analysis (OpenRouter)` | `httpRequest` | Gọi OpenRouter LLM để phân tích định tính (Qualitative Assessment). |
| **8** | `Code - Parse AI & Merge` | `code` | Ghép nhận xét của AI vào bộ điểm số đã tính. Có cơ chế fallback: Nếu AI không phản hồi, tự sinh nhận xét dựa trên số liệu toán học. |
| **9** | `IF - Has Scored Members` | `if` | Đảm bảo danh sách sau tính toán và đánh giá AI có dữ liệu hợp lệ. |
| **10** | `Code - Split Members` | `code` | Tách danh sách thành viên ra từng phần tử độc lập để định tuyến theo dõi. |
| **11** | `Switch - Score Trend` | `switch` | Phân loại theo xu hướng biến động điểm: `DECLINING` (giảm ≥10đ), `IMPROVING` (tăng ≥10đ), `STABLE` (ổn định). |
| **12** | `HTTP - Save Declining Score` | `httpRequest` | Gửi `POST` lưu kết quả cho thành viên sụt giảm năng suất (bật cờ `needs_attention: true` để quản lý chú ý hỗ trợ). |
| **13** | `HTTP - Save Improving Score` | `httpRequest` | Gửi `POST` lưu kết quả thành viên có tiến bộ vượt bậc. |
| **14** | `HTTP - Save Stable Score` | `httpRequest` | Gửi `POST` lưu kết quả thành viên giữ phong độ ổn định. |
| **15** | `Merge - All Saved Results` | `merge` | Gom tất cả kết quả phản hồi từ 3 nhánh lưu trữ về một luồng chung. |
| **16** | `Code - Build Final Summary` | `code` | Tổng hợp báo cáo toàn team: tỉ lệ điểm số, phân bố hạng (A+, A, B,...), tỉ lệ tiến bộ/giảm sút. |
| **17** | `Code - No Members` | `code` | Trả thông báo khi hệ thống chưa có thành viên nào. |
| **18** | `Code - No Valid Scores` | `code` | Xử lý ngoại lệ dữ liệu không hợp lệ. |
| **19** | `Error Trigger` | `errorTrigger` | Bắt lỗi toàn cục của workflow. |
| **20** | `Code - Handle Error` | `code` | Báo cáo chi tiết vị trí và nội dung lỗi runtime. |

---

### 3.2. Kết quả mong muốn (Expected Output của Luồng 8)

#### A. Đầu ra tại Node cuối cùng của n8n (`Code - Build Final Summary`):
```json
{
  "success": true,
  "flow": "flow8-member-productivity-scoring",
  "summary": {
    "total_members_scored": 3,
    "save_errors": 0,
    "ai_parse_success": true,
    "grade_distribution": {
      "A": 1,
      "B+": 1,
      "C": 1
    },
    "trend_distribution": {
      "IMPROVING": 1,
      "STABLE": 2,
      "DECLINING": 0
    }
  },
  "processed_at": "2026-11-13T10:00:00.000Z"
}
```

#### B. Dữ liệu được ghi vào PostgreSQL:
1. **Bảng `productivity_scores`:**
   - Tạo mới các dòng ghi nhận chu kỳ đánh giá cho từng thành viên.
   - Lưu trữ đầy đủ 4 điểm thành phần, điểm cuối cùng `final_score`, xếp loại `score_grade` và nhận xét của AI `ai_summary`.
2. **Bảng `members`:**
   - Cột `productivity_score` của từng thành viên được cập nhật giá trị mới nhất tương ứng với `final_score`.
3. **Bảng `activity_history`:**
   - Sinh bản ghi `action_type = 'PRODUCTIVITY_SCORED'`.

---

### 3.3. Các bước kiểm thử Luồng 8

#### Bước 1: Nạp Migration vào Database
```bash
docker exec -i productivity_postgres psql -U postgres -d productivity_db < database/migration-flow8-productivity-scores.sql
```

#### Bước 2: Kiểm tra Endpoint thu thập chỉ số
```bash
curl "http://localhost:3000/api/productivity-scores/collect?period_days=7"
```
*Kỳ vọng:* Trả về thông tin của 3 thành viên mẫu (`Van Huy`, `Member 2`, `Member 3`) kèm chi tiết `tasks_completed`, `tasks_on_time`, `tasks_overdue`, `total_story_points`, `stuck_task_count`, `bottleneck_count`.

#### Bước 3: Import Workflow vào n8n
1. Mở n8n -> **Import from File** -> Chọn `n8n-workflows/member-2/flow-8-member-productivity-scoring.json`.
2. Tại node **`HTTP - AI Analysis (OpenRouter)`**, chọn Credential OpenRouter tương tự Luồng 7.
3. Bấm **Save**.

#### Bước 4: Chạy kiểm thử
* Bấm **"Test Workflow"** từ node `Manual Trigger`.
* Kiểm tra luồng chạy từ Node 1 ➔ Node 16.

#### Bước 5: Xác minh dữ liệu cập nhật trong PostgreSQL
Chạy lệnh kiểm tra đồng thời cả 2 bảng:
```bash
docker exec -it productivity_postgres psql -U postgres -d productivity_db -c \
"SELECT ps.member_id, m.full_name, ps.final_score, ps.score_grade, ps.score_trend, m.productivity_score AS synced_member_score FROM productivity_scores ps JOIN members m ON ps.member_id = m.id ORDER BY ps.created_at DESC LIMIT 3;"
```
*Kỳ vọng:* `ps.final_score` và `m.synced_member_score` phải có giá trị hoàn toàn khớp nhau!

---

## 4. CÁC TRƯỜNG HỢP KIỂM THỬ BIÊN (EDGE CASES & FALLBACKS)

Cả hai luồng đã được xây dựng sẵn kịch bản chống lỗi thực chiến:

1. **Khi OpenRouter API hết quota hoặc sai API Key:**
   - **Thử nghiệm:** Đổi tạm API key trong Header Auth thành giá trị sai.
   - **Kết quả kỳ vọng:** Node `Code - Parse AI Response` (L7) và `Code - Parse AI & Merge` (L8) tự động kích hoạt khối `catch (error)`, chuyển sang chế độ **Fallback**. Kết quả chẩn đoán và chấm điểm vẫn được tính toán từ công thức nội bộ và lưu thành công vào PostgreSQL với cờ `parse_success: false`.
2. **Khi dự án chưa có Task nào (Database mới):**
   - **Kết quả kỳ vọng:** Node `IF - Has Data` (L7) hoặc `IF - Has Members` (L8) rẽ nhánh sang `Code - No Data` / `Code - No Members`, trả về thông báo trạng thái sạch sẽ mà không báo lỗi 500.
3. **Khi không có Task nào bị tắc nghẽn (Mọi việc hoàn hảo):**
   - **Kết quả kỳ vọng:** Luồng 7 rẽ sang nhánh `Code - No Issues Found`, thông báo: *"Không phát hiện bottleneck mới. Tất cả đang hoạt động bình thường!"* và không tạo rác vào bảng `bottleneck_diagnostics`.

---

## 5. TỔNG KẾT TÀI NGUYÊN & ĐƯỜNG DẪN FILE

- **Tài liệu hướng dẫn:** [`docs/HUONG_DAN_TEST_LUONG_7_VA_8.md`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/docs/HUONG_DAN_TEST_LUONG_7_VA_8.md)
- **Workflows n8n:**
  - Luồng 7: [`n8n-workflows/member-2/flow-7-ai-bottleneck-diagnostic.json`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/n8n-workflows/member-2/flow-7-ai-bottleneck-diagnostic.json) (23 nodes)
  - Luồng 8: [`n8n-workflows/member-2/flow-8-member-productivity-scoring.json`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/n8n-workflows/member-2/flow-8-member-productivity-scoring.json) (20 nodes)
- **Migrations Database:**
  - Luồng 7: [`database/migration-flow7-diagnostics.sql`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/database/migration-flow7-diagnostics.sql)
  - Luồng 8: [`database/migration-flow8-productivity-scores.sql`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/database/migration-flow8-productivity-scores.sql)
- **Next.js Backend API Routes:**
  - Diagnostics: [`apps/web/app/api/diagnostics/route.ts`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/apps/web/app/api/diagnostics/route.ts) & [`collect/route.ts`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/apps/web/app/api/diagnostics/collect/route.ts)
  - Productivity Scores: [`apps/web/app/api/productivity-scores/route.ts`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/apps/web/app/api/productivity-scores/route.ts) & [`collect/route.ts`](file:///home/huydieu06/Năm_3_HK1/ai-project-productivity-system/apps/web/app/api/productivity-scores/collect/route.ts)

