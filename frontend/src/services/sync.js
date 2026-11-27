// Sincronização offline-first com o Supabase.
//
// O banco local (Dexie) é a fonte da tela. Em segundo plano, este módulo:
//   1) PUXA do Supabase o que mudou desde a última vez (pelo relógio do servidor);
//   2) ENVIA os registros alterados neste aparelho.
//
// Conflito: vence a alteração com o "updated_at" mais recente (o servidor também
// ignora uma versão mais antiga que a que ele já tem). Exclusões são lógicas
// ("deleted_at"), então também se propagam entre os aparelhos.
//
// Controle local: cada registro guarda "_pushed" = o updated_at que já está no
// servidor. Se "_pushed" !== "updated_at", o registro está pendente de envio.
import { db, TABLES, nowMs, onLocalChange } from "./localDb";
import { supabase } from "./supabase";

const PUSH_BATCH = 500;
const PULL_PAGE = 500;
const OVERLAP_MS = 60_000; // reler 1 min para trás: cobre transações que terminam fora de ordem
const AUTO_SYNC_MS = 60_000;
const DEBOUNCE_MS = 2_500;

// Colunas de cada tabela no Supabase (sem user_id e synced_at, tratados à parte).
const COLUMNS = {
  entities: ["id", "name", "color", "created_at", "updated_at", "deleted_at"],
  expenses: [
    "id", "entity_id", "description", "total_amount", "installment_amount",
    "expense_type", "total_installments", "start_month", "created_at",
    "updated_at", "deleted_at",
  ],
  monthly_entries: [
    "id", "expense_id", "entity_id", "description", "reference_month",
    "installment_number", "total_installments", "amount", "status", "paid_at",
    "updated_at", "deleted_at",
  ],
  monthly_incomes: ["id", "reference_month", "amount", "updated_at", "deleted_at"],
  receivables: [
    "id", "entity_id", "description", "total_amount", "installment_amount",
    "expense_type", "total_installments", "start_month", "created_at",
    "updated_at", "deleted_at",
  ],
  receivable_entries: [
    "id", "receivable_id", "entity_id", "description", "reference_month",
    "installment_number", "total_installments", "amount", "status",
    "received_at", "updated_at", "deleted_at",
  ],
};
const remote = (name) => `luzzy_${name}`;

// ---------- estado observável (usado pela interface) ----------
// status: disabled | signedout | idle | syncing | offline | error
let state = {
  configured: Boolean(supabase),
  user: null,
  status: supabase ? "signedout" : "disabled",
  lastSyncAt: null,
  error: null,
};
const stateListeners = new Set();
const dataListeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  stateListeners.forEach((l) => l());
}
export const getSyncState = () => state;
export function subscribeSync(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
// Chamado quando a sincronização trouxe dados novos de outro aparelho.
export function onRemoteData(cb) {
  dataListeners.add(cb);
  return () => dataListeners.delete(cb);
}

// ---------- meta (cursores) ----------
async function getMeta(key, fallback = null) {
  const row = await db.table("meta").get(key);
  return row ? row.value : fallback;
}
const setMeta = (key, value) => db.table("meta").put({ key, value });

// ---------- conversões ----------
function toRemote(name, row, userId) {
  const out = { user_id: userId };
  for (const col of COLUMNS[name]) out[col] = row[col] ?? null;
  return out;
}

function fromRemote(name, remote) {
  const out = {};
  for (const col of COLUMNS[name]) out[col] = remote[col] ?? null;
  out._pushed = remote.updated_at;
  return out;
}

// ---------- puxar ----------
async function mergeRemote(name, remoteRows) {
  if (!remoteRows.length) return 0;
  let changed = 0;
  await db.transaction("rw", name, async () => {
    const table = db.table(name);
    const locals = await table.bulkGet(remoteRows.map((r) => r.id));
    const writes = [];
    remoteRows.forEach((remote, i) => {
      const local = locals[i];
      const localAt = local?.updated_at ?? 0;
      if (!local || remote.updated_at > localAt) {
        writes.push(fromRemote(name, remote));
        changed += 1;
      } else if (remote.updated_at === localAt && local._pushed !== localAt) {
        writes.push({ ...local, _pushed: localAt }); // já está igual no servidor
      }
      // remote mais antigo que o local: mantém o local (será enviado depois)
    });
    if (writes.length) await table.bulkPut(writes);
  });
  return changed;
}

async function pull() {
  const cursor = await getMeta("pull_cursor");
  const since = cursor
    ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString()
    : null;

  let maxSeen = cursor ? new Date(cursor).getTime() : 0;
  let changed = 0;

  for (const name of TABLES) {
    for (let from = 0; ; from += PULL_PAGE) {
         let query = supabase.from(remote(name)).select("*");
      if (since) query = query.gt("synced_at", since);
      query = query
        .order("synced_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PULL_PAGE - 1);

      const { data, error } = await query;
      if (error) throw error;

      changed += await mergeRemote(name, data);
      for (const row of data) {
        const t = new Date(row.synced_at).getTime();
        if (t > maxSeen) maxSeen = t;
      }
      if (data.length < PULL_PAGE) break;
    }
  }

  if (maxSeen) await setMeta("pull_cursor", new Date(maxSeen).toISOString());
  return changed;
}

// ---------- enviar ----------
async function markPushed(name, batch) {
  // Só marca como enviado se o registro não foi alterado durante o envio.
  await db.transaction("rw", name, async () => {
    const table = db.table(name);
    const current = await table.bulkGet(batch.map((r) => r.id));
    const writes = [];
    current.forEach((row, i) => {
      if (row && row.updated_at === batch[i].updated_at) {
        writes.push({ ...row, _pushed: row.updated_at });
      }
    });
    if (writes.length) await table.bulkPut(writes);
  });
}

async function push(userId) {
  let pushed = 0;
  for (const name of TABLES) {
    const dirty = (await db.table(name).toArray()).filter(
      (r) => r._pushed !== r.updated_at
    );
    for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
      const batch = dirty.slice(i, i + PUSH_BATCH);
      const { error } = await supabase
        .from(remote(name))
        .upsert(
          batch.map((r) => toRemote(name, r, userId)),
          { onConflict: "user_id,id" }
        );
      if (error) throw error;
      await markPushed(name, batch);
      pushed += batch.length;
    }
  }
  return pushed;
}

// Se entrar outra conta neste aparelho, recomeça os cursores e reenvia tudo.
async function ensureUser(userId) {
  const previous = await getMeta("sync_user");
  if (previous && previous !== userId) {
    await setMeta("pull_cursor", null);
    for (const name of TABLES) {
      const rows = await db.table(name).toArray();
      await db.table(name).bulkPut(rows.map(({ _pushed, ...r }) => r));
    }
  }
  if (previous !== userId) await setMeta("sync_user", userId);
}

// ---------- orquestração ----------
function friendlyError(err) {
  const msg = String(err?.message || err || "");
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return { status: "offline", error: null };
  }
  if (/schema cache|does not exist|relation/i.test(msg)) {
    return {
      status: "error",
      error: "Tabelas não encontradas no Supabase. Rode o SQL de criação.",
    };
  }
  if (/jwt|token|not authenticated/i.test(msg)) {
    return { status: "error", error: "Sessão expirada. Entre novamente." };
  }
  return { status: "error", error: msg || "Falha na sincronização." };
}

let running = null;
let rerun = false;
let timer = null;

export async function syncNow() {
  if (!supabase) return null;
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        setState({ user: null, status: "signedout", error: null });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setState({ user: session.user, status: "offline" });
        return;
      }

      setState({ user: session.user, status: "syncing", error: null });
      await ensureUser(session.user.id);
      const changed = await pull(); // primeiro puxa, depois envia
      await push(session.user.id);

      const ts = nowMs();
      await setMeta("last_sync_at", ts);
      setState({ status: "idle", lastSyncAt: ts, error: null });
      if (changed > 0) dataListeners.forEach((cb) => cb());
    } catch (err) {
      setState(friendlyError(err));
    } finally {
      running = null;
      if (rerun) {
        rerun = false;
        scheduleSync(500);
      }
    }
  })();
  return running;
}

export function scheduleSync(delay = DEBOUNCE_MS) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

function applySession(session) {
  if (session) {
    setState({
      user: session.user,
      status: state.status === "signedout" ? "idle" : state.status,
    });
    scheduleSync(300);
  } else {
    setState({ user: null, status: "signedout", error: null });
  }
}

// Liga a sincronização automática. Retorna a função que desliga.
let started = false;
export function startSync() {
  if (started || !supabase) return () => {};
  started = true;
  const cleanups = [];

  getMeta("last_sync_at").then((v) => v && setState({ lastSyncAt: v }));
  supabase.auth.getSession().then(({ data }) => applySession(data?.session));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
    applySession(session)
  );
  cleanups.push(() => sub.subscription.unsubscribe());
  cleanups.push(onLocalChange(() => scheduleSync()));

  if (typeof window !== "undefined") {
    const soon = () => scheduleSync(500);
    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    window.addEventListener("focus", soon);
    window.addEventListener("online", soon);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") scheduleSync(0);
    }, AUTO_SYNC_MS);
    cleanups.push(() => {
      window.removeEventListener("focus", soon);
      window.removeEventListener("online", soon);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    });
  }

  return () => {
    started = false;
    clearTimeout(timer);
    cleanups.forEach((fn) => fn());
  };
}

// ---------- conta ----------
function authMessage(error) {
  const msg = String(error?.message || "");
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already been registered/i.test(msg)) {
    return "Este e-mail já tem conta. Use “Entrar”.";
  }
  if (/password should be at least/i.test(msg)) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "Confirme o e-mail antes de entrar (veja sua caixa de entrada).";
  }
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão com a internet.";
  return msg || "Não foi possível autenticar.";
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error));
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(authMessage(error));
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
}