import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/diagnostics/collect – Gom toàn bộ dữ liệu thô của hệ thống cho Luồng 7
export async function GET() {
  try {
    // 1. Danh sách tasks
    const tasksRes = await query(`
      SELECT t.*, m.full_name AS assignee_name, p.name AS project_name
      FROM tasks t
      LEFT JOIN members m ON t.assignee_id = m.id
      LEFT JOIN projects p ON t.project_id = p.id
      ORDER BY t.created_at DESC
    `);

    // 2. Tasks bị kẹt (> 24h không cập nhật và chưa DONE)
    const stuckRes = await query(`
      SELECT 
        t.id AS task_id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        t.assignee_id,
        p.name AS project_name,
        m.full_name AS assignee_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - t.updated_at)) / 3600, 1) AS inactive_hours
      FROM tasks t
      LEFT JOIN members m ON t.assignee_id = m.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status NOT IN ('DONE')
        AND t.updated_at < NOW() - INTERVAL '24 hours'
      ORDER BY t.updated_at ASC
    `);

    // 3. Tasks quá hạn deadline
    const overdueRes = await query(`
      SELECT 
        t.id AS task_id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        t.assignee_id,
        p.name AS project_name,
        m.full_name AS assignee_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - t.due_date)) / 86400, 1) AS overdue_days
      FROM tasks t
      LEFT JOIN members m ON t.assignee_id = m.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status NOT IN ('DONE')
        AND t.due_date IS NOT NULL
        AND t.due_date < NOW()
      ORDER BY t.due_date ASC
    `);

    // 4. Phân tích tải công việc thành viên
    const membersRes = await query(`
      SELECT 
        m.id AS member_id,
        m.full_name,
        m.email,
        m.skills,
        m.max_workload,
        COALESCE(m.productivity_score, 100)::float AS productivity_score,
        COUNT(t.id) FILTER (WHERE t.status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW'))::int AS active_task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'DONE')::int AS completed_task_count,
        COUNT(t.id) FILTER (WHERE t.status != 'DONE' AND t.due_date < NOW())::int AS overdue_task_count,
        COALESCE(SUM(t.story_points) FILTER (WHERE t.status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW')), 0)::int AS active_story_points
      FROM members m
      LEFT JOIN tasks t ON t.assignee_id = m.id
      GROUP BY m.id
      ORDER BY m.full_name
    `);

    // 5. Thống kê dự án
    const projectsRes = await query(`
      SELECT 
        p.id AS project_id,
        p.name,
        p.status,
        p.deadline,
        COUNT(t.id)::int AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'DONE')::int AS done_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS in_progress_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'TODO')::int AS todo_tasks,
        COUNT(t.id) FILTER (WHERE t.is_bottleneck = true)::int AS bottleneck_tasks,
        COUNT(t.id) FILTER (WHERE t.status != 'DONE' AND t.due_date < NOW())::int AS overdue_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
    `);

    // 6. Các chẩn đoán gần đây (24 giờ qua)
    const recentDiagRes = await query(`
      SELECT id, project_id, diagnostic_type, severity, title, created_at
      FROM bottleneck_diagnostics
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      summary: {
        total_tasks: tasksRes.rows.length,
        stuck_tasks: stuckRes.rows.length,
        overdue_tasks: overdueRes.rows.length,
        total_members: membersRes.rows.length,
        total_projects: projectsRes.rows.length,
      },
      tasks: tasksRes.rows,
      stuck_tasks: stuckRes.rows,
      overdue_tasks: overdueRes.rows,
      members: membersRes.rows,
      projects: projectsRes.rows,
      recent_diagnostics: recentDiagRes.rows,
    });
  } catch (error) {
    console.error('Error collecting diagnostics data:', error);
    return NextResponse.json(
      { error: 'Failed to collect diagnostics data' },
      { status: 500 }
    );
  }
}

