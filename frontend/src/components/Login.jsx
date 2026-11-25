import { Lock } from "lucide-react";

export default function Login({ onEnterLocal }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 text-center">
        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">Finanças Pessoais</h1>
          <p className="text-xs text-slate-500">
            Modo local ativo (dados salvos no banco local)
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEnterLocal?.()}
          className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
        >
          Continuar localmente
        </button>
      </div>
    </div>
  );
}