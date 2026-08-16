import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Recherche dans la table CIQUAL (name_fr) avec suggestions.
export default function FoodAutocomplete({ value, onSelect, placeholder = "Ingrédient CIQUAL…" }) {
  const [q, setQ] = useState(value || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => setQ(value || ""), [value]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("ciqual_foods")
        .select("ciqual_code,name_fr,subgroup_fr,kcal_100g")
        .ilike("name_fr", `%${q.trim()}%`)
        .order("name_fr")
        .limit(12);
      setItems(data || []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

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
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        style={{ width: "100%" }}
      />
      {open && items.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
