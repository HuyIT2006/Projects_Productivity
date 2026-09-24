-- Kích hoạt extension hỗ trợ sinh UUID ngẫu nhiên
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG THÀNH VIÊN (MEMBERS)
-- Phục vụ: Smart Workload Balancer, Skill Matrix, Standup Summary
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telegram_id VARCHAR(50), -- Dùng cho n8n gửi thông báo/standup bot
    skills TEXT[] DEFAULT '{}', -- Danh sách kỹ năng: {'Next.js', 'PostgreSQL', 'Docker'}
    max_workload INT DEFAULT 5, -- Số task tối đa có thể nhận cùng lúc
    productivity_score NUMERIC(5, 2) DEFAULT 100.00, -- Điểm năng suất (do Agent 8 cập nhật)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG DỰ ÁN (PROJECTS)
-- Phục vụ: Quản lý tổng thể, Deadline Forecasting
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DELAYED, ON_HOLD
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BẢNG NHIỆM VỤ (TASKS)
-- Bảng cốt lõi: Phục vụ cả 12 luồng n8n
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES members(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    story_points INT DEFAULT 1, -- Độ khó ước lượng (do Agent 1 bóc tách)
    required_skills TEXT[] DEFAULT '{}', -- Kỹ năng cần: {'Frontend', 'API'}
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status VARCHAR(30) DEFAULT 'TODO', -- TODO, IN_PROGRESS, IN_REVIEW, DONE
    due_date TIMESTAMP WITH TIME ZONE,
    is_bottleneck BOOLEAN DEFAULT FALSE, -- Cờ đỏ khi bị tắc nghẽn (do Agent 6 & 7 bật)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG NHẬT KÝ TRẠNG THÁI TASK (TASK_LOGS)
-- Phục vụ: Realtime Status Tracker (Agent 5), Inactivity Alert (Agent 6), Diagnostic (Agent 7)
CREATE TABLE IF NOT EXISTS task_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES members(id) ON DELETE SET NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    comment TEXT, -- Ghi chú hoặc tóm tắt lý do stuck của AI
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. BẢNG BÁO CÁO & DỰ BÁO RỦI RO (REPORTS)
-- Phục vụ: Deadline Forecasting (Agent 9), Weekly Report (Agent 10)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL, -- 'WEEKLY_REPORT', 'DEADLINE_RISK', 'STANDUP'
    risk_score NUMERIC(5, 2), -- Tỷ lệ rủi ro trễ hạn (0 - 100%)
    ai_summary TEXT NOT NULL, -- Nội dung tóm tắt do LLM tạo ra
    metrics JSONB, -- Dữ liệu thô linh hoạt: { "completed_tasks": 12, "overdue_tasks": 2 }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CHÈN DỮ LIỆU MẪU ĐỂ TEST
INSERT INTO members (full_name, email, skills, max_workload) VALUES
('Van Huy', 'huy@example.com', ARRAY['Next.js', 'PostgreSQL', 'Backend'], 5),
('Member 2', 'member2@example.com', ARRAY['Frontend', 'UI/UX', 'Tailwind'], 5),
('Member 3', 'member3@example.com', ARRAY['Automation', 'n8n', 'DevOps'], 5)
ON CONFLICT (email) DO NOTHING;

-- 6. BẢNG LỊCH SỬ HOẠT ĐỘNG (ACTIVITY_HISTORY)
-- Phục vụ: Realtime Status Tracker (Agent 5), giao diện Activity Feed trên Next.js
CREATE TABLE IF NOT EXISTS activity_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,       -- 'STATUS_CHANGE', 'TASK_CREATED', 'TASK_ASSIGNED'
    old_value VARCHAR(100),                 -- Giá trị cũ (vd: 'TODO')
    new_value VARCHAR(100),                 -- Giá trị mới (vd: 'IN_PROGRESS')
    lead_time_hours NUMERIC(10, 2),         -- Lead time tính bằng giờ (chỉ khi task DONE)
    metadata JSONB DEFAULT '{}',            -- Dữ liệu bổ sung linh hoạt
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DỮ LIỆU MẪU CHO TESTING LUỒNG 5
-- ============================================

-- Dự án mẫu
INSERT INTO projects (id, name, description, start_date, deadline, status) VALUES
('a0000001-0000-0000-0000-000000000001', 'AI Productivity System', 'Hệ thống quản lý năng suất nhóm với AI & n8n', '2026-09-01', '2026-12-31', 'ACTIVE'),
('a0000001-0000-0000-0000-000000000002', 'E-Commerce Platform', 'Website thương mại điện tử với Next.js', '2026-10-01', '2027-03-31', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Tasks mẫu (dùng subquery để lấy member id theo email)
INSERT INTO tasks (id, project_id, assignee_id, title, description, story_points, priority, status, due_date) VALUES
('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'huy@example.com'),
  'Setup Docker & PostgreSQL', 'Cấu hình Docker Compose cho toàn bộ dự án', 3, 'HIGH', 'DONE',
  '2026-09-10 23:59:59+07'),
('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'member2@example.com'),
  'Design Kanban Board UI', 'Thiết kế giao diện Kanban Board với Tailwind CSS', 5, 'HIGH', 'IN_PROGRESS',
  '2026-09-20 23:59:59+07'),
('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'member3@example.com'),
  'Setup n8n Workflows', 'Cấu hình 4 workflow tự động hóa trên n8n', 5, 'MEDIUM', 'IN_PROGRESS',
  '2026-09-25 23:59:59+07'),
('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'huy@example.com'),
  'Implement API Routes', 'Xây dựng REST API cho task management', 8, 'HIGH', 'TODO',
  '2026-09-30 23:59:59+07'),
('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'member2@example.com'),
  'Tích hợp Webhook n8n', 'Kết nối Next.js với n8n thông qua webhook', 5, 'MEDIUM', 'TODO',
  '2026-10-05 23:59:59+07'),
('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'member3@example.com'),
  'Viết Unit Tests', 'Viết test cho API routes và React components', 3, 'LOW', 'TODO',
  '2026-10-10 23:59:59+07'),
('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'huy@example.com'),
  'Deploy lên Production', 'Triển khai hệ thống lên server production', 8, 'URGENT', 'TODO',
  '2026-10-15 23:59:59+07'),
('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000001',
  (SELECT id FROM members WHERE email = 'member2@example.com'),
  'Code Review Sprint 1', 'Review toàn bộ code của sprint đầu tiên', 2, 'MEDIUM', 'IN_REVIEW',
  '2026-09-28 23:59:59+07')
ON CONFLICT (id) DO NOTHING;