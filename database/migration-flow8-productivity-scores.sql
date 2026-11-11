-- ============================================================
-- Migration: Bảng productivity_scores cho Luồng 8
-- Member Productivity Scoring (Cron)
-- ============================================================

-- 8. BẢNG ĐIỂM NĂNG SUẤT THÀNH VIÊN (PRODUCTIVITY_SCORES)
-- Phục vụ: Member Productivity Scoring (Agent 8)
-- Lưu lịch sử chi tiết mỗi lần chấm điểm
CREATE TABLE IF NOT EXISTS productivity_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    period_start    TIMESTAMPTZ NOT NULL,           -- Bắt đầu chu kỳ đánh giá
    period_end      TIMESTAMPTZ NOT NULL,           -- Kết thúc chu kỳ đánh giá

    -- Các chỉ số thô
    tasks_completed     INT DEFAULT 0,              -- Số task hoàn thành trong kỳ
    tasks_overdue       INT DEFAULT 0,              -- Số task quá hạn
    tasks_on_time       INT DEFAULT 0,              -- Số task đúng hạn
    total_story_points  INT DEFAULT 0,              -- Tổng story points hoàn thành
    avg_lead_time_hours NUMERIC(10,2),              -- Lead time trung bình (giờ)
    stuck_task_count    INT DEFAULT 0,              -- Số task bị stuck trong kỳ
    bottleneck_count    INT DEFAULT 0,              -- Số lần bị đánh cờ bottleneck
    active_task_count   INT DEFAULT 0,              -- Số task đang active

    -- Điểm thành phần (0-100 mỗi phần)
    completion_score    NUMERIC(5,2) DEFAULT 0,     -- Điểm hoàn thành task
    timeliness_score    NUMERIC(5,2) DEFAULT 0,     -- Điểm đúng hạn
    velocity_score      NUMERIC(5,2) DEFAULT 0,     -- Điểm tốc độ (story points)
    quality_score       NUMERIC(5,2) DEFAULT 0,     -- Điểm chất lượng (ít stuck/bottleneck)

    -- Điểm tổng hợp
    final_score         NUMERIC(5,2) DEFAULT 0,     -- Điểm cuối cùng (0-200 tương thích members.productivity_score)
    score_grade         VARCHAR(10),                 -- A+, A, B+, B, C+, C, D, F
    score_trend         VARCHAR(20),                 -- IMPROVING, STABLE, DECLINING

    -- AI analysis
    ai_summary          TEXT,                        -- Nhận xét từ AI
    ai_raw_response     TEXT,                        -- Response thô từ AI

    -- Metadata
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes cho productivity_scores
CREATE INDEX IF NOT EXISTS idx_prod_scores_member ON productivity_scores(member_id);
CREATE INDEX IF NOT EXISTS idx_prod_scores_period ON productivity_scores(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_prod_scores_grade ON productivity_scores(score_grade);
CREATE INDEX IF NOT EXISTS idx_prod_scores_created ON productivity_scores(created_at DESC);

