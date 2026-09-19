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
    productivity_score NUMERIC(4, 2) DEFAULT 100.00, -- Điểm năng suất (do Agent 8 cập nhật)
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