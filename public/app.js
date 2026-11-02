import { addTodo, deserialize, serialize, toggleTodo } from '/src/todos.js';

const KEY = 'todos';
let todos = deserialize(localStorage.getItem(KEY));

const list = document.getElementById('list');
const form = document.getElementById('add');
const input = document.getElementById('text');

function save() {
  localStorage.setItem(KEY, serialize(todos));
}

function render() {
  list.innerHTML = '';
  for (const t of todos) {
    const li = document.createElement('li');
    li.className = t.done ? 'done' : '';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = t.done;
    box.addEventListener('change', () => {
      todos = toggleTodo(todos, t.id);
      save();
      render();
    });
    const span = document.createElement('span');
    span.textContent = t.text;
    li.append(box, span);
    list.append(li);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  todos = addTodo(todos, input.value);
  input.value = '';
  save();
  render();
});

render();
