// Calculs nutritionnels à partir des données CIQUAL (valeurs pour 100 g).

export const EMPTY = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };

export function addN(a, b) {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carb: a.carb + b.carb,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function scaleN(a, f) {
  return { kcal: a.kcal * f, protein: a.protein * f, carb: a.carb * f, fat: a.fat * f, fiber: a.fiber * f };
}

// Apport d'un ingrédient : quantité (g) × valeurs /100 g.
export function ingredientNutrition(food, grams) {
  if (!food) return { ...EMPTY };
  const f = grams / 100;
  return {
    kcal: (food.kcal_100g || 0) * f,
    protein: (food.protein_100g || 0) * f,
    carb: (food.carb_100g || 0) * f,
    fat: (food.fat_100g || 0) * f,
    fiber: (food.fiber_100g || 0) * f,
  };
}

// Apport total d'une recette pour `servings` personnes
// (les quantités d'ingrédients sont définies pour recipe.servings_base personnes).
export function recipeNutrition(recipe, foodsByCode, servings = null) {
  const base = recipe.servings_base || 2;
  const factor = (servings ?? base) / base;
  let total = { ...EMPTY };
  for (const ing of recipe.recipe_ingredients || []) {
    const food = foodsByCode[ing.ciqual_code];
    total = addN(total, ingredientNutrition(food, (ing.quantity_g || 0) * factor));
  }
  return total;
}

// Apport par personne (une part).
export function recipePerServing(recipe, foodsByCode) {
  const base = recipe.servings_base || 2;
  return scaleN(recipeNutrition(recipe, foodsByCode, base), 1 / base);
}
