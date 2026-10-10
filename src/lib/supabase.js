import { createClient } from "@supabase/supabase-js";

// Supabase auto-hébergé sur le homelab : les API sont servies sur la même origine que l'app
// (nginx proxifie /auth, /rest, /realtime, /functions). VITE_SUPABASE_URL permet de viser une autre instance (dev).
const url = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Session persistante par défaut (localStorage) : connexion durable pour Nicolas & Marion.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
