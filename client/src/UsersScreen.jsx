import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Trash2, Edit2, Key, Shield, ShieldCheck, User as UserIcon, RefreshCw } from 'lucide-react';
import { useAuth } from './auth.jsx';
import api from './api.js';
import { Btn, Input, Select, Modal, Card, EmptyState, Tag, Avatar, Toast, ConfirmDialog } from './ui.jsx';
import { fmtDateFR, formatRelativeTime } from './utils.js';

export default function UsersScreen({ staff }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.auth.listUsers();
      setUsers(list);
    } catch (e) {
      setToast({ message: e.message || 'Erreur', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (u) => {
    try {
      await api.auth.deleteUser(u.id);
      setToast({ message: `Compte "${u.displayName}" supprimé`, type: 'success' });
      reload();
    } catch (e) {
      setToast({ message: e.message || 'Suppression impossible', type: 'error' });
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Comptes utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez les accès de votre équipe à l'application.</p>
        </div>
        <Btn icon={Plus} onClick={() => setCreating(true)}>Nouveau compte</Btn>
      </header>

      {loading ? (
        <Card className="p-12 text-center text-slate-400">Chargement...</Card>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="Aucun compte" description="Créez le premier compte pour votre équipe." />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                <th className="text-left px-4 py-3 font-medium">Identifiant</th>
                <th className="text-left px-4 py-3 font-medium">Rôle</th>
                <th className="text-left px-4 py-3 font-medium">Lié à employé</th>
                <th className="text-left px-4 py-3 font-medium">Dernière connexion</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const linkedStaff = staff?.find(s => s.id === u.staffId);
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.displayName} size="md"/>
                        <div className="font-medium text-slate-900">
                          {u.displayName}
                          {isMe && <span className="ml-2 text-xs text-slate-400 font-normal">(vous)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">
                      {u.role === 'admin'
                        ? <Tag color="emerald" icon={ShieldCheck}>Administrateur</Tag>
                        : <Tag color="slate" icon={UserIcon}>Membre</Tag>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {linkedStaff ? linkedStaff.name : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {u.lastLogin ? formatRelativeTime(u.lastLogin) : <span className="text-slate-400">jamais</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Btn variant="ghost" size="sm" icon={Key} onClick={() => setResetting(u)} title="Réinitialiser le mot de passe"/>
                        <Btn variant="ghost" size="sm" icon={Edit2} onClick={() => setEditing(u)} title="Modifier"/>
                        {!isMe && (
                          <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(u)} title="Supprimer"/>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {creating && (
        <UserFormModal
          mode="create"
          staff={staff}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); setToast({ message: 'Compte créé', type: 'success' }); }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      )}

      {editing && (
        <UserFormModal
          mode="edit"
          user={editing}
          staff={staff}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setToast({ message: 'Compte modifié', type: 'success' }); }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => { setResetting(null); setToast({ message: 'Mot de passe réinitialisé', type: 'success' }); }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer ce compte ?"
        description={confirmDelete && `Le compte "${confirmDelete.displayName}" sera définitivement supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)}/>
    </div>
  );
}

function UserFormModal({ mode, user, staff, onClose, onSaved, onError }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'member');
  const [staffId, setStaffId] = useState(user?.staffId || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      if (mode === 'create') {
        await api.auth.createUser({ username, password, displayName, role, staffId: staffId || null });
      } else {
        await api.auth.updateUser(user.id, { displayName, role, staffId: staffId || null });
      }
      onSaved();
    } catch (err) {
      onError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Nouveau compte' : 'Modifier le compte'}
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={submit} disabled={saving || !displayName || (mode === 'create' && (!username || !password))}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Nom affiché" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus/>
        <Input
          label="Identifiant de connexion"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={mode === 'edit'}
          hint={mode === 'edit' ? "L'identifiant ne peut pas être modifié" : undefined}
        />
        {mode === 'create' && (
          <Input label="Mot de passe initial" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="6 caractères minimum"/>
        )}
        <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">Membre — consulte, coche ses tâches, lit/écrit transmissions</option>
          <option value="admin">Administrateur — accès complet</option>
        </Select>
        <Select
          label="Lier à un employé du planning (optionnel)"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          hint="Permet d'identifier qui est qui dans l'équipe et de retrouver son planning"
        >
          <option value="">— Aucun lien —</option>
          {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone, onError }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPassword.length < 6) { onError('Mot de passe trop court (6 caractères min.)'); return; }
    setSaving(true);
    try {
      await api.auth.resetPassword(user.id, newPassword);
      onDone();
    } catch (err) {
      onError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Réinitialiser le mot de passe de ${user.displayName}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn onClick={submit} disabled={saving || !newPassword}>Réinitialiser</Btn>
        </div>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        Définissez un nouveau mot de passe. Communiquez-le à l'utilisateur, qui pourra
        le changer ensuite depuis son profil.
      </p>
      <Input label="Nouveau mot de passe" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus/>
    </Modal>
  );
}
