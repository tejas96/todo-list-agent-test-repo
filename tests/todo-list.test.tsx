import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TodoList from "@/components/TodoList";
import type { Todo } from "@/lib/db/todo-store";

function makeTodo(id: string, title: string): Todo {
  return {
    id,
    title,
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("TodoList component (src/components/TodoList.tsx)", () => {
  it("TC-NEW-03 test_todo_list_component_renders_empty_items_and_escapes", () => {
    const empty = renderToStaticMarkup(<TodoList todos={[]} />);
    expect(empty).toContain("No todos yet");
    expect(empty).not.toContain("<li");

    const two = renderToStaticMarkup(
      <TodoList todos={[makeTodo("t1", "Alpha"), makeTodo("t2", "Beta")]} />,
    );
    expect(two).not.toContain("No todos yet");
    const items = [...two.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
    expect(items).toEqual(["Alpha", "Beta"]);

    const escaped = renderToStaticMarkup(
      <TodoList todos={[makeTodo("t3", "<b>x</b>")]} />,
    );
    expect(escaped).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(escaped).not.toContain("<b>");
  });
});
