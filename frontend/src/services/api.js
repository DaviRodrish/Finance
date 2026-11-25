const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erro na requisição");
  }
  return res.json();
}

export const api = {
  getDashboard: (month) => request(`/dashboard/${month}`),
  getEntities: () => request("/entities"),
  createEntity: (data) => request("/entities", { method: "POST", body: JSON.stringify(data) }),
  createExpense: (data) => request("/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateEntry: (id, data) => request(`/entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  payAllEntity: (month, entityId) =>
    request(`/entries/pay-entity?reference_month=${month}&entity_id=${entityId}`, { method: "POST" }),
  upsertIncome: (data) => request("/income", { method: "PUT", body: JSON.stringify(data) }),
  seedSheet: (month) => request(`/seed/sheet?reference_month=${month}`, { method: "POST" }),
};