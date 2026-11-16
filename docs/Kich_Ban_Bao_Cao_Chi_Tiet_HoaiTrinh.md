# 📋 TÀI LIỆU TRÌNH BÀY & BẢO VỆ ĐỒ ÁN (MEMBER 1)
**Sinh viên thực hiện**: Hoài Trinh  
**Phân hệ**: Planning & Resource Allocation (Lập kế hoạch & Phân bổ nguồn lực)  
**Công nghệ sử dụng**: n8n Automation Engine + Google Gemini AI + PostgreSQL + Gmail API  
**Ví dụ thực tế xuyên suốt**: *"Xây dựng hệ thống đăng nhập bằng Google OAuth2 và bảo mật JWT"*  
*(Dự án: `a0000001-0000-0000-0000-000000000001`, Email quản lý: `htchannelas@gmail.com`)*

---

# 🎯 LỜI MỞ ĐẦU CHUNG (30 giây)

> *"Em chào Thầy/Cô, em tên là Hoài Trinh. Trong dự án AI Project & Productivity System, em phụ trách phân hệ **Planning & Resource Allocation** (Lập kế hoạch & Phân bổ nguồn lực).  
> Phân hệ của em gồm **4 Luồng tự động hóa bằng AI và thuật toán thông minh**, giải quyết trọn vẹn quy trình:  
> **Nhận yêu cầu tính năng ➔ AI bóc tách task ➔ Cân bằng tải công việc ➔ So khớp ma trận kỹ năng ➔ Tự động lên lịch thi công Sprint**.  
> Tất cả các luồng đều được thiết kế theo chuẩn bảo vệ dữ liệu, chống lỗi và ghi log kiểm toán đầy đủ."*

---

# 🟢 LUỒNG 1: AI Task Breakdown (17 Nodes)

🗣 **Lời thoại**:  
> *"Thưa Thầy/Cô, Luồng 1 giải quyết bài toán tự động bóc tách yêu cầu tính năng thành các task kỹ thuật chi tiết. Dữ liệu chạy qua 5 chặng khép kín như sau:"*

### 🔹 Chặng 1: Kiểm định & Chuẩn hóa đầu vào (Nodes 1, 2, 3, 4)
* **Node `Webhook`**: Tiếp nhận dữ liệu JSON từ Frontend:
  ```json
  {
    "project_id": "a0000001-0000-0000-0000-000000000001",
    "feature_description": "Xây dựng hệ thống đăng nhập bằng Google OAuth2 và bảo mật JWT",
    "notify_email": "htchannelas@gmail.com"
  }
  ```
* **Node `Validate Input` (IF)**: Đo độ dài `feature_description` = 65 ký tự (≥ 10 ký tự) ➔ Hợp lệ. *(Nếu chuỗi rỗng hoặc < 10 ký tự, lập tức rẽ sang node `Respond 400` báo lỗi và dừng luồng ngay để không lãng phí token AI)*.
* **Node `Prepare Input` (Code)**: Chạy Regex kiểm tra UUID và Email, cắt bỏ khoảng trắng thừa `.trim()`, giới hạn độ dài an toàn tối đa 1.000 ký tự.

### 🔹 Chặng 2: Nạp ngữ cảnh Database & Gọi AI (Nodes 5, 6, 7)
* **Node `Get Project Context` (Postgres)**: Truy vấn lấy tên dự án `"AI Productivity System"`, deadline `"2026-12-31"` và danh sách các task đã có: `["Setup Docker & PostgreSQL", "Design Kanban Board UI"]`.
* **Node `Build Prompt` (Code)**: Ghép ngữ cảnh trên vào câu lệnh yêu cầu AI: *"Không tạo trùng với task Setup Docker và Design UI... Chia tính năng Đăng nhập OAuth2 & JWT thành 3–5 task kỹ thuật dạng JSON..."*
* **Node `Gemini Breakdown` (Google Gemini)**: AI phân tích và trả về 3 task kỹ thuật:
  ```json
  [
    {"title": "Cấu hình Google Cloud Console và OAuth2", "story_points": 2, "required_skills": ["OAuth2", "DevOps"], "priority": "HIGH"},
    {"title": "Xây dựng API cấp phát & verify JWT Token", "story_points": 3, "required_skills": ["JWT", "Backend"], "priority": "URGENT"},
    {"title": "Tích hợp giao diện nút Đăng nhập Google", "story_points": 3, "required_skills": ["Next.js", "Frontend"], "priority": "MEDIUM"}
  ]
  ```

### 🔹 Chặng 3: Xử lý ngoại lệ & Chống trùng lặp (Nodes 8, 9, 10, 11)
* **Node `Parse and Validate` (Code)**: Bóc tách chuỗi JSON trả về trong khối `try/catch`. 
* **Node `Parse OK?` (IF)**: Kiểm tra JSON hợp lệ ➔ Đi tiếp. *(Nếu AI trả lỗi cú pháp, rẽ sang node `Respond 502`)*.
* **Node `Normalize and Dedupe` (Code)**: Đối chiếu 3 task mới với các task cũ trong Database ➔ Trùng lặp = 0; đồng thời chuẩn hóa `story_points` (1–8) và độ ưu tiên.

### 🔹 Chặng 4: Lưu Database & Ghi Log kiểm toán (Nodes 12, 13, 14)
* **Node `Insert Tasks` (Postgres)**: Thực thi lệnh SQL chèn 3 task vào bảng `tasks` với trạng thái `TODO` và `assignee_id = NULL`.
* **Node `Build Log SQL` & `Log Activity` (Postgres)**: Tự động ghi 3 dòng nhật ký vào bảng `activity_history` với hành động `TASK_CREATED`.

### 🔹 Chặng 5: Báo cáo & Phản hồi (Nodes 15, 16, 17)
* **Node `Build Summary` & `Send Gmail`**: Tạo bảng HTML và gửi email báo cáo về `htchannelas@gmail.com` với tiêu đề:  
  📧 *`✅ [Luồng 1] AI đã tạo 3 task mới`*.
* **Node `Respond Success`**: Phản hồi HTTP 200 kèm danh sách 3 task vừa tạo về cho màn hình người dùng.

---

# 🟢 LUỒNG 2: Smart Workload Balancer (15 Nodes)

🗣 **Lời thoại**:  
> *"Thưa Thầy/Cô, sau khi 3 task được tạo ra nhưng chưa có người nhận (`assignee_id = NULL`), Luồng 2 tự động kích hoạt để cân bằng khối lượng công việc qua 4 chặng:"*

### 🔹 Chặng 1: Thu thập & Kiểm tra task tồn đọng (Nodes 1, 2, 3, 4, 5, 6)
* **Node `Webhook` & `Prepare Input`**: Nhận tín hiệu cân bằng tải cho dự án.
* **Node `Get Unassigned Tasks` (Postgres)**: Truy vấn lấy 3 task đang có `assignee_id IS NULL`, sắp xếp theo thứ tự ưu tiên:
  1. Task `API JWT` (Ưu tiên: `URGENT`)
  2. Task `Google Cloud Console` (Ưu tiên: `HIGH`)
  3. Task `Giao diện Đăng nhập` (Ưu tiên: `MEDIUM`)
* **Node `Collect Tasks` & `Has Tasks?` (IF)**: Đếm được 3 task cần phân bổ. *(Nếu không có task nào, rẽ sang `Respond No Tasks` báo hệ thống rảnh việc)*.

### 🔹 Chặng 2: Tính toán thuật toán cân bằng tải (Nodes 7, 8)
* **Node `Get Member Workload` (Postgres)**: Đếm số task đang làm của từng thành viên:
  * `Van Huy`: Đang gánh **2/5 task** (Tải 40%).
  * `Member 2`: Đang gánh **1/5 task** (Tải 20% - **Rảnh nhất!**).
  * `Member 3`: Đang gánh **2/5 task** (Tải 40%).
* **Node `Compute Distribution` (Code)**: Thuật toán cân bằng tải tính toán phân bổ:
  * Task 1 (`URGENT`): Ưu tiên người rảnh nhất ➔ Gán cho **Member 2** (Tải tăng lên 2/5).
  * Task 2 (`HIGH`): Gán cho **Van Huy** vì có điểm năng suất cao hơn (Tải tăng lên 3/5).
  * Task 3 (`MEDIUM`): Gán cho **Member 3** (Tải tăng lên 3/5).
  * *Kết quả*: Cả 3 thành viên đều nhận việc cân đối, không ai vượt `max_workload = 5`.

### 🔹 Chặng 3: Cập nhật Database & Ghi vết sự kiện (Nodes 9, 10, 11)
* **Node `Update Assignees` (Postgres)**: Chạy lệnh SQL Batch UPDATE điền `assignee_id` vào bảng `tasks`.
* **Node `Build Log SQL` & `Log Activity` (Postgres)**: Ghi 3 dòng `TASK_ASSIGNED` vào bảng `activity_history`.

### 🔹 Chặng 4: Cảnh báo quá tải & Báo cáo (Nodes 12, 13, 14, 15, 16)
* **Node `Build Summary` & `Has Overflow?` (IF)**: Kiểm tra số task bị dồn ứ = 0 ➔ Không quá tải. *(Nếu cả đội đều đã kịch trần 5/5, node `Set Overflow Warning` sẽ kích hoạt để đổi tiêu đề email thành `⚠️ Team quá tải`)*.
* **Node `Send Gmail` & `Respond Success`**: Gửi email: 📧 *`✅ [Luồng 2] Đã gán 3 task`* kèm bảng tải mới: Huy (3/5), Member 2 (2/5), Member 3 (3/5).

---

# 🟢 LUỒNG 3: Skill Matrix Matching (19 Nodes)

🗣 **Lời thoại**:  
> *"Thưa Thầy/Cô, đối với các task đòi hỏi chuyên môn kỹ thuật sâu, Luồng 3 vận hành ma trận đánh giá năng lực đa tiêu chí qua 5 chặng:"*

### 🔹 Chặng 1: Tiếp nhận & Lọc task chuyên môn (Nodes 1, 2, 3, 4, 5, 6)
* **Node `Webhook` & `Prepare Input`**: Đặt ngưỡng điểm năng lực tối thiểu = 40/100 điểm.
* **Node `Get Candidate Tasks` (Postgres)**: Lọc các task có yêu cầu kỹ năng cụ thể:
  * Task `API JWT` yêu cầu: `['JWT', 'Backend']`.
  * Task `Giao diện Đăng nhập` yêu cầu: `['Next.js', 'Frontend']`.
* **Node `Collect Tasks` & `Has Tasks?` (IF)**: Xác nhận có 2 task chuyên môn cần so khớp.

### 🔹 Chặng 2: Ma trận chấm điểm đa tiêu chí (Nodes 7, 8)
* **Node `Get Members With Load` (Postgres)**: Đọc hồ sơ kỹ năng của thành viên:
  * `Van Huy`: Skills = `['Next.js', 'PostgreSQL', 'Backend']`.
  * `Member 2`: Skills = `['Frontend', 'UI/UX', 'Tailwind']`.
* **Node `Score Matching` (Code)**: Thuật toán chấm điểm theo công thức:
  $$\text{Điểm tổng} = (60\% \times \text{Kỹ năng trùng}) + (25\% \times \text{Slot trống}) + (15\% \times \text{Năng suất})$$
  * **Task API JWT**: `Van Huy` trùng kỹ năng `Backend` ➔ **Đạt 72.5 điểm** (Cao nhất).
  * **Task Giao diện**: `Member 2` trùng kỹ năng `Frontend` ➔ **Đạt 68.0 điểm** (Cao nhất).

### 🔹 Chặng 3: Phân loại đạt chuẩn & Hợp nhất luồng (Nodes 9, 10, 11, 12, 13)
* **Node `Qualified?` (IF)**: Cả 2 đều đạt điểm ≥ 40 ➔ Đi vào node **`Update Assignee`** gán Task API cho Van Huy, Task Giao diện cho Member 2. *(Nếu ai có điểm < 40, node `Set Needs Review` sẽ đánh dấu cần PM can thiệp)*.
* **Node `Merge Results` & `Aggregate Results`**: Hợp nhất các nhánh thành một mảng dữ liệu tổng hợp.

### 🔹 Chặng 4: AI giải trình & Lưu báo cáo (Nodes 14, 15, 16, 17)
* **Node `Build Explain Prompt` & `Gemini Explain`**: Gửi kết quả chấm điểm sang AI. Gemini viết giải trình:
  > *"Task API JWT được gán cho Van Huy vì có kỹ năng Backend phù hợp nhất. Task Giao diện đăng nhập được gán cho Member 2 giúp tận dụng tốt thế mạnh Frontend. Cả hai đều có slot trống đảm bảo tiến độ."*
* **Node `Build Report` & `Save Report` (Postgres)**: Lưu kết quả vào bảng `reports` với loại `SKILL_MATCHING`, tỷ lệ rủi ro = `0.00%`.

### 🔹 Chặng 5: Gửi Gmail & Phản hồi (Nodes 18, 19)
* **Node `Send Gmail` & `Respond Success`**: Gửi email giải trình chi tiết về hộp thư quản lý và phản hồi HTTP 200 cho client.

---

# 🟢 LUỒNG 4: Sprint Auto-scheduling (17 Nodes)

🗣 **Lời thoại**:  
> *"Thưa Thầy/Cô, sau khi các task đã có người nhận, Luồng 4 sẽ tự động thiết lập thời gian biểu thi công Sprint qua 5 chặng:"*

### 🔹 Chặng 1: Kiểm tra dự án & Hạn cam kết (Nodes 1, 2, 3, 4, 5)
* **Node `Webhook` & `Prepare Input`**: Tiếp nhận Project ID và định mức tốc độ (2 story points/ngày).
* **Node `Get Project` (Postgres)**: Lấy ngày bắt đầu `2026-10-19` (Thứ Hai) và Deadline cam kết `2026-12-31`.
* **Node `Project Found?` (IF)**: Xác nhận dự án tồn tại. *(Nếu ID sai, rẽ sang `Respond 404`)*.

### 🔹 Chặng 2: Thuật toán tịnh tiến lịch Sprint (Nodes 6, 7)
* **Node `Get Sprint Tasks` (Postgres)**: Sắp xếp danh sách task theo thứ tự ưu tiên:
  1. `Xây dựng API JWT` (URGENT - 3 SP - Van Huy làm)
  2. `Cấu hình Google Cloud Console` (HIGH - 2 SP)
  3. `Tích hợp giao diện Đăng nhập` (MEDIUM - 3 SP - Member 2 làm)
* **Node `Schedule Calculation` (Code)**: Thuật toán lập lịch thi công:
  * Số ngày thi công = $\text{Story Points} / (\text{Tốc độ} \times \text{Năng suất})$.
  * **Tự động nhảy qua Thứ 7 & Chủ Nhật** (chỉ tính ngày làm việc).
  * **Mỗi người một timeline độc lập**:
    * Van Huy làm Task 1 (3 SP) mất 2 ngày ➔ Bắt đầu Thứ Hai 19/10 ➔ **Hạn chót `due_date`**: Thứ Tư `21/10/2026`.
    * Member 2 làm Task 3 (3 SP) mất 2 ngày ➔ Bắt đầu Thứ Hai 19/10 ➔ **Hạn chót `due_date`**: Thứ Tư `21/10/2026`.
  * *Kiểm tra*: Hạn chót `21/10` trước Deadline cam kết `31/12` ➔ Số task trễ `late_count = 0`.

### 🔹 Chặng 3: Cập nhật Database & Ghi vết (Nodes 8, 9, 10)
* **Node `Update Due Dates` (Postgres)**: Cập nhật ngày `due_date` cho các task vào Database.
* **Node `Build Log SQL` & `Log Activity` (Postgres)**: Ghi sự kiện `DUE_DATE_SET` vào bảng `activity_history`.

### 🔹 Chặng 4: Đánh giá rủi ro trễ hạn bằng AI (Nodes 11, 12, 13, 14, 15)
* **Node `Overruns Deadline?` (IF)**: Vì `late_count = 0` (đúng hạn) ➔ Bỏ qua việc gọi AI phân tích rủi ro để tiết kiệm tài nguyên. *(Nếu có task trễ, node `Gemini Risk Analysis` sẽ kích hoạt để đề xuất giải pháp khắc phục)*.
* **Node `Build Report` & `Save Report` (Postgres)**: Lưu vào bảng `reports` loại `DEADLINE_RISK`:
  * `risk_score`: `0.00%`.
  * `ai_summary`: *"Toàn bộ task dự kiến hoàn thành trước deadline dự án. Rủi ro trễ hạn: Thấp."*

### 🔹 Chặng 5: Gửi thông báo & Phản hồi (Nodes 16, 17)
* **Node `Send Gmail`**: Gửi email: 📧 *`✅ [Luồng 4] Lịch Sprint: rủi ro trễ hạn 0%`* đến `htchannelas@gmail.com`.
* **Node `Respond Success`**: Trả về kết quả JSON lịch trình chi tiết hoàn tất quy trình.

---

# 🏆 LỜI KẾT THÚC BÁO CÁO (30 giây)

> *"Tóm lại, phân hệ Planning & Resource Allocation của em đã hiện thực hóa một dây chuyền tự động hóa khép kín 100% gồm 4 luồng với hơn 15 node mỗi luồng.  
> Hệ thống đảm bảo đầy đủ các tiêu chuẩn kỹ thuật: **Kiểm tra dữ liệu đầu vào, phòng chống lỗi ngoại lệ, tối ưu chi phí AI, thuật toán cân bằng tải - xếp lịch làm việc thực tế, và ghi log kiểm toán đầy đủ trong cơ sở dữ liệu PostgreSQL**.  
> Em xin cảm ơn Thầy/Cô đã lắng nghe và em sẵn sàng trả lời các câu hỏi phản biện ạ!"*
