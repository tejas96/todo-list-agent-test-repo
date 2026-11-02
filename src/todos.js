// Todo logic. Pure functions, used by the browser app and the tests.

let nextId = 1;

// A due date is a 'YYYY-MM-DD' string that names a real calendar date.
// UTC is used only for this check; the stored string is never reformatted.
function isValidDueDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() + 1 === m &&
    date.getUTCDate() === d
  );
}

export function addTodo(todos, text, dueDate) {
  const t = String(text ?? '').trim();
  if (!t) throw new Error('Todo text is required');
  const due = dueDate === undefined || dueDate === null || dueDate === '' ? null : dueDate;
  if (due !== null && !isValidDueDate(due)) {
    throw new Error('Due date must be a valid YYYY-MM-DD date');
  }
  return [...todos, { id: nextId++, text: t, done: false, dueDate: due }];
}

export function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function deleteTodo(todos, id) {
  return todos.filter((t) => t.id !== id);
}

// Earliest due date first, undated todos last, ties in creation (id) order.
// Sorts a copy, so the input array is never reordered.
export function sortByDueDate(todos) {
  return [...todos].sort((a, b) => {
    const da = a.dueDate ?? null;
    const db = b.dueDate ?? null;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da < db ? -1 : 1;
    }
    return a.id - b.id;
  });
}

export function serialize(todos) {
  return JSON.stringify(todos);
}

export function deserialize(json) {
  if (!json) return [];
  const saved = JSON.parse(json);
  nextId = saved.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  return saved.map((t) => ({ id: t.id, text: t.text, done: false, dueDate: isValidDueDate(t.dueDate) ? t.dueDate : null }));
}
