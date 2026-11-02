# Todo app

A small todo app in plain Node.js and browser JavaScript. No dependencies.

- `npm start` serves the app at http://localhost:5173
- `npm test` runs the tests (`node --test`)

## Structure

- `src/todos.js` — todo logic (add, toggle, save, load). Shared by the browser and the tests.
- `public/` — the page (`index.html`, `app.js`, `style.css`).
- `server.js` — a tiny static file server.
