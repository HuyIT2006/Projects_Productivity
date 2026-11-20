'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Task,
  Project,
  ActivityEntry,
  TaskStatus,
  TaskPriority,
  TASK_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/types';
import TaskCard from './TaskCard';
import ActivityLog from './ActivityLog';
import StuckTasksPanel from './StuckTasksPanel';
import AIDiagnosticsPanel from './AIDiagnosticsPanel';

interface ProjectWithCount extends Project {
  task_count?: number;
}

interface ProjectMemberInfo {
  id: string;
  full_name: string;
  email: string;
  skills: string[];
  max_workload: number;
  role: string;
  active_tasks_count: number;
}

export default function KanbanBoard() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberInfo[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Danh sách toàn bộ thành viên hệ thống (cho dropdown chọn)
  const [allMembers, setAllMembers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);

  // Modal 1: Thêm Task
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('TODO');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Modal 2: Tạo Dự Án Mới
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [newProjectDeadline, setNewProjectDeadline] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [newProjectStatus, setNewProjectStatus] = useState('ACTIVE');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // Modal 3: Thêm Thành Viên Mới vào Hệ Thống
  const [isCreateMemberModalOpen, setIsCreateMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberSkills, setNewMemberSkills] = useState('');
  const [newMemberMaxWorkload, setNewMemberMaxWorkload] = useState(5);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Modal 4: Gán Thành Viên vào Dự Án Hiện Tại
  const [isAssignMemberModalOpen, setIsAssignMemberModalOpen] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignMemberRole, setAssignMemberRole] = useState('Developer');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 1. Fetch danh sách toàn bộ members
  const fetchAllMembers = useCallback(() => {
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => setAllMembers(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch all members:', err));
  }, []);

  useEffect(() => {
    fetchAllMembers();
  }, [fetchAllMembers]);

  // 2. Fetch danh sách Projects
  const fetchProjects = useCallback((selectNewId?: string) => {
    setIsLoading(true);
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        if (selectNewId) {
          setSelectedProjectId(selectNewId);
        } else if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to fetch projects:', err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 3. Fetch Tasks theo Project
  const fetchTasks = useCallback(() => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/tasks`)
      .then((res) => res.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch tasks:', err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  // 4. Fetch Activities theo Project
  const fetchActivities = useCallback(() => {
    if (!selectedProjectId) return;
    setIsLoadingActivities(true);
    fetch(`/api/task-logs?project_id=${selectedProjectId}&limit=20`)
      .then((res) => res.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch activities:', err))
      .finally(() => setIsLoadingActivities(false));
  }, [selectedProjectId]);

  // 5. Fetch thành viên của Project hiện tại
  const fetchProjectMembers = useCallback(() => {
    if (!selectedProjectId) return;
    fetch(`/api/projects/${selectedProjectId}/members`)
      .then((res) => res.json())
      .then((data) => setProjectMembers(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to fetch project members:', err));
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks();
      fetchActivities();
      fetchProjectMembers();
    }
  }, [selectedProjectId, fetchTasks, fetchActivities, fetchProjectMembers]);

  // Xử lý đổi trạng thái Task (Kéo thả hoặc click đổi)
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
        setToast({ message: data.message || 'Cập nhật trạng thái thành công!', type: 'success' });
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

  // Drag & Drop
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

  // 1. Submit Tạo Task mới
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedProjectId) return;
    setIsSubmittingTask(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          assignee_id: newTaskAssignee || null,
          priority: newTaskPriority,
          status: newTaskStatus,
          due_date: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        setToast({ message: 'Tạo task mới thành công!', type: 'success' });
        setNewTaskTitle('');
        setNewTaskDueDate('');
        setIsCreateTaskModalOpen(false);
        fetchTasks();
        fetchActivities();
        fetchProjectMembers();
        fetchProjects(selectedProjectId);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Lỗi khi tạo task', type: 'error' });
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setToast({ message: 'Không thể kết nối server', type: 'error' });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // 2. Submit Tạo Dự án mới
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsSubmittingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          start_date: newProjectStartDate,
          deadline: newProjectDeadline,
          status: newProjectStatus,
        }),
      });

      if (res.ok) {
        const newProj = await res.json();
        setToast({ message: `Đã tạo dự án "${newProj.name}" thành công!`, type: 'success' });
        setNewProjectName('');
        setNewProjectDesc('');
        setIsCreateProjectModalOpen(false);
        fetchProjects(newProj.id);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Lỗi khi tạo dự án', type: 'error' });
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setToast({ message: 'Không thể kết nối server', type: 'error' });
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // 3. Submit Thêm Thành viên mới vào hệ thống
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    setIsSubmittingMember(true);
    try {
      const skillsArray = newMemberSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          skills: skillsArray,
          max_workload: Number(newMemberMaxWorkload) || 5,
        }),
      });

      if (res.ok) {
        const newMem = await res.json();
        setToast({ message: `Đã thêm thành viên "${newMem.full_name}"!`, type: 'success' });
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberSkills('');
        setIsCreateMemberModalOpen(false);
        fetchAllMembers();
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Lỗi khi thêm thành viên', type: 'error' });
      }
    } catch (err) {
      console.error('Error creating member:', err);
      setToast({ message: 'Không thể kết nối server', type: 'error' });
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // 4. Submit Gán Thành viên vào Dự án hiện tại
  const handleAssignMemberToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignMemberId || !selectedProjectId) return;
    setIsSubmittingAssign(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: assignMemberId,
          role: assignMemberRole,
        }),
      });

      if (res.ok) {
        setToast({ message: 'Đã thêm thành viên vào dự án!', type: 'success' });
        setIsAssignMemberModalOpen(false);
        setAssignMemberId('');
        fetchProjectMembers();
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Lỗi khi gán thành viên', type: 'error' });
      }
    } catch (err) {
      console.error('Error assigning member:', err);
      setToast({ message: 'Không thể kết nối server', type: 'error' });
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Current selected project info
  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const doneTasksCount = getTasksByStatus('DONE').length;
  const progressPercent = tasks.length > 0 ? Math.round((doneTasksCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-xl transition-all text-sm font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-red-600 text-white shadow-red-200'
          }`}
        >
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Title & Badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-xl text-white shadow-md shadow-indigo-200">
                📊
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl flex items-center gap-2">
                  <span>Productivity & AI Diagnostic</span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                    Luồng 5 · 6 · 7
                  </span>
                </h1>
                <p className="text-xs text-gray-500">
                  Quản lý tiến độ thời gian thực, tự động phát hiện tắc nghẽn & đề xuất hành động từ Gemini AI
                </p>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Project Select Dropdown */}
              <div className="flex items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <span className="text-xs font-semibold text-gray-500 mr-2 uppercase">📁 Dự án:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.task_count !== undefined ? `(${p.task_count} tasks)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-indigo-600 active:scale-95"
                title="Tạo dự án mới"
              >
                <span className="text-sm font-bold text-indigo-600">＋</span>
                <span>Tạo Dự Án</span>
              </button>

              <button
                onClick={() => setIsCreateMemberModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-indigo-600 active:scale-95"
                title="Thêm thành viên mới vào hệ thống"
              >
                <span className="text-sm font-bold text-indigo-600">👤</span>
                <span>Thêm Thành Viên</span>
              </button>

              <button
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95"
              >
                <span className="text-sm font-extrabold">＋</span>
                <span>Thêm Task</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        {/* Project Context & Team Banner */}
        {currentProject && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Project Info */}
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-gray-900">
                    {currentProject.name}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      currentProject.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentProject.status}
                  </span>
                </div>
                {currentProject.description && (
                  <p className="mt-1 text-xs text-gray-600 max-w-2xl">
                    {currentProject.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span>📅 Bắt đầu: {new Date(currentProject.start_date).toLocaleDateString('vi-VN')}</span>
                  <span>⏰ Hạn chót: {new Date(currentProject.deadline).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              {/* Progress & Stats Bar */}
              <div className="min-w-[220px]">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-gray-600">Tiến độ hoàn thành:</span>
                  <span className="font-bold text-indigo-600">{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-500 text-right">
                  Đã xong {doneTasksCount}/{tasks.length} tasks
                </div>
              </div>
            </div>

            {/* Team Members in this Project */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider mr-1">
                  👥 Đội ngũ dự án:
                </span>
                {projectMembers.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Chưa có thành viên nào trong dự án này</span>
                ) : (
                  projectMembers.map((m) => (
                    <div
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-slate-50 px-2.5 py-1 text-xs shadow-2xs"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {m.full_name.charAt(0)}
                      </span>
                      <span className="font-semibold text-gray-800">{m.full_name}</span>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-medium text-indigo-600">
                        {m.role || 'Member'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        ({m.active_tasks_count} tasks)
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Nút Gán Thành viên vào Dự án này */}
              <button
                onClick={() => setIsAssignMemberModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition py-1"
              >
                <span>＋ Thêm thành viên vào dự án này</span>
              </button>
            </div>
          </div>
        )}

        {/* Task Counters Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {TASK_STATUSES.map((status) => {
            const count = getTasksByStatus(status).length;
            const colors = STATUS_COLORS[status];
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-bold shadow-2xs ${colors.border} ${colors.bg}`}
              >
                <span>{STATUS_LABELS[status]}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] shadow-2xs text-gray-700 font-extrabold">
                  {count}
                </span>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-bold text-gray-600 shadow-2xs">
            Tổng: <span className="text-gray-900">{tasks.length}</span>
          </span>
        </div>

        {/* Kanban Board Grid */}
        {isLoading ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-2 text-xs font-medium text-gray-500">Đang tải bảng Kanban...</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          /* Empty State khi Dự án chưa có task */
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
              📋
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900">
              Dự án này chưa có task nào!
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
              Bắt đầu tạo task đầu tiên để giao việc cho các thành viên, hoặc chọn dự án <strong>AI Productivity System</strong> ở thanh trên để xem dữ liệu có sẵn.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <span>＋</span> Thêm Task Mới Ngay
              </button>
              {projects.length > 1 && (
                <button
                  onClick={() => {
                    const other = projects.find((p) => p.id !== selectedProjectId);
                    if (other) setSelectedProjectId(other.id);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
                >
                  Chuyển sang dự án khác
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 4 Cột Kanban */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TASK_STATUSES.map((status) => {
              const columnTasks = getTasksByStatus(status);
              const colors = STATUS_COLORS[status];

              return (
                <div
                  key={status}
                  className={`flex flex-col rounded-2xl border-2 ${colors.border} ${colors.bg} p-3 transition-colors min-h-[380px] shadow-2xs`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column Header */}
                  <div className={`mb-3 flex items-center justify-between rounded-xl ${colors.header} px-3 py-2 shadow-2xs`}>
                    <h3 className="text-xs font-bold tracking-wide">
                      {STATUS_LABELS[status]}
                    </h3>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-extrabold text-gray-800">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Task Cards Dropzone */}
                  <div className="flex-1 space-y-3">
                    {columnTasks.length === 0 ? (
                      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-300/80 p-4 text-center">
                        <p className="text-xs text-gray-400 italic">Kéo thả task vào đây</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="cursor-grab active:cursor-grabbing transition-transform"
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

        {/* Section: Luồng 6 – Stuck Task Alert */}
        {selectedProjectId && (
          <div>
            <StuckTasksPanel projectId={selectedProjectId} />
          </div>
        )}

        {/* Section: Luồng 7 – AI Chẩn đoán Điểm nghẽn (Gemini AI) */}
        <div>
          <AIDiagnosticsPanel projectId={selectedProjectId} />
        </div>

        {/* Section: Luồng 5 – Nhật ký hoạt động */}
        <div>
          <ActivityLog activities={activities} isLoading={isLoadingActivities} />
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: THÊM TASK MỚI                                                     */}
      {/* ========================================================================= */}
      {isCreateTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">➕</span>
                <h3 className="text-base font-bold text-gray-900">Thêm Task Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateTaskModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Tiêu đề task <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Xây dựng API xác thực người dùng..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Người thực hiện
                  </label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Chưa gán --</option>
                    {allMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Độ ưu tiên
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">🟢 LOW</option>
                    <option value="MEDIUM">🟡 MEDIUM</option>
                    <option value="HIGH">🟠 HIGH</option>
                    <option value="URGENT">🔴 URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Trạng thái ban đầu
                  </label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Hạn chót (Deadline)
                  </label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingTask ? 'Đang tạo...' : 'Tạo Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO DỰ ÁN MỚI                                                    */}
      {/* ========================================================================= */}
      {isCreateProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📁</span>
                <h3 className="text-base font-bold text-gray-900">Tạo Dự Án Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Tên dự án <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: FinTech Banking App..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Mô tả dự án
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn gọn về mục tiêu dự án..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    required
                    value={newProjectStartDate}
                    onChange={(e) => setNewProjectStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Hạn chót (Deadline)
                  </label>
                  <input
                    type="date"
                    required
                    value={newProjectDeadline}
                    onChange={(e) => setNewProjectDeadline(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Trạng thái
                </label>
                <select
                  value={newProjectStatus}
                  onChange={(e) => setNewProjectStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                  <option value="ON_HOLD">Tạm dừng (ON_HOLD)</option>
                  <option value="COMPLETED">Hoàn thành (COMPLETED)</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateProjectModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProject}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingProject ? 'Đang tạo...' : 'Tạo Dự Án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: THÊM THÀNH VIÊN MỚI VÀO HỆ THỐNG                                 */}
      {/* ========================================================================= */}
      {isCreateMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <h3 className="text-base font-bold text-gray-900">Thêm Thành Viên Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateMemberModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Họ và Tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trần Văn Huy"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="VD: huy@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Kỹ năng (phân tách bởi dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="React, Next.js, Node.js, AI Prompting..."
                  value={newMemberSkills}
                  onChange={(e) => setNewMemberSkills(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Giới hạn workload tối đa (Số task)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newMemberMaxWorkload}
                  onChange={(e) => setNewMemberMaxWorkload(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateMemberModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingMember ? 'Đang thêm...' : 'Thêm Thành Viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GÁN THÀNH VIÊN VÀO DỰ ÁN HIỆN TẠI                                */}
      {/* ========================================================================= */}
      {isAssignMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <h3 className="text-base font-bold text-gray-900">
                  Gán Thành Viên Vào Dự Án: {currentProject?.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAssignMemberModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignMemberToProject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Chọn thành viên <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn thành viên --</option>
                  {allMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Vai trò trong dự án
                </label>
                <select
                  value={assignMemberRole}
                  onChange={(e) => setAssignMemberRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Leader">Team Leader</option>
                  <option value="Developer">Developer</option>
                  <option value="Tester">QA / Tester</option>
                  <option value="Designer">UI/UX Designer</option>
                  <option value="Product Owner">Product Owner</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAssignMemberModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !assignMemberId}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingAssign ? 'Đang thêm...' : 'Gán vào Dự án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
