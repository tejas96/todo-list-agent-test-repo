#!/usr/bin/env node
// Integration smoke tests for TD-1 (test plan v2).
//
// Usage: node tests/smoke.mjs [--keep]
//        node tests/smoke.mjs --port=3100   (or SMOKE_PORT=3100, if 3000 is taken)
//
// The script clones the committed HEAD of this repository into a new temporary
// folder (a clean checkout without node_modules/ or .next/), copies the current
// tests/ folder into it, and then runs the npm commands, starts the dev and
// production servers on http://localhost:3000 and checks exit codes, HTML and
// git status. The working tree of this repository is never changed.
// The temporary folder is deleted at the end unless --keep is given.
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const keep = process.argv.includes("--keep");
// The plan uses http://localhost:3000 (the Next.js default). Set SMOKE_PORT to
// use another port when 3000 is taken on the test machine; next dev and
// next start both read the PORT environment variable.
const portArg = process.argv.find((a) => a.startsWith("--port="))?.slice(7);
const PORT = Number(portArg ?? process.env.SMOKE_PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;
const ENV = {
  ...process.env,
  PORT: String(PORT),
  NEXT_TELEMETRY_DISABLED: "1",
  FORCE_COLOR: "0",
  NO_COLOR: "1",
};

const results = [];
function record(id, ok, details) {
  const status = ok ? "passed" : "failed";
  results.push({ id, status, details });
  console.log(`[${status.toUpperCase()}] ${id}: ${details}`);
}
function tail(text, lines = 15) {
  return text.trim().split(/\r?\n/).slice(-lines).join("\n");
}

function run(cmd, args, cwd, timeoutMs = 900_000) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: ENV,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status,
    out: `${r.stdout ?? ""}${r.stderr ?? ""}`,
    stdout: r.stdout ?? "",
    error: r.error ? String(r.error) : "",
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path) {
  try {
    const res = await fetch(BASE + path, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: "", error: String(err) };
  }
}

async function portIsFree() {
  return (await get("/")).status === 0;
}

function startServer(cwd, script) {
  const child = spawn("npm", ["run", script], {
    cwd,
    env: ENV,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const server = { child, log: "", exited: false };
  child.stdout.on("data", (d) => (server.log += d));
  child.stderr.on("data", (d) => (server.log += d));
  child.on("exit", () => (server.exited = true));
  return server;
}

async function waitFor200(server, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let last = { status: 0, body: "" };
  while (Date.now() < end && !server.exited) {
    last = await get("/");
    if (last.status === 200) return last;
    await sleep(1000);
  }
  return last;
}

async function stopServer(server) {
  try {
    process.kill(-server.child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 20 && !server.exited; i++) await sleep(500);
  if (!server.exited) {
    try {
      process.kill(-server.child.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  for (let i = 0; i < 20; i++) {
    if (await portIsFree()) return;
    await sleep(500);
  }
}

function errorLines(log) {
  return log
    .split(/\r?\n/)
    .filter((line) => /Error|error -|Unhandled/.test(line));
}

function checkHome(page) {
  const problems = [];
  if (page.status !== 200) problems.push(`HTTP ${page.status}`);
  if (!/<h1[^>]*>\s*Todo App\s*<\/h1>/.test(page.body))
    problems.push("no <h1>Todo App</h1>");
  if (!page.body.includes("No todos yet")) problems.push("no 'No todos yet'");
  return problems;
}

function gitStatus(cwd, ...paths) {
  return run("git", ["status", "--porcelain", "--untracked-files=all", ...paths], cwd)
    .stdout.trim();
}

function walk(dir, root = dir, skip = new Set(["node_modules", ".next", ".git"])) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, root, skip));
    else out.push({ rel: relative(root, full), mtime: statSync(full).mtimeMs });
  }
  return out;
}

async function main() {
  if (!(await portIsFree())) {
    console.error(`Port ${PORT} is already in use. Stop the process on it and re-run.`);
    process.exit(2);
  }

  // ---- Clean checkout -------------------------------------------------------
  const work = mkdtempSync(join(tmpdir(), "td1-smoke-"));
  const app = join(work, "repo");
  const clone = run("git", ["clone", "--quiet", repoRoot, app], work);
  if (clone.code !== 0) {
    console.error(`git clone failed: ${clone.out}${clone.error}`);
    process.exit(2);
  }
  const head = run("git", ["rev-parse", "HEAD"], app).stdout.trim();
  console.log(`Clean checkout of ${head} in ${app}`);
  // Bring in the QA test files that are not committed yet.
  cpSync(join(repoRoot, "tests"), join(app, "tests"), { recursive: true });
  const baseline = gitStatus(app);
  const intentional = new Set(baseline.split(/\r?\n/).filter(Boolean));
  console.log(`Uncommitted QA files copied into the clone:\n${baseline}`);

  // ---- TC-AC1-01: npm install + dev server -----------------------------------
  const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
  const semver = createRequire(join(repoRoot, "package.json"))("semver");
  const nodeOk = semver.satisfies(process.versions.node, pkg.engines?.node ?? "");
  const install = run("npm", ["install"], app);
  console.log(`npm install exit ${install.code}\n${tail(install.out, 6)}`);

  const dev1 = startServer(app, "dev");
  const home1 = await waitFor200(dev1, 60_000);
  const missing = await get("/does-not-exist");
  await sleep(1000);
  await stopServer(dev1);
  const dev1Ready = /Ready/.test(dev1.log) && dev1.log.includes(`localhost:${PORT}`);
  const dev1Errors = errorLines(dev1.log);

  record(
    "TC-AC1-01",
    nodeOk && install.code === 0 && home1.status === 200 && dev1Ready && dev1Errors.length === 0,
    `node ${process.versions.node} satisfies engines '${pkg.engines?.node}': ${nodeOk}; ` +
      `npm install exit ${install.code}; GET / -> ${home1.status}; dev log ready: ${dev1Ready}; ` +
      `error lines: ${JSON.stringify(dev1Errors)}`,
  );
  const ac3 = checkHome(home1);
  record(
    "TC-AC3-01",
    ac3.length === 0 && dev1Errors.length === 0,
    `plain fetch GET / -> ${home1.status}; problems: ${JSON.stringify(ac3)}; ` +
      `server log error lines: ${JSON.stringify(dev1Errors)}`,
  );
  record(
    "TC-AC3-03",
    missing.status === 404 && dev1Errors.length === 0,
    `GET /does-not-exist -> ${missing.status}; server log error lines: ${JSON.stringify(dev1Errors)}`,
  );

  // ---- TC-AC2B-02: dev restart shows empty store ----------------------------
  const dev2 = startServer(app, "dev");
  const home2 = await waitFor200(dev2, 60_000);
  await stopServer(dev2);
  const run1 = checkHome(home1);
  const run2 = checkHome(home2);
  record(
    "TC-AC2B-02",
    run1.length === 0 && run2.length === 0,
    `dev run 1: HTTP ${home1.status}, problems ${JSON.stringify(run1)}; ` +
      `dev run 2: HTTP ${home2.status}, problems ${JSON.stringify(run2)}`,
  );

  // ---- TC-AC1-03: npm ci from the committed lockfile -------------------------
  rmSync(join(app, "node_modules"), { recursive: true, force: true });
  const ci = run("npm", ["ci"], app);
  const pkgStatus = run("git", ["status", "--porcelain", "package.json", "package-lock.json"], app)
    .stdout.trim();
  record(
    "TC-AC1-03",
    ci.code === 0 && pkgStatus === "",
    `npm ci exit ${ci.code} (${tail(ci.out, 3).replace(/\n/g, " | ")}); ` +
      `git status package.json package-lock.json: '${pkgStatus}' (after npm install and npm ci)`,
  );

  // Fresh-checkout type check (observation only): no .next/ types, no next-env.d.ts.
  rmSync(join(app, ".next"), { recursive: true, force: true });
  rmSync(join(app, "next-env.d.ts"), { force: true });
  const tscFresh = run("npx", ["tsc", "--noEmit"], app);
  console.log(`[INFO] tsc --noEmit before any next build/dev (no generated types): exit ${tscFresh.code}\n${tail(tscFresh.out, 8)}`);

  // ---- TC-AC6-01 / TC-NEW-04: production build -------------------------------
  const build = run("npm", ["run", "build"], app);
  const buildBad = build.out
    .split(/\r?\n/)
    .filter((l) => /Type error|Failed to compile|Error:/.test(l));
  record(
    "TC-AC6-01",
    build.code === 0 && buildBad.length === 0 && existsSync(join(app, ".next")),
    `npm run build exit ${build.code}; bad lines ${JSON.stringify(buildBad)}; .next exists: ${existsSync(join(app, ".next"))}`,
  );
  const routeLine = build.stdout.split(/\r?\n/).find((l) => /^[┌├└│]\s*\S+\s+\/\s*$/.test(l.trim()));
  record(
    "TC-NEW-04",
    Boolean(routeLine && routeLine.includes("ƒ")),
    `route table line for '/': '${routeLine?.trim() ?? "not found"}'`,
  );

  // ---- TC-AC2-06: type check -------------------------------------------------
  const pageSrc = readFileSync(join(app, "src/app/page.tsx"), "utf8");
  const importsStore = /import\s*\{[^}]*\blistTodos\b[^}]*\}\s*from\s*["']@\/lib\/db\/todo-store["']/.test(pageSrc);
  const tsc = run("npx", ["tsc", "--noEmit"], app);
  record(
    "TC-AC2-06",
    importsStore && tsc.code === 0,
    `page.tsx imports listTodos from '@/lib/db/todo-store': ${importsStore}; ` +
      `npx tsc --noEmit (after npm run build) exit ${tsc.code}${tsc.code ? `: ${tail(tsc.out, 8)}` : ""}; ` +
      `before any build/dev on a fresh checkout tsc exit was ${tscFresh.code}`,
  );

  // ---- TC-AC6-02 / TC-REG-02: production server ------------------------------
  const prod = startServer(app, "start");
  const prodHome = await waitFor200(prod, 30_000);
  await stopServer(prod);
  const prodErrors = errorLines(prod.log);
  const prodProblems = checkHome(prodHome);
  record(
    "TC-AC6-02",
    prodProblems.length === 0 && prodErrors.length === 0,
    `npm run start, GET / -> ${prodHome.status}; problems ${JSON.stringify(prodProblems)}; log error lines ${JSON.stringify(prodErrors)}`,
  );
  const hasLang = /<html[^>]*\blang="en"/.test(prodHome.body);
  const hasTitle = /<title>Todo App<\/title>/.test(prodHome.body);
  const layout = readFileSync(join(app, "src/app/layout.tsx"), "utf8");
  const layoutOk = !/["']use client["']/.test(layout) && !/vercel\.com|nextjs\.org/.test(layout);
  record(
    "TC-REG-02",
    prodHome.status === 200 && hasLang && hasTitle && layoutOk,
    `prod HTML <html lang="en">: ${hasLang}; <title>Todo App</title>: ${hasTitle}; layout.tsx has no 'use client' and no demo links: ${layoutOk}`,
  );

  // ---- TC-NEW-05: npm test on the clean checkout -----------------------------
  const test = run("npm", ["test"], app);
  const ranStore = test.out.includes("tests/todo-store.test.ts");
  const failedTests = /Tests\s+.*\bfailed\b/.test(test.out);
  record(
    "TC-NEW-05",
    test.code === 0 && ranStore && !failedTests,
    `npm test exit ${test.code}; ran tests/todo-store.test.ts: ${ranStore}; summary: ${tail(test.out, 5).replace(/\n/g, " | ")}`,
  );

  // ---- TC-AC2B-01: store empty after process restart -------------------------
  const startedAt = Date.now();
  const before = gitStatus(app);
  const inv1 = run("npx", ["vitest", "run", "tests/restart/store-write.test.ts"], app);
  const inv2 = run("npx", ["vitest", "run", "tests/restart/store-read.test.ts"], app);
  const after = gitStatus(app);
  const newDataFiles = walk(app)
    .filter((f) => f.mtime >= startedAt && /\.(json|db|sqlite)$/.test(f.rel))
    .map((f) => f.rel);
  record(
    "TC-AC2B-01",
    inv1.code === 0 && inv2.code === 0 && before === after && newDataFiles.length === 0,
    `invocation 1 (addTodo('Temp'), length 1) exit ${inv1.code}; invocation 2 (new process, listTodos() is []) exit ${inv2.code}; ` +
      `git status unchanged: ${before === after}; new data files: ${JSON.stringify(newDataFiles)}`,
  );

  // ---- TC-REG-01: lint -------------------------------------------------------
  const lint = run("npm", ["run", "lint"], app);
  const lintErrors = lint.out.match(/\((\d+) errors?/);
  record(
    "TC-REG-01",
    lint.code === 0 && (!lintErrors || lintErrors[1] === "0") &&
      !existsSync(join(app, "src/app/page.module.css")),
    `npm run lint exit ${lint.code}; output: ${tail(lint.out, 6).replace(/\n/g, " | ") || "(none)"}; ` +
      `src/app/page.module.css exists: ${existsSync(join(app, "src/app/page.module.css"))}; public/ exists: ${existsSync(join(app, "public"))}`,
  );

  // ---- TC-AC2C-01: client import of the store must fail the build ------------
  const leakPath = join(app, "src/components/LeakTest.tsx");
  writeFileSync(
    leakPath,
    `"use client";\n\nimport { listTodos } from "@/lib/db/todo-store";\n\n` +
      `export default function LeakTest() {\n  return <p>{listTodos().length}</p>;\n}\n`,
  );
  const pagePath = join(app, "src/app/page.tsx");
  const leakPage = pageSrc
    .replace(`import TodoList from "@/components/TodoList";`, `import TodoList from "@/components/TodoList";\nimport LeakTest from "@/components/LeakTest";`)
    .replace("<TodoList todos={listTodos()} />", "<TodoList todos={listTodos()} />\n      <LeakTest />");
  writeFileSync(pagePath, leakPage);
  const leakApplied = leakPage.includes("<LeakTest />") && leakPage.includes("import LeakTest");
  const leakBuild = run("npm", ["run", "build"], app);
  const namesStore = leakBuild.out.includes("todo-store");
  const mentionsGuard = /server-only|Client Component/.test(leakBuild.out);
  const guardLine = leakBuild.out.split(/\r?\n/).find((l) => /server-only/.test(l)) ?? "";
  rmSync(leakPath, { force: true });
  run("git", ["checkout", "--", "src/app/page.tsx"], app);
  const revertBuild = run("npm", ["run", "build"], app);
  const srcStatus = run("git", ["status", "--porcelain", "src"], app).stdout.trim();
  record(
    "TC-AC2C-01",
    leakApplied && leakBuild.code !== 0 && namesStore && mentionsGuard && revertBuild.code === 0 && srcStatus === "",
    `leak build exit ${leakBuild.code}; output names todo-store: ${namesStore}; mentions server-only/Client Component: ${mentionsGuard} ('${guardLine.trim()}'); ` +
      `after revert build exit ${revertBuild.code}; git status src: '${srcStatus}'`,
  );

  // ---- TC-AC7-01: generated files are ignored ---------------------------------
  const finalStatus = gitStatus(app);
  const lines = finalStatus.split(/\r?\n/).filter(Boolean);
  const artefacts = lines.filter((l) => /^\?\? (node_modules|\.next|coverage)\//.test(l) || l.includes("next-env.d.ts"));
  const unexpected = lines.filter((l) => !intentional.has(l));
  record(
    "TC-AC7-01",
    artefacts.length === 0 && unexpected.length === 0,
    `after npm install, dev, build, start, npm test and lint: artefact lines ${JSON.stringify(artefacts)}; ` +
      `lines other than the copied QA test files ${JSON.stringify(unexpected)}`,
  );

  // ---- TC-AC7-02: .gitignore rules ---------------------------------------------
  const ignorePaths = ["node_modules/x", ".next/x", ".env.local", ".env.development.local", "coverage/x"];
  const checkIgnore = run("git", ["check-ignore", "-v", ...ignorePaths], app);
  const ignoredCount = checkIgnore.stdout.trim().split(/\r?\n/).filter(Boolean).length;
  const tracked = run("git", ["ls-files", "node_modules", ".next", "coverage"], app).stdout.trim();
  const envTracked = run("git", ["ls-files"], app)
    .stdout.split(/\r?\n/)
    .filter((f) => /\.env.*\.local$/.test(f));
  const lockIgnore = run("git", ["check-ignore", "package-lock.json"], app);
  record(
    "TC-AC7-02",
    checkIgnore.code === 0 && ignoredCount === 5 && tracked === "" && envTracked.length === 0 &&
      lockIgnore.code === 1 && lockIgnore.stdout.trim() === "",
    `check-ignore matched ${ignoredCount}/5 paths (${checkIgnore.stdout.trim().replace(/\n/g, " | ")}); ` +
      `tracked node_modules/.next/coverage: '${tracked}'; tracked .env*.local: ${JSON.stringify(envTracked)}; ` +
      `git check-ignore package-lock.json exit ${lockIgnore.code}, output '${lockIgnore.stdout.trim()}'`,
  );

  if (keep) console.log(`Kept clean checkout at ${app}`);
  else rmSync(work, { recursive: true, force: true });

  console.log("SMOKE_RESULTS " + JSON.stringify(results));
  process.exit(results.every((r) => r.status === "passed") ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
