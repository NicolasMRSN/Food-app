import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { mondayOf, isoDate } from "./lib/constants";
import Auth from "./components/Auth";
import Planner from "./components/Planner";
import Recipes from "./components/Recipes";
import Report from "./components/Report";
import Shopping from "./components/Shopping";

const TABS = [
  ["semaine", "Semaine"],
  ["recettes", "Recettes"],
  ["rapport", "Rapport nutrition"],
  ["courses", "Courses"],
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("semaine");
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [recipes, setRecipes] = useState([]);
  const [meals, setMeals] = useState([]);
  const [foodsByCode, setFoodsByCode] = useState({});
  const [people, setPeople] = useState([]);
  const [wheySettings, setWheySettings] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadRecipes = useCallback(async () => {
    const { data } = await supabase
      .from("recipes")
      .select("*, recipe_ingredients(*)")
      .order("name");
    setRecipes(data || []);
    // Charger les fiches CIQUAL utilisées par les recettes (valeurs /100 g + rayon).
    const codes = [...new Set((data || []).flatMap((r) => r.recipe_ingredients.map((i) => i.ciqual_code)))];
    if (codes.length) {
      const { data: foods } = await supabase
        .from("ciqual_foods")
        .select("ciqual_code,name_fr,aisle,kcal_100g,protein_100g,carb_100g,fat_100g,fiber_100g")
        .in("ciqual_code", codes);
      setFoodsByCode(Object.fromEntries((foods || []).map((f) => [f.ciqual_code, f])));
    }
  }, []);

  const loadMeals = useCallback(async () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const { data } = await supabase
      .from("planned_meals")
      .select("*")
      .gte("meal_date", isoDate(weekStart))
      .lte("meal_date", isoDate(end));
    setMeals(data || []);
  }, [weekStart]);

  const loadSettings = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("people").select("*").order("sort"),
      supabase.from("app_settings").select("value").eq("key", "whey_nutripure").maybeSingle(),
    ]);
    setPeople(p || []);
    setWheySettings(s?.value || null);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadRecipes();
    loadSettings();
  }, [session, loadRecipes, loadSettings]);

  useEffect(() => {
    if (!session) return;
    loadMeals();
  }, [session, loadMeals]);

  if (session === undefined) return null;
  if (!session) return <Auth />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="brand">Table <em>·</em> Nicolas &amp; Marion</h1>
        <nav className="tabs" aria-label="Navigation">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </nav>
      </header>

      {tab === "semaine" && (
        <Planner weekStart={weekStart} setWeekStart={setWeekStart} recipes={recipes} meals={meals} reloadMeals={loadMeals} />
      )}
      {tab === "recettes" && <Recipes recipes={recipes} foodsByCode={foodsByCode} reload={loadRecipes} />}
      {tab === "rapport" && (
        <Report weekStart={weekStart} recipes={recipes} meals={meals} foodsByCode={foodsByCode} people={people} wheySettings={wheySettings} reloadSettings={loadSettings} />
      )}
      {tab === "courses" && <Shopping weekStart={weekStart} recipes={recipes} meals={meals} foodsByCode={foodsByCode} />}
    </div>
  );
}
