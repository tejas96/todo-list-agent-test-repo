// Static checks on project files (package.json, README.md, folders, source).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(read(rel)) as Record<string, unknown>;
}

function walk(dirRel: string): string[] {
  const out: string[] = [];
  const abs = join(root, dirRel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(relative(root, full)));
    } else {
      out.push(relative(root, full));
    }
  }
  return out;
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

type Pkg = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

const pkg = readJson("package.json") as Pkg;
const readme = read("README.md");

const DB_PACKAGES = [
  "pg",
  "mysql2",
  "mongodb",
  "mongoose",
  "sqlite3",
  "better-sqlite3",
  "prisma",
  "@prisma/client",
  "redis",
  "ioredis",
];

describe("project files", () => {
  it("TC-AC1-02 test_package_json_scripts_and_lockfile", () => {
    expect(pkg.scripts?.dev).toBe("next dev");
    expect(pkg.scripts?.build).toBe("next build");
    expect(pkg.scripts?.start).toBe("next start");
    expect(pkg.dependencies?.next).toBeTruthy();
    expect(git(["ls-files", "package-lock.json"]).trim()).toBe(
      "package-lock.json",
    );
  });

  it("TC-AC2-05 test_store_module_uses_no_external_storage", () => {
    const files = walk("src/lib/db");
    expect(files.length).toBeGreaterThan(0);
    const forbiddenModule =
      /(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s+)["'](?:node:)?(fs|path|net|http|https|pg|mysql2|mongodb|mongoose|sqlite3|better-sqlite3|prisma|@prisma\/client|redis|ioredis)(?:\/[^"']*)?["']/;
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(forbiddenModule);
      expect(source, file).not.toMatch(/\bfetch\s*\(/);
    }
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    for (const name of DB_PACKAGES) {
      expect(Object.keys(allDeps), name).not.toContain(name);
    }
  });

  it("TC-AC2-06 (static part) page.tsx imports listTodos from the store", () => {
    expect(read("src/app/page.tsx")).toMatch(
      /import\s*\{[^}]*\blistTodos\b[^}]*\}\s*from\s*["']@\/lib\/db\/todo-store["']/,
    );
    const tsconfig = readJson("tsconfig.json") as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions?.paths?.["@/*"]).toEqual(["./src/*"]);
  });

  it("TC-AC2C-02 test_store_module_marked_server_only", () => {
    const firstLine = read("src/lib/db/todo-store.ts")
      .split(/\r?\n/)
      .find((line) => line.trim() !== "");
    expect(firstLine?.trim()).toMatch(/^import\s+["']server-only["'];?$/);

    expect(pkg.dependencies?.["server-only"]).toBeTruthy();

    const todoList = read("src/components/TodoList.tsx");
    const storeImports = todoList
      .split(/\r?\n/)
      .filter((line) => /["']@\/lib\/db\/todo-store["']/.test(line));
    expect(storeImports.length).toBeGreaterThan(0);
    for (const line of storeImports) {
      expect(line).toMatch(/^\s*import\s+type\s*\{[^}]*\bTodo\b[^}]*\}/);
    }
  });

  it("TC-AC4-01 test_folder_structure_separates_routes_components_data", () => {
    for (const dir of ["src/app", "src/components", "src/lib/db"]) {
      expect(existsSync(join(root, dir)) && statSync(join(root, dir)).isDirectory(), dir).toBe(true);
    }
    expect(existsSync(join(root, "src/components/TodoList.tsx"))).toBe(true);

    const definition =
      /export\s+(?:async\s+)?(?:function\s+(listTodos|addTodo)\b|(?:const|let|var)\s+(listTodos|addTodo)\b)/;
    const definers = walk("src").filter((file) =>
      definition.test(read(file)),
    );
    expect(definers).toEqual(["src/lib/db/todo-store.ts"]);
  });

  it("TC-AC4-02 test_readme_describes_each_source_folder", () => {
    const lines = readme.split(/\r?\n/);
    const rowFor = (folder: string): string =>
      lines.find((line) => line.includes("`" + folder + "/`")) ?? "";

    expect(rowFor("src/app")).toMatch(/route|page/i);
    expect(rowFor("src/components")).toMatch(/component/i);
    expect(rowFor("src/lib/db")).toMatch(/data access|store/i);
    expect(rowFor("tests")).toMatch(/test/i);
  });

  it("TC-AC5-01 test_readme_contains_required_sections", () => {
    expect(readme.trim()).not.toBe("# todo-list-agent-test-repo");
    expect(readme.split(/\r?\n/).filter((l) => l.trim()).length).toBeGreaterThan(1);

    expect(readme).toMatch(/Node\.js[^\n]*\d+\.\d+\.\d+/);
    for (const needle of [
      "npm install",
      "npm run dev",
      "http://localhost:3000",
      "npm run build",
      "npm run start",
    ]) {
      expect(readme, needle).toContain(needle);
    }
    expect(readme).toMatch(/in(-|\s)memory|memory of the running server/i);
    expect(readme).toMatch(/lost[^\n]*restart/i);
    expect(readme).toMatch(/not shared between[^\n]*(process|instance)/i);

    const hasTestScript = Boolean(pkg.scripts?.test);
    expect(readme.includes("npm test")).toBe(hasTestScript);
  });

  it("TC-NEW-01 test_engines_node_matches_readme_node_version", () => {
    const engines = pkg.engines?.node;
    expect(engines).toBeTruthy();

    const section = readme.split(/^## /m).find((s) => s.startsWith("Requirements"));
    expect(section).toBeTruthy();
    const nodeLine = (section ?? "")
      .split(/\r?\n/)
      .find((line) => /Node\.js/.test(line));
    const stated = nodeLine?.match(/`([^`]+)`/)?.[1];
    expect(stated).toBe(engines);
  });

  it("TC-REG-01 (file part) generated demo files removed", () => {
    expect(existsSync(join(root, "src/app/page.module.css"))).toBe(false);
    const page = read("src/app/page.tsx");
    expect(page).not.toMatch(/page\.module\.css|next\/image|\.svg["']/);
    const publicFiles = walk("public");
    for (const file of publicFiles) {
      const name = file.split("/").pop() ?? "";
      const referenced = walk("src").some((src) => read(src).includes(name));
      expect(referenced, file).toBe(true);
    }
  });

  it("TC-REG-02 (static part) layout.tsx is a server component without demo links", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).not.toMatch(/["']use client["']/);
    expect(layout).not.toMatch(/vercel\.com|nextjs\.org/);
    expect(layout).toMatch(/<html\s+lang=["']en["']/);
    expect(layout).toMatch(/title:\s*["']Todo App["']/);
  });

  it("TC-REG-04 test_server_only_alias_is_test_only", () => {
    const vitestConfig = read("vitest.config.mts");
    expect(vitestConfig).toMatch(
      /["']server-only["']\s*:[\s\S]*?tests\/stubs\/server-only\.ts/,
    );
    expect(read("next.config.ts")).not.toContain("server-only");
    expect(read("tsconfig.json")).not.toContain("server-only");

    // In package.json server-only may only appear as a dependency, not as a mapping.
    const pkgRaw = readJson("package.json") as Record<string, unknown>;
    for (const key of ["imports", "browser", "alias", "overrides"]) {
      expect(JSON.stringify(pkgRaw[key] ?? {}), key).not.toContain("server-only");
    }
    expect(pkg.devDependencies?.["server-only"]).toBeUndefined();
    expect(existsSync(join(root, "node_modules/server-only/package.json"))).toBe(true);
  });

  it("TC-REG-05 test_home_page_is_server_component_with_no_api_routes", () => {
    const page = read("src/app/page.tsx");
    expect(page).not.toMatch(/["']use client["']/);
    expect(page).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);

    const appFiles = walk("src/app");
    const routes = appFiles.filter((f) => /(^|\/)route\.tsx?$/.test(f));
    expect(routes).toEqual([]);
    const serverActions = appFiles.filter((f) =>
      /["']use server["']/.test(read(f)),
    );
    expect(serverActions).toEqual([]);
  });

  it("TC-REG-06 test_next_config_has_no_static_export", () => {
    const config = read("next.config.ts");
    expect(config).not.toMatch(/\boutput\s*:/);
    expect(config).not.toMatch(/experimental/);
  });
});
