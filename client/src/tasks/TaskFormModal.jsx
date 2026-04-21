import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, Plus, Trash2, X, AlertTriangle, Flame, Circle, ChevronDown,
  User as UserIcon, Calendar as CalendarIcon, Tag as TagIcon
} from 'lucide-react';
import { Modal, Btn, Input, Textarea, Select, Tag, Avatar, ConfirmDialog } from '../ui.jsx';
import { fmtDateFR, parseDate } from '../utils.js';
import api from '../api.js';

const PRIORITIES = [
  { value: 'low',    label: 'Basse',   color: 'slate',  icon: Circle },
  { value: 'normal', label: 'Normale', color: 'sky',    icon: Circle },
  { value: 'high',   label: 'Haute',   color: 'amber',  icon: AlertTriangle },
  { value: 'urgent', label: 'Urgente', color: 'rose',   icon: Flame }
];

export default function TaskFormModal({ task, boardId, columnId, columns, users, onClose, onSaved, showToast }) {
  const isEdit = !!task?.id;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'normal');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [labels, setLabels] = useState(task?.labels || []);
  const [labelInput, setLabelInput] = useState('');
  const [assigneeIds, setAssigneeIds] = useState(task?.assignees?.map(a => a.id) || []);
  const [checklist, setChecklist] = useState(task?.checklist || []);
  const [newItem, setNewItem] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState(task?.columnId || columnId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleAssignee = (id) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addLabel = () => {
    const l = labelInput.trim();
    if (l && !labels.includes(l)) setLabels([...labels, l]);
    setLabelInput('');
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
        labels,
        assigneeIds,
        columnId: selectedColumnId
      };
      let saved;
      if (isEdit) {
        saved = await api.tasks.updateTask(task.id, payload);
        // Changement de colonne ?
        if (selectedColumnId !== task.columnId) {
          await api.tasks.moveTask(task.id, selectedColumnId);
        }
        // Checklist : diff avec l'original
        const origIds = new Set((task.checklist || []).map(i => i.id));
        const newIds = new Set(checklist.map(i => i.id).filter(Boolean));
        // Supprimer les items retirés
        for (const orig of (task.checklist || [])) {
          if (!newIds.has(orig.id)) {
            await api.tasks.deleteChecklistItem(orig.id);
          }
        }
        // Ajouter les nouveaux + mettre à jour les modifiés
        for (const item of checklist) {
          if (!item.id) {
            await api.tasks.addChecklistItem(task.id, item.content);
          } else if (origIds.has(item.id)) {
            const orig = task.checklist.find(i => i.id === item.id);
            if (orig.done !== item.done || orig.content !== item.content) {
              await api.tasks.updateChecklistItem(item.id, { content: item.content, done: item.done });
            }
          }
        }
      } else {
        saved = await api.tasks.createTask(boardId, payload);
        // Ajouter les items de checklist
        for (const item of checklist) {
          await api.tasks.addChecklistItem(saved.id, item.content);
        }
      }
      showToast(isEdit ? 'Tâche modifiée' : 'Tâche créée');
      onSaved(saved);
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.tasks.deleteTask(task.id);
      showToast('Tâche supprimée', 'warning');
      onSaved(null);
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    }
    setConfirmDelete(false);
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {isEdit ? (
              <Btn variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>Supprimer</Btn>
            ) : <div/>}
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
              <Btn onClick={submit} disabled={!title.trim() || saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Btn>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <Input
            label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <Textarea
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Détails, procédure, contexte..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Priorité" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>

            <Input
              label="Échéance"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />

            <Select label="Colonne" value={selectedColumnId} onChange={(e) => setSelectedColumnId(e.target.value)}>
              {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Assigné(e)s</label>
            {users.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Aucun utilisateur disponible</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {users.map(u => {
                  const sel = assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs transition border ${
                        sel
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Avatar name={u.displayName} size="xs"/>
                      {u.displayName}
                      {sel && <Check className="w-3 h-3"/>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Étiquettes</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {labels.map(l => (
                <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-md">
                  <TagIcon className="w-3 h-3"/>
                  {l}
                  <button type="button" onClick={() => setLabels(labels.filter(x => x !== l))} className="ml-0.5 hover:text-rose-600">
                    <X className="w-3 h-3"/>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
                placeholder="Nouvelle étiquette (Entrée pour ajouter)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <Btn size="sm" onClick={addLabel} disabled={!labelInput.trim()}>Ajouter</Btn>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Checklist
              {checklist.length > 0 && (
                <span className="ml-1.5 text-slate-400 font-normal">
                  ({checklist.filter(i => i.done).length}/{checklist.length})
                </span>
              )}
            </label>
            <div className="space-y-1.5 mb-2">
              {checklist.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...checklist];
                      next[idx] = { ...next[idx], done: !next[idx].done };
                      setChecklist(next);
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      item.done ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 hover:border-emerald-500'
                    }`}
                  >
                    {item.done && <Check className="w-3 h-3 text-white"/>}
                  </button>
                  <input
                    value={item.content}
                    onChange={(e) => {
                      const next = [...checklist];
                      next[idx] = { ...next[idx], content: e.target.value };
                      setChecklist(next);
                    }}
                    className={`flex-1 text-sm bg-transparent border-none outline-none px-1 py-0.5 rounded focus:bg-slate-50 ${
                      item.done ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItem.trim()) {
                    e.preventDefault();
                    setChecklist([...checklist, { content: newItem.trim(), done: false }]);
                    setNewItem('');
                  }
                }}
                placeholder="Ajouter un item (Entrée pour valider)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <Btn
                size="sm"
                icon={Plus}
                onClick={() => {
                  if (newItem.trim()) {
                    setChecklist([...checklist, { content: newItem.trim(), done: false }]);
                    setNewItem('');
                  }
                }}
                disabled={!newItem.trim()}
              >
                Ajouter
              </Btn>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette tâche ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
