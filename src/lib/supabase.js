import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://dwykymlfseilwzcrpbbj.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_foyFRXgHi7_bRiO9L6QbiQ_2FC-7rTp";

// Session persistante par défaut (localStorage) : connexion durable pour Nicolas & Marion.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
