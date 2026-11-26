// Implementação LOCAL da API: mesma interface de antes (os componentes não mudam),
// mas tudo lê e grava no banco do aparelho (Dexie). Port do services.py.
import { db, newId, nowMs } from "./localDb";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RECURRING_MONTHS = 12;
const FALLBACK_COLOR = "#94a3b8";
const ENTITY_NF = "Pessoa/Categoria não encontrada";

// Descreve um par pai/parcela para reaproveitar a lógica em despesas e cobranças.
const EXPENSE = {
  parent: "expenses",
  entry: "monthly_entries",
  fk: "expense_id",
  done: "paid",
  doneAt: "paid_at",
  nf: "Lançamento não encontrado",
};
const RECEIVABLE = {
  parent: "receivables",
  entry: "receivable_entries",
  fk: "receivable_id",
  done: "received",
  doneAt: "received_at",
  nf: "Cobrança não encontrada",
};

// ---------- utilitários ----------
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const t = (name) => db.table(name);
const alive = (rows) => rows.filter((r) => r && !r.deleted_at);
const byId = (a, b) => a.id - b.id;
const toMoney = (cents) => cents / 100;
const toCents = (value) => Math.round(Number(value) * 100);
const sum = (rows) => rows.reduce((acc, r) => acc + r.amount, 0);

function checkMonth(month) {
  if (!MONTH_RE.test(String(month ?? ""))) {
    throw httpError(422, "Mês inválido (use AAAA-MM).");
  }
}

function shiftYm(ym, offset) {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function splitTotals(rows, done) {
  const total = sum(rows);
  const finished = sum(rows.filter((r) => r.status === done));
  return [total, finished, total - finished];
}

async function owned(table, id, message) {
  const row = await t(table).get(Number(id));
  if (!row || row.deleted_at) throw httpError(404, message);
  return row;
}

async function softDeleteRows(table, rows) {
  if (!rows.length) return;
  const ts = nowMs();
  await t(table).bulkPut(
    rows.map((r) => ({ ...r, deleted_at: ts, updated_at: ts }))
  );
}

// ---------- leitura ----------
async function monthEntriesRaw(k, month) {
  const rows = await t(k.entry).where("reference_month").equals(month).toArray();
  return alive(rows).sort(byId);
}

function entryLabel(parent, entry) {
  if (parent?.expense_type === "recurring") return "Fixo";
  return entry.total_installments > 1
    ? `${entry.installment_number}/${entry.total_installments}`
    : null;
}

// Monta o formato que as telas esperam (pessoa embutida, etiqueta 2/6, valores em reais).
async function hydrate(k, entries) {
  if (!entries.length) return [];
  const entityIds = [...new Set(entries.map((e) => e.entity_id))];
  const parentIds = [...new Set(entries.map((e) => e[k.fk]))];
  const [entities, parents] = await Promise.all([
    t("entities").bulkGet(entityIds),
    t(k.parent).bulkGet(parentIds),
  ]);
  const entityMap = new Map(entities.filter(Boolean).map((e) => [e.id, e]));
  const parentMap = new Map(parents.filter(Boolean).map((p) => [p.id, p]));

  return entries.map((e) => {
    const ent = entityMap.get(e.entity_id);
    return {
      id: e.id,
      [k.fk]: e[k.fk],
      description: e.description,
      reference_month: e.reference_month,
      installment_label: entryLabel(parentMap.get(e[k.fk]), e),
      amount: toMoney(e.amount),
      status: e.status,
      entity: ent
        ? { id: ent.id, name: ent.name, color: ent.color }
        : { id: e.entity_id, name: "(removida)", color: FALLBACK_COLOR },
    };
  });
}

async function receivablesMonth(month) {
  checkMonth(month);
  const raw = await monthEntriesRaw(RECEIVABLE, month);
  const [total, received, pending] = splitTotals(raw, "received");
  return {
    reference_month: month,
    total_receivable: toMoney(total),
    total_received: toMoney(received),
    total_pending: toMoney(pending),
    entries: await hydrate(RECEIVABLE, raw),
  };
}

async function dashboard(month) {
  checkMonth(month);
  const raw = await monthEntriesRaw(EXPENSE, month);
  const entries = await hydrate(EXPENSE, raw);

  const incomeRow = await t("monthly_incomes").get(Number(month.replace("-", "")));
  const income = incomeRow && !incomeRow.deleted_at ? incomeRow.amount : 0;

  const [total, paid, pending] = splitTotals(raw, "paid");
  const remaining = income - total;

  const recRaw = await monthEntriesRaw(RECEIVABLE, month);
  const [, , receivablesPending] = splitTotals(recRaw, "received");

  const groups = new Map();
  raw.forEach((e, i) => {
    const ent = entries[i].entity;
    let g = groups.get(e.entity_id);
    if (!g) {
      g = {
        entity_id: e.entity_id,
        entity_name: ent.name,
        color: ent.color,
        total: 0,
        paid: 0,
        pending: 0,
      };
      groups.set(e.entity_id, g);
    }
    g.total += e.amount;
    if (e.status === "paid") g.paid += e.amount;
    else g.pending += e.amount;
  });
  const byEntity = [...groups.values()].map((g) => ({
    entity_id: g.entity_id,
    entity_name: g.entity_name,
    color: g.color,
    total_amount: toMoney(g.total),
    paid_amount: toMoney(g.paid),
    pending_amount: toMoney(g.pending),
    percentage: pct(g.total, total),
  }));

  const months = Array.from({ length: 6 }, (_, i) => shiftYm(month, i + 1));
  const future = alive(
    await t("monthly_entries").where("reference_month").anyOf(months).toArray()
  );
  const next6 = months.map((m) => ({
    month: m,
    total_amount: toMoney(sum(future.filter((e) => e.reference_month === m))),
  }));

  return {
    reference_month: month,
    income: toMoney(income),
    total_expenses: toMoney(total),
    total_paid: toMoney(paid),
    total_pending: toMoney(pending),
    remaining: toMoney(remaining),
    commitment_percentage: pct(total, income),
    receivables_pending: toMoney(receivablesPending),
    projected_balance: toMoney(remaining + receivablesPending),
    by_entity: byEntity,
    next_6_months: next6,
    entries,
  };
}

// ---------- criação ----------
function plan(etype, startMonth, total, first) {
  if (etype === "recurring") {
    return Array.from({ length: RECURRING_MONTHS }, (_, i) => [
      shiftYm(startMonth, i),
      1,
      1,
    ]);
  }
  if (etype === "single") return [[startMonth, 1, 1]];
  const items = [];
  for (let n = first, i = 0; n <= total; n += 1, i += 1) {
    items.push([shiftYm(startMonth, i), n, total]);
  }
  return items;
}

async function createLaunch(k, p, etype) {
  if (!["single", "installment", "recurring"].includes(etype)) {
    throw httpError(422, "Condição inválida.");
  }
  checkMonth(p.start_month);

  const amount = toCents(p.amount);
  if (!(amount > 0)) throw httpError(422, "Informe um valor maior que zero.");

  const description = String(p.description ?? "").trim();
  if (!description) throw httpError(422, "Informe uma descrição.");
  if (description.length > 200) throw httpError(422, "Descrição muito longa.");

  const entityId = Number(p.entity_id);
  await owned("entities", entityId, ENTITY_NF);

  const isInstallment = etype === "installment";
  const total = isInstallment ? Number(p.total_installments) || 1 : 1;
  const first = isInstallment ? Number(p.start_installment) || 1 : 1;
  if (total < 1 || total > 120) {
    throw httpError(422, "O total de parcelas deve ficar entre 1 e 120.");
  }
  if (first < 1 || first > total) {
    throw httpError(400, "Parcela inicial maior que o total de parcelas");
  }

  const items = plan(etype, p.start_month, total, first);
  const ts = nowMs();
  const parentId = newId();
  const parent = {
    id: parentId,
    entity_id: entityId,
    description,
    total_amount: amount * items.length,
    installment_amount: amount,
    expense_type: etype,
    total_installments: total,
    start_month: p.start_month,
    created_at: new Date(ts).toISOString(),
    updated_at: ts,
    deleted_at: null,
  };
  const entries = items.map(([month, num, tot]) => ({
    id: newId(),
    [k.fk]: parentId,
    entity_id: entityId,
    description,
    reference_month: month,
    installment_number: num,
    total_installments: tot,
    amount,
    status: "pending",
    [k.doneAt]: null,
    updated_at: ts,
    deleted_at: null,
  }));

  await db.transaction("rw", [k.parent, k.entry], async () => {
    await t(k.parent).put(parent);
    await t(k.entry).bulkPut(entries);
  });
  return parent;
}

// ---------- edição / remoção / baixa ----------
async function updateEntry(k, id, data, applyFuture) {
  const entry = await owned(k.entry, id, k.nf);

  const changes = {};
  if (data.description != null) {
    const d = String(data.description).trim();
    if (!d) throw httpError(422, "Informe uma descrição.");
    changes.description = d;
  }
  if (data.amount != null) {
    const a = toCents(data.amount);
    if (!(a > 0)) throw httpError(422, "Informe um valor maior que zero.");
    changes.amount = a;
  }
  if (data.status != null) {
    if (!["pending", k.done].includes(data.status)) {
      throw httpError(422, "Estado inválido.");
    }
    changes.status = data.status;
  }

  let targets = [entry];
  if (applyFuture) {
    const all = await t(k.entry).where(k.fk).equals(entry[k.fk]).toArray();
    targets = alive(all).filter((e) => e.reference_month >= entry.reference_month);
  }

  const ts = nowMs();
  const updated = targets.map((target) => {
    const next = { ...target, ...changes, updated_at: ts };
    if ("status" in changes) {
      next[k.doneAt] = changes.status === k.done ? new Date(ts).toISOString() : null;
    }
    return next;
  });
  await t(k.entry).bulkPut(updated);

  const fresh = updated.find((e) => e.id === entry.id);
  return (await hydrate(k, [fresh]))[0];
}

// Remove a parcela; se era a última do pai, remove o pai também.
async function deleteEntry(k, id) {
  const entry = await owned(k.entry, id, k.nf);
  const parentId = entry[k.fk];
  await db.transaction("rw", [k.parent, k.entry], async () => {
    await softDeleteRows(k.entry, [entry]);
    const rest = alive(await t(k.entry).where(k.fk).equals(parentId).toArray());
    if (!rest.length) {
      const parent = await t(k.parent).get(parentId);
      if (parent && !parent.deleted_at) await softDeleteRows(k.parent, [parent]);
    }
  });
}

async function deleteParent(k, id) {
  const parent = await owned(k.parent, id, k.nf);
  await db.transaction("rw", [k.parent, k.entry], async () => {
    const entries = alive(await t(k.entry).where(k.fk).equals(parent.id).toArray());
    await softDeleteRows(k.entry, entries);
    await softDeleteRows(k.parent, [parent]);
  });
}

// Marca como pago/recebido tudo que está pendente de uma pessoa no mês.
async function settleEntity(k, month, entityId) {
  checkMonth(month);
  const rows = (await monthEntriesRaw(k, month)).filter(
    (e) => e.entity_id === Number(entityId) && e.status !== k.done
  );
  const ts = nowMs();
  await t(k.entry).bulkPut(
    rows.map((e) => ({
      ...e,
      status: k.done,
      [k.doneAt]: new Date(ts).toISOString(),
      updated_at: ts,
    }))
  );
  return { updated: rows.length };
}

// ---------- pessoas / categorias ----------
async function deleteEntity(id, force) {
  const entity = await owned("entities", id, ENTITY_NF);

  const [expenses, receivables] = (
    await Promise.all([
      t("expenses").where("entity_id").equals(entity.id).toArray(),
      t("receivables").where("entity_id").equals(entity.id).toArray(),
    ])
  ).map(alive);

  if ((expenses.length || receivables.length) && !force) {
    throw httpError(
      409,
      "Possui lançamentos vinculados. Use force=true para apagar tudo junto."
    );
  }

  const [monthly, recEntries] = (
    await Promise.all([
      t("monthly_entries").where("entity_id").equals(entity.id).toArray(),
      t("receivable_entries").where("entity_id").equals(entity.id).toArray(),
    ])
  ).map(alive);

  await db.transaction(
    "rw",
    ["entities", "expenses", "monthly_entries", "receivables", "receivable_entries"],
    async () => {
      await softDeleteRows("monthly_entries", monthly);
      await softDeleteRows("expenses", expenses);
      await softDeleteRows("receivable_entries", recEntries);
      await softDeleteRows("receivables", receivables);
      await softDeleteRows("entities", [entity]);
    }
  );
  return { message: "Pessoa/Categoria removida" };
}

// ---------- interface pública (mesmos nomes de antes) ----------
export const api = {
  // Dashboard / Ganhos / Pessoas
  getDashboard: (month) => dashboard(month),

  getEntities: async () =>
    alive(await t("entities").toArray())
      .sort(byId)
      .map(({ id, name, color }) => ({ id, name, color })),

  createEntity: async (data) => {
    const name = String(data?.name ?? "").trim();
    if (!name) throw httpError(422, "Informe um nome.");
    if (name.length > 100) throw httpError(422, "Nome muito longo.");
    const ts = nowMs();
    const entity = {
      id: newId(),
      name,
      color: String(data?.color || "#3B82F6").slice(0, 20),
      created_at: new Date(ts).toISOString(),
      updated_at: ts,
      deleted_at: null,
    };
    await t("entities").put(entity);
    return { id: entity.id, name: entity.name, color: entity.color };
  },

  deleteEntity: (id, force = false) => deleteEntity(id, force),

  // Despesas
  createExpense: async (data) => {
    await createLaunch(EXPENSE, data, data.expense_type || "single");
    return dashboard(data.start_month);
  },
  deleteExpense: (expenseId) => deleteParent(EXPENSE, expenseId),
  deleteEntry: (entryId) => deleteEntry(EXPENSE, entryId),
  updateEntry: (id, data, applyFuture = false) =>
    updateEntry(EXPENSE, id, data, applyFuture),
  payAllEntity: (month, entityId) => settleEntity(EXPENSE, month, entityId),

  upsertIncome: async (data) => {
    checkMonth(data.reference_month);
    const amount = toCents(data.amount);
    if (!(amount >= 0)) throw httpError(422, "O valor de ganhos não pode ser negativo.");
    // ID fixo por mês (ex.: 202611): dois aparelhos nunca criam rendas duplicadas.
    const id = Number(data.reference_month.replace("-", ""));
    await t("monthly_incomes").put({
      id,
      reference_month: data.reference_month,
      amount,
      updated_at: nowMs(),
      deleted_at: null,
    });
    return { reference_month: data.reference_month, amount: toMoney(amount) };
  },

  // Cobranças (A Receber)
  getReceivables: (month) => receivablesMonth(month),
  createReceivable: async (data) => {
    const etype =
      data.expense_type ||
      (Number(data.total_installments) > 1 ? "installment" : "single");
    await createLaunch(RECEIVABLE, data, etype);
    return receivablesMonth(data.start_month);
  },
  deleteReceivable: (receivableId) => deleteParent(RECEIVABLE, receivableId),
  deleteReceivableEntry: (entryId) => deleteEntry(RECEIVABLE, entryId),
  updateReceivableEntry: (id, data, applyFuture = false) =>
    updateEntry(RECEIVABLE, id, data, applyFuture),
  receiveAllEntity: (month, entityId) => settleEntity(RECEIVABLE, month, entityId),
};