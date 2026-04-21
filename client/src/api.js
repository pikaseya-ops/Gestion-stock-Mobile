/**
 * Client API : wrapper fetch typé pour tous les endpoints du backend.
 *
 * - Toutes les requêtes incluent les cookies (credentials: 'include')
 * - Les erreurs 401 → callback global (redirection login)
 * - Les erreurs sont normalisées en { error, message, status }
 */

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

/* Helper bas-niveau */
async function request(method, url, body, opts = {}) {
  const init = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw { error: 'network_error', message: 'Serveur injoignable', status: 0 };
  }

  if (res.status === 401 && unauthorizedHandler && !opts.skipAuthRedirect) {
    unauthorizedHandler();
  }

  // Pas de contenu (DELETE/204)
  if (res.status === 204) return null;

  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const err = (typeof data === 'object' && data) ? data : { error: 'http_error' };
    throw { ...err, status: res.status };
  }
  return data;
}

const get    = (url, opts) => request('GET',    url, undefined, opts);
const post   = (url, body, opts) => request('POST',   url, body, opts);
const put    = (url, body, opts) => request('PUT',    url, body, opts);
const patch  = (url, body, opts) => request('PATCH',  url, body, opts);
const del    = (url, opts) => request('DELETE', url, undefined, opts);

/* ============================================================
   AUTH
   ============================================================ */
export const auth = {
  status:   () => get('/api/auth/status', { skipAuthRedirect: true }),
  setup:    (username, password, displayName) => post('/api/auth/setup', { username, password, displayName }, { skipAuthRedirect: true }),
  login:    (username, password) => post('/api/auth/login', { username, password }, { skipAuthRedirect: true }),
  logout:   () => post('/api/auth/logout', {}, { skipAuthRedirect: true }),
  password: (oldPassword, newPassword) => post('/api/auth/password', { oldPassword, newPassword }),

  // Gestion utilisateurs (admin)
  listUsers:    () => get('/api/auth/users'),
  listTeam:     () => get('/api/auth/team'),
  createUser:   (data) => post('/api/auth/users', data),
  updateUser:   (id, data) => put(`/api/auth/users/${id}`, data),
  deleteUser:   (id) => del(`/api/auth/users/${id}`),
  resetPassword:(id, newPassword) => post(`/api/auth/users/${id}/reset-password`, { newPassword })
};

/* ============================================================
   PLANNING (collections / singletons)
   ============================================================ */
function makeCollection(base) {
  return {
    list:    () => get(base),
    add:     (item) => post(base, item),
    update:  (id, item) => put(`${base}/${id}`, item),
    remove:  (id) => del(`${base}/${id}`),
    replaceAll: (items) => put(base, items)
  };
}
function makeSingleton(base) {
  return {
    get:    () => get(base),
    set:    (obj) => put(base, obj),
    patch:  (obj) => patch(base, obj)
  };
}

export const staff     = makeCollection('/api/staff');
export const leaves    = makeCollection('/api/leaves');
export const settings  = makeSingleton('/api/settings');
export const coverage  = makeSingleton('/api/coverage');
export const plannings = makeSingleton('/api/plannings');

/* ============================================================
   BACKUP
   ============================================================ */
export const backup = {
  list:     () => get('/api/backup/list'),
  now:      () => post('/api/backup/now', {}),
  exportUrl: () => '/api/backup/export',
  import:   (data) => post('/api/backup/import', data),
  download: (name) => `/api/backup/download/${encodeURIComponent(name)}`
};

/* ============================================================
   TASKS
   ============================================================ */
export const tasks = {
  // Boards
  listBoards:        () => get('/api/tasks/boards'),
  createBoard:       (data) => post('/api/tasks/boards', data),
  updateBoard:       (id, data) => put(`/api/tasks/boards/${id}`, data),
  deleteBoard:       (id) => del(`/api/tasks/boards/${id}`),
  archiveBoard:      (id) => post(`/api/tasks/boards/${id}/archive`, {}),
  listTemplates:     () => get('/api/tasks/boards/templates'),
  createFromTemplate:(templateKey, title) => post('/api/tasks/boards/from-template', { templateKey, title }),

  // Columns
  listColumns:   (bid) => get(`/api/tasks/boards/${bid}/columns-list`),
  createColumn:  (bid, data) => post(`/api/tasks/boards/${bid}/columns`, data),
  updateColumn:  (id, data) => put(`/api/tasks/columns/${id}`, data),
  deleteColumn:  (id) => del(`/api/tasks/columns/${id}`),
  reorderColumns:(order) => post('/api/tasks/columns/reorder', { order }),

  // Tasks
  listTasks:    (bid, includeCompleted = false) =>
    get(`/api/tasks/boards/${bid}/tasks${includeCompleted ? '?completed=1' : ''}`),
  createTask:   (bid, data) => post(`/api/tasks/boards/${bid}/tasks`, data),
  updateTask:   (id, data) => put(`/api/tasks/tasks/${id}`, data),
  deleteTask:   (id) => del(`/api/tasks/tasks/${id}`),
  moveTask:     (id, columnId, sortOrder) => post(`/api/tasks/tasks/${id}/move`, { columnId, sortOrder }),
  completeTask: (id) => post(`/api/tasks/tasks/${id}/complete`, {}),
  uncompleteTask:(id) => post(`/api/tasks/tasks/${id}/uncomplete`, {}),

  // Checklist
  addChecklistItem:    (tid, content) => post(`/api/tasks/tasks/${tid}/checklist`, { content }),
  updateChecklistItem: (id, data) => put(`/api/tasks/checklist/${id}`, data),
  deleteChecklistItem: (id) => del(`/api/tasks/checklist/${id}`),

  // Vues spéciales
  myTasks:      () => get('/api/tasks/my'),
  todayTasks:   () => get('/api/tasks/today'),
  overdueTasks: () => get('/api/tasks/overdue')
};

/* ============================================================
   TRANSMISSIONS
   ============================================================ */
export const transmissions = {
  list: (filters = {}) => {
    const qs = new URLSearchParams();
    if (filters.unread)   qs.set('unread', '1');
    if (filters.pinned)   qs.set('pinned', '1');
    if (filters.category) qs.set('category', filters.category);
    if (filters.q)        qs.set('q', filters.q);
    const q = qs.toString();
    return get(`/api/transmissions${q ? '?' + q : ''}`);
  },
  detail:       (id) => get(`/api/transmissions/${id}`),
  create:       (data) => post('/api/transmissions', data),
  update:       (id, data) => put(`/api/transmissions/${id}`, data),
  remove:       (id) => del(`/api/transmissions/${id}`),
  pin:          (id) => post(`/api/transmissions/${id}/pin`, {}),
  markRead:     (id) => post(`/api/transmissions/${id}/read`, {}),
  unreadCount:  () => get('/api/transmissions/unread-count'),
  categories:   () => get('/api/transmissions/categories'),
  comments:     (id) => get(`/api/transmissions/${id}/comments`),
  addComment:   (id, content) => post(`/api/transmissions/${id}/comments`, { content }),
  removeComment:(cid) => del(`/api/transmissions/comments/${cid}`)
};

export default {
  auth, staff, leaves, settings, coverage, plannings,
  backup, tasks, transmissions, setUnauthorizedHandler
};
