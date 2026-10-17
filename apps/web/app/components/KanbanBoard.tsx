'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Task,
  Project,
  ActivityEntry,
  TaskStatus,
  TASK_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/types';
import TaskCard from './TaskCard';
import ActivityLog from './ActivityLog';
import StuckTasksPanel from './StuckTasksPanel';

export default function KanbanBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch projects lần đầu
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to fetch projects:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch tasks khi chọn project
  const fetchTasks = useCallback(() => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/tasks`)
      .then((res) => res.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch tasks:', err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  // Fetch activities
  const fetchActivities = useCallback(() => {
    if (!selectedProjectId) return;
    setIsLoadingActivities(true);
    fetch(`/api/task-logs?project_id=${selectedProjectId}&limit=20`)
      .then((res) => res.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch activities:', err))
      .finally(() => setIsLoadingActivities(false));
  }, [selectedProjectId]);

  useEffect(() => {
    fetchTasks();
    fetchActivities();
  }, [fetchTasks, fetchActivities]);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Xử lý đổi trạng thái task
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: newStatus }),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({ message: data.message || 'Đã cập nhật!', type: 'success' });
        // Refresh data
        fetchTasks();
        fetchActivities();
      } else {
        setToast({ message: data.error || 'Có lỗi xảy ra', type: 'error' });
      }
    } catch (err) {
      console.error('Status change failed:', err);
      setToast({ message: 'Không thể kết nối server', type: 'error' });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Group tasks theo status
  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks.filter((t) => t.status === status);
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      handleStatusChange(taskId, targetStatus);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📊 Projects & Productivity
              </h1>
              <p className="text-sm text-gray-500">
                Luồng 5 – Realtime Status Tracker
              </p>
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="project-select" className="text-sm font-medium text-gray-600">
                Dự án:
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-3 flex gap-4 text-sm">
            {TASK_STATUSES.map((status) => {
              const count = getTasksByStatus(status).length;
              return (
                <span
                  key={status}
                  className={`rounded-full px-3 py-1 font-medium ${STATUS_COLORS[status].header}`}
                >
                  {STATUS_LABELS[status]}: {count}
                </span>
              );
            })}
            <span className="rounded-full bg-gray-200 px-3 py-1 font-medium text-gray-600">
              Tổng: {tasks.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-2 text-gray-500">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TASK_STATUSES.map((status) => {
              const columnTasks = getTasksByStatus(status);
              const colors = STATUS_COLORS[status];

              return (
                <div
                  key={status}
                  className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-3 transition-colors`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column Header */}
                  <div className={`mb-3 rounded-lg ${colors.header} px-3 py-2 text-center`}>
                    <h3 className="text-sm font-bold">
                      {STATUS_LABELS[status]}
                      <span className="ml-2 rounded-full bg-white/50 px-2 py-0.5 text-xs">
                        {columnTasks.length}
                      </span>
                    </h3>
                  </div>

                  {/* Task Cards */}
                  <div className="space-y-3 min-h-[200px]">
                    {columnTasks.length === 0 ? (
                      <p className="py-8 text-center text-xs text-gray-400 italic">
                        Không có task nào
                      </p>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <TaskCard
                            task={task}
                            onStatusChange={handleStatusChange}
                            isUpdating={updatingTaskId === task.id}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stuck Tasks Alert - Flow 6 */}
        {selectedProjectId && (
          <div className="mt-6">
            <StuckTasksPanel projectId={selectedProjectId} />
          </div>
        )}

        {/* Activity Log */}
        <div className="mt-6">
          <ActivityLog activities={activities} isLoading={isLoadingActivities} />
        </div>
      </main>
    </div>
  );
}
