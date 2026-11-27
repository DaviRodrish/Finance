import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSync } from "../hooks/useSync";
import { signIn, signUp, signOut, syncNow } from "../services/sync";

function timeAgo(ms, now) {
  if (!ms) return "ainda não sincronizou";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "agora há pouco";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

function AuthModal({ onClose }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        onClose();
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo("Conta criada. Confirme o e-mail e depois entre.");
          setMode("signin");
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {mode === "signin" ? "Entrar para sincronizar" : "Criar conta"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Seus dados continuam neste aparelho e funcionam sem internet. A conta
          serve para sincronizar com outros aparelhos e guardar um backup.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              E-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Senha
            </label>
            <input
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError("");
            setInfo("");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="w-full text-xs text-blue-600 hover:underline cursor-pointer"
        >
          {mode === "signin"
            ? "Ainda não tenho conta"
            : "Já tenho conta, quero entrar"}
        </button>
      </div>
    </div>
  );
}

export default function SyncPanel() {
  const sync = useSync();
  const [showAuth, setShowAuth] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (sync.status === "disabled") {
    return (
      <p className="text-[11px] text-slate-400">
        Sincronização desativada: faltam as chaves do Supabase no .env.
      </p>
    );
  }

  if (!sync.user) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-slate-400">Sincronização</p>
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Entrar para sincronizar</span>
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const syncing = sync.status === "syncing";
  let label = `Sincronizado ${timeAgo(sync.lastSyncAt, now)}`;
  if (syncing) label = "Sincronizando...";
  else if (sync.status === "offline") label = "Sem conexão. Sincroniza ao voltar.";
  else if (sync.status === "error") label = sync.error || "Falha na sincronização.";

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-slate-400">Sincronização</p>
      <div
        className={`flex items-start gap-1.5 text-[11px] ${
          sync.status === "error" ? "text-red-700" : "text-slate-500"
        }`}
      >
        {sync.status === "offline" ? (
          <CloudOff className="w-3.5 h-3.5 shrink-0 mt-px" />
        ) : (
          <Cloud className="w-3.5 h-3.5 shrink-0 mt-px" />
        )}
        <span className="min-w-0">{label}</span>
      </div>
      <p className="text-[11px] text-slate-400 truncate">{sync.user.email}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => syncNow()}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          <span>Sincronizar</span>
        </button>
        <button
          type="button"
          onClick={() => signOut()}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          Sair
        </button>
      </div>
    </div>
  );
}