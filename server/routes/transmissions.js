/**
 * Module Transmissions (notes équipe avec accusés de lecture).
 *
 * GET    /api/transmissions                       liste (filtres : ?unread=1, ?pinned=1, ?category=xxx, ?q=texte)
 * GET    /api/transmissions/:id                   détail (avec liste des lecteurs)
 * POST   /api/transmissions                       créer (auth requis, pas admin)
 * PUT    /api/transmissions/:id                   modifier (auteur ou admin)
 * DELETE /api/transmissions/:id                   supprimer (auteur ou admin)
 * POST   /api/transmissions/:id/pin               épingler/désépingler (admin)
 * POST   /api/transmissions/:id/read              marquer comme lu (auth)
 * POST   /api/transmissions/:id/comments          ajouter un commentaire (auth)
 * GET    /api/transmissions/:id/comments          liste des commentaires
 * DELETE /api/transmissions/comments/:cid         supprimer un commentaire (auteur ou admin)
 *
 * GET    /api/transmissions/unread-count          compteur non-lus pour l'utilisateur courant
 * GET    /api/transmissions/categories            libellés distincts utilisés
 */
const express = require('express');
const { getDb, uuid, logAudit } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

/* ---------- Helpers ---------- */

function enrichTransmission(row, userId) {
  if (!row) return null;

  const author = row.author_id
    ? getDb().prepare('SELECT id, username, display_name AS displayName, role FROM accounts WHERE id = ?').get(row.author_id)
    : null;

  const readCount = getDb().prepare(
    'SELECT COUNT(*) AS n FROM transmission_reads WHERE transmission_id = ?'
  ).get(row.id).n;

  const commentCount = getDb().prepare(
    'SELECT COUNT(*) AS n FROM transmission_comments WHERE transmission_id = ?'
  ).get(row.id).n;

  let read = false;
  if (userId) {
    const r = getDb().prepare(
      'SELECT 1 FROM transmission_reads WHERE transmission_id = ? AND account_id = ?'
    ).get(row.id, userId);
    read = !!r;
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author,
    category: row.category,
    pinned: !!row.pinned,
    important: !!row.important,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readCount,
    commentCount,
    read
  };
}

/* ---------- Routes ---------- */

router.get('/', requireAuth, (req, res) => {
  const { unread, pinned, category, q } = req.query;
  const conditions = [];
  const params = [];

  if (pinned === '1') conditions.push('t.pinned = 1');
  if (category) {
    conditions.push('t.category = ?');
    params.push(category);
  }
  if (q) {
    conditions.push('(t.title LIKE ? OR t.content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (unread === '1') {
    conditions.push(
      `t.id NOT IN (SELECT transmission_id FROM transmission_reads WHERE account_id = ${Number(req.session.userId)})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = getDb().prepare(`
    SELECT t.* FROM transmissions t
    ${where}
    ORDER BY t.pinned DESC, t.created_at DESC
    LIMIT 200
  `).all(...params);

  res.json(rows.map(r => enrichTransmission(r, req.session.userId)));
});

router.get('/unread-count', requireAuth, (req, res) => {
  const n = getDb().prepare(`
    SELECT COUNT(*) AS n FROM transmissions t
    WHERE t.id NOT IN (SELECT transmission_id FROM transmission_reads WHERE account_id = ?)
  `).get(req.session.userId).n;
  res.json({ count: n });
});

router.get('/categories', requireAuth, (_req, res) => {
  const rows = getDb().prepare(`
    SELECT DISTINCT category FROM transmissions WHERE category IS NOT NULL AND category != ''
    ORDER BY category
  `).all();
  res.json(rows.map(r => r.category));
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT * FROM transmissions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const enriched = enrichTransmission(row, req.session.userId);

  // Liste des lecteurs (pour affichage admin/auteur)
  enriched.readers = getDb().prepare(`
    SELECT a.id, a.username, a.display_name AS displayName, tr.read_at AS readAt
    FROM transmission_reads tr JOIN accounts a ON a.id = tr.account_id
    WHERE tr.transmission_id = ? ORDER BY tr.read_at DESC
  `).all(req.params.id);

  // Tous les comptes (pour savoir qui n'a PAS encore lu)
  enriched.notRead = getDb().prepare(`
    SELECT id, username, display_name AS displayName FROM accounts
    WHERE id NOT IN (SELECT account_id FROM transmission_reads WHERE transmission_id = ?)
    ORDER BY display_name
  `).all(req.params.id);

  res.json(enriched);
});

router.post('/', requireAuth, (req, res) => {
  const { title, content, category, important } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content_required' });

  const id = uuid();
  getDb().prepare(`
    INSERT INTO transmissions (id, title, content, author_id, category, important)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title?.trim() || null, content, req.session.userId, category?.trim() || null, important ? 1 : 0);

  // L'auteur est automatiquement marqué comme lecteur
  getDb().prepare(`
    INSERT OR IGNORE INTO transmission_reads (transmission_id, account_id) VALUES (?, ?)
  `).run(id, req.session.userId);

  logAudit('transmission_created', 'transmission', { id });
  const row = getDb().prepare('SELECT * FROM transmissions WHERE id = ?').get(id);
  res.json(enrichTransmission(row, req.session.userId));
});

router.put('/:id', requireAuth, (req, res) => {
  const t = getDb().prepare('SELECT * FROM transmissions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (t.author_id !== req.session.userId && req.session.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { title, content, category, important } = req.body || {};
  getDb().prepare(`
    UPDATE transmissions
       SET title = ?, content = COALESCE(?, content),
           category = ?, important = COALESCE(?, important),
           updated_at = unixepoch()
     WHERE id = ?
  `).run(
    title?.trim() || null,
    content || null,
    category?.trim() || null,
    important !== undefined ? (important ? 1 : 0) : null,
    req.params.id
  );

  logAudit('transmission_updated', 'transmission', { id: req.params.id });
  const row = getDb().prepare('SELECT * FROM transmissions WHERE id = ?').get(req.params.id);
  res.json(enrichTransmission(row, req.session.userId));
});

router.delete('/:id', requireAuth, (req, res) => {
  const t = getDb().prepare('SELECT * FROM transmissions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (t.author_id !== req.session.userId && req.session.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  getDb().prepare('DELETE FROM transmissions WHERE id = ?').run(req.params.id);
  logAudit('transmission_deleted', 'transmission', { id: req.params.id });
  res.json({ ok: true });
});

router.post('/:id/pin', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'admin_required' });
  }
  const t = getDb().prepare('SELECT pinned FROM transmissions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  const next = t.pinned ? 0 : 1;
  getDb().prepare('UPDATE transmissions SET pinned = ? WHERE id = ?').run(next, req.params.id);
  res.json({ ok: true, pinned: !!next });
});

router.post('/:id/read', requireAuth, (req, res) => {
  getDb().prepare(`
    INSERT OR IGNORE INTO transmission_reads (transmission_id, account_id, read_at)
    VALUES (?, ?, unixepoch())
  `).run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

/* ---------- Comments ---------- */

router.get('/:id/comments', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT c.id, c.content, c.created_at AS createdAt,
           a.id AS authorId, a.username AS authorUsername, a.display_name AS authorDisplayName
    FROM transmission_comments c
    LEFT JOIN accounts a ON a.id = c.author_id
    WHERE c.transmission_id = ?
    ORDER BY c.created_at
  `).all(req.params.id);
  res.json(rows);
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content_required' });
  const id = uuid();
  getDb().prepare(`
    INSERT INTO transmission_comments (id, transmission_id, author_id, content)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, req.session.userId, content);
  res.json({ id, ok: true });
});

router.delete('/comments/:cid', requireAuth, (req, res) => {
  const c = getDb().prepare('SELECT * FROM transmission_comments WHERE id = ?').get(req.params.cid);
  if (!c) return res.status(404).json({ error: 'not_found' });
  if (c.author_id !== req.session.userId && req.session.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  getDb().prepare('DELETE FROM transmission_comments WHERE id = ?').run(req.params.cid);
  res.json({ ok: true });
});

module.exports = router;
