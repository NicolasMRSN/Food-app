import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DAY_NAMES, isoDate, WHEY_DEFAULTS } from "../lib/constants";
import { EMPTY, addN, scaleN, recipeNutrition } from "../lib/nutrition";

function Bar({ value, target }) {
  const pct = target > 0 ? Math.min(140, (value / target) * 100) : 0;
  return (
    <div className="bar-track" title={`${Math.round(value)} / ${Math.round(target)}`}>
      <div className={`bar-fill ${value > target * 1.1 ? "over" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function Report({ weekStart, recipes, meals, foodsByCode, profiles, wheySettings, reloadSettings }) {
  const [editWhey, setEditWhey] = useState(false);
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const whey = { ...WHEY_DEFAULTS, ...(wheySettings || {}) };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Apport par personne et par jour : 1 part de chaque recette planifiée + whey quotidienne.
  const perDay = days.map((d) => {
    const dayMeals = meals.filter((m) => m.meal_date === isoDate(d));
    let onePart = { ...EMPTY };
    for (const m of dayMeals) {
      const r = recipesById[m.recipe_id];
      if (!r) continue;
      onePart = addN(onePart, scaleN(recipeNutrition(r, foodsByCode, m.servings), 1 / m.servings));
    }
    return { date: d, hasMeals: dayMeals.length > 0, onePart };
  });

  async function updateProfile(p, patch) {
    await supabase.from("profiles").update(patch).eq("id", p.id);
    reloadSettings();
  }

  async function saveWhey(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    await supabase.from("app_settings").upsert({
      key: "whey_nutripure",
      value: {
        kcal_100g: Number(f.get("kcal")),
        protein_100g: Number(f.get("prot")),
        carb_100g: Number(f.get("carb")),
        fat_100g: Number(f.get("fat")),
        fiber_100g: Number(f.get("fiber")),
      },
    });
    setEditWhey(false);
    reloadSettings();
  }

  return (
    <div className="panel">
      <div className="row spread" style={{ alignItems: "start" }}>
        <h2>Apports journaliers — semaine en cours</h2>
        <div className="card" style={{ minWidth: 260 }}>
          <div className="row spread">
            <h3>Whey Isolate Nutripure</h3>
            <button className="ghost" onClick={() => setEditWhey(!editWhey)}>{editWhey ? "Annuler" : "Modifier"}</button>
          </div>
          {editWhey ? (
            <form onSubmit={saveWhey} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
              {[["kcal", "kcal/100 g", whey.kcal_100g], ["prot", "Protéines g/100 g", whey.protein_100g], ["carb", "Glucides g/100 g", whey.carb_100g], ["fat", "Lipides g/100 g", whey.fat_100g], ["fiber", "Fibres g/100 g", whey.fiber_100g]].map(([n, l, v]) => (
                <div key={n} className="row spread">
                  <label style={{ margin: 0 }}>{l}</label>
                  <input name={n} type="number" step="0.1" defaultValue={v} style={{ width: 90 }} />
                </div>
              ))}
              <button className="primary">Enregistrer</button>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {whey.kcal_100g} kcal · P {whey.protein_100g} g · G {whey.carb_100g} g · L {whey.fat_100g} g /100 g
            </p>
          )}
        </div>
      </div>

      <div className="report-grid">
        {profiles.map((p) => {
          const wheyG = Number(p.whey_grams_daily || 0);
          const wheyN = scaleN(
            { kcal: whey.kcal_100g, protein: whey.protein_100g, carb: whey.carb_100g, fat: whey.fat_100g, fiber: whey.fiber_100g },
            wheyG / 100
          );
          const target = Number(p.daily_kcal_target || 2000);
          return (
            <section className="card" key={p.id}>
              <div className="row spread">
                <h3>{p.display_name}</h3>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <label style={{ margin: 0 }}>Cible kcal/j</label>
                  <input
                    type="number"
                    defaultValue={target}
                    style={{ width: 85 }}
                    onBlur={(e) => Number(e.target.value) !== target && updateProfile(p, { daily_kcal_target: Number(e.target.value) })}
                  />
                  <label style={{ margin: 0 }}>Whey g/j</label>
                  <input
                    type="number"
                    defaultValue={wheyG}
                    style={{ width: 70 }}
                    onBlur={(e) => Number(e.target.value) !== wheyG && updateProfile(p, { whey_grams_daily: Number(e.target.value) })}
                  />
                </span>
              </div>
              <table className="nutri" style={{ marginTop: "0.6rem" }}>
                <thead>
                  <tr>
                    <th>Jour</th><th>kcal</th><th>Prot. (g)</th><th>Lip. (g)</th><th>Gluc. (g)</th><th>Fibres (g)</th><th style={{ width: 110 }}>vs cible</th>
                  </tr>
                </thead>
                <tbody>
                  {perDay.map(({ date, hasMeals, onePart }, i) => {
                    const t = hasMeals || wheyG > 0 ? addN(onePart, wheyN) : { ...EMPTY };
                    return (
                      <tr key={i} style={!hasMeals && wheyG === 0 ? { color: "var(--ink-soft)" } : {}}>
                        <td style={{ textTransform: "capitalize" }}>{DAY_NAMES[i]}</td>
                        <td>{Math.round(t.kcal)}</td>
                        <td>{t.protein.toFixed(0)}</td>
                        <td>{t.fat.toFixed(0)}</td>
                        <td>{t.carb.toFixed(0)}</td>
                        <td>{t.fiber.toFixed(0)}</td>
                        <td><Bar value={t.kcal} target={target} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="muted" style={{ marginBottom: 0 }}>
                Une part de chaque plat planifié + {wheyG} g de whey/jour. Données CIQUAL (ANSES).
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
