import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, Plus, MoreVertical, Archive, Edit2, Trash2, Settings,
  AlertTriangle, Flame, Circle, Calendar as CalendarIcon, Check, MessageSquare,
  Users as UsersIcon, GripVertical, Tag as TagIcon
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners, pointerWithin
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Btn, Card, EmptyState, Avatar, Tag, ConfirmDialog } from '../ui.jsx';
import { fmtDateFR, parseDate } from '../utils.js';
import { useAuth } from '../auth.jsx';
import api from '../api.js';
import TaskFormModal from './TaskFormModal.jsx';

const PRIORITY_STYLES = {
  urgent: { color: 'rose',  icon: Flame,          label: 'Urgente' },
  high:   { color: 'amber', icon: AlertTriangle,  label: 'Haute' },
  normal: { color: 'slate', icon: null,           label: 'Normale' },
  low:    { color: 'slate', icon: null,           label: 'Basse' }
};

export default function KanbanBoard({ board, users, onBack, showToast }) {
  const { isAdmin } = useAuth();
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState(null);
  const [creatingInColumn, setCreatingInColumn] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, allTasks] = await Promise.all([
        api.tasks.listColumns(board.id),
        api.tasks.listTasks(board.id, showCompleted)
      ]);
      setColumns(cols);
      setTasks(allTasks);
    } catch (e) {
      showToast(e.message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [board.id, showCompleted, showToast]);

  useEffect(() => { reload(); }, [reload]);

  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach(c => map[c.id] = []);
    tasks.forEach(t => {
      if (!map[t.columnId]) map[t.columnId] = [];
      map[t.columnId].push(t);
    });
    // Sort by sortOrder
    Object.values(map).forEach(arr => arr.sort((a, b) => a.sortOrder - b.sortOrder));
    return map;
  }, [columns, tasks]);

  /* ---------- Drag & Drop ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event) => setActiveDragId(event.active.id);

  const handleDragEnd = async (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Drop target peut être : un autre task (dans la même colonne ou autre) OU une colonne vide
    const overTask = tasks.find(t => t.id === over.id);
    const overColumn = columns.find(c => c.id === over.id || c.id === over.data?.current?.columnId);

    let targetColumnId = overTask?.columnId || overColumn?.id;
    if (!targetColumnId) return;

    const targetColumnTasks = tasksByColumn[targetColumnId] || [];

    let newSortOrder;
    if (overTask) {
      // Inséré à la position de overTask
      const overIndex = targetColumnTasks.findIndex(t => t.id === overTask.id);
      if (active.id === over.id) return;
      newSortOrder = overIndex * 10;
      // Shift tous ceux à partir de overIndex (on simplifie : on met juste overIndex*10 - 5)
      if (overIndex > 0) {
        const before = targetColumnTasks[overIndex - 1];
        if (before && before.id !== active.id) {
          newSortOrder = (before.sortOrder + overTask.sortOrder) / 2;
        }
      } else {
        newSortOrder = overTask.sortOrder - 5;
      }
    } else {
      // Fin de la colonne cible
      const last = targetColumnTasks[targetColumnTasks.length - 1];
      newSortOrder = last ? last.sortOrder + 10 : 0;
    }

    // Mise à jour optimiste
    setTasks(prev => prev.map(t =>
      t.id === active.id
        ? { ...t, columnId: targetColumnId, sortOrder: newSortOrder }
        : t
    ));

    try {
      await api.tasks.moveTask(active.id, targetColumnId, newSortOrder);
      // Si la colonne cible est "done", recharger pour refléter l'éventuelle auto-complétion
      const targetCol = columns.find(c => c.id === targetColumnId);
      if (targetCol?.doneState) reload();
    } catch (e) {
      showToast(e.message || 'Erreur de déplacement', 'error');
      reload();
    }
  };

  const activeTask = useMemo(
    () => tasks.find(t => t.id === activeDragId),
    [tasks, activeDragId]
  );

  /* ---------- Actions board ---------- */
  const archiveBoard = async () => {
    try {
      await api.tasks.archiveBoard(board.id);
      showToast('Tableau archivé', 'warning');
      onBack();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
  };

  const deleteBoard = async () => {
    try {
      await api.tasks.deleteBoard(board.id);
      showToast('Tableau supprimé', 'warning');
      onBack();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
    setConfirmDelete(false);
  };

  /* ---------- Actions columns ---------- */
  const addColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      const col = await api.tasks.createColumn(board.id, { title: newColumnTitle.trim() });
      setColumns([...columns, col]);
      setAddingColumn(false);
      setNewColumnTitle('');
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
  };

  const deleteColumn = async (colId) => {
    if (!confirm('Supprimer cette colonne ?')) return;
    try {
      await api.tasks.deleteColumn(colId);
      setColumns(columns.filter(c => c.id !== colId));
    } catch (e) { showToast(e.message || e.error || 'Erreur', 'error'); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <Btn variant="ghost" size="sm" icon={ChevronLeft} onClick={onBack}>Tableaux</Btn>
          <div className="h-6 w-px bg-slate-200"/>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate">{board.title}</h1>
            <div className="text-xs text-slate-500">
              {tasks.filter(t => !t.completedAt).length} tâche{tasks.filter(t => !t.completedAt).length > 1 ? 's' : ''} en cours
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} className="rounded"/>
            Afficher terminées
          </label>
          {isAdmin && (
            <div className="relative">
              <Btn variant="ghost" size="sm" icon={MoreVertical} onClick={() => setMenuOpen(!menuOpen)}/>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button onClick={() => { archiveBoard(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
                      <Archive className="w-4 h-4"/> Archiver
                    </button>
                    <button onClick={() => { setConfirmDelete(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 text-left border-t border-slate-100">
                      <Trash2 className="w-4 h-4"/> Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-100 p-4 scrollbar-thin">
        {loading ? (
          <div className="text-center pt-12 text-slate-400 text-sm">Chargement...</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 h-full items-start">
              {columns.map(col => (
                <Column
                  key={col.id}
                  column={col}
                  tasks={tasksByColumn[col.id] || []}
                  onCreateTask={() => setCreatingInColumn(col.id)}
                  onEditTask={setEditTask}
                  onDeleteColumn={() => deleteColumn(col.id)}
                  isAdmin={isAdmin}
                />
              ))}

              {/* Colonne : ajouter */}
              {isAdmin && (
                <div className="w-72 flex-shrink-0">
                  {addingColumn ? (
                    <div className="bg-white rounded-lg border border-slate-300 p-3">
                      <input
                        autoFocus
                        value={newColumnTitle}
                        onChange={e => setNewColumnTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingColumn(false); }}
                        placeholder="Titre de la colonne"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <Btn size="sm" onClick={addColumn} disabled={!newColumnTitle.trim()}>Ajouter</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => { setAddingColumn(false); setNewColumnTitle(''); }}>Annuler</Btn>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingColumn(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 bg-white/50 hover:bg-white border border-dashed border-slate-300 rounded-lg transition"
                    >
                      <Plus className="w-4 h-4"/> Ajouter une colonne
                    </button>
                  )}
                </div>
              )}
            </div>

            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} onClick={() => {}} isDragging/>}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Modales */}
      {(editTask || creatingInColumn) && (
        <TaskFormModal
          task={editTask}
          boardId={board.id}
          columnId={creatingInColumn}
          columns={columns}
          users={users}
          showToast={showToast}
          onClose={() => { setEditTask(null); setCreatingInColumn(null); }}
          onSaved={() => {
            setEditTask(null);
            setCreatingInColumn(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce tableau ?"
        description="Toutes les colonnes et tâches seront supprimées. Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={deleteBoard}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/* =========================================================
   COLUMN
   ========================================================= */
function Column({ column, tasks, onCreateTask, onEditTask, onDeleteColumn, isAdmin }) {
  const { setNodeRef } = useSortable({ id: column.id, data: { type: 'column' } });

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-slate-50 rounded-lg border border-slate-200 max-h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            column.color === 'emerald' ? 'bg-emerald-500' :
            column.color === 'amber'   ? 'bg-amber-500' :
            column.color === 'rose'    ? 'bg-rose-500' :
            column.color === 'sky'     ? 'bg-sky-500' :
            'bg-slate-400'
          }`}/>
          <span className="text-sm font-medium text-slate-700 truncate">{column.title}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">({tasks.length})</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onCreateTask} className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100" title="Ajouter une tâche">
            <Plus className="w-4 h-4"/>
          </button>
          {isAdmin && tasks.length === 0 && (
            <button onClick={onDeleteColumn} className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100" title="Supprimer la colonne">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin min-h-[60px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={rectSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onEditTask(task)}/>
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-400">
            Aucune tâche
          </div>
        )}
      </div>

      <button
        onClick={onCreateTask}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 border-t border-slate-200 transition"
      >
        <Plus className="w-3.5 h-3.5"/> Ajouter une tâche
      </button>
    </div>
  );
}

/* =========================================================
   TASK CARD
   ========================================================= */
function SortableTaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.columnId }
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick}/>
    </div>
  );
}

function TaskCard({ task, onClick, isDragging }) {
  const prio = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal;
  const PrioIcon = prio.icon;
  const dueDate = task.dueDate;
  let dueStatus = null;
  if (dueDate && !task.completedAt) {
    const today = new Date().toISOString().slice(0, 10);
    if (dueDate < today) dueStatus = 'overdue';
    else if (dueDate === today) dueStatus = 'today';
  }
  const checklistDone = (task.checklist || []).filter(i => i.done).length;
  const checklistTotal = (task.checklist || []).length;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-md p-2.5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition ${
        isDragging ? 'shadow-lg ring-2 ring-emerald-500/40' : ''
      } ${task.completedAt ? 'opacity-60' : ''}`}
    >
      {(task.labels?.length > 0 || task.priority === 'urgent' || task.priority === 'high') && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {(task.priority === 'urgent' || task.priority === 'high') && PrioIcon && (
            <Tag color={prio.color} icon={PrioIcon}>{prio.label}</Tag>
          )}
          {(task.labels || []).slice(0, 3).map(l => (
            <span key={l} className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded">
              {l}
            </span>
          ))}
        </div>
      )}

      <div className={`text-sm ${task.completedAt ? 'line-through text-slate-400' : 'text-slate-800'} leading-snug`}>
        {task.title}
      </div>

      {task.description && (
        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {dueDate && (
            <span className={`inline-flex items-center gap-1 ${
              dueStatus === 'overdue' ? 'text-rose-600 font-medium' :
              dueStatus === 'today'   ? 'text-amber-600 font-medium' : ''
            }`}>
              <CalendarIcon className="w-3 h-3"/>
              {fmtDateFR(parseDate(dueDate))}
            </span>
          )}
          {checklistTotal > 0 && (
            <span className={`inline-flex items-center gap-1 ${
              checklistDone === checklistTotal ? 'text-emerald-600' : ''
            }`}>
              <Check className="w-3 h-3"/>
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3"/>
              {task.commentCount}
            </span>
          )}
        </div>
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 3).map(a => (
              <Avatar key={a.id} name={a.displayName} size="xs"/>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] flex items-center justify-center font-semibold border border-white">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
