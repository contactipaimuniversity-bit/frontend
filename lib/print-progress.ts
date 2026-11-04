// Suivi d'une impression : une fenêtre s'ouvre dès le clic (préparation), puis
// annonce le PDF prêt ou l'erreur. Sans elle, un PDF arrive en silence dans les
// téléchargements et l'utilisateur ne sait pas si quelque chose se passe.

export const PRINT_EVENT = "ipaim-print";

export type PrintProgress =
  | { phase: "start"; label?: string }
  | { phase: "ready"; url: string; fileName: string }
  | { phase: "failed"; message: string }
  // Fin d'une préparation qui n'a rien produit (rien à imprimer) : la fenêtre se ferme.
  | { phase: "end" };

function emit(detail: PrintProgress) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRINT_EVENT, { detail }));
}

/** Ouvre la fenêtre de préparation (sans libellé : garde celui déjà affiché). */
export function printStarted(label?: string) {
  emit({ phase: "start", label });
}

/** Enregistre le PDF dans les téléchargements et l'annonce comme prêt. */
export function savePdf(pdf: { output(type: "blob"): Blob; save(fileName: string): unknown }, fileName: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    pdf.save(fileName);
    return;
  }
  const url = URL.createObjectURL(pdf.output("blob"));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  emit({ phase: "ready", url, fileName });
}

/** Une impression qui commence par rassembler ses données : la fenêtre s'ouvre tout de suite. */
export async function printTask<T>(label: string, task: () => Promise<T>): Promise<T> {
  printStarted(label);
  try {
    const result = await task();
    emit({ phase: "end" });
    return result;
  } catch (failure) {
    emit({ phase: "failed", message: failure instanceof Error ? failure.message : "Le document n'a pas pu être préparé." });
    throw failure;
  }
}
