import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/planning/overview?project_id=...
// Trả về:
//  - members : tải công việc từng thành viên (bảng members + tasks)
//  - reports : 6 báo cáo AI gần nhất của dự án (bảng reports)
//  - activity: 20 sự kiện gần nhất của dự án (bảng activity_history)
export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get('project_id');

    const members = await query(
      `SELECT m.id, m.full_name, m.skills, m.max_workload,
              COALESCE(m.productivity_score, 100)::float AS productivity_score,
              COUNT(t.id) FILTER (WHERE t.status IN ('TODO','IN_PROGRESS','IN_REVIEW'))::int AS current_load
       FROM members m
       LEFT JOIN tasks t ON t.assignee_id = m.id
       GROUP BY m.id
       ORDER BY m.full_name`
    );

    if (!projectId) {
      return NextResponse.json({ members: members.rows, reports: [], activity: [] });
    }

    const [reports, activity] = await Promise.all([
      query(
        `SELECT id, report_type, risk_score::float AS risk_score, ai_summary, created_at
         FROM reports WHERE project_id = $1
         ORDER BY created_at DESC LIMIT 6`,
        [projectId]
      ),
      query(
        `SELECT ah.id, ah.action_type, ah.new_value, ah.created_at,
                t.title AS task_title, m.full_name AS member_name
         FROM activity_history ah
         JOIN tasks t ON t.id = ah.task_id
         LEFT JOIN members m ON m.id = ah.member_id
         WHERE t.project_id = $1
         ORDER BY ah.created_at DESC LIMIT 20`,
        [projectId]
      ),
    ]);

    return NextResponse.json({
      members: members.rows,
      reports: reports.rows,
      activity: activity.rows,
    });
  } catch (error) {
    console.error('Error fetching planning overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
