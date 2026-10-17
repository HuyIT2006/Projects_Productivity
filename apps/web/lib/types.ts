// =============================================
// TypeScript types cho dự án Productivity System
// =============================================

export interface Member {
  id: string;
  full_name: string;
  email: string;
  telegram_id: string | null;
  skills: string[];
  max_workload: number;
  productivity_score: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  start_date: string;
  deadline: string;
  status: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  assignee_id: string | null;
  title: string;
  description: string;
  story_points: number;
  required_skills: string[];
  priority: string;
  status: TaskStatus;
  due_date: string | null;
  is_bottleneck: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee_name?: string;
  lead_time_hours?: number;
}

export interface TaskLog {
  id: string;
  task_id: string;
  changed_by: string | null;
  old_status: string;
  new_status: string;
  comment: string | null;
  logged_at: string;
  // Joined fields
  task_title?: string;
  member_name?: string;
}

export interface ActivityEntry {
  id: string;
  task_id: string;
  member_id: string | null;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  lead_time_hours: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined fields
  task_title?: string;
  member_name?: string;
}

// =============================================
// Constants
// =============================================

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: '📝 To Do',
  IN_PROGRESS: '🔄 In Progress',
  IN_REVIEW: '👀 In Review',
  DONE: '✅ Done',
};

export const STATUS_COLORS: Record<TaskStatus, { bg: string; border: string; header: string }> = {
  TODO: { bg: 'bg-slate-50', border: 'border-slate-200', header: 'bg-slate-200 text-slate-700' },
  IN_PROGRESS: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-200 text-blue-700' },
  IN_REVIEW: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-200 text-amber-700' },
  DONE: { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-200 text-emerald-700' },
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};
