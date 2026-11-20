import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/projects – Lấy danh sách tất cả projects kèm số lượng task
export async function GET() {
  try {
    const result = await query(
      `SELECT 
        p.*, 
        COUNT(t.id)::int AS task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY COUNT(t.id) DESC, p.created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects – Tạo dự án mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description = '', start_date, deadline, status = 'ACTIVE' } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tên dự án là bắt buộc' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO projects (name, description, start_date, deadline, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        name.trim(),
        description || null,
        start_date || new Date().toISOString().split('T')[0],
        deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
