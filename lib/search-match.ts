// Recherche souple, la même que côté serveur (sgi/src/common/recherche.ts) :
// accents et majuscules ignorés, mots dans n'importe quel ordre, début de mot
// suffisant, fautes de frappe tolérées quand rien ne correspond directement.

export const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const phonetic = (word: string) =>
  word.replace(/ph/g, "f").replace(/qu/g, "k").replace(/c(?=[aou]|$)/g, "k").replace(/ck/g, "k").replace(/y/g, "i").replace(/h/g, "").replace(/(.)\1+/g, "$1");

const distance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
};

const tolerance = (length: number) => (length < 4 ? 0 : length < 7 ? 1 : 2);

// 2 : correspond directement, 1 : correspondance approchée, 0 : rien.
export function matchLevel(query: string, ...parts: Array<string | null | undefined>) {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return 2;
  const text = normalizeSearch(parts.filter(Boolean).join(" "));
  const words = text.split(" ");
  const compact = text.replace(/ /g, "");
  let level = 2;
  for (const term of terms) {
    let found = 0;
    if (words.some((word) => word.startsWith(term)) || text.includes(term) || (/\d/.test(term) && compact.includes(term))) found = 2;
    else if (tolerance(term.length)) {
      const sound = phonetic(term);
      const margin = tolerance(term.length);
      found = words.some((word) => {
        const form = phonetic(word);
        return form.startsWith(sound) || distance(sound, form) <= margin || distance(sound, form.slice(0, sound.length)) <= margin;
      }) ? 1 : 0;
    }
    level = Math.min(level, found);
    if (!level) break;
  }
  return level;
}

// Filtre une liste : les correspondances directes, sinon les approchantes.
export function softFilter<T>(items: T[], query: string, text: (item: T) => Array<string | null | undefined>) {
  if (!query.trim()) return items;
  const levels = items.map((item) => matchLevel(query, ...text(item)));
  const best = levels.includes(2) ? 2 : 1;
  return items.filter((_, index) => levels[index] === best);
}
