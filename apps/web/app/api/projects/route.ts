import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/projects – Lấy danh sách tất cả projects
export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM projects ORDER BY created_at DESC'
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
