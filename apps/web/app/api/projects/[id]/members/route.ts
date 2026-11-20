import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/projects/[id]/members – Lấy danh sách thành viên của dự án
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const result = await query(
      `SELECT 
        m.id,
        m.full_name,
        m.email,
        m.skills,
        m.max_workload,
        pm.role,
        pm.joined_at,
        COUNT(t.id) FILTER (WHERE t.status != 'DONE') as active_tasks_count
      FROM project_members pm
      JOIN members m ON pm.member_id = m.id
      LEFT JOIN tasks t ON t.assignee_id = m.id AND t.project_id = pm.project_id
      WHERE pm.project_id = $1
      GROUP BY m.id, m.full_name, m.email, m.skills, m.max_workload, pm.role, pm.joined_at
      ORDER BY m.full_name ASC`,
      [projectId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project members' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/members – Thêm thành viên vào dự án
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { member_id, role = 'Developer' } = body;

    if (!member_id) {
      return NextResponse.json(
        { error: 'member_id là bắt buộc' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO project_members (project_id, member_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, member_id) 
       DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [projectId, member_id, role]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error adding member to project:', error);
    return NextResponse.json(
      { error: 'Failed to add member to project' },
      { status: 500 }
    );
  }
}

