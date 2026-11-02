import "server-only";

/**
 * In-memory todo store.
 *
 * Data lives only in the memory of the current server process. It is lost
 * whenever the process restarts and is not shared between processes.
 * The single store instance is kept on globalThis under the key
 * "__todoStore" so that every importer sees the same data and the data
 * survives development hot-reloads.
 */

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

const g = globalThis as unknown as { __todoStore?: Todo[] };
const todos: Todo[] = (g.__todoStore ??= []);

/** Returns all todos as a shallow copy, so callers cannot change the store. */
export function listTodos(): Todo[] {
  return [...todos];
}

/** Adds a todo with the given title and returns it. */
export function addTodo(title: string): Todo {
  const todo: Todo = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  return todo;
}
