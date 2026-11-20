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

