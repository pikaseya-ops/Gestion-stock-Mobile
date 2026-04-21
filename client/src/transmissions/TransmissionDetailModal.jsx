import React, { useEffect, useState, useCallback } from 'react';
import {
  Pin, PinOff, Edit2, Trash2, AlertCircle, Eye, CheckCircle2,
  Send, MessageSquare, Calendar as CalendarIcon
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Modal, Btn, Avatar, Tag, Textarea, ConfirmDialog } from '../ui.jsx';
import { formatRelativeTime } from '../utils.js';
import api from '../api.js';

export default function TransmissionDetailModal({ id, users, onClose, onEdit, showToast }) {
  const { user, isAdmin } = useAuth();
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReaders, setShowReaders] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, cmts] = await Promise.all([
        api.transmissions.detail(id),
        api.transmissions.comments(id)
      ]);
      setT(detail);
      setComments(cmts);
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [id, onClose, showToast]);

  useEffect(() => { reload(); }, [reload]);

  // Marquer comme lu automatiquement à l'ouverture (une seule fois)
  useEffect(() => {
    if (t && !t.read) {
      api.transmissions.markRead(id).catch(() => {});
    }
  }, [t?.id, t?.read, id]);

  const isAuthor = t?.author?.id === user?.id;
  const canEdit = isAuthor || isAdmin;

  const pinToggle = async () => {
    try {
      await api.transmissions.pin(id);
      reload();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
  };

  const remove = async () => {
    try {
      await api.transmissions.remove(id);
      showToast('Transmission supprimée', 'warning');
      onClose();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await api.transmissions.addComment(id, newComment.trim());
      setNewComment('');
      const cmts = await api.transmissions.comments(id);
      setComments(cmts);
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (cid) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await api.transmissions.removeComment(cid);
      const cmts = await api.transmissions.comments(id);
      setComments(cmts);
    } catch (e) { showToast(e.message || 'Erreur', 'error'); }
  };

  if (loading || !t) {
    return (
      <Modal open onClose={onClose} title="Chargement...">
        <div className="text-center py-8 text-slate-400 text-sm">Chargement de la transmission...</div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={t.title || 'Transmission'}
        subtitle={`Par ${t.author?.displayName || 'Utilisateur supprimé'} · ${formatRelativeTime(t.createdAt)}`}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Btn variant="ghost" size="sm" icon={t.pinned ? PinOff : Pin} onClick={pinToggle}>
                  {t.pinned ? 'Désépingler' : 'Épingler'}
                </Btn>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>Supprimer</Btn>
                  <Btn variant="secondary" size="sm" icon={Edit2} onClick={() => onEdit(t)}>Modifier</Btn>
                </>
              )}
              <Btn onClick={onClose}>Fermer</Btn>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {t.important && <Tag color="rose" icon={AlertCircle}>Important — accusé de lecture requis</Tag>}
            {t.pinned && <Tag color="amber" icon={Pin}>Épinglée</Tag>}
            {t.category && <Tag color="slate">{t.category}</Tag>}
          </div>

          {/* Contenu */}
          <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
            {t.content}
          </div>

          {/* Accusés de lecture */}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => setShowReaders(s => !s)}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              <Eye className="w-3.5 h-3.5"/>
              Lu par {t.readCount} / {t.readCount + (t.notRead?.length || 0)}
              {t.notRead?.length > 0 && <span className="text-rose-600 ml-1">(+{t.notRead.length} non lu)</span>}
              <span className="text-slate-400 text-[10px]">{showReaders ? '(masquer)' : '(afficher)'}</span>
            </button>

            {showReaders && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1.5">Ont lu</div>
                  {t.readers.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Personne encore</div>
                  ) : (
                    <ul className="space-y-1">
                      {t.readers.map(r => (
                        <li key={r.id} className="flex items-center gap-2 text-xs">
                          <Avatar name={r.displayName} size="xs"/>
                          <span className="text-slate-700 truncate">{r.displayName}</span>
                          <span className="text-slate-400 ml-auto text-[10px]">{formatRelativeTime(r.readAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 mb-1.5">N'ont pas lu</div>
                  {(!t.notRead || t.notRead.length === 0) ? (
                    <div className="text-xs text-emerald-600 italic">Toute l'équipe a lu ✓</div>
                  ) : (
                    <ul className="space-y-1">
                      {t.notRead.map(r => (
                        <li key={r.id} className="flex items-center gap-2 text-xs">
                          <Avatar name={r.displayName} size="xs"/>
                          <span className="text-slate-700 truncate">{r.displayName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Commentaires */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
              <MessageSquare className="w-3.5 h-3.5"/>
              Commentaires {comments.length > 0 && `(${comments.length})`}
            </div>

            {comments.length > 0 && (
              <ul className="space-y-3 mb-3">
                {comments.map(c => (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar name={c.authorDisplayName || '?'} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-slate-700">{c.authorDisplayName || 'Supprimé'}</span>
                        <span className="text-[10px] text-slate-400">{formatRelativeTime(c.createdAt)}</span>
                        {(c.authorId === user?.id || isAdmin) && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-[10px] text-slate-400 hover:text-rose-600 ml-auto"
                          >Supprimer</button>
                        )}
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-line">{c.content}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  rows={2}
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment();
                  }}
                />
              </div>
              <Btn
                icon={Send}
                onClick={postComment}
                disabled={!newComment.trim() || posting}
                size="sm"
                className="self-start mt-0.5"
              >
                {posting ? '...' : 'Envoyer'}
              </Btn>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette transmission ?"
        description="La transmission et tous ses commentaires seront définitivement supprimés."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmDelete(false); remove(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
