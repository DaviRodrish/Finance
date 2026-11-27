// Backup manual em arquivo JSON (independente do Supabase).
// O mesmo formato é gerado pelo script tools/export_finance_db.py,
// então este importador também traz os dados do seu finance.db antigo.
import { db, TABLES, nowMs, emitLocalChange } from "./localDb";

// "_pushed" é controle interno da sincronização, não faz parte do backup.
const stripInternal = ({ _pushed, ...row }) => row;

export async function buildExport() {
  const tables = {};
  for (const name of TABLES) {
    tables[name] = (await db.table(name).toArray()).map(stripInternal);
  }
  return {
    app: "luzzy",
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export async function downloadBackup() {
  const data = await buildExport();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `luzzy-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function validateBackup(data) {
  if (!data || data.app !== "luzzy" || typeof data.tables !== "object") {
    throw new Error("Este arquivo não é um backup do Luzzy.");
  }
  for (const name of TABLES) {
    const rows = data.tables[name] ?? [];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup inválido: "${name}" deveria ser uma lista.`);
    }
    for (const row of rows) {
      if (!row || !Number.isFinite(Number(row.id))) {
        throw new Error(`Backup inválido: registro sem id em "${name}".`);
      }
    }
  }
}

// Substitui TODOS os dados do aparelho pelos do backup.
// Os registros importados ficam "pendentes de envio" e sobem na próxima sincronização.
export async function applyImport(data) {
  validateBackup(data);
  const counts = {};
  await db.transaction("rw", TABLES, async () => {
    for (const name of TABLES) {
      const rows = (data.tables[name] ?? []).map((r) => ({
        updated_at: nowMs(),
        deleted_at: null,
        ...stripInternal(r),
        id: Number(r.id),
      }));
      await db.table(name).clear();
      await db.table(name).bulkPut(rows);
      counts[name] = rows.filter((r) => !r.deleted_at).length;
    }
  });
  emitLocalChange();
  return counts;
}

export async function importBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Arquivo inválido (não é um JSON).");
  }
  return applyImport(data);
}