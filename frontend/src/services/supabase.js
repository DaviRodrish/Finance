import { createClient } from "@supabase/supabase-js";

// As chaves ficam no .env da raiz do projeto (o vite.config.js lê de "..").
//   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
// A chave "publishable" é pública por natureza; quem protege os dados é o RLS.
// NUNCA coloque a chave "secret" / "service_role" aqui.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;