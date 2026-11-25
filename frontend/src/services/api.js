import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erro na requisição");
  }
  return res.json();
}

export const api = {
  // Dashboard / Ganhos / Pessoas
  getDashboard: (month) => request(`/dashboard/${month}`),
  getEntities: () => request("/entities"),
  createEntity: (data) =>
    request("/entities", { method: "POST", body: JSON.stringify(data) }),

  // Despesas
  createExpense: (data) =>
    request("/expenses", { method: "POST", body: JSON.stringify(data) }),
  deleteExpense: (expenseId) =>
    request(`/expenses/${expenseId}`, { method: "DELETE" }),
  deleteEntry: (entryId) =>
    request(`/entries/${entryId}`, { method: "DELETE" }),
  updateEntry: (id, data, applyFuture = false) =>
    request(`/entries/${id}?apply_future=${applyFuture}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  payAllEntity: (month, entityId) =>
    request(`/entries/pay-entity?reference_month=${month}&entity_id=${entityId}`, {
      method: "POST",
    }),
  upsertIncome: (data) =>
    request("/income", { method: "PUT", body: JSON.stringify(data) }),

  // Cobranças (A Receber)
  getReceivables: (month) => request(`/receivables/${month}`),
  createReceivable: (data) =>
    request("/receivables", { method: "POST", body: JSON.stringify(data) }),
  deleteReceivable: (receivableId) =>
    request(`/receivables/${receivableId}`, { method: "DELETE" }),
  deleteReceivableEntry: (entryId) =>
    request(`/receivable-entries/${entryId}`, { method: "DELETE" }),
  updateReceivableEntry: (id, data, applyFuture = false) =>
    request(`/receivable-entries/${id}?apply_future=${applyFuture}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  receiveAllEntity: (month, entityId) =>
    request(
      `/receivable-entries/receive-entity?reference_month=${month}&entity_id=${entityId}`,
      { method: "POST" }
    ),
};