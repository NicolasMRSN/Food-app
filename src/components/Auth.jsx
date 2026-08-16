import { useState } from "react";
import { supabase } from "../lib/supabase";

// Accès réservé : un seul compte commun (Nicolas & Marion),
// verrou appliqué côté serveur par un trigger sur auth.users.
export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg({ ok: true, text: "Compte commun créé. Vous pouvez vous connecter." });
        setMode("login");
      }
    } catch (err) {
      const t = /existe déjà|max_users/i.test(err.message)
        ? "Le compte commun existe déjà : connectez-vous avec celui-ci."
        : err.message;
      setMsg({ ok: false, text: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>
          Table <span style={{ color: "var(--accent)" }}>·</span> Nicolas &amp; Marion
        </h1>
        <p className="muted" style={{ textAlign: "center", margin: 0 }}>
          Compte commun — connexion persistante sur cet appareil.
        </p>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label htmlFor="pwd">Mot de passe</label>
          <input id="pwd" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
        <button className="primary" disabled={busy}>
          {mode === "login" ? "Se connecter" : "Créer le compte commun"}
        </button>
        <button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Première visite ? Créer le compte commun" : "J'ai déjà le compte"}
        </button>
      </form>
    </div>
  );
}
