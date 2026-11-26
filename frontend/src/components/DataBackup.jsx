import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { downloadBackup, importBackupFile } from "../services/backup";

export default function DataBackup({ onChanged }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "ok" | "error", text }

  const handleExport = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await downloadBackup();
      setMsg({ type: "ok", text: "Backup baixado." });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Falha ao exportar." });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ok = window.confirm(
      "Importar substitui TODOS os dados atuais deste aparelho pelos do arquivo. Deseja continuar?"
    );
    if (!ok) return;

    setMsg(null);
    setBusy(true);
    try {
      const counts = await importBackupFile(file);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setMsg({ type: "ok", text: `Importado (${total} registros).` });
      onChanged?.();
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Falha ao importar." });
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50";

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-slate-400">Dados deste aparelho</p>
      <div className="flex gap-2">
        <button type="button" onClick={handleExport} disabled={busy} className={btn}>
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={btn}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importar</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {msg && (
        <p
          className={`text-[11px] rounded-lg px-2 py-1.5 ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}