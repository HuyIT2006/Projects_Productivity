import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/members – Lấy danh sách thành viên trong team
export async function GET() {
  try {
    const result = await query(
      `SELECT id, full_name, email, skills, max_workload, productivity_score
       FROM members
       ORDER BY full_name ASC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// POST /api/members – Thêm thành viên mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, skills = [], max_workload = 5 } = body;

    if (!full_name || !full_name.trim() || !email || !email.trim()) {
      return NextResponse.json(
        { error: 'Họ tên và email là bắt buộc' },
        { status: 400 }
      );
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : typeof skills === 'string'
      ? skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const result = await query(
      `INSERT INTO members (full_name, email, skills, max_workload, productivity_score, created_at)
       VALUES ($1, $2, $3, $4, 100.00, NOW())
       RETURNING *`,
      [full_name.trim(), email.trim(), skillsArray, parseInt(max_workload, 10) || 5]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating member:', error);
    const err = error as { code?: string };
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Email này đã tồn tại trong hệ thống' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
