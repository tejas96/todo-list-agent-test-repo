import { addTodo, deleteTodo, deserialize, serialize, sortByDueDate, toggleTodo } from '/src/todos.js';

const KEY = 'todos';
let todos = deserialize(localStorage.getItem(KEY));

const list = document.getElementById('list');
const form = document.getElementById('add');
const input = document.getElementById('text');
const due = document.getElementById('due');

function save() {
  localStorage.setItem(KEY, serialize(todos));
}

function render() {
  list.innerHTML = '';
  for (const t of sortByDueDate(todos)) {
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
    if (t.dueDate) {
      const date = document.createElement('time');
      date.className = 'due';
      date.dateTime = t.dueDate;
      date.textContent = t.dueDate;
      li.append(date);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete';
    del.setAttribute('aria-label', `Delete ${t.text}`);
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      todos = deleteTodo(todos, t.id);
      save();
      render();
    });
    li.append(del);
    list.append(li);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  due.setCustomValidity('');
  try {
    todos = addTodo(todos, input.value, due.value);
  } catch (err) {
    due.setCustomValidity(err.message);
    due.reportValidity();
    return;
  }
  input.value = '';
  due.value = '';
  save();
  render();
});

due.addEventListener('input', () => due.setCustomValidity(''));

render();
