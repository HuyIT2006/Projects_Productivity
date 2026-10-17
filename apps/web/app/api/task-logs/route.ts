import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/task-logs – Lấy activity history, hỗ trợ filter theo project_id
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    let sql = `
      SELECT ah.*,
             t.title  AS task_title,
             m.full_name AS member_name
      FROM activity_history ah
      LEFT JOIN tasks   t ON ah.task_id   = t.id
      LEFT JOIN members m ON ah.member_id = m.id
    `;
    const params: unknown[] = [];

    if (projectId) {
      sql += ' WHERE t.project_id = $1';
      params.push(projectId);
    }

    sql += ' ORDER BY ah.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching task logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity history' },
      { status: 500 }
    );
  }
}
