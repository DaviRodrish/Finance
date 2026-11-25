const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}, { retries = 6, retryDelayMs = 450 } = {}) {
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erro na requisição");
      }

      if (res.status === 204) return null;
      return res.json();
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err?.message || "");

      if (isNetworkError && attempt < retries) {
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      throw err;
    }
  }
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