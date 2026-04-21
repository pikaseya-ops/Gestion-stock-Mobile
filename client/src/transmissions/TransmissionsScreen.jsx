import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageSquare, Plus, Pin, Search, Filter, X, AlertCircle,
  Eye, EyeOff, ChevronDown, Calendar as CalendarIcon, Inbox
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Btn, Card, EmptyState, Avatar, Tag, Input, Select } from '../ui.jsx';
import { formatRelativeTime } from '../utils.js';
import api from '../api.js';
import TransmissionDetailModal from './TransmissionDetailModal.jsx';
import TransmissionFormModal from './TransmissionFormModal.jsx';

export default function TransmissionsScreen({ users, showToast }) {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'pinned' | 'mine'
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filter === 'unread') filters.unread = true;
      if (filter === 'pinned') filters.pinned = true;
      if (category) filters.category = category;
      if (search.trim()) filters.q = search.trim();
      let data = await api.transmissions.list(filters);
      if (filter === 'mine') data = data.filter(t => t.author?.id === user?.id);
      setList(data);
    } catch (e) {
      showToast(e.message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, category, search, user?.id, showToast]);

  const reloadCategories = useCallback(async () => {
    try {
      const cats = await api.transmissions.categories();
      setCategories(cats);
    } catch {}
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  const counts = useMemo(() => {
    const unread = list.filter(t => !t.read).length;
    const pinned = list.filter(t => t.pinned).length;
    return { unread, pinned, total: list.length };
  }, [list]);

  // Tri : épinglés d'abord, puis par date
  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [list]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transmissions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Notes et consignes pour toute l'équipe — avec accusés de lecture
          </p>
        </div>
        <Btn icon={Plus} onClick={() => setCreating(true)}>Nouvelle transmission</Btn>
      </header>

      {/* Barre de filtres */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input
              type="text" placeholder="Rechercher dans les transmissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill label="Toutes" count={list.length} active={filter === 'all'} onClick={() => setFilter('all')}/>
            <FilterPill label="Non lues" count={counts.unread} active={filter === 'unread'} onClick={() => setFilter('unread')} accent="rose"/>
            <FilterPill label="Épinglées" count={counts.pinned} active={filter === 'pinned'} onClick={() => setFilter('pinned')} accent="amber"/>
            <FilterPill label="Mes écrits" active={filter === 'mine'} onClick={() => setFilter('mine')}/>
          </div>

          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">Toutes catégories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </Card>

      {/* Liste */}
      {loading ? (
        <Card className="p-12 text-center text-sm text-slate-400">Chargement...</Card>
      ) : sortedList.length === 0 ? (
        <EmptyState
          icon={filter === 'unread' ? Eye : MessageSquare}
          title={
            filter === 'unread' ? 'Aucune transmission non lue' :
            filter === 'pinned' ? 'Aucune transmission épinglée' :
            filter === 'mine' ? "Vous n'avez encore rien écrit" :
            search ? 'Aucun résultat' :
            'Aucune transmission'
          }
          description={
            filter === 'all' && !search
              ? "Créez la première transmission pour informer votre équipe d'une consigne, d'une info importante ou d'une procédure."
              : "Essayez de modifier vos filtres."
          }
          action={filter === 'all' && !search && <Btn icon={Plus} onClick={() => setCreating(true)}>Nouvelle transmission</Btn>}
        />
      ) : (
        <div className="space-y-2">
          {sortedList.map(t => (
            <TransmissionCard
              key={t.id}
              transmission={t}
              onOpen={() => setDetailId(t.id)}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {detailId && (
        <TransmissionDetailModal
          id={detailId}
          users={users}
          onClose={() => { setDetailId(null); reload(); }}
          onEdit={(t) => { setDetailId(null); setEditing(t); }}
          showToast={showToast}
        />
      )}
      {(creating || editing) && (
        <TransmissionFormModal
          transmission={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
            reloadCategories();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* =========================================================
   FILTER PILL
   ========================================================= */
function FilterPill({ label, count, active, onClick, accent = 'emerald' }) {
  const activeColors = {
    emerald: 'bg-emerald-600 text-white',
    rose:    'bg-rose-600 text-white',
    amber:   'bg-amber-600 text-white'
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md font-medium transition inline-flex items-center gap-1.5 ${
        active ? activeColors[accent] : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] px-1.5 rounded-full ${
          active ? 'bg-white/20' : accent === 'rose' ? 'bg-rose-200 text-rose-800' :
                                    accent === 'amber' ? 'bg-amber-200 text-amber-800' :
                                    'bg-slate-200 text-slate-700'
        }`}>{count}</span>
      )}
    </button>
  );
}

/* =========================================================
   TRANSMISSION CARD (item dans la liste)
   ========================================================= */
function TransmissionCard({ transmission, onOpen }) {
  const { author, content, title, category, pinned, important, read, readCount, commentCount, createdAt } = transmission;
  const preview = content.slice(0, 180);

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-white rounded-xl border transition hover:shadow-sm ${
        !read ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-4 flex gap-3">
        <Avatar name={author?.displayName || '?'} size="md"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-slate-900">{author?.displayName || 'Utilisateur supprimé'}</span>
            {pinned && <Pin className="w-3.5 h-3.5 text-amber-600" title="Épinglée"/>}
            {important && <Tag color="rose" icon={AlertCircle}>Important</Tag>}
            {category && <Tag color="slate">{category}</Tag>}
            {!read && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                Non lu
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{formatRelativeTime(createdAt)}</span>
          </div>
          {title && (
            <div className={`text-sm font-semibold mb-0.5 ${!read ? 'text-slate-900' : 'text-slate-700'}`}>
              {title}
            </div>
          )}
          <div className={`text-sm whitespace-pre-line line-clamp-2 ${!read ? 'text-slate-700' : 'text-slate-500'}`}>
            {preview}{content.length > 180 ? '…' : ''}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3"/>
              {readCount} lecture{readCount > 1 ? 's' : ''}
            </span>
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3"/>
                {commentCount} commentaire{commentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
