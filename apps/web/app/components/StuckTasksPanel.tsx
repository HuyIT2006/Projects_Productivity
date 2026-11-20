'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

const SEVERITY_STYLES: Record<string, { border: string; badge: string; icon: string; iconBg: string }> = {
  CRITICAL: { border: 'border-red-200',    badge: 'bg-red-500 text-white',    icon: '🔴', iconBg: 'bg-red-100'   },
  HIGH:     { border: 'border-orange-200', badge: 'bg-orange-500 text-white', icon: '🟠', iconBg: 'bg-orange-100'},
  MEDIUM:   { border: 'border-yellow-200', badge: 'bg-yellow-500 text-white', icon: '🟡', iconBg: 'bg-yellow-100'},
};

export default function StuckTasksPanel({ projectId }: { projectId: string }) {
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  const fetchStuckTasks = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    fetch(`/api/stuck-tasks?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => setStuckTasks(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchStuckTasks();
    const t = setInterval(fetchStuckTasks, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchStuckTasks]);

  const fmtHours = (h: number) => {
    if (h < 24) return `${Math.round(h)}h`;
    return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
  };

  const scroll = (dir: 'left' | 'right') => {
    sliderRef.current?.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
  };

  const criticalCount = stuckTasks.filter(t => t.severity === 'CRITICAL').length;
  const highCount     = stuckTasks.filter(t => t.severity === 'HIGH').length;

  // Nếu loading xong mà không có stuck tasks → ẩn hoàn toàn
  if (stuckTasks.length === 0 && !isLoading) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between bg-gradient-to-r from-red-50 to-orange-50 px-5 py-3.5 select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">Stuck Task Alert</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Luồng 6</span>
              {criticalCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{criticalCount} CRITICAL</span>
              )}
              {highCount > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">{highCount} HIGH</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isLoading ? 'Đang quét...' : `${stuckTasks.length} task bị stuck > 24h trong dự án này`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); fetchStuckTasks(); }}
            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 shadow-sm hover:bg-red-50 transition"
          >
            ↻ Làm mới
          </button>
          <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              Đang quét task bị tắc nghẽn...
            </div>
          ) : (
            /* Horizontal Slider */
            <div className="relative">
              {stuckTasks.length > 3 && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-600 hover:bg-gray-50 -ml-3"
                >
                  ‹
                </button>
              )}

              <div
                ref={sliderRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {stuckTasks.map((task) => {
                  const s = SEVERITY_STYLES[task.severity] || SEVERITY_STYLES.MEDIUM;
                  return (
                    <div
                      key={task.task_id}
                      className={`flex-shrink-0 w-64 rounded-xl border ${s.border} bg-white p-3.5 shadow-sm flex flex-col gap-2`}
                    >
                      {/* Top */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${s.iconBg}`}>
                            {s.icon}
                          </span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.badge}`}>
                            {task.severity}
                          </span>
                          {task.is_overdue && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">QUÁ HẠN</span>
                          )}
                        </div>
                        {task.is_bottleneck && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">🔴 BOTTLENECK</span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-2" title={task.task_title}>
                        {task.task_title}
                      </p>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span>👤 {task.assignee_name || 'Chưa gán'}</span>
                        <span className="font-semibold text-orange-600">⏱ Stuck: {fmtHours(task.inactive_hours)}</span>
                        <span>🎯 {task.story_points} SP</span>
                        {task.due_date && (
                          <span className={task.is_overdue ? 'text-red-500 font-semibold' : ''}>
                            📅 {new Date(task.due_date).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      <div>
                        <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          {task.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stuckTasks.length > 3 && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-600 hover:bg-gray-50 -mr-3"
                >
                  ›
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
