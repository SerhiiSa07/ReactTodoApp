import type { Todo } from "../types/todo";

const BASE_URL = "/api";

export async function apiGetTodos(signal?: AbortSignal): Promise<Todo[]> {
  const res = await fetch(`${BASE_URL}/todos`, { signal });
  if (!res.ok) throw new Error(`GET /todos failed: ${res.status}`);
  return res.json();
}

export async function apiCreateTodo(todo: Todo): Promise<Todo> {
  const res = await fetch(`${BASE_URL}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });
  if (!res.ok) throw new Error(`POST /todos failed: ${res.status}`);
  return res.json();
}

export async function apiPatchTodo(
  id: string,
  patch: Partial<Todo>
): Promise<Todo> {
  const res = await fetch(`${BASE_URL}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /todos/${id} failed: ${res.status}`);
  return res.json();
}

export async function apiDeleteTodo(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/todos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /todos/${id} failed: ${res.status}`);
}