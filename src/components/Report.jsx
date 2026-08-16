import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DAY_NAMES, isoDate, WHEY_DEFAULTS } from "../lib/constants";
import { EMPTY, addN, scaleN, recipeNutrition } from "../lib/nutrition";

function Bar({ value, target }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="bar-track" title={`${Math.round(value)} / ${Math.round(target)} kcal`}>
      <div className={`bar-fill ${value > target * 1.1 ? "over" : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Report({ weekStart, recipes, meals, foodsByCode, people, wheySettings, reloadSettings }) {
  const [editWhey, setEditWhey] = useState(false);
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const whey = { ...WHEY_DEFAULTS, ...(wheySettings || {}) };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Apport journalier par personne : chaque repas planifié est divisé par son
  // nombre de parts (2 par défaut) -> une part par personne.
  const perDay = days.map((d) => {
    const dayMeals = meals.filter((m) => m.meal_date === isoDate(d));
    let onePart = { ...EMPTY };
    for (const m of dayMeals) {
      const r = recipesById[m.recipe_id];
      if (!r) continue;
      onePart = addN(onePart, scaleN(recipeNutrition(r, foodsByCode, m.servings), 1 / m.servings));
    }
    return { hasMeals: dayMeals.length > 0, onePart };
  });

  // Whey par personne (valeurs /100 g communes, grammage individuel)
  const wheyByPerson = Object.fromEntries(
    people.map((p) => [
      p.id,
      scaleN(
        { kcal: whey.kcal_100g, protein: whey.protein_100g, carb: whey.carb_100g, fat: whey.fat_100g, fiber: whey.fiber_100g },
        Number(p.whey_grams_daily || 0) / 100
      ),
    ])
  );

  async function updatePerson(p, patch) {
    await supabase.from("people").update(patch).eq("id", p.id);
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

      {/* Cibles individuelles : énergie + whey pour chacun */}
      <div className="row" style={{ gap: "1rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
        {people.map((p) => {
          const w = wheyByPerson[p.id];
          return (
            <div className="card" key={p.id} style={{ flex: "1 1 260px" }}>
              <div className="row spread">
                <h3>{p.name}</h3>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <label style={{ margin: 0 }}>Cible kcal/j</label>
                  <input
                    type="number"
                    defaultValue={p.daily_kcal_target}
                    style={{ width: 85 }}
                    onBlur={(e) => Number(e.target.value) !== Number(p.daily_kcal_target) && updatePerson(p, { daily_kcal_target: Number(e.target.value) })}
                  />
                  <label style={{ margin: 0 }}>Whey g/j</label>
                  <input
                    type="number"
                    defaultValue={p.whey_grams_daily}
                    style={{ width: 70 }}
                    onBlur={(e) => Number(e.target.value) !== Number(p.whey_grams_daily) && updatePerson(p, { whey_grams_daily: Number(e.target.value) })}
                  />
                </span>
              </div>
              <p className="muted" style={{ margin: "0.4rem 0 0" }}>
                Whey quotidienne : +{Math.round(w.kcal)} kcal · P +{w.protein.toFixed(1)} g · G +{w.carb.toFixed(1)} g · L +{w.fat.toFixed(1)} g
              </p>
            </div>
          );
        })}
      </div>

      {/* Tableau unique : apports d'une part (repas ÷ nb de parts) + kcal avec whey par personne */}
      <div className="card" style={{ marginTop: "1rem", overflowX: "auto" }}>
        <table className="nutri">
          <thead>
            <tr>
              <th>Jour</th>
              <th>kcal (repas)</th>
              <th>Prot. (g)</th>
              <th>Lip. (g)</th>
              <th>Gluc. (g)</th>
              <th>Fibres (g)</th>
              {people.map((p) => (
                <th key={p.id} style={{ minWidth: 150 }}>{p.name} · kcal + whey</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perDay.map(({ hasMeals, onePart }, i) => (
              <tr key={i} style={!hasMeals ? { color: "var(--ink-soft)" } : {}}>
                <td style={{ textTransform: "capitalize" }}>{DAY_NAMES[i]}</td>
                <td>{Math.round(onePart.kcal)}</td>
                <td>{onePart.protein.toFixed(0)}</td>
                <td>{onePart.fat.toFixed(0)}</td>
                <td>{onePart.carb.toFixed(0)}</td>
                <td>{onePart.fiber.toFixed(0)}</td>
                {people.map((p) => {
                  const total = onePart.kcal + wheyByPerson[p.id].kcal;
                  const target = Number(p.daily_kcal_target || 2000);
                  return (
                    <td key={p.id}>
                      <div className="row" style={{ gap: "0.5rem", flexWrap: "nowrap" }}>
                        <span style={{ minWidth: 44, textAlign: "right" }}>{Math.round(total)}</span>
                        <div style={{ flex: 1 }}><Bar value={total} target={target} /></div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginBottom: 0 }}>
          Colonnes « repas » : une part par personne (repas divisé par le nombre de parts, 2 par défaut).
          Colonnes par personne : kcal du repas + whey individuelle, comparés à la cible. Données CIQUAL (ANSES).
        </p>
      </div>
    </div>
  );
}
