import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/lib/db/todo-store";

type StoreModule = typeof import("@/lib/db/todo-store");

const g = globalThis as unknown as { __todoStore?: Todo[] };

const storeSourcePath = fileURLToPath(
  new URL("../src/lib/db/todo-store.ts", import.meta.url),
);

async function loadStore(): Promise<StoreModule> {
  return import("@/lib/db/todo-store");
}

describe("in-memory todo store (src/lib/db/todo-store.ts)", () => {
  // Isolation: every test starts from an empty store and a fresh module registry.
  beforeEach(() => {
    delete g.__todoStore;
    vi.resetModules();
  });

  it("TC-AC2-01 test_store_list_returns_empty_on_fresh_start", async () => {
    const store = await loadStore();
    const todos = store.listTodos();
    expect(Array.isArray(todos)).toBe(true);
    expect(todos).toHaveLength(0);
  });

  it("TC-AC2-02 test_store_add_returns_todo_with_expected_shape", async () => {
    const store = await loadStore();
    const todo = store.addTodo("Buy milk");

    expect(typeof todo.id).toBe("string");
    expect(todo.id.length).toBeGreaterThan(0);
    expect(todo.title).toBe("Buy milk");
    expect(todo.completed).toBe(false);
    expect(typeof todo.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(todo.createdAt))).toBe(false);
    expect(new Date(todo.createdAt).toISOString()).toBe(todo.createdAt);

    const todos = store.listTodos();
    expect(todos).toHaveLength(1);
    expect(todos[0]).toStrictEqual(todo);
  });

  it("TC-AC2-03 test_store_add_twice_gives_unique_ids", async () => {
    const store = await loadStore();
    store.addTodo("First");
    store.addTodo("Second");

    const todos = store.listTodos();
    expect(todos.map((t) => t.title)).toEqual(["First", "Second"]);
    expect(todos[0].id).not.toBe(todos[1].id);
  });

  it("TC-AC2-04 test_store_keeps_special_characters_in_title", async () => {
    const store = await loadStore();
    const special = "O'Brien & Co – 100% café <b>x</b>";
    store.addTodo(special);
    store.addTodo("  padded  ");

    const todos = store.listTodos();
    expect(todos).toHaveLength(2);
    expect(todos[0].title).toBe(special);
    expect(todos[0].title.length).toBe(special.length);
    expect(todos[1].title).toBe("  padded  ");
  });

  it("TC-AC2A-01 test_store_shared_across_importing_modules", async () => {
    const { addShared } = await import("./helpers/add-shared");
    const { readShared } = await import("./helpers/read-shared");

    addShared();
    const seen = readShared();

    expect(seen).toHaveLength(1);
    expect(seen[0].title).toBe("Shared");
  });

  it("TC-AC2A-02 test_store_survives_module_reload_via_globalThis", async () => {
    const first = await loadStore();
    first.addTodo("Before reload");

    // Simulate a dev hot-reload: drop the module cache but keep globalThis.
    vi.resetModules();
    const second = await loadStore();

    expect(second).not.toBe(first);
    const todos = second.listTodos();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("Before reload");
    expect(g.__todoStore).toHaveLength(1);
  });

  it("TC-NEW-02 test_list_todos_returns_copy_not_internal_array", async () => {
    const store = await loadStore();
    store.addTodo("One");

    const a = store.listTodos();
    a.push({
      id: "x",
      title: "Injected",
      completed: false,
      createdAt: new Date().toISOString(),
    });
    a.splice(0, 1);

    const again = store.listTodos();
    expect(again).toHaveLength(1);
    expect(again[0].title).toBe("One");
  });

  it("TC-REG-03 test_store_exports_only_list_and_add", async () => {
    const store = await loadStore();
    expect(Object.keys(store).sort()).toEqual(["addTodo", "listTodos"]);

    const source = readFileSync(storeSourcePath, "utf8");
    expect(source).not.toMatch(
      /export\s+(async\s+)?(function|const|let|var)\s+\w*(update|delete|remove)\w*/i,
    );
  });
});
