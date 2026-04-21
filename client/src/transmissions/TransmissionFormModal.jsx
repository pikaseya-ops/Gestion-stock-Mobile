import React, { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Modal, Btn, Input, Textarea, Toggle, Select } from '../ui.jsx';
import api from '../api.js';

export default function TransmissionFormModal({ transmission, onClose, onSaved, showToast }) {
  const isEdit = !!transmission?.id;
  const [title, setTitle] = useState(transmission?.title || '');
  const [content, setContent] = useState(transmission?.content || '');
  const [category, setCategory] = useState(transmission?.category || '');
  const [important, setImportant] = useState(transmission?.important || false);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.transmissions.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const submit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const finalCategory = (newCategory.trim() || category) || null;
    const payload = {
      title: title.trim() || null,
      content: content.trim(),
      category: finalCategory,
      important
    };
    try {
      if (isEdit) {
        await api.transmissions.update(transmission.id, payload);
        showToast('Transmission modifiée');
      } else {
        await api.transmissions.create(payload);
        showToast('Transmission publiée');
      }
      onSaved();
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier la transmission' : 'Nouvelle transmission'}
      subtitle={!isEdit ? 'Visible par toute votre équipe' : undefined}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn icon={Save} onClick={submit} disabled={saving || !content.trim()}>
            {saving ? 'Publication...' : (isEdit ? 'Enregistrer' : 'Publier')}
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Titre (optionnel)"
          placeholder="ex. Nouvelle procédure pour les commandes Cooper"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <Textarea
          label="Message *"
          rows={8}
          placeholder="Écrivez votre transmission ici..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Catégorie existante (optionnel)"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setNewCategory(''); }}
            disabled={!!newCategory.trim()}
          >
            <option value="">— Aucune catégorie —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>

          <Input
            label="Ou nouvelle catégorie"
            placeholder="ex. Frigos, Caisses, AQ..."
            value={newCategory}
            onChange={(e) => { setNewCategory(e.target.value); if (e.target.value) setCategory(''); }}
          />
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <Toggle
            checked={important}
            onChange={setImportant}
            label={
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600"/>
                Marquer comme importante
              </span>
            }
            hint="Affiché avec un badge visible ; permet de facilement identifier qui a lu / n'a pas encore lu."
          />
        </div>
      </div>
    </Modal>
  );
}
