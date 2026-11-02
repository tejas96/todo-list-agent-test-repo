// TC-AC2B-01 part 2 of 2. Runs in a new process after store-write.test.ts.
// It does not clear globalThis on purpose: a new process must start empty.
import { describe, expect, it } from "vitest";
import { listTodos } from "@/lib/db/todo-store";

describe("TC-AC2B-01 process restart (invocation 2)", () => {
  it("starts with an empty store in a new process", () => {
    expect(listTodos()).toEqual([]);
  });
});
