-- ============================================================
-- Migration: Bảng bottleneck_diagnostics cho Luồng 7
-- AI Bottleneck Diagnostic
-- ============================================================

-- 7. BẢNG CHẨN ĐOÁN BOTTLENECK (BOTTLENECK_DIAGNOSTICS)
-- Phục vụ: AI Bottleneck Diagnostic (Agent 7)
CREATE TABLE IF NOT EXISTS bottleneck_diagnostics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    diagnostic_type VARCHAR(50) NOT NULL,       -- 'STUCK_TASKS', 'OVERDUE_DEADLINE', 'MEMBER_OVERLOAD', 'WORKLOAD_IMBALANCE', 'GENERAL'
    severity        VARCHAR(20) NOT NULL,       -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    title           VARCHAR(500) NOT NULL,      -- Tiêu đề ngắn gọn
    description     TEXT NOT NULL,              -- Mô tả chi tiết từ AI
    evidence        JSONB DEFAULT '[]',         -- Bằng chứng: [{ "type": "stuck_task", "task_id": "...", "detail": "..." }]
    recommendations JSONB DEFAULT '[]',         -- Giải pháp đề xuất: [{ "action": "...", "priority": "HIGH", "detail": "..." }]
    affected_tasks  JSONB DEFAULT '[]',         -- Danh sách task bị ảnh hưởng: [{ "task_id": "...", "title": "..." }]
    affected_members JSONB DEFAULT '[]',        -- Danh sách member bị ảnh hưởng: [{ "member_id": "...", "name": "..." }]
    ai_raw_response TEXT,                       -- Response thô từ AI (để debug)
    is_resolved     BOOLEAN DEFAULT FALSE,      -- Đã xử lý chưa
    resolved_at     TIMESTAMPTZ,                -- Thời điểm xử lý
    metadata        JSONB DEFAULT '{}',         -- Dữ liệu bổ sung linh hoạt
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes cho bottleneck_diagnostics
CREATE INDEX IF NOT EXISTS idx_diagnostics_project ON bottleneck_diagnostics(project_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_severity ON bottleneck_diagnostics(severity);
CREATE INDEX IF NOT EXISTS idx_diagnostics_type ON bottleneck_diagnostics(diagnostic_type);
CREATE INDEX IF NOT EXISTS idx_diagnostics_resolved ON bottleneck_diagnostics(is_resolved);
CREATE INDEX IF NOT EXISTS idx_diagnostics_created ON bottleneck_diagnostics(created_at DESC);

