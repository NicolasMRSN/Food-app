import { useState } from "react";
import { supabase } from "../lib/supabase";
import { CATEGORIES, SEASONS, ALLERGENS } from "../lib/constants";
import FoodAutocomplete from "./FoodAutocomplete";

const emptyIng = () => ({ ciqual_code: null, label: "", quantity_g: "", pieces: "", food: null });

export default function RecipeForm({ recipe, onClose, onSaved }) {
  const editing = Boolean(recipe?.id);
  const [name, setName] = useState(recipe?.name || "");
  const [category, setCategory] = useState(recipe?.category || "plat");
  const [season, setSeason] = useState(recipe?.season || "Toute l'année");
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [imageUrl, setImageUrl] = useState(recipe?.image_url || "");
  const [utensils, setUtensils] = useState((recipe?.utensils || []).join(", "));
  const [allergens, setAllergens] = useState(recipe?.allergens || []);
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url || "");
  const [ings, setIngs] = useState(
    recipe?.recipe_ingredients?.length
      ? recipe.recipe_ingredients.map((i) => ({
          ciqual_code: i.ciqual_code,
          label: i.label,
          quantity_g: i.quantity_g,
          pieces: i.pieces ?? "",
          food: { ciqual_code: i.ciqual_code, name_fr: i.label },
        }))
      : [emptyIng()]
  );
  const [importUrl, setImportUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function setIng(i, patch) {
    setIngs((arr) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  }

  function toggleAllergen(a) {
    setAllergens((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  }

  // Import depuis marmiton.fr, jow.fr, etc. via l'edge function (JSON-LD schema.org/Recipe).
  async function importFromUrl() {
    if (!importUrl.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-recipe", {
        body: { url: importUrl.trim() },
      });
      if (error) throw error;
      if (!data?.name) throw new Error("Recette introuvable sur cette page.");
      setName(data.name);
      if (data.image) setImageUrl(data.image);
      if (data.instructions) setInstructions(data.instructions);
      setSourceUrl(importUrl.trim());
      if (data.ingredients?.length) {
        // Association automatique de chaque ingrédient à sa référence CIQUAL
        const labels = data.ingredients.map((t) => t.raw);
        const { data: matches } = await supabase.rpc("match_ciqual", { labels });
        const byLabel = Object.fromEntries((matches || []).map((m) => [m.label, m]));
        setIngs(
          data.ingredients.map((t) => {
            const m = byLabel[t.raw];
            return {
              ciqual_code: m?.ciqual_code ?? null,
              label: m?.name_fr ?? t.label,
              quantity_g: t.grams || 100,
              pieces: t.pieces ?? "",
              food: m ? { ciqual_code: m.ciqual_code, name_fr: m.name_fr } : null,
              hint: t.raw,
            };
          })
        );
        setMsg({
          ok: true,
          text: "Recette importée : ingrédients associés automatiquement à CIQUAL et quantités estimées. Enregistrez, puis corrigez en édition si besoin.",
        });
      }
    } catch (e) {
      setMsg({ ok: false, text: `Import impossible : ${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const valid = ings.filter((i) => i.ciqual_code && Number(i.quantity_g) > 0);
      const payload = {
        name: name.trim(),
        category,
        season,
        instructions,
        image_url: imageUrl || null,
        utensils: utensils.split(",").map((u) => u.trim()).filter(Boolean),
        allergens,
        source_url: sourceUrl || null,
        servings_base: 2,
      };
      let recipeId = recipe?.id;
      if (editing) {
        const { error } = await supabase.from("recipes").update(payload).eq("id", recipeId);
        if (error) throw error;
        await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
      } else {
        const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
        if (error) throw error;
        recipeId = data.id;
      }
      if (valid.length) {
        const { error } = await supabase.from("recipe_ingredients").insert(
          valid.map((i) => ({
            recipe_id: recipeId,
            ciqual_code: i.ciqual_code,
            label: i.food?.name_fr || i.label,
            quantity_g: Number(i.quantity_g),
            pieces: i.pieces ? Number(i.pieces) : null,
          }))
        );
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row spread">
          <h2>{editing ? "Modifier la recette" : "Nouvelle recette"}</h2>
          <button className="ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {!editing && (
          <div className="card" style={{ margin: "0.8rem 0" }}>
            <label htmlFor="imp">Importer depuis un site (marmiton.fr, jow.fr…)</label>
            <div className="row">
              <input
                id="imp"
                placeholder="https://www.marmiton.org/recettes/…"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={importFromUrl} disabled={busy}>
                {busy ? "Import…" : "Importer"}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div className="grid-2">
            <div>
              <label>Nom</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label>Image (URL)</label>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label>Type</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Saison</label>
              <select value={season} onChange={(e) => setSeason(e.target.value)} style={{ width: "100%" }}>
                {SEASONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label>Ingrédients pour 2 personnes — pièces (optionnel) et grammes</label>
            {ings.map((ing, i) => (
              <div className="ing-row" key={i}>
                <div>
                  <FoodAutocomplete
                    value={ing.food?.name_fr || ing.label}
                    onSelect={(f) => setIng(i, { ciqual_code: f.ciqual_code, food: f, label: f.name_fr })}
                  />
                  {ing.hint && (
                    <span className="muted">Importé : « {ing.hint} »{!ing.ciqual_code && " — sélectionnez l'équivalent CIQUAL"}</span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="pcs"
                  value={ing.pieces}
                  onChange={(e) => setIng(i, { pieces: e.target.value })}
                  aria-label="Nombre de pièces (optionnel)"
                  title="Nombre de pièces (optionnel)"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="g"
                  value={ing.quantity_g}
                  onChange={(e) => setIng(i, { quantity_g: e.target.value })}
                  aria-label="Quantité en grammes"
                  title="Quantité en grammes"
                />
                <button type="button" className="ghost" onClick={() => setIngs((a) => a.filter((_, k) => k !== i))} aria-label="Retirer">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setIngs((a) => [...a, emptyIng()])}>+ Ingrédient</button>
          </div>

          <div>
            <label>Mode opératoire</label>
            <textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div>
            <label>Ustensiles nécessaires (séparés par des virgules)</label>
            <input value={utensils} onChange={(e) => setUtensils(e.target.value)} placeholder="poêle, fouet, plat à gratin" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Allergènes présents</label>
            <div className="row">
              {ALLERGENS.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={allergens.includes(a) ? "primary" : ""}
                  style={{ padding: "0.2rem 0.6rem", fontSize: "0.78rem", borderRadius: 999 }}
                  onClick={() => toggleAllergen(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
          <div className="row spread">
            {editing ? (
              <button
                type="button"
                className="ghost"
                style={{ color: "var(--warn)" }}
                onClick={async () => {
                  if (confirm("Supprimer cette recette ?")) {
                    await supabase.from("recipes").delete().eq("id", recipe.id);
                    onSaved();
                  }
                }}
              >
                Supprimer
              </button>
            ) : <span />}
            <button className="primary" disabled={busy}>Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
