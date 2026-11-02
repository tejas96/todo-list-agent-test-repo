import TodoList from "@/components/TodoList";
import { listTodos } from "@/lib/db/todo-store";

// Read the in-memory store on every request instead of prerendering at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      <h1>Todo App</h1>
      <TodoList todos={listTodos()} />
    </main>
  );
}
