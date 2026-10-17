import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/stuck-tasks – Lấy danh sách task bị stuck (không thay đổi trạng thái > 24h)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const thresholdHours = parseInt(searchParams.get('threshold_hours') || '24', 10);

    let whereClause = `
      WHERE t.status NOT IN ('DONE')
        AND t.updated_at < NOW() - INTERVAL '${thresholdHours} hours'
    `;

    const params: string[] = [];

    if (projectId) {
      params.push(projectId);
      whereClause += ` AND t.project_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        t.id AS task_id,
        t.title AS task_title,
        t.status,
        t.priority,
        t.story_points,
        t.due_date,
        t.is_bottleneck,
        t.project_id,
        t.assignee_id,
        t.updated_at,
        m.full_name AS assignee_name,
        p.name AS project_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - t.updated_at)) / 3600, 2) AS inactive_hours,
        CASE
          WHEN t.priority = 'URGENT'
            OR t.updated_at < NOW() - INTERVAL '72 hours'
            OR (t.due_date IS NOT NULL AND t.due_date < NOW())
          THEN 'CRITICAL'
          WHEN t.priority = 'HIGH'
            OR t.updated_at < NOW() - INTERVAL '48 hours'
          THEN 'HIGH'
          ELSE 'MEDIUM'
        END AS severity,
        CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() THEN true ELSE false END AS is_overdue
      FROM tasks t
      LEFT JOIN members m ON t.assignee_id = m.id
      LEFT JOIN projects p ON t.project_id = p.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN t.priority = 'URGENT' THEN 0
          WHEN t.priority = 'HIGH' THEN 1
          WHEN t.priority = 'MEDIUM' THEN 2
          ELSE 3
        END,
        t.updated_at ASC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch stuck tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stuck tasks' },
      { status: 500 }
    );
  }
}
