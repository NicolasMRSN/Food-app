import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { AISLE_ORDER, isoDate, fmtQty } from "../lib/constants";

export default function Shopping({ weekStart, recipes, meals, foodsByCode }) {
  const [checks, setChecks] = useState({});
  const week = isoDate(weekStart);
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);

  // Agrégation : somme des quantités par ingrédient CIQUAL sur les repas de la semaine,
  // mise à l'échelle du nombre de parts de chaque repas (base : 2 personnes).
  const items = useMemo(() => {
    const acc = {};
    for (const m of meals) {
      const r = recipesById[m.recipe_id];
      if (!r) continue;
      const factor = (m.servings || 2) / (r.servings_base || 2);
      for (const ing of r.recipe_ingredients || []) {
        const key = ing.ciqual_code;
        if (!acc[key]) {
          const food = foodsByCode[key];
          acc[key] = { ciqual_code: key, label: ing.label, aisle: food?.aisle || "Épicerie salée", grams: 0, pieces: 0 };
        }
        acc[key].grams += (ing.quantity_g || 0) * factor;
        if (ing.pieces) acc[key].pieces += Number(ing.pieces) * factor;
      }
    }
    return Object.values(acc);
  }, [meals, recipesById, foodsByCode]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("shopping_checks").select("*").eq("week_start", week);
      setChecks(Object.fromEntries((data || []).map((c) => [c.ciqual_code, c.checked])));
    })();
  }, [week]);

  async function toggle(item) {
    const next = !checks[item.ciqual_code];
    setChecks((c) => ({ ...c, [item.ciqual_code]: next }));
    await supabase.from("shopping_checks").upsert(
      { week_start: week, ciqual_code: item.ciqual_code, label: item.label, checked: next },
      { onConflict: "week_start,ciqual_code" }
    );
  }

  const byAisle = {};
  for (const it of items) (byAisle[it.aisle] ||= []).push(it);
  const aisles = AISLE_ORDER.filter((a) => byAisle[a]);
  const done = items.filter((i) => checks[i.ciqual_code]).length;

  return (
    <div className="panel">
      <div className="row spread">
        <h2>Liste de courses</h2>
        <span className="muted">{done}/{items.length} articles dans le panier</span>
      </div>
      {items.length === 0 && (
        <p className="muted">Planifiez des repas dans l'onglet Semaine : la liste se remplit automatiquement.</p>
      )}
      {aisles.map((aisle) => (
        <section className="aisle" key={aisle}>
          <h3>{aisle}</h3>
          {byAisle[aisle]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((it) => (
              <label className={`shop-item ${checks[it.ciqual_code] ? "done" : ""}`} key={it.ciqual_code}>
                <input
                  type="checkbox"
                  checked={Boolean(checks[it.ciqual_code])}
                  onChange={() => toggle(it)}
                />
                <span className="txt">{it.label}</span>
                <span className="qty">
                  {it.pieces > 0
                    ? `${Math.ceil(it.pieces)} pc${Math.ceil(it.pieces) > 1 ? "s" : ""} · ${fmtQty(it.grams)}`
                    : fmtQty(it.grams)}
                </span>
              </label>
            ))}
        </section>
      ))}
    </div>
  );
}
