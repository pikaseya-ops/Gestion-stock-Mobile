import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, Truck, GraduationCap, AlertTriangle, Trophy, Tag as TagIcon,
  Flame, Layout, Check, Sparkles
} from 'lucide-react';
import { Modal, Btn, Input, Card } from '../ui.jsx';
import api from '../api.js';

/* Mapping icônes + couleurs des modèles */
const TEMPLATE_ICONS = {
  CalendarCheck, Truck, GraduationCap, AlertTriangle, Trophy, Tag: TagIcon, Flame, Layout
};

const COLOR_STYLES = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  sky:     'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
  violet:  'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
  rose:    'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
  amber:   'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  pink:    'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
  slate:   'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
};

export default function NewBoardModal({ onClose, onCreated, showToast }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);  // template key or 'blank'
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.tasks.listTemplates()
      .then(setTemplates)
      .catch(() => showToast('Erreur de chargement des modèles', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const submit = async () => {
    setCreating(true);
    try {
      let board;
      if (!selected || selected === 'blank' || selected === 'vierge') {
        board = await api.tasks.createBoard({
          title: customTitle.trim() || 'Nouveau tableau',
          icon: 'Layout',
          color: 'slate'
        });
        showToast('Tableau créé');
      } else {
        board = await api.tasks.createFromTemplate(selected, customTitle.trim() || null);
        showToast('Tableau créé depuis le modèle');
      }
      onCreated(board);
    } catch (e) {
      showToast(e.message || 'Erreur de création', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau tableau"
      subtitle="Partez d'un modèle prêt à l'emploi ou créez un tableau vierge"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {selected && selected !== 'blank' && templates.find(t => t.key === selected) && (
              <>Modèle : <span className="font-medium text-slate-700">
                {templates.find(t => t.key === selected)?.title}
              </span></>
            )}
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn onClick={submit} disabled={!selected || creating} icon={Sparkles}>
              {creating ? 'Création...' : 'Créer le tableau'}
            </Btn>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Titre du tableau (optionnel)"
          placeholder="Laisser vide pour utiliser le titre du modèle"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
        />

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Chargement...</div>
        ) : (
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2 uppercase tracking-wider">Choisir un modèle</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map(t => {
                const Icon = TEMPLATE_ICONS[t.icon] || Layout;
                const isSelected = selected === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelected(t.key)}
                    className={`p-3 text-left border rounded-lg transition relative ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : `border-slate-200 bg-white hover:border-slate-300`
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white"/>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COLOR_STYLES[t.color] || COLOR_STYLES.slate}`}>
                        <Icon className="w-4 h-4"/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900">{t.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
                        <div className="text-[11px] text-slate-400 mt-1.5">
                          {t.columnCount} colonne{t.columnCount > 1 ? 's' : ''}
                          {t.taskCount > 0 && ` · ${t.taskCount} tâche${t.taskCount > 1 ? 's' : ''} exemple`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
