import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DAY_NAMES, SLOTS, isoDate, WHEY_DEFAULTS } from "../lib/constants";
import { EMPTY, addN, scaleN, recipeNutrition } from "../lib/nutrition";

// Répartition cible des macronutriments (% des kcal/j cibles de chaque personne)
const MACROS = [
  { key: "protein", label: "Protéines", kcalPerG: 4, min: 0.10, max: 0.20 },
  { key: "fat", label: "Lipides", kcalPerG: 9, min: 0.35, max: 0.40 },
  { key: "carb", label: "Glucides", kcalPerG: 4, min: 0.40, max: 0.55 },
];
const FIBER_MAX = 30; // g/j

function Gauge({ label, value, min, max }) {
  const scale = max * 1.25;
  const status = value < min ? "low" : value > max ? "over" : "ok";
  return (
    <div className="gauge" title={`${label} : ${Math.round(value)} g (cible ${Math.round(min)}–${Math.round(max)} g)`}>
      <div className="gauge-head">
        <span>{label}</span>
        <span className={`gauge-val ${status}`}>{Math.round(value)} g</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-band" style={{ left: `${(min / scale) * 100}%`, width: `${((max - min) / scale) * 100}%` }} />
        <div className={`gauge-fill ${status}`} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
      </div>
      <span className="gauge-range">{Math.round(min)}–{Math.round(max)} g</span>
    </div>
  );
}

function FiberGauge({ value }) {
  const scale = FIBER_MAX * 1.25;
  const status = value > FIBER_MAX ? "over" : "ok";
  return (
    <div className="gauge" title={`Fibres : ${Math.round(value)} g (max ${FIBER_MAX} g)`}>
      <div className="gauge-head">
        <span>Fibres</span>
        <span className={`gauge-val ${status}`}>{Math.round(value)} g</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-band" style={{ left: 0, width: `${(FIBER_MAX / scale) * 100}%` }} />
        <div className={`gauge-fill ${status}`} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
      </div>
      <span className="gauge-range">max {FIBER_MAX} g</span>
    </div>
  );
}

function KcalGauge({ value, target }) {
  const scale = target * 1.25;
  const status = value > target * 1.05 ? "over" : value < target * 0.8 ? "low" : "ok";
  return (
    <div className="gauge" title={`${Math.round(value)} / ${Math.round(target)} kcal`}>
      <div className="gauge-head">
        <span>Énergie</span>
        <span className={`gauge-val ${status}`}>{Math.round(value)} kcal</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-band" style={{ left: `${(target * 0.9 / scale) * 100}%`, width: `${(target * 0.15 / scale) * 100}%` }} />
        <div className={`gauge-fill ${status}`} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
      </div>
      <span className="gauge-range">cible {Math.round(target)}</span>
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
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

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

      {/* Cibles individuelles : énergie + whey */}
      <div className="row" style={{ gap: "1rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
        {people.map((p) => {
          const w = wheyByPerson[p.id];
          const t = Number(p.daily_kcal_target || 2000);
          return (
            <div className="card" key={p.id} style={{ flex: "1 1 280px" }}>
              <div className="row spread">
                <h3>{p.name}</h3>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <label style={{ margin: 0 }}>Cible kcal/j</label>
                  <input
                    type="number"
                    defaultValue={t}
                    style={{ width: 85 }}
                    onBlur={(e) => Number(e.target.value) !== t && updatePerson(p, { daily_kcal_target: Number(e.target.value) })}
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
                Zones cibles : Protéines {Math.round(t * 0.10 / 4)}–{Math.round(t * 0.20 / 4)} g · Lipides {Math.round(t * 0.35 / 9)}–{Math.round(t * 0.40 / 9)} g ·
                Glucides {Math.round(t * 0.40 / 4)}–{Math.round(t * 0.55 / 4)} g · Fibres ≤{FIBER_MAX} g ·
                Whey : +{Math.round(w.kcal)} kcal, P +{w.protein.toFixed(1)} g
              </p>
            </div>
          );
        })}
      </div>

      {/* Détail par jour : chaque repas avec ses apports par personne, puis jauges individuelles */}
      {days.map((d, di) => {
        const dayMeals = meals
          .filter((m) => m.meal_date === isoDate(d))
          .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
        const rows = dayMeals
          .map((m) => {
            const r = recipesById[m.recipe_id];
            if (!r) return null;
            // Apport par personne = une part (repas divisé par son nombre de parts)
            const per = scaleN(recipeNutrition(r, foodsByCode, m.servings), 1 / m.servings);
            return { m, r, per };
          })
          .filter(Boolean);
        const dayTotal = rows.reduce((acc, x) => addN(acc, x.per), { ...EMPTY });

        return (
          <section className="card day-report" key={di}>
            <h3 style={{ textTransform: "capitalize" }}>{DAY_NAMES[di]} {fmt.format(d)}</h3>
            {rows.length === 0 ? (
              <p className="muted" style={{ margin: "0.4rem 0 0" }}>Aucun repas planifié.</p>
            ) : (
              <>
                <table className="nutri" style={{ marginTop: "0.5rem" }}>
                  <thead>
                    <tr>
                      <th>Repas (apport par personne)</th>
                      <th>kcal</th><th>Prot. (g)</th><th>Lip. (g)</th><th>Gluc. (g)</th><th>Fibres (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ m, r, per }) => (
                      <tr key={m.id}>
                        <td><span className="chip-cat">{m.slot}</span> {r.name} <span className="muted">({r.category})</span></td>
                        <td>{Math.round(per.kcal)}</td>
                        <td>{per.protein.toFixed(1)}</td>
                        <td>{per.fat.toFixed(1)}</td>
                        <td>{per.carb.toFixed(1)}</td>
                        <td>{per.fiber.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="person-gauges-wrap">
                  {people.map((p) => {
                    const w = wheyByPerson[p.id];
                    const tot = addN(dayTotal, w);
                    const target = Number(p.daily_kcal_target || 2000);
                    return (
                      <div className="person-gauges" key={p.id}>
                        <strong>{p.name}</strong>
                        <div className="gauges-row">
                          <KcalGauge value={tot.kcal} target={target} />
                          {MACROS.map((mc) => (
                            <Gauge
                              key={mc.key}
                              label={mc.label}
                              value={tot[mc.key]}
                              min={(target * mc.min) / mc.kcalPerG}
                              max={(target * mc.max) / mc.kcalPerG}
                            />
                          ))}
                          <FiberGauge value={tot.fiber} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        );
      })}
      <p className="muted">
        Chaque repas est divisé par son nombre de parts (2 par défaut) : les valeurs affichées sont l'apport d'une personne.
        Les jauges par personne incluent la whey individuelle et s'évaluent contre les zones cibles : protéines 10–20 %, lipides 35–40 %,
        glucides 40–55 % des kcal/j cibles, fibres ≤{FIBER_MAX} g. Données CIQUAL (ANSES).
      </p>
    </div>
  );
}
