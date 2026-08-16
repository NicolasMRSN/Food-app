// Edge function : import d'une recette depuis une URL (marmiton.org, jow.fr, cuisineaz…)
// Extraction du JSON-LD schema.org/Recipe présent sur ces sites.
// Réservée aux utilisateurs authentifiés (verify_jwt activé au déploiement).

const UNIT_TO_G: Record<string, number> = {
  g: 1, gramme: 1, grammes: 1,
  kg: 1000,
  mg: 0.001,
  l: 1000, litre: 1000, litres: 1000,
  cl: 10,
  ml: 1,
  "c. à soupe": 15, "cuillère à soupe": 15, "cuillères à soupe": 15, cas: 15, "c.à.s": 15,
  "c. à café": 5, "cuillère à café": 5, "cuillères à café": 5, cac: 5, "c.à.c": 5,
  sachet: 10, sachets: 10,
  pincée: 1, pincées: 1,
};

function parseIngredient(raw: string) {
  const txt = raw.replace(/\s+/g, " ").trim();
  // Formes : "200 g de farine", "2 cuillères à soupe d'huile", "3 œufs"
  const m = txt.match(/^([\d.,/]+)\s*([a-zA-Zàâéèêîôûç.\s]*?)\s*(?:de\s+|d')?(.+)$/i);
  let grams: number | null = null;
  let label = txt;
  if (m) {
    let qty = m[1].includes("/")
      ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1])
      : Number(m[1].replace(",", "."));
    const unit = m[2].trim().toLowerCase();
    label = m[3].trim();
    if (!Number.isNaN(qty)) {
      if (unit && UNIT_TO_G[unit] != null) grams = Math.round(qty * UNIT_TO_G[unit]);
      else if (!unit) grams = null; // pièces ("3 œufs") : grammage à préciser par l'utilisateur
    }
  }
  return { raw: txt, label, grams };
}

function firstRecipe(node: unknown): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = firstRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    const type = o["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return o;
    if (o["@graph"]) return firstRecipe(o["@graph"]);
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { url } = await req.json();
    if (!url || !/^https?:\/\//.test(url)) throw new Error("URL invalide");

    const page = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoodApp/1.0)", Accept: "text/html" },
    });
    if (!page.ok) throw new Error(`Page inaccessible (${page.status})`);
    const html = await page.text();

    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe: Record<string, unknown> | null = null;
    for (const s of scripts) {
      try {
        recipe = firstRecipe(JSON.parse(s[1].trim()));
        if (recipe) break;
      } catch { /* JSON-LD invalide : bloc suivant */ }
    }
    if (!recipe) throw new Error("Aucune recette structurée trouvée sur cette page");

    const image = Array.isArray(recipe.image)
      ? recipe.image[0]
      : typeof recipe.image === "object" && recipe.image
      ? (recipe.image as Record<string, unknown>).url
      : recipe.image;

    let instructions = "";
    const ri = recipe.recipeInstructions;
    if (typeof ri === "string") instructions = ri;
    else if (Array.isArray(ri)) {
      instructions = ri
        .map((s: unknown, i: number) => {
          const step = typeof s === "string" ? s : (s as Record<string, unknown>)?.text ?? "";
          return `${i + 1}. ${step}`;
        })
        .join("\n");
    }

    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map((r: unknown) => parseIngredient(String(r)));

    return new Response(
      JSON.stringify({
        name: recipe.name ?? null,
        image: typeof image === "string" ? image : null,
        instructions,
        ingredients,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
