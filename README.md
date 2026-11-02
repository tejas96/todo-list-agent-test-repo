# Todo App

A starter Next.js todo application with an in-memory data store. Later tickets add the todo features on top of this setup.

## Requirements

- Node.js `^20.19.0 || >=22.12.0` (the same value as the `engines.node` field in `package.json`)
- npm (comes with Node.js)

## Install

```bash
npm install
```

For a clean install that follows `package-lock.json` exactly, use `npm ci`.

## Run in development

```bash
npm run dev
```

Then open http://localhost:3000.

## Build

```bash
npm run build
```

## Run the production build

```bash
npm run build
npm run start
```

The production server also listens on http://localhost:3000.

## Test

```bash
npm test
```

Runs the automated tests in `tests/` once with Vitest.

## Lint

```bash
npm run lint
```

## Folder structure

| Folder | Purpose |
| --- | --- |
| `src/app/` | Routes and pages (Next.js App Router). `page.tsx` is the home page `/`, `layout.tsx` is the root layout. |
| `src/components/` | Reusable UI components, for example `TodoList.tsx`. |
| `src/lib/db/` | Data access. `todo-store.ts` is the in-memory todo store (`listTodos`, `addTodo`). It is server-only: importing it from a client component fails the build. |
| `tests/` | Automated tests (Vitest). `tests/stubs/` holds test-only stubs. |

## Data storage

Todos are kept only in the memory of the running server process. There is no database, file or browser storage.

- All data is lost every time the server stops or restarts.
- Data is not shared between several server processes or instances. Each process has its own store.
