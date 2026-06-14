import { memo, useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bot, Send, Eye, Clock, CheckCircle2, AlertTriangle, Loader2, Plus, ChevronDown, GripVertical } from 'lucide-react';
import { api } from '../lib/api';

interface AgentCollabProps {}

type TabView = 'delegate' | 'kanban';

interface DelegateTask {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  agentId?: string;
  agentName?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

const MOCK_AGENTS = [
  { id: 'agent-1', name: 'Research Agent' },
  { id: 'agent-2', name: 'Code Agent' },
  { id: 'agent-3', name: 'Writing Agent' },
  { id: 'agent-4', name: 'Analysis Agent' },
];

const INITIAL_DELEGATE_TASKS: DelegateTask[] = [
  { id: 'dt-1', agentId: 'agent-1', agentName: 'Research Agent', task: 'Research latest AI trends', status: 'completed', createdAt: Date.now() - 3600000, completedAt: Date.now() - 1800000, result: 'Found 5 key trends in AI development...' },
  { id: 'dt-2', agentId: 'agent-2', agentName: 'Code Agent', task: 'Implement auth module', status: 'running', createdAt: Date.now() - 900000 },
  { id: 'dt-3', agentId: 'agent-3', agentName: 'Writing Agent', task: 'Draft blog post', status: 'pending', createdAt: Date.now() - 300000 },
];

const INITIAL_KANBAN_TASKS: KanbanTask[] = [
  { id: 'kt-1', title: 'Setup project', description: 'Initialize project structure', status: 'done', priority: 'high', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 43200000, tags: ['setup'] },
  { id: 'kt-2', title: 'Design API', description: 'Design REST API endpoints', status: 'in_progress', priority: 'high', createdAt: Date.now() - 72000000, updatedAt: Date.now() - 36000000, tags: ['api', 'design'], agentId: 'agent-2', agentName: 'Code Agent' },
  { id: 'kt-3', title: 'Write docs', description: 'Create documentation', status: 'todo', priority: 'medium', createdAt: Date.now() - 50000000, updatedAt: Date.now() - 50000000, tags: ['docs'], agentId: 'agent-3', agentName: 'Writing Agent' },
  { id: 'kt-4', title: 'Test suite', description: 'Write unit tests', status: 'todo', priority: 'medium', createdAt: Date.now() - 40000000, updatedAt: Date.now() - 40000000, tags: ['testing'] },
  { id: 'kt-5', title: 'Deploy staging', description: 'Deploy to staging environment', status: 'todo', priority: 'low', createdAt: Date.now() - 30000000, updatedAt: Date.now() - 30000000, tags: ['deploy'] },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };
  const icons: Record<string, any> = {
    pending: Clock,
    running: Loader2,
    completed: CheckCircle2,
    failed: AlertTriangle,
    todo: Clock,
    in_progress: Loader2,
    done: CheckCircle2,
  };
  const Icon = icons[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[status] || colors.pending}`}>
      <Icon size={10} className={status === 'running' || status === 'in_progress' ? 'animate-spin' : ''} />
      {status.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${colors[priority] || colors.low}`}>
      {priority.toUpperCase()}
    </span>
  );
}

function DelegatePanel({ tasks, onCreateTask, modern }: { tasks: DelegateTask[]; onCreateTask: (task: Omit<DelegateTask, 'id' | 'createdAt' | 'status'>) => void; modern: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(MOCK_AGENTS[0].id);
  const [taskDescription, setTaskDescription] = useState('');

  const handleSubmit = () => {
    if (!taskDescription.trim()) return;
    const agent = MOCK_AGENTS.find(a => a.id === selectedAgent);
    onCreateTask({
      agentId: selectedAgent,
      agentName: agent?.name || 'Unknown',
      task: taskDescription.trim(),
    });
    setTaskDescription('');
    setShowForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Delegate Tasks（同步子代理）</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${modern ? 'page-modern-action' : 'bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400'}`}
        >
          {showForm ? '取消' : <><Plus size={12} /> 新建任务</>}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/30">
          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">选择智能体</label>
            <div className="relative">
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none"
              >
                {MOCK_AGENTS.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">任务描述</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="描述需要智能体执行的任务..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              rows={3}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!taskDescription.trim()}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            委派任务
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <Bot size={40} className="mb-2 opacity-50" />
            <span className="text-sm">暂无委派任务</span>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="p-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Bot size={12} className="text-violet-500" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{task.agentName}</span>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.task}</p>
              {task.result && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-[11px] text-emerald-700 dark:text-emerald-400">
                  {task.result}
                </div>
              )}
              {task.error && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-[11px] text-red-700 dark:text-red-400">
                  {task.error}
                </div>
              )}
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                {new Date(task.createdAt).toLocaleString()}
                {task.completedAt && ` → ${new Date(task.completedAt).toLocaleString()}`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ title, tasks, status, icon, color }: { title: string; tasks: KanbanTask[]; status: string; icon: string; color: string }) {
  return (
    <div className="flex-1 min-w-[280px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <h4 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h4>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 min-h-[200px] p-2 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
        {tasks.map(task => (
          <div key={task.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">{task.title}</h5>
              <PriorityBadge priority={task.priority} />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</p>
            {task.agentName && (
              <div className="flex items-center gap-1.5 mb-2">
                <Bot size={10} className="text-violet-500" />
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">{task.agentName}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[9px] text-gray-500 dark:text-gray-400 font-bold">{tag}</span>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <span>{new Date(task.updatedAt).toLocaleDateString()}</span>
              <GripVertical size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanPanel({ tasks, modern }: { tasks: KanbanTask[]; modern: boolean }) {
  const todoTasks = useMemo(() => tasks.filter(t => t.status === 'todo'), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter(t => t.status === 'in_progress'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Kanban Board（异步看板工作流）</h3>
        <button className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${modern ? 'page-modern-action' : 'bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400'}`}>
          <Plus size={12} /> 新建任务
        </button>
      </div>
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn title="待处理" tasks={todoTasks} status="todo" icon="pending_actions" color="bg-slate-400" />
        <KanbanColumn title="进行中" tasks={inProgressTasks} status="in_progress" icon="progress_activity" color="bg-blue-500" />
        <KanbanColumn title="已完成" tasks={doneTasks} status="done" icon="check_circle" color="bg-emerald-500" />
      </div>
    </div>
  );
}

function AgentCollabPage() {
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [activeTab, setActiveTab] = useState<TabView>('delegate');
  const [delegateTasks, setDelegateTasks] = useState<DelegateTask[]>(INITIAL_DELEGATE_TASKS);
  const [kanbanTasks] = useState<KanbanTask[]>(INITIAL_KANBAN_TASKS);

  const handleCreateDelegateTask = (task: Omit<DelegateTask, 'id' | 'createdAt' | 'status'>) => {
    const newTask: DelegateTask = {
      ...task,
      id: `dt-${Date.now()}`,
      createdAt: Date.now(),
      status: 'pending',
    };
    setDelegateTasks(prev => [newTask, ...prev]);
  };

  const tabs: { id: TabView; label: string; icon: any }[] = [
    { id: 'delegate', label: 'Delegate Task', icon: Send },
    { id: 'kanban', label: 'Kanban', icon: Eye },
  ];

  return (
    <div className={`h-full flex flex-col ${modern ? '' : 'bg-white dark:bg-gray-900'}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b shrink-0 ${modern ? 'border-slate-200/60 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/20 backdrop-blur-xl' : 'border-gray-100 dark:border-gray-800'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-100/80 dark:border-violet-800/40">
            <Bot size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">智能体协作</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">委派任务与管理工作流</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-5">
        {activeTab === 'delegate' ? (
          <DelegatePanel tasks={delegateTasks} onCreateTask={handleCreateDelegateTask} modern={modern} />
        ) : (
          <KanbanPanel tasks={kanbanTasks} modern={modern} />
        )}
      </div>
    </div>
  );
}

export default memo(AgentCollabPage);
