import Dexie from "dexie";

// Banco local (IndexedDB) do aparelho. Todas as telas leem e gravam aqui,
// por isso cada ação é instantânea (sem ida e volta pela rede).
//
// Todo registro tem:
//   updated_at  -> ms desde 1970 (para a sincronização futura com o Supabase)
//   deleted_at  -> null ou ms (exclusão lógica: assim a exclusão também sincroniza)
// Valores em dinheiro ficam em CENTAVOS inteiros (evita erro de ponto flutuante).
export const db = new Dexie("luzzy");

db.version(1).stores({
  entities: "id, updated_at",
  expenses: "id, entity_id, updated_at",
  monthly_entries: "id, expense_id, entity_id, reference_month, updated_at",
  monthly_incomes: "id, reference_month, updated_at",
  receivables: "id, entity_id, updated_at",
  receivable_entries:
    "id, receivable_id, entity_id, reference_month, updated_at",
  meta: "key",
});

// Tabelas com dados do usuário (a "meta" guarda só controle interno).
export const TABLES = [
  "entities",
  "expenses",
  "monthly_entries",
  "monthly_incomes",
  "receivables",
  "receivable_entries",
];

export const nowMs = () => Date.now();

// IDs numéricos gerados no aparelho. Ficam na casa de 1,8e15, abaixo do
// limite seguro do JavaScript (9e15), e cabem em bigint no Postgres.
// Dois aparelhos não colidem na prática, e as telas continuam usando
// Number(id) sem mudança.
let lastId = 0;
export function newId() {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (id <= lastId) id = lastId + 1;
  lastId = id;
  return id;
}

// Pede ao navegador para não apagar os dados quando faltar espaço.
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignora */
  }
  return false;
}