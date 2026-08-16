import { useState } from "react";
import { CATEGORIES, SEASONS, currentSeason } from "../lib/constants";
import { recipePerServing } from "../lib/nutrition";
import RecipeForm from "./RecipeForm";

function Thumb({ recipe }) {
  return recipe.image_url ? (
    <img src={recipe.image_url} alt="" loading="lazy" />
  ) : (
    <div className="lib-thumb">🍽</div>
  );
}

function RecipeDetail({ recipe, foodsByCode, onClose, onEdit }) {
  const per = recipePerServing(recipe, foodsByCode);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row spread">
          <h2>{recipe.name}</h2>
          <button className="ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.name} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, margin: "0.6rem 0" }} />
        )}
        <div className="badges" style={{ margin: "0.4rem 0" }}>
          <span className="badge">{recipe.category}</span>
          <span className="badge season">{recipe.season}</span>
          {(recipe.allergens || []).map((a) => <span key={a} className="badge warn">⚠ {a}</span>)}
        </div>
        <p className="muted">
          Par personne : {Math.round(per.kcal)} kcal · P {per.protein.toFixed(1)} g · L {per.fat.toFixed(1)} g · G {per.carb.toFixed(1)} g · Fibres {per.fiber.toFixed(1)} g
        </p>
        <h3>Ingrédients (2 personnes)</h3>
        <ul>
          {(recipe.recipe_ingredients || []).map((i) => (
            <li key={i.id || i.label}>{i.label} — {i.pieces ? `${i.pieces} pièce${i.pieces > 1 ? "s" : ""} (${i.quantity_g} g)` : `${i.quantity_g} g`}</li>
          ))}
        </ul>
        {recipe.utensils?.length > 0 && (
          <>
            <h3>Ustensiles</h3>
            <p>{recipe.utensils.join(", ")}</p>
          </>
        )}
        {recipe.instructions && (
          <>
            <h3>Mode opératoire</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{recipe.instructions}</p>
          </>
        )}
        {recipe.source_url && (
          <p className="muted">
            Source : <a href={recipe.source_url} target="_blank" rel="noreferrer">{new URL(recipe.source_url).hostname}</a>
          </p>
        )}
        <button onClick={onEdit}>Modifier</button>
      </div>
    </div>
  );
}

export default function Recipes({ recipes, foodsByCode, reload }) {
  const [cat, setCat] = useState("");
  const [season, setSeason] = useState(currentSeason());
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null); // null | {} | recipe
  const [detail, setDetail] = useState(null);

  const list = recipes.filter(
    (r) =>
      (!cat || r.category === cat) &&
      (!season || r.season === season || r.season === "Toute l'année") &&
      (!search || r.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="panel">
      <div className="row spread">
        <div className="row">
          <input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Type">
            <option value="">Tous les types</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Saison">
            <option value="">Toutes saisons</option>
            {SEASONS.filter((s) => s !== "Toute l'année").map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="primary" onClick={() => setForm({})}>+ Recette</button>
      </div>

      <div className="recipes-grid">
        {list.map((r) => (
          <article key={r.id} className="recipe-card">
            <Thumb recipe={r} />
            <div className="body">
              <strong>{r.name}</strong>
              <div className="badges">
                <span className="badge">{r.category}</span>
                <span className="badge season">{r.season}</span>
              </div>
              {(r.allergens || []).length > 0 && (
                <span className="allergen-dots">⚠ {r.allergens.join(" · ")}</span>
              )}
              <button className="ghost" style={{ marginTop: "auto", alignSelf: "start" }} onClick={() => setDetail(r)}>
                Consulter →
              </button>
            </div>
          </article>
        ))}
        {list.length === 0 && (
          <p className="muted">Aucune recette ne correspond. Ajoutez-en une avec « + Recette ».</p>
        )}
      </div>

      {form && (
        <RecipeForm
          recipe={form.id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); setDetail(null); reload(); }}
        />
      )}
      {detail && (
        <RecipeDetail
          recipe={detail}
          foodsByCode={foodsByCode}
          onClose={() => setDetail(null)}
          onEdit={() => { setForm(detail); }}
        />
      )}
    </div>
  );
}
