'use client';

import { Task, PRIORITY_COLORS, TaskStatus, TASK_STATUSES } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  isUpdating: boolean;
}

export default function TaskCard({ task, onStatusChange, isUpdating }: TaskCardProps) {
  const currentIndex = TASK_STATUSES.indexOf(task.status);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < TASK_STATUSES.length - 1;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'DONE';

  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md ${
        isUpdating ? 'opacity-50 pointer-events-none' : ''
      } ${task.is_bottleneck ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'}`}
    >
      {/* Header: Priority + Story Points */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {task.priority}
        </span>
        <span className="text-xs text-gray-400" title="Story Points">
          🎯 {task.story_points} SP
        </span>
      </div>

      {/* Title */}
      <h4 className="mb-1 text-sm font-semibold text-gray-800 leading-snug">
        {task.title}
      </h4>

      {/* Description (truncated) */}
      {task.description && (
        <p className="mb-2 text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      {/* Meta info */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {task.assignee_name && (
          <span className="flex items-center gap-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
              {task.assignee_name.charAt(0).toUpperCase()}
            </span>
            {task.assignee_name}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
            📅 {formatDate(task.due_date)}
            {isOverdue && ' ⚠️'}
          </span>
        )}
      </div>

      {/* Lead time khi DONE */}
      {task.status === 'DONE' && task.lead_time_hours && (
        <div className="mb-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
          ⏱️ Lead time: <strong>{task.lead_time_hours}h</strong>
        </div>
      )}

      {/* Bottleneck warning */}
      {task.is_bottleneck && (
        <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
          🚨 Bottleneck detected
        </div>
      )}

      {/* Status change buttons */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <button
          onClick={() => canMoveLeft && onStatusChange(task.id, TASK_STATUSES[currentIndex - 1])}
          disabled={!canMoveLeft || isUpdating}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            canMoveLeft
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'cursor-not-allowed text-gray-300'
          }`}
          title={canMoveLeft ? `← ${TASK_STATUSES[currentIndex - 1]}` : ''}
        >
          ← Lùi
        </button>
        <button
          onClick={() => canMoveRight && onStatusChange(task.id, TASK_STATUSES[currentIndex + 1])}
          disabled={!canMoveRight || isUpdating}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            canMoveRight
              ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
              : 'cursor-not-allowed text-gray-300'
          }`}
          title={canMoveRight ? `→ ${TASK_STATUSES[currentIndex + 1]}` : ''}
        >
          Tiến →
        </button>
      </div>
    </div>
  );
}
