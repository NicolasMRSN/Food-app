import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "../lib/supabase";
import { DAY_NAMES, SLOTS, isoDate, currentSeason, CATEGORIES } from "../lib/constants";

function DraggableRecipe({ recipe }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lib-${recipe.id}`,
    data: { recipeId: recipe.id },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 40, opacity: isDragging ? 0.85 : 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className="lib-item" {...listeners} {...attributes}>
      {recipe.image_url ? <img src={recipe.image_url} alt="" /> : <div className="lib-thumb">🍽</div>}
      <div>
        <div className="name">{recipe.name}</div>
        <span className="chip-cat">{recipe.category}</span>
        {(recipe.allergens || []).length > 0 && (
          <div className="allergen-dots" title={recipe.allergens.join(", ")}>⚠ {recipe.allergens.join(" · ")}</div>
        )}
      </div>
    </div>
  );
}

function Slot({ date, slot, meals, recipesById, onRemove, onServings, onQuickAdd, recipes }) {
  const id = `${isoDate(date)}|${slot}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");

  const matches = q.trim().length >= 1
    ? recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div ref={setNodeRef} className={`slot ${isOver ? "over" : ""}`}>
      <span className="slot-title">{slot}</span>
      {meals.map((m) => {
        const r = recipesById[m.recipe_id];
        if (!r) return null;
        return (
          <div className="meal-chip" key={m.id}>
            <span className="chip-cat">{r.category}</span>
            <span>{r.name}</span>
            <div className="row spread">
              <span className="serv-ctrl">
                <button onClick={() => onServings(m, Math.max(1, m.servings - 1))} aria-label="Moins de parts">−</button>
                {m.servings} pers.
                <button onClick={() => onServings(m, m.servings + 1)} aria-label="Plus de parts">+</button>
              </span>
              <button className="ghost" onClick={() => onRemove(m)} aria-label="Retirer le plat">✕</button>
            </div>
          </div>
        );
      })}
      {adding ? (
        <div className="autocomplete">
          <input
            autoFocus
            value={q}
            placeholder="Nom de recette…"
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            style={{ width: "100%", fontSize: "0.8rem" }}
          />
          {matches.length > 0 && (
            <div className="suggestions">
              {matches.map((r) => (
                <div key={r.id} onMouseDown={() => { onQuickAdd(date, slot, r.id); setAdding(false); setQ(""); }}>
                  {r.name} <span className="sub">{r.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button className="ghost" style={{ fontSize: "0.75rem" }} onClick={() => setAdding(true)}>+ ajouter</button>
      )}
    </div>
  );
}

export default function Planner({ weekStart, setWeekStart, recipes, meals, reloadMeals }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [libCat, setLibCat] = useState("");
  const [libQ, setLibQ] = useState("");
  const season = currentSeason();

  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );

  const library = recipes.filter(
    (r) =>
      (!libCat || r.category === libCat) &&
      (r.season === season || r.season === "Toute l'année" || libQ) &&
      (!libQ || r.name.toLowerCase().includes(libQ.toLowerCase()))
  );

  async function addMeal(date, slot, recipeId) {
    await supabase.from("planned_meals").insert({ meal_date: isoDate(date), slot, recipe_id: recipeId, servings: 2 });
    reloadMeals();
  }

  async function onDragEnd(e) {
    const recipeId = e.active?.data?.current?.recipeId;
    const target = e.over?.id;
    if (!recipeId || !target) return;
    const [date, slot] = String(target).split("|");
    await supabase.from("planned_meals").insert({ meal_date: date, slot, recipe_id: recipeId, servings: 2 });
    reloadMeals();
  }

  async function removeMeal(m) {
    await supabase.from("planned_meals").delete().eq("id", m.id);
    reloadMeals();
  }

  async function setServings(m, servings) {
    await supabase.from("planned_meals").update({ servings }).eq("id", m.id);
    reloadMeals();
  }

  function shiftWeek(n) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + n * 7);
    setWeekStart(d);
  }

  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

  return (
    <div className="panel">
      <div className="row spread">
        <div className="row">
          <button onClick={() => shiftWeek(-1)} aria-label="Semaine précédente">←</button>
          <h2>Semaine du {fmt.format(weekStart)}</h2>
          <button onClick={() => shiftWeek(1)} aria-label="Semaine suivante">→</button>
        </div>
        <span className="muted">Saison en cours : {season} · glissez une recette sur un créneau, ou « + ajouter »</span>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="planner-layout">
          <div className="week-grid">
            {days.map((d, i) => (
              <div className="day-col" key={i}>
                <div className="day-head">
                  {DAY_NAMES[i]} <strong>{fmt.format(d)}</strong>
                </div>
                {SLOTS.map((slot) => (
                  <Slot
                    key={slot}
                    date={d}
                    slot={slot}
                    meals={meals.filter((m) => m.meal_date === isoDate(d) && m.slot === slot)}
                    recipesById={recipesById}
                    onRemove={removeMeal}
                    onServings={setServings}
                    onQuickAdd={addMeal}
                    recipes={recipes}
                  />
                ))}
              </div>
            ))}
          </div>

          <aside className="library card">
            <h3>Recettes</h3>
            <input placeholder="Filtrer…" value={libQ} onChange={(e) => setLibQ(e.target.value)} />
            <select value={libCat} onChange={(e) => setLibCat(e.target.value)} aria-label="Type de recette">
              <option value="">Tous les types</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {library.map((r) => <DraggableRecipe key={r.id} recipe={r} />)}
            {library.length === 0 && <p className="muted">Aucune recette de saison. Élargissez le filtre ou ajoutez-en dans l'onglet Recettes.</p>}
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
