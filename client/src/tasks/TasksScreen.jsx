import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, CheckSquare, Archive, Layout, Filter, Calendar as CalendarIcon,
  AlertTriangle, Trophy, Tag as TagIcon, Flame, CalendarCheck, Truck,
  GraduationCap, Clock, ChevronRight, User as UserIcon, Inbox, Sparkles
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Btn, Card, EmptyState, Avatar, Tag } from '../ui.jsx';
import { fmtDateFR, parseDate, formatRelativeTime } from '../utils.js';
import api from '../api.js';
import NewBoardModal from './NewBoardModal.jsx';
import KanbanBoard from './KanbanBoard.jsx';

const BOARD_ICONS = {
  CalendarCheck, Truck, GraduationCap, AlertTriangle, Trophy, Tag: TagIcon, Flame, Layout
};

const BOARD_COLORS = {
  emerald: 'from-emerald-500 to-emerald-600',
  sky:     'from-sky-500 to-sky-600',
  violet:  'from-violet-500 to-violet-600',
  rose:    'from-rose-500 to-rose-600',
  amber:   'from-amber-500 to-amber-600',
  pink:    'from-pink-500 to-pink-600',
  slate:   'from-slate-500 to-slate-600'
};

export default function TasksScreen({ users, showToast }) {
  const { user, isAdmin } = useAuth();
  const [mode, setMode] = useState('boards'); // 'boards' | 'my' | 'today' | 'overdue' | 'board:xxx'
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [activeBoard, setActiveBoard] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);

  const reloadBoards = useCallback(async () => {
    try {
      const list = await api.tasks.listBoards();
      setBoards(list);
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
    setLoading(false);
  }, [showToast]);

  const reloadQuickViews = useCallback(async () => {
    try {
      const [my, today, overdue] = await Promise.all([
        api.tasks.myTasks(),
        api.tasks.todayTasks(),
        api.tasks.overdueTasks()
      ]);
      setMyTasks(my);
      setTodayTasks(today);
      setOverdueTasks(overdue);
    } catch {}
  }, []);

  useEffect(() => {
    reloadBoards();
    reloadQuickViews();
  }, [reloadBoards, reloadQuickViews]);

  const openBoard = (board) => {
    setActiveBoard(board);
    setMode(`board:${board.id}`);
  };

  const closeBoard = () => {
    setActiveBoard(null);
    setMode('boards');
    reloadBoards();
    reloadQuickViews();
  };

  /* ---------- Vue "Tableau ouvert" ---------- */
  if (activeBoard) {
    return (
      <KanbanBoard
        board={activeBoard}
        users={users}
        onBack={closeBoard}
        showToast={showToast}
      />
    );
  }

  /* ---------- Vues listes ---------- */
  const quickViewCounts = {
    my:      myTasks.length,
    today:   todayTasks.length,
    overdue: overdueTasks.length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tâches</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organisez votre travail en tableaux Kanban
          </p>
        </div>
        {isAdmin && (
          <Btn icon={Plus} onClick={() => setShowNew(true)}>Nouveau tableau</Btn>
        )}
      </header>

      {/* Vues rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickViewCard
          title="Mes tâches"
          subtitle="Qui me sont assignées"
          count={quickViewCounts.my}
          icon={UserIcon}
          color="emerald"
          active={mode === 'my'}
          onClick={() => setMode(mode === 'my' ? 'boards' : 'my')}
        />
        <QuickViewCard
          title="Aujourd'hui"
          subtitle="Échéance du jour"
          count={quickViewCounts.today}
          icon={CalendarIcon}
          color="sky"
          active={mode === 'today'}
          onClick={() => setMode(mode === 'today' ? 'boards' : 'today')}
        />
        <QuickViewCard
          title="En retard"
          subtitle="Échéance dépassée"
          count={quickViewCounts.overdue}
          icon={AlertTriangle}
          color="rose"
          active={mode === 'overdue'}
          onClick={() => setMode(mode === 'overdue' ? 'boards' : 'overdue')}
        />
      </div>

      {/* Vue active */}
      {mode === 'my' && <QuickTaskList title="Mes tâches" tasks={myTasks} boards={boards} onOpenBoard={openBoard} emptyText="Aucune tâche ne vous est assignée."/>}
      {mode === 'today' && <QuickTaskList title="Tâches d'aujourd'hui" tasks={todayTasks} boards={boards} onOpenBoard={openBoard} emptyText="Pas de tâche prévue aujourd'hui."/>}
      {mode === 'overdue' && <QuickTaskList title="Tâches en retard" tasks={overdueTasks} boards={boards} onOpenBoard={openBoard} emptyText="Bonne nouvelle, aucun retard !"/>}

      {mode === 'boards' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Tableaux</h2>
          </div>
          {loading ? (
            <Card className="p-12 text-center text-slate-400 text-sm">Chargement...</Card>
          ) : boards.length === 0 ? (
            <EmptyState
              icon={Layout}
              title="Aucun tableau"
              description={isAdmin
                ? "Créez votre premier tableau, à partir de zéro ou d'un modèle officine prêt à l'emploi."
                : "L'administrateur de la pharmacie n'a pas encore créé de tableau."}
              action={isAdmin ? <Btn icon={Sparkles} onClick={() => setShowNew(true)}>Nouveau tableau</Btn> : null}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {boards.map(b => (
                <BoardCard key={b.id} board={b} onClick={() => openBoard(b)}/>
              ))}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewBoardModal
          onClose={() => setShowNew(false)}
          onCreated={(board) => {
            setShowNew(false);
            reloadBoards();
            openBoard(board);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* =========================================================
   QUICK VIEW CARD
   ========================================================= */
function QuickViewCard({ title, subtitle, count, icon: Icon, color, active, onClick }) {
  const styles = {
    emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-700',  ring: 'ring-emerald-500',  iconBg: 'bg-emerald-100' },
    sky:     { bg: 'bg-sky-50',      text: 'text-sky-700',      ring: 'ring-sky-500',      iconBg: 'bg-sky-100' },
    rose:    { bg: 'bg-rose-50',     text: 'text-rose-700',     ring: 'ring-rose-500',     iconBg: 'bg-rose-100' }
  }[color];

  return (
    <button
      onClick={onClick}
      className={`p-4 text-left bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition ${
        active ? `ring-2 ${styles.ring} border-transparent` : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${styles.iconBg} ${styles.text} flex items-center justify-center`}>
          <Icon className="w-4 h-4"/>
        </div>
        <div className={`text-2xl font-semibold ${count > 0 ? styles.text : 'text-slate-300'}`}>{count}</div>
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </button>
  );
}

/* =========================================================
   BOARD CARD
   ========================================================= */
function BoardCard({ board, onClick }) {
  const Icon = BOARD_ICONS[board.icon] || Layout;
  const gradient = BOARD_COLORS[board.color] || BOARD_COLORS.slate;

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition"
    >
      <div className={`h-20 bg-gradient-to-br ${gradient} relative flex items-end p-4`}>
        <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white absolute top-3 right-3">
          <Icon className="w-5 h-5"/>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold text-slate-900 group-hover:text-emerald-700 transition">
          {board.title}
        </h3>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Layout className="w-3.5 h-3.5"/>
            {board.columnCount} colonne{board.columnCount > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5"/>
            {board.taskCount} tâche{board.taskCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   QUICK TASK LIST (Mes / Aujourd'hui / En retard)
   ========================================================= */
function QuickTaskList({ title, tasks, boards, onOpenBoard, emptyText }) {
  if (tasks.length === 0) {
    return (
      <EmptyState icon={Inbox} title={title} description={emptyText}/>
    );
  }
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">{title}</h2>
      <Card>
        <div className="divide-y divide-slate-100">
          {tasks.map(t => {
            const board = boards.find(b => b.id === t.boardId);
            const isLate = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <button
                key={t.id}
                onClick={() => board && onOpenBoard(board)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 truncate">{t.title}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {board && <span className="truncate">{board.title}</span>}
                    {t.dueDate && (
                      <span className={`inline-flex items-center gap-1 ${isLate ? 'text-rose-600 font-medium' : ''}`}>
                        <CalendarIcon className="w-3 h-3"/>
                        {fmtDateFR(parseDate(t.dueDate))}
                      </span>
                    )}
                    {t.priority === 'urgent' && <Tag color="rose" icon={Flame}>Urgent</Tag>}
                    {t.priority === 'high' && <Tag color="amber" icon={AlertTriangle}>Haute</Tag>}
                  </div>
                </div>
                {t.assignees?.length > 0 && (
                  <div className="flex -space-x-1">
                    {t.assignees.slice(0, 3).map(a => <Avatar key={a.id} name={a.displayName} size="xs"/>)}
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0"/>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
