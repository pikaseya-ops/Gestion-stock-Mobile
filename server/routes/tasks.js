/**
 * Module Tâches (Kanban).
 *
 * Boards :
 *   GET    /api/tasks/boards                       liste tous les tableaux non-archivés
 *   POST   /api/tasks/boards                       crée un tableau
 *   PUT    /api/tasks/boards/:id                   modifie un tableau
 *   DELETE /api/tasks/boards/:id                   supprime un tableau
 *   POST   /api/tasks/boards/:id/archive           archive/désarchive
 *   POST   /api/tasks/boards/from-template         crée un tableau depuis un modèle
 *   GET    /api/tasks/boards/templates             liste des modèles disponibles
 *
 * Columns (à l'intérieur d'un board) :
 *   POST   /api/tasks/boards/:bid/columns          ajoute une colonne
 *   PUT    /api/tasks/columns/:id                  modifie une colonne
 *   DELETE /api/tasks/columns/:id                  supprime une colonne
 *   POST   /api/tasks/columns/reorder              réordonne les colonnes
 *
 * Tasks :
 *   GET    /api/tasks/boards/:bid/tasks            liste les tâches d'un board (avec assignees, checklist)
 *   POST   /api/tasks/boards/:bid/tasks            crée une tâche
 *   PUT    /api/tasks/tasks/:id                    modifie une tâche
 *   DELETE /api/tasks/tasks/:id                    supprime une tâche
 *   POST   /api/tasks/tasks/:id/move               change colonne et/ou ordre
 *   POST   /api/tasks/tasks/:id/complete           marque comme terminée
 *   POST   /api/tasks/tasks/:id/uncomplete         remet en cours
 *   POST   /api/tasks/tasks/:id/checklist          ajoute un item à la checklist
 *   PUT    /api/tasks/checklist/:id                modifie un item
 *   DELETE /api/tasks/checklist/:id                supprime un item
 *
 * Vues spéciales :
 *   GET    /api/tasks/my                           mes tâches assignées (toutes boards)
 *   GET    /api/tasks/today                        tâches d'aujourd'hui
 *   GET    /api/tasks/overdue                      tâches en retard
 */
const express = require('express');
const { getDb, uuid, logAudit } = require('../db');
const { requireAuth, requireAdmin } = require('./auth');
const { OFFICINE_TEMPLATES } = require('./_task_templates');

const router = express.Router();

/* ============================================================
   HELPERS
   ============================================================ */

function loadTaskFull(id) {
  const t = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!t) return null;
  return enrichTask(t);
}

function enrichTask(t) {
  const assignees = getDb().prepare(`
    SELECT a.id, a.username, a.display_name AS displayName, a.role
    FROM task_assignees ta JOIN accounts a ON a.id = ta.account_id
    WHERE ta.task_id = ?
  `).all(t.id);

  const checklist = getDb().prepare(`
    SELECT id, content, done, sort_order AS sortOrder
    FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order
  `).all(t.id).map(it => ({ ...it, done: !!it.done }));

  const commentCount = getDb().prepare(
    'SELECT COUNT(*) AS n FROM task_comments WHERE task_id = ?'
  ).get(t.id).n;

  return {
    id: t.id,
    boardId: t.board_id,
    columnId: t.column_id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueDate: t.due_date,
    labels: t.labels ? JSON.parse(t.labels) : [],
    sortOrder: t.sort_order,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    createdBy: t.created_by,
    recurrenceId: t.recurrence_id,
    assignees,
    checklist,
    commentCount
  };
}

function nextSortOrder(table, where, params = []) {
  const row = getDb().prepare(
    `SELECT COALESCE(MAX(sort_order), -1) + 10 AS n FROM ${table} WHERE ${where}`
  ).get(...params);
  return row.n;
}

/* ============================================================
   BOARDS
   ============================================================ */

router.get('/boards', requireAuth, (_req, res) => {
  const boards = getDb().prepare(`
    SELECT id, title, icon, color, sort_order AS sortOrder, archived, created_at AS createdAt
    FROM boards WHERE archived = 0 ORDER BY sort_order, title
  `).all();

  // Compter les colonnes et les tâches en cours
  boards.forEach(b => {
    b.columnCount = getDb().prepare(
      'SELECT COUNT(*) AS n FROM board_columns WHERE board_id = ?'
    ).get(b.id).n;
    b.taskCount = getDb().prepare(
      'SELECT COUNT(*) AS n FROM tasks WHERE board_id = ? AND completed_at IS NULL'
    ).get(b.id).n;
    b.archived = !!b.archived;
  });

  res.json(boards);
});

router.post('/boards', requireAdmin, (req, res) => {
  const { title, icon, color } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  const id = uuid();
  const sortOrder = nextSortOrder('boards', '1=1');

  getDb().prepare(`
    INSERT INTO boards (id, title, icon, color, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title.trim(), icon || null, color || null, sortOrder, req.session.userId);

  // Colonnes par défaut
  ['À faire', 'En cours', 'Terminé'].forEach((t, i) => {
    getDb().prepare(`
      INSERT INTO board_columns (id, board_id, title, sort_order, done_state)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), id, t, i * 10, i === 2 ? 1 : 0);
  });

  logAudit('board_created', 'board', { id, title });
  res.json({ id, title, icon, color, sortOrder, archived: false });
});

router.put('/boards/:id', requireAdmin, (req, res) => {
  const { title, icon, color } = req.body || {};
  const r = getDb().prepare(`
    UPDATE boards SET title = COALESCE(?, title),
                       icon  = ?,
                       color = ?
     WHERE id = ?
  `).run(title?.trim() || null, icon || null, color || null, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  logAudit('board_updated', 'board', { id: req.params.id });
  res.json({ ok: true });
});

router.delete('/boards/:id', requireAdmin, (req, res) => {
  const r = getDb().prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  logAudit('board_deleted', 'board', { id: req.params.id });
  res.json({ ok: true });
});

router.post('/boards/:id/archive', requireAdmin, (req, res) => {
  const cur = getDb().prepare('SELECT archived FROM boards WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const next = cur.archived ? 0 : 1;
  getDb().prepare('UPDATE boards SET archived = ? WHERE id = ?').run(next, req.params.id);
  logAudit('board_archived', 'board', { id: req.params.id, archived: !!next });
  res.json({ ok: true, archived: !!next });
});

router.get('/boards/templates', requireAuth, (_req, res) => {
  res.json(OFFICINE_TEMPLATES.map(t => ({
    key: t.key,
    title: t.title,
    description: t.description,
    icon: t.icon,
    color: t.color,
    columnCount: t.columns.length,
    taskCount: t.tasks?.length || 0
  })));
});

/* Récupère les colonnes d'un tableau */
router.get('/boards/:id/columns-list', requireAuth, (req, res) => {
  const cols = getDb().prepare(`
    SELECT id, title, color, sort_order AS sortOrder, done_state AS doneState
    FROM board_columns WHERE board_id = ? ORDER BY sort_order
  `).all(req.params.id);
  res.json(cols.map(c => ({ ...c, doneState: !!c.doneState })));
});

router.post('/boards/from-template', requireAdmin, (req, res) => {
  const { templateKey, title } = req.body || {};
  const tmpl = OFFICINE_TEMPLATES.find(t => t.key === templateKey);
  if (!tmpl) return res.status(404).json({ error: 'template_not_found' });

  const boardId = uuid();
  const sortOrder = nextSortOrder('boards', '1=1');
  const finalTitle = title?.trim() || tmpl.title;

  const tx = getDb().transaction(() => {
    getDb().prepare(`
      INSERT INTO boards (id, title, icon, color, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(boardId, finalTitle, tmpl.icon, tmpl.color, sortOrder, req.session.userId);

    const colIdMap = {};
    tmpl.columns.forEach((c, idx) => {
      const cid = uuid();
      colIdMap[c.key] = cid;
      getDb().prepare(`
        INSERT INTO board_columns (id, board_id, title, color, sort_order, done_state)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cid, boardId, c.title, c.color || null, idx * 10, c.done ? 1 : 0);
    });

    (tmpl.tasks || []).forEach((task, idx) => {
      const cid = colIdMap[task.column];
      if (!cid) return;
      const tid = uuid();
      getDb().prepare(`
        INSERT INTO tasks (id, board_id, column_id, title, description, priority, labels, sort_order, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tid, boardId, cid,
        task.title,
        task.description || null,
        task.priority || 'normal',
        task.labels ? JSON.stringify(task.labels) : null,
        idx * 10,
        req.session.userId
      );
      (task.checklist || []).forEach((item, j) => {
        getDb().prepare(`
          INSERT INTO task_checklist_items (id, task_id, content, done, sort_order)
          VALUES (?, ?, ?, 0, ?)
        `).run(uuid(), tid, item, j * 10);
      });
    });
  });
  tx();

  logAudit('board_from_template', 'board', { id: boardId, template: templateKey });
  res.json({ id: boardId, title: finalTitle });
});

/* ============================================================
   COLUMNS
   ============================================================ */

router.get('/boards/:bid/columns-list', requireAuth, (req, res) => {
  const cols = getDb().prepare(`
    SELECT id, board_id AS boardId, title, color, sort_order AS sortOrder, done_state
    FROM board_columns WHERE board_id = ? ORDER BY sort_order, title
  `).all(req.params.bid);
  res.json(cols.map(c => ({ ...c, doneState: !!c.done_state })));
});

router.post('/boards/:bid/columns', requireAdmin, (req, res) => {
  const { title, color, doneState } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  const id = uuid();
  const sortOrder = nextSortOrder('board_columns', 'board_id = ?', [req.params.bid]);
  getDb().prepare(`
    INSERT INTO board_columns (id, board_id, title, color, sort_order, done_state)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.bid, title.trim(), color || null, sortOrder, doneState ? 1 : 0);
  res.json({ id, title, color, sortOrder, doneState: !!doneState });
});

router.put('/columns/:id', requireAdmin, (req, res) => {
  const { title, color, doneState } = req.body || {};
  const r = getDb().prepare(`
    UPDATE board_columns SET title = COALESCE(?, title),
                              color = ?,
                              done_state = COALESCE(?, done_state)
     WHERE id = ?
  `).run(
    title?.trim() || null,
    color || null,
    doneState !== undefined ? (doneState ? 1 : 0) : null,
    req.params.id
  );
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.delete('/columns/:id', requireAdmin, (req, res) => {
  // Refuser la suppression s'il reste des tâches
  const taskCount = getDb().prepare('SELECT COUNT(*) AS n FROM tasks WHERE column_id = ?').get(req.params.id).n;
  if (taskCount > 0) {
    return res.status(400).json({ error: 'column_not_empty', message: `${taskCount} tâche(s) à déplacer d'abord` });
  }
  const r = getDb().prepare('DELETE FROM board_columns WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.post('/columns/reorder', requireAdmin, (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order_array_required' });
  const tx = getDb().transaction(() => {
    order.forEach((id, idx) => {
      getDb().prepare('UPDATE board_columns SET sort_order = ? WHERE id = ?').run(idx * 10, id);
    });
  });
  tx();
  res.json({ ok: true });
});

/* ============================================================
   TASKS
   ============================================================ */

router.get('/boards/:bid/tasks', requireAuth, (req, res) => {
  const showCompleted = req.query.completed === '1';
  const tasks = getDb().prepare(`
    SELECT * FROM tasks WHERE board_id = ?
    ${showCompleted ? '' : 'AND completed_at IS NULL'}
    ORDER BY sort_order, created_at
  `).all(req.params.bid);
  res.json(tasks.map(enrichTask));
});

router.post('/boards/:bid/tasks', requireAuth, (req, res) => {
  const { columnId, title, description, priority, dueDate, labels, assigneeIds } = req.body || {};
  if (!columnId || !title) return res.status(400).json({ error: 'missing_fields' });

  const id = uuid();
  const sortOrder = nextSortOrder('tasks', 'column_id = ?', [columnId]);

  const tx = getDb().transaction(() => {
    getDb().prepare(`
      INSERT INTO tasks (id, board_id, column_id, title, description, priority, due_date, labels, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.params.bid, columnId,
      title.trim(),
      description || null,
      priority || 'normal',
      dueDate || null,
      labels ? JSON.stringify(labels) : null,
      sortOrder,
      req.session.userId
    );
    (assigneeIds || []).forEach(aid => {
      getDb().prepare(`
        INSERT OR IGNORE INTO task_assignees (task_id, account_id) VALUES (?, ?)
      `).run(id, aid);
    });
  });
  tx();

  logAudit('task_created', 'task', { id, title, board: req.params.bid });
  res.json(loadTaskFull(id));
});

router.put('/tasks/:id', requireAuth, (req, res) => {
  const { title, description, priority, dueDate, labels, assigneeIds } = req.body || {};
  const t = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });

  const tx = getDb().transaction(() => {
    getDb().prepare(`
      UPDATE tasks SET title = COALESCE(?, title),
                       description = ?,
                       priority = COALESCE(?, priority),
                       due_date = ?,
                       labels = ?
       WHERE id = ?
    `).run(
      title?.trim() || null,
      description !== undefined ? description : t.description,
      priority || null,
      dueDate !== undefined ? dueDate : t.due_date,
      labels !== undefined ? (labels ? JSON.stringify(labels) : null) : t.labels,
      req.params.id
    );

    if (Array.isArray(assigneeIds)) {
      getDb().prepare('DELETE FROM task_assignees WHERE task_id = ?').run(req.params.id);
      assigneeIds.forEach(aid => {
        getDb().prepare(`
          INSERT OR IGNORE INTO task_assignees (task_id, account_id) VALUES (?, ?)
        `).run(req.params.id, aid);
      });
    }
  });
  tx();

  logAudit('task_updated', 'task', { id: req.params.id });
  res.json(loadTaskFull(req.params.id));
});

router.delete('/tasks/:id', requireAuth, (req, res) => {
  // member ne peut supprimer que ses propres tâches
  const t = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (req.session.role !== 'admin' && t.created_by !== req.session.userId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  logAudit('task_deleted', 'task', { id: req.params.id });
  res.json({ ok: true });
});

router.post('/tasks/:id/move', requireAuth, (req, res) => {
  const { columnId, sortOrder } = req.body || {};
  if (!columnId) return res.status(400).json({ error: 'columnId_required' });
  const t = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });

  const newOrder = (sortOrder !== undefined)
    ? sortOrder
    : nextSortOrder('tasks', 'column_id = ?', [columnId]);

  // Si la colonne cible est marquée done -> auto-completion
  const col = getDb().prepare('SELECT done_state FROM board_columns WHERE id = ?').get(columnId);
  const completedAt = col?.done_state ? Math.floor(Date.now()/1000) : null;

  getDb().prepare(`
    UPDATE tasks SET column_id = ?, sort_order = ?, completed_at = ?
     WHERE id = ?
  `).run(columnId, newOrder, completedAt, req.params.id);

  logAudit('task_moved', 'task', { id: req.params.id, to: columnId });
  res.json(loadTaskFull(req.params.id));
});

router.post('/tasks/:id/complete', requireAuth, (req, res) => {
  getDb().prepare(
    'UPDATE tasks SET completed_at = unixepoch() WHERE id = ?'
  ).run(req.params.id);
  res.json(loadTaskFull(req.params.id));
});

router.post('/tasks/:id/uncomplete', requireAuth, (req, res) => {
  getDb().prepare(
    'UPDATE tasks SET completed_at = NULL WHERE id = ?'
  ).run(req.params.id);
  res.json(loadTaskFull(req.params.id));
});

/* ---------- Checklist ---------- */

router.post('/tasks/:id/checklist', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content_required' });
  const id = uuid();
  const sortOrder = nextSortOrder('task_checklist_items', 'task_id = ?', [req.params.id]);
  getDb().prepare(`
    INSERT INTO task_checklist_items (id, task_id, content, done, sort_order)
    VALUES (?, ?, ?, 0, ?)
  `).run(id, req.params.id, content.trim(), sortOrder);
  res.json({ id, content: content.trim(), done: false, sortOrder });
});

router.put('/checklist/:id', requireAuth, (req, res) => {
  const { content, done } = req.body || {};
  const r = getDb().prepare(`
    UPDATE task_checklist_items SET content = COALESCE(?, content),
                                     done = COALESCE(?, done)
     WHERE id = ?
  `).run(
    content?.trim() || null,
    done !== undefined ? (done ? 1 : 0) : null,
    req.params.id
  );
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.delete('/checklist/:id', requireAuth, (req, res) => {
  const r = getDb().prepare('DELETE FROM task_checklist_items WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* ============================================================
   VUES SPÉCIALES
   ============================================================ */

router.get('/my', requireAuth, (req, res) => {
  const tasks = getDb().prepare(`
    SELECT t.* FROM tasks t
    JOIN task_assignees ta ON ta.task_id = t.id
    WHERE ta.account_id = ? AND t.completed_at IS NULL
    ORDER BY (CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END), t.due_date, t.created_at
  `).all(req.session.userId);
  res.json(tasks.map(enrichTask));
});

router.get('/today', requireAuth, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = getDb().prepare(`
    SELECT * FROM tasks
     WHERE completed_at IS NULL AND due_date = ?
     ORDER BY created_at
  `).all(today);
  res.json(tasks.map(enrichTask));
});

router.get('/overdue', requireAuth, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = getDb().prepare(`
    SELECT * FROM tasks
     WHERE completed_at IS NULL AND due_date IS NOT NULL AND due_date < ?
     ORDER BY due_date
  `).all(today);
  res.json(tasks.map(enrichTask));
});

module.exports = router;
