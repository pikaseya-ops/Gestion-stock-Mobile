/**
 * Pour les "objets singletons" (un seul objet/dictionnaire stocké sous une clé) :
 *   GET  /  -> renvoie l'objet
 *   PUT  /  -> remplace l'objet entier
 *   PATCH / -> fusionne les champs
 */
const express = require('express');
const { kvGet, kvSet, logAudit } = require('../db');
const { requireAuth } = require('./auth');

function buildSingletonRouter(storageKey, entityName, defaults = {}) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json(kvGet(storageKey, defaults));
  });

  router.put('/', requireAuth, (req, res) => {
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ error: 'object_expected' });
    }
    kvSet(storageKey, req.body);
    logAudit('replace', entityName);
    res.json({ ok: true });
  });

  router.patch('/', requireAuth, (req, res) => {
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ error: 'object_expected' });
    }
    const current = kvGet(storageKey, defaults);
    const next = { ...current, ...req.body };
    kvSet(storageKey, next);
    logAudit('patch', entityName);
    res.json(next);
  });

  return router;
}

module.exports = { buildSingletonRouter };
