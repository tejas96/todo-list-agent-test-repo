// Test helper A for TC-AC2A-01: imports the store on its own and writes to it.
import { addTodo, type Todo } from "@/lib/db/todo-store";

export function addShared(): Todo {
  return addTodo("Shared");
}
