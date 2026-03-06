import type { Todo } from "../types/todo";

const base = "/api/todos";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function apiGetTodos(signal?: AbortSignal) {
  return http<Todo[]>(base, { signal });
}

export function apiCreateTodo(todo: Todo) {
  return http<Todo>(base, { method: "POST", body: JSON.stringify(todo) });
}

export function apiPatchTodo(id: string, patch: Partial<Todo>) {
  return http<Todo>(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function apiDeleteTodo(id: string) {
  await http<unknown>(`${base}/${id}`, { method: "DELETE" });
}