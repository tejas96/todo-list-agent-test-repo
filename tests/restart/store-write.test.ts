// TC-AC2B-01 part 1 of 2. tests/smoke.mjs runs this file in its own
// `npx vitest run` process, then runs store-read.test.ts in a new process.
import { describe, expect, it } from "vitest";
import { addTodo, listTodos } from "@/lib/db/todo-store";

describe("TC-AC2B-01 process restart (invocation 1)", () => {
  it("adds one todo in this process", () => {
    addTodo("Temp");
    expect(listTodos()).toHaveLength(1);
  });
});
