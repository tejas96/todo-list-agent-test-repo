// Todo logic. Pure functions, used by the browser app and the tests.

let nextId = 1;

export function addTodo(todos, text) {
  const t = String(text ?? '').trim();
  if (!t) throw new Error('Todo text is required');
  return [...todos, { id: nextId++, text: t, done: false }];
}

export function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function serialize(todos) {
  return JSON.stringify(todos);
}

export function deserialize(json) {
  if (!json) return [];
  const saved = JSON.parse(json);
  nextId = saved.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  return saved.map((t) => ({ id: t.id, text: t.text, done: false }));
}
