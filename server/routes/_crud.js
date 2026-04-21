/**
 * Construit un routeur CRUD pour une collection (tableau d'objets) stockée
 * sous une clé unique dans la table KV.
 *
 *   GET    /              -> renvoie le tableau complet
 *   POST   /              -> ajoute un élément (génère un id si absent)
 *   PUT    /:id           -> remplace un élément par id
 *   DELETE /:id           -> supprime un élément par id
 *   PUT    /              -> remplace TOUT le tableau (utile pour import/sync)
 *
 * Toutes les opérations d'écriture exigent une session admin.
 */
const express = require('express');
const { kvGet, kvSet, logAudit } = require('../db');
const { requireAuth } = require('./auth');

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildCollectionRouter(storageKey, entityName) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json(kvGet(storageKey, []));
  });

  router.post('/', requireAuth, (req, res) => {
    const arr = kvGet(storageKey, []);
    const item = { ...req.body, id: req.body?.id || uuid() };
    arr.push(item);
    kvSet(storageKey, arr);
    logAudit('create', entityName, { id: item.id });
    res.json(item);
  });

  router.put('/:id', requireAuth, (req, res) => {
    const arr = kvGet(storageKey, []);
    const idx = arr.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not_found' });
    arr[idx] = { ...req.body, id: req.params.id };
    kvSet(storageKey, arr);
    logAudit('update', entityName, { id: req.params.id });
    res.json(arr[idx]);
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const arr = kvGet(storageKey, []);
    const next = arr.filter(x => x.id !== req.params.id);
    if (next.length === arr.length) return res.status(404).json({ error: 'not_found' });
    kvSet(storageKey, next);
    logAudit('delete', entityName, { id: req.params.id });
    res.json({ ok: true });
  });

  // Remplace tout le tableau (utile pour synchronisation en bloc)
  router.put('/', requireAuth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'array_expected' });
    }
    kvSet(storageKey, req.body);
    logAudit('replace_all', entityName, { count: req.body.length });
    res.json({ ok: true, count: req.body.length });
  });

  return router;
}

module.exports = { buildCollectionRouter };
