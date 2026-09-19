# AI Project & Productivity System

Dự án quản lý dự án và năng suất thông minh với Next.js, PostgreSQL và n8n AI Agents.

## 🛠 Tech Stack
- **Frontend & Backend:** Next.js (App Router, Tailwind CSS)
- **Database:** PostgreSQL
- **Workflow & AI Automation:** n8n + LLM (Gemini / OpenAI)

## 📁 Cấu trúc thư mục
- `apps/web/`: Mã nguồn giao diện và API Next.js.
- `database/`: Chứa file `schema.sql`, migrations và tài liệu database.
- `n8n-workflows/`: Chứa file xuất JSON của các luồng n8n.
  - `member-1/`: 4 luồng Khởi tạo & Phân bổ task.
  - `member-2/`: 4 luồng Giám sát & Phát hiện điểm nghẽn.
  - `member-3/`: 4 luồng Dự báo rủi ro & Báo cáo.

## 👥 Phân công nhiệm vụ (12 luồng)
### Thành viên 1: Planning & Resource Allocation
1. Luồng 1: AI Task Breakdown
2. Luồng 2: Smart Workload Balancer
3. Luồng 3: Skill Matrix Matching
4. Luồng 4: Sprint Auto-scheduling

### VanHuy : Team Tracking & Bottleneck Detection
5. Luồng 5: Realtime Status Tracker
6. Luồng 6: Stuck Task Alert (Cron)
7. Luồng 7: AI Bottleneck Diagnostic
8. Luồng 8: Member Productivity Scoring (Cron)

### Thành viên 3: Forecasting, Reporting & Alerts
9.  Luồng 9: Deadline Forecasting & Risk Scoring (Cron)
10. Luồng 10: AI Weekly Executive Report (Cron)
11. Luồng 11: Daily Standup Summary (Telegram Bot)
12. Luồng 12: Burn Rate & Overtime Warning