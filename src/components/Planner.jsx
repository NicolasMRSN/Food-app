import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "../lib/supabase";
import { DAY_NAMES, SLOTS, SEASONS, isoDate, currentSeason, CATEGORIES } from "../lib/constants";

const LIB_PER_PAGE = 12;
const SLOT_PER_PAGE = 8;

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
  const [page, setPage] = useState(0);

  // Liste consultable dès l'ouverture, sans saisie obligatoire
  const filtered = recipes.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.toLowerCase()));
  const maxPage = Math.max(0, Math.ceil(filtered.length / SLOT_PER_PAGE) - 1);
  const cur = Math.min(page, maxPage);
  const matches = filtered.slice(cur * SLOT_PER_PAGE, (cur + 1) * SLOT_PER_PAGE);

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
            placeholder="Filtrer (optionnel)…"
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            style={{ width: "100%", fontSize: "0.8rem" }}
          />
          <div className="suggestions">
            {matches.map((r) => (
              <div key={r.id} onMouseDown={() => { onQuickAdd(date, slot, r.id); setAdding(false); setQ(""); setPage(0); }}>
                {r.name} <span className="sub">{r.category} · {r.season}</span>
              </div>
            ))}
            {matches.length === 0 && <div className="sub" style={{ padding: "0.5rem 0.7rem" }}>Aucune recette.</div>}
            {filtered.length > SLOT_PER_PAGE && (
              <div className="pager" onMouseDown={(e) => e.preventDefault()}>
                <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Page précédente">‹</button>
                <span>{cur + 1}/{maxPage + 1}</span>
                <button type="button" disabled={cur === maxPage} onClick={() => setPage(cur + 1)} aria-label="Page suivante">›</button>
              </div>
            )}
          </div>
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
  const [libSeason, setLibSeason] = useState(currentSeason());
  const [libQ, setLibQ] = useState("");
  const [libPage, setLibPage] = useState(0);

  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );

  // Bibliothèque : filtres type + saison + texte, paginée
  const library = recipes.filter(
    (r) =>
      (!libCat || r.category === libCat) &&
      (!libSeason || r.season === libSeason || r.season === "Toute l'année") &&
      (!libQ || r.name.toLowerCase().includes(libQ.toLowerCase()))
  );
  const libMaxPage = Math.max(0, Math.ceil(library.length / LIB_PER_PAGE) - 1);
  const libCur = Math.min(libPage, libMaxPage);
  const libPageItems = library.slice(libCur * LIB_PER_PAGE, (libCur + 1) * LIB_PER_PAGE);

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
        <span className="muted">Saison en cours : {currentSeason()} · glissez une recette sur un créneau, ou « + ajouter »</span>
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
            <input placeholder="Filtrer (optionnel)…" value={libQ} onChange={(e) => { setLibQ(e.target.value); setLibPage(0); }} />
            <select value={libCat} onChange={(e) => { setLibCat(e.target.value); setLibPage(0); }} aria-label="Type de recette">
              <option value="">Tous les types</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={libSeason} onChange={(e) => { setLibSeason(e.target.value); setLibPage(0); }} aria-label="Saison">
              <option value="">Toutes saisons</option>
              {SEASONS.filter((s) => s !== "Toute l'année").map((s) => <option key={s}>{s}</option>)}
            </select>
            {libPageItems.map((r) => <DraggableRecipe key={r.id} recipe={r} />)}
            {library.length === 0 && <p className="muted">Aucune recette pour ces filtres. Élargissez la saison ou ajoutez-en dans l'onglet Recettes.</p>}
            {library.length > LIB_PER_PAGE && (
              <div className="pager">
                <button type="button" disabled={libCur === 0} onClick={() => setLibPage(libCur - 1)} aria-label="Page précédente">‹</button>
                <span>{libCur + 1}/{libMaxPage + 1} · {library.length} recettes</span>
                <button type="button" disabled={libCur === libMaxPage} onClick={() => setLibPage(libCur + 1)} aria-label="Page suivante">›</button>
              </div>
            )}
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
