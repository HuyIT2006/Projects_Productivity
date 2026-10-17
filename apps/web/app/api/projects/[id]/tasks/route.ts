import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/projects/[id]/tasks – Lấy tất cả tasks của một project, JOIN với members để lấy tên
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT t.*, m.full_name AS assignee_name
       FROM tasks t
       LEFT JOIN members m ON t.assignee_id = m.id
       WHERE t.project_id = $1
       ORDER BY
         CASE t.priority
           WHEN 'URGENT' THEN 0
           WHEN 'HIGH'   THEN 1
           WHEN 'MEDIUM' THEN 2
           WHEN 'LOW'    THEN 3
           ELSE 4
         END,
         t.created_at ASC`,
      [id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
