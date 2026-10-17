'use client';

import { useState, useEffect, useCallback } from 'react';

interface StuckTask {
  task_id: string;
  task_title: string;
  status: string;
  priority: string;
  story_points: number;
  due_date: string | null;
  is_bottleneck: boolean;
  project_name: string;
  assignee_name: string | null;
  inactive_hours: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  is_overdue: boolean;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string; icon: string }> = {
  CRITICAL: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-500 text-white',
    icon: '🔴',
  },
  HIGH: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    badge: 'bg-orange-500 text-white',
    icon: '🟠',
  },
  MEDIUM: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    badge: 'bg-yellow-500 text-white',
    icon: '🟡',
  },
};

interface StuckTasksPanelProps {
  projectId: string;
}

export default function StuckTasksPanel({ projectId }: StuckTasksPanelProps) {
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchStuckTasks = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    fetch(`/api/stuck-tasks?project_id=${projectId}`)
      .then((res) => res.json())
      .then((data) => setStuckTasks(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch stuck tasks:', err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchStuckTasks();
    // Auto-refresh mỗi 5 phút
    const interval = setInterval(fetchStuckTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStuckTasks]);

  const formatHours = (hours: number) => {
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    const remainHours = Math.round(hours % 24);
    return `${days}d ${remainHours}h`;
  };

  const criticalCount = stuckTasks.filter((t) => t.severity === 'CRITICAL').length;
  const highCount = stuckTasks.filter((t) => t.severity === 'HIGH').length;

  if (stuckTasks.length === 0 && !isLoading) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4 shadow-sm">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">
              Stuck Task Alert
              <span className="ml-2 text-xs font-normal text-gray-500">(Luồng 6 – Cron)</span>
            </h3>
            <p className="text-xs text-gray-500">
              {stuckTasks.length} task bị stuck &gt; 24h
              {criticalCount > 0 && (
                <span className="ml-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {criticalCount} CRITICAL
                </span>
              )}
              {highCount > 0 && (
                <span className="ml-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {highCount} HIGH
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchStuckTasks();
            }}
            className="rounded-md bg-white px-2 py-1 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
            title="Refresh"
          >
            🔄
          </button>
          <span className="text-gray-400 text-sm">{isCollapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              <span className="ml-2 text-xs text-gray-500">Đang quét...</span>
            </div>
          ) : (
            stuckTasks.map((task) => {
              const styles = SEVERITY_STYLES[task.severity];
              return (
                <div
                  key={task.task_id}
                  className={`rounded-lg border ${styles.border} ${styles.bg} p-3 transition-all hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{styles.icon}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                          {task.severity}
                        </span>
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {task.status}
                        </span>
                        {task.is_overdue && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            ⚠️ QUÁ HẠN
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800">{task.task_title}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>👤 {task.assignee_name || 'Chưa gán'}</span>
                        <span>⏱️ Stuck: {formatHours(task.inactive_hours)}</span>
                        <span>🎯 {task.story_points} SP</span>
                        {task.due_date && (
                          <span className={task.is_overdue ? 'text-red-500 font-semibold' : ''}>
                            📅 {new Date(task.due_date).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.is_bottleneck && (
                      <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600">
                        BOTTLENECK
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
