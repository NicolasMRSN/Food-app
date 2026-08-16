export const CATEGORIES = ["apéritif", "entrée", "plat", "dessert"];

export const SEASONS = ["Automne/Hiver", "Printemps/Été", "Toute l'année"];

// Saison courante : Printemps/Été d'avril à septembre inclus.
export function currentSeason(d = new Date()) {
  const m = d.getMonth() + 1;
  return m >= 4 && m <= 9 ? "Printemps/Été" : "Automne/Hiver";
}

// Les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011).
export const ALLERGENS = [
  "Gluten",
  "Crustacés",
  "Œufs",
  "Poissons",
  "Arachides",
  "Soja",
  "Lait",
  "Fruits à coque",
  "Céleri",
  "Moutarde",
  "Sésame",
  "Sulfites",
  "Lupin",
  "Mollusques",
];

export const AISLE_ORDER = [
  "Fruits et légumes",
  "Boucherie",
  "Charcuterie",
  "Poissonnerie",
  "Fromages",
  "Crèmerie",
  "Boulangerie",
  "Féculents",
  "Épicerie salée",
  "Épicerie sucrée",
  "Condiments et épices",
  "Huiles et matières grasses",
  "Surgelés",
  "Boissons",
  "Traiteur",
  "Bébé",
];

export const SLOTS = ["midi", "soir"];

// Valeurs par défaut Whey Isolate Nutripure (pour 100 g) — modifiables dans le rapport.
export const WHEY_DEFAULTS = {
  kcal_100g: 372,
  protein_100g: 87.4,
  carb_100g: 3.6,
  fat_100g: 1.4,
  fiber_100g: 0,
};

export const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isoDate(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function fmtQty(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg`;
  return `${Math.round(g)} g`;
}
