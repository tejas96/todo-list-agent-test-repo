// Test helper B for TC-AC2A-01: imports the store on its own and reads from it.
import { listTodos, type Todo } from "@/lib/db/todo-store";

export function readShared(): Todo[] {
  return listTodos();
}
