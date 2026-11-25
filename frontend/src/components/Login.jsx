import { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../services/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("E-mail ou senha inválidos.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="text-center space-y-1">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Finanças Pessoais</h1>
          <p className="text-xs text-slate-500">Entre com sua conta individual</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              E-mail
            </label>
            <input
              type="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}