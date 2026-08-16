import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const PER_PAGE = 20;

// Sélecteur d'ingrédients CIQUAL : consultable dès le focus (sans saisie),
// recherche insensible aux accents/ligatures (œuf = oeuf), pagination.
export default function FoodAutocomplete({ value, onSelect, placeholder = "Ingrédient CIQUAL…" }) {
  const [q, setQ] = useState(value || "");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => setQ(value || ""), [value]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_foods", {
        q: q.trim(),
        lim: PER_PAGE + 1,
        off: page * PER_PAGE,
      });
      const rows = data || [];
      setHasNext(rows.length > PER_PAGE);
      setItems(rows.slice(0, PER_PAGE));
    }, q.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [q, page, open]);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="autocomplete" ref={boxRef}>
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setPage(0); }}
        onFocus={() => setOpen(true)}
        style={{ width: "100%" }}
      />
      {open && (
        <div className="suggestions" role="listbox">
          {items.map((f) => (
            <div
              key={f.ciqual_code}
              role="option"
              onClick={() => {
                onSelect(f);
                setQ(f.name_fr);
                setOpen(false);
              }}
            >
              {f.name_fr}
              <div className="sub">
                {f.subgroup_fr} · {Math.round(f.kcal_100g || 0)} kcal/100 g
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="sub" style={{ padding: "0.5rem 0.7rem" }}>Aucun ingrédient trouvé.</div>}
          {(page > 0 || hasNext) && (
            <div className="pager" onMouseDown={(e) => e.preventDefault()}>
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Page précédente">‹</button>
              <span>Page {page + 1}</span>
              <button type="button" disabled={!hasNext} onClick={() => setPage(page + 1)} aria-label="Page suivante">›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
