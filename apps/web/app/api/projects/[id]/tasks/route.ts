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

// POST /api/projects/[id]/tasks – Tạo task mới cho project
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    const {
      title,
      description = '',
      assignee_id,
      priority = 'MEDIUM',
      status = 'TODO',
      story_points = 3,
      due_date = null,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Tiêu đề task (title) là bắt buộc' },
        { status: 400 }
      );
    }

    const insertResult = await query(
      `INSERT INTO tasks (
        project_id,
        assignee_id,
        title,
        description,
        priority,
        status,
        story_points,
        due_date,
        is_bottleneck,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW(), NOW())
      RETURNING *`,
      [
        projectId,
        assignee_id || null,
        title.trim(),
        description || null,
        priority,
        status,
        story_points,
        due_date || null,
      ]
    );

    const newTask = insertResult.rows[0];

    // Lấy thêm tên assignee nếu có
    if (newTask.assignee_id) {
      const memberRes = await query(
        'SELECT full_name FROM members WHERE id = $1',
        [newTask.assignee_id]
      );
      newTask.assignee_name = memberRes.rows[0]?.full_name || 'Chưa gán';
    } else {
      newTask.assignee_name = 'Chưa gán';
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
