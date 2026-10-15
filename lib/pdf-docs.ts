import { generatedByLine } from "@/lib/session";
import { formatDate, formatMoney, pdfSafe } from "@/lib/types";

// Documents officiels en PDF : bulletins de notes, procès-verbaux de délibération, bulletins de paie.

type Pdf = import("jspdf").jsPDF;

export const DECISION_LABELS: Record<string, string> = {
  VALIDE: "Semestre validé",
  NON_VALIDE: "Semestre non validé",
  INCOMPLET: "Résultats incomplets",
  ADMIS: "Admis(e)",
  ADMIS_AVEC_DETTES: "Admis(e) avec crédits à rattraper",
  AJOURNE: "Ajourné(e)",
  NON_DELIBERE: "Non délibéré",
};

const note = (value: number | string | null | undefined) => (value === null || value === undefined ? "-" : Number(value).toFixed(2).replace(".", ","));

async function createPdf(landscape = false): Promise<Pdf> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
}

function header(pdf: Pdf, title: string, subtitle: string) {
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFont("helvetica", "bold").setFontSize(15).setTextColor(20, 40, 92);
  pdf.text("IPAIM UNIVERSITY", 15, 18);
  pdf.setFontSize(12);
  pdf.text(pdfSafe(title), width - 15, 18, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 100, 120);
  pdf.text(pdfSafe(subtitle), width - 15, 24, { align: "right" });
  pdf.setDrawColor(200, 148, 27).setLineWidth(0.6).line(15, 28, width - 15, 28);
  pdf.setTextColor(30, 40, 60);
}

function footer(pdf: Pdf) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(110, 120, 135);
  pdf.text(pdfSafe(generatedByLine()), width / 2, height - 8, { align: "center" });
  pdf.setTextColor(30, 40, 60);
}

// Tableau simple : colonnes de largeur fixe, saut de page automatique.
function table(pdf: Pdf, y: number, columns: Array<{ label: string; width: number; align?: "right" | "center" }>, rows: Array<{ cells: string[]; bold?: boolean; fill?: boolean }>, x = 15) {
  const height = pdf.internal.pageSize.getHeight();
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const drawHead = () => {
    pdf.setFillColor(20, 40, 92).rect(x, y, total, 7, "F");
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(255, 255, 255);
    let left = x;
    for (const column of columns) {
      pdf.text(pdfSafe(column.label), column.align === "right" ? left + column.width - 2 : column.align === "center" ? left + column.width / 2 : left + 2, y + 4.8, { align: column.align ?? "left" });
      left += column.width;
    }
    pdf.setTextColor(30, 40, 60);
    y += 7;
  };
  drawHead();
  for (const row of rows) {
    if (y > height - 22) {
      footer(pdf);
      pdf.addPage();
      y = 18;
      drawHead();
    }
    if (row.fill) pdf.setFillColor(232, 238, 248).rect(x, y, total, 6.2, "F");
    pdf.setFont("helvetica", row.bold ? "bold" : "normal").setFontSize(8.5);
    let left = x;
    row.cells.forEach((cell, index) => {
      const column = columns[index];
      const text = pdf.splitTextToSize(pdfSafe(cell), column.width - 3)[0] as string;
      pdf.text(text ?? "", column.align === "right" ? left + column.width - 2 : column.align === "center" ? left + column.width / 2 : left + 2, y + 4.3, { align: column.align ?? "left" });
      left += column.width;
    });
    pdf.setDrawColor(215, 222, 235).setLineWidth(0.1).line(x, y + 6.2, x + total, y + 6.2);
    y += 6.2;
  }
  return y;
}

// ---------- Export d'un tableau ----------

export type PdfColumn = { label: string; width: number; align?: "right" | "center" };

// Export d'une liste en PDF paysage : le texte long passe à la ligne au lieu d'être coupé.
export async function tablePdf(options: { title: string; subtitle: string; columns: PdfColumn[]; rows: Array<Array<string | number | null | undefined>>; fileName: string }) {
  const pdf = await createPdf(true);
  const height = pdf.internal.pageSize.getHeight();
  const { columns } = options;
  const x = 15;
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const position = (column: PdfColumn, left: number) => (column.align === "right" ? left + column.width - 2 : column.align === "center" ? left + column.width / 2 : left + 2);
  let y = 34;
  const drawHead = () => {
    pdf.setFillColor(20, 40, 92).rect(x, y, total, 7, "F");
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(255, 255, 255);
    let left = x;
    for (const column of columns) {
      pdf.text(pdfSafe(column.label), position(column, left), y + 4.8, { align: column.align ?? "left" });
      left += column.width;
    }
    pdf.setFont("helvetica", "normal").setTextColor(30, 40, 60);
    y += 7;
  };
  header(pdf, options.title, options.subtitle);
  drawHead();
  options.rows.forEach((row, rowIndex) => {
    const cells = columns.map((column, index) => (pdf.splitTextToSize(pdfSafe(String(row[index] ?? "")), column.width - 4) as string[]).slice(0, 6));
    const rowHeight = Math.max(1, ...cells.map((lines) => lines.length)) * 3.6 + 2.6;
    if (y + rowHeight > height - 16) {
      footer(pdf);
      pdf.addPage();
      y = 18;
      drawHead();
    }
    if (rowIndex % 2) pdf.setFillColor(244, 247, 252).rect(x, y, total, rowHeight, "F");
    // Une ligne de total ressort en gras.
    pdf.setFont("helvetica", row.includes("TOTAL") ? "bold" : "normal");
    let left = x;
    cells.forEach((lines, index) => {
      pdf.text(lines, position(columns[index], left), y + 4, { align: columns[index].align ?? "left" });
      left += columns[index].width;
    });
    pdf.setDrawColor(215, 222, 235).setLineWidth(0.1).line(x, y + rowHeight, x + total, y + rowHeight);
    y += rowHeight;
  });
  if (!options.rows.length) pdf.text("Aucune ligne.", x + 2, y + 6);
  footer(pdf);
  pdf.save(options.fileName);
}

// Export d'une liste dont la première ligne porte les intitulés : la largeur des
// colonnes suit leur contenu, les colonnes de chiffres s'alignent à droite.
export function listPdf(fileName: string, title: string, subtitle: string, rows: Array<Array<string | number | null | undefined>>) {
  const [head = [], ...body] = rows;
  const text = (value: string | number | null | undefined) => String(value ?? "");
  const weights = head.map((label, index) => Math.min(42, Math.max(7, text(label).length + 1, ...body.map((row) => text(row[index]).length))));
  const sum = weights.reduce((total, weight) => total + weight, 0) || 1;
  const numeric = (index: number) => body.length > 0 && body.every((row) => /^-?[\d\s.,]*%?$/.test(text(row[index]).trim()));
  return tablePdf({
    title,
    subtitle,
    fileName,
    columns: head.map((label, index) => ({ label: text(label), width: (weights[index] / sum) * 267, ...(numeric(index) ? { align: "right" as const } : {}) })),
    rows: body,
  });
}

// ---------- Bulletin de notes ----------

type SubjectResult = { code: string; nom: string; coefficient: number; controle: number | null; examen: number | null; rattrapage: number | null; moyenne: number | null };
type UnitResult = { code: string; nom: string; credits: number; moyenne: number | null; validee: boolean; matieres: SubjectResult[] };
type SemesterLine = { semestre: number; moyenne: number | null; creditsAcquis: number; creditsTotal: number; decision: string };
export type GradeReport = {
  etudiant: { nom: string; prenom: string; matricule?: string | null; dateNaissance?: string | null; lieuNaissance?: string | null };
  inscriptionId: string;
  classe: { nom: string; niveau: string; filiere: string; annee: string };
  semestre: number;
  resultat: { moyenne: number | null; creditsAcquis: number; creditsTotal: number; rang: number | null; mention: string | null; decision: string; detail: { unites?: UnitResult[]; semestres?: SemesterLine[] } };
  classeStats: { effectif: number; moyenneClasse: number | null; plusForte: number | null; plusFaible: number | null };
  absences: { total: number; injustifiees: number };
  deliberation: { president?: string | null; dateCloture?: string | null };
  retenu?: undefined;
};
export type WithheldReport = { inscriptionId: string; etudiant: { nom: string; prenom: string }; retenu: string };

function gradeReportPage(pdf: Pdf, report: GradeReport) {
  const annual = report.semestre === 0;
  header(pdf, annual ? "RELEVÉ ANNUEL" : `BULLETIN DE NOTES · SEMESTRE ${report.semestre}`, `Année académique ${report.classe.annee}`);
  pdf.setFont("helvetica", "bold").setFontSize(12);
  pdf.text(pdfSafe(`${report.etudiant.nom} ${report.etudiant.prenom}`), 15, 38);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Matricule : ${report.etudiant.matricule ?? "-"}`), 15, 44);
  pdf.text(pdfSafe(`Né(e) le ${report.etudiant.dateNaissance ? formatDate(report.etudiant.dateNaissance) : "-"}${report.etudiant.lieuNaissance ? ` à ${report.etudiant.lieuNaissance}` : ""}`), 15, 49);
  pdf.text(pdfSafe(`Filière : ${report.classe.filiere}`), 195, 38, { align: "right" });
  pdf.text(pdfSafe(`Classe : ${report.classe.nom} · ${report.classe.niveau}`), 195, 44, { align: "right" });
  pdf.text(pdfSafe(`Effectif : ${report.classeStats.effectif}`), 195, 49, { align: "right" });

  let y = 56;
  if (annual) {
    y = table(
      pdf,
      y,
      [{ label: "Semestre", width: 50 }, { label: "Moyenne", width: 35, align: "center" }, { label: "Crédits", width: 35, align: "center" }, { label: "Résultat", width: 60 }],
      (report.resultat.detail.semestres ?? []).map((line) => ({ cells: [`Semestre ${line.semestre}`, note(line.moyenne), `${line.creditsAcquis} / ${line.creditsTotal}`, DECISION_LABELS[line.decision] ?? line.decision] })),
    );
  } else {
    const rows: Array<{ cells: string[]; bold?: boolean; fill?: boolean }> = [];
    for (const unit of report.resultat.detail.unites ?? []) {
      rows.push({ cells: [`${unit.code} · ${unit.nom}`, String(unit.credits), "", "", "", note(unit.moyenne), unit.validee ? "Validée" : "Non validée"], bold: true, fill: true });
      for (const subject of unit.matieres) rows.push({ cells: [`   ${subject.nom}`, String(subject.coefficient), note(subject.controle), note(subject.examen), note(subject.rattrapage), note(subject.moyenne), ""] });
    }
    y = table(
      pdf,
      y,
      [{ label: "Unité d'enseignement / matière", width: 68 }, { label: "Créd./Coef.", width: 20, align: "center" }, { label: "Contrôle", width: 18, align: "center" }, { label: "Examen", width: 18, align: "center" }, { label: "Rattr.", width: 16, align: "center" }, { label: "Moyenne", width: 18, align: "center" }, { label: "Résultat", width: 22 }],
      rows,
    );
  }
  y += 8;
  pdf.setFillColor(248, 243, 228).roundedRect(15, y, 180, 30, 2, 2, "F");
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text(pdfSafe(`Moyenne ${annual ? "annuelle" : "du semestre"} : ${note(report.resultat.moyenne)} / 20`), 20, y + 8);
  pdf.text(pdfSafe(DECISION_LABELS[report.resultat.decision] ?? report.resultat.decision), 190, y + 8, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Crédits acquis : ${report.resultat.creditsAcquis} / ${report.resultat.creditsTotal}`), 20, y + 15);
  pdf.text(pdfSafe(`Rang : ${report.resultat.rang ?? "-"} sur ${report.classeStats.effectif}`), 20, y + 21);
  pdf.text(pdfSafe(`Mention : ${report.resultat.mention ?? "-"}`), 20, y + 27);
  pdf.text(pdfSafe(`Moyenne de la classe : ${note(report.classeStats.moyenneClasse)}`), 190, y + 15, { align: "right" });
  pdf.text(pdfSafe(`Plus forte : ${note(report.classeStats.plusForte)} · plus faible : ${note(report.classeStats.plusFaible)}`), 190, y + 21, { align: "right" });
  pdf.text(pdfSafe(`Absences : ${report.absences.total} h, dont ${report.absences.injustifiees} h non justifiées`), 190, y + 27, { align: "right" });
  y += 42;
  pdf.setFontSize(9);
  pdf.text(pdfSafe(`Délibération du ${report.deliberation.dateCloture ? formatDate(report.deliberation.dateCloture) : "-"} · Président du jury : ${report.deliberation.president ?? "-"}`), 15, y);
  pdf.text("Le responsable de la scolarité", 150, y + 14, { align: "center" });
  pdf.setDrawColor(150, 160, 180).line(120, y + 30, 180, y + 30);
  footer(pdf);
}

export async function gradeReportsPdf(reports: GradeReport[], fileName: string) {
  const pdf = await createPdf();
  reports.forEach((report, index) => {
    if (index > 0) pdf.addPage();
    gradeReportPage(pdf, report);
  });
  pdf.save(fileName);
}

// ---------- Relevé de notes annuel, attestation de réussite, diplôme ----------

type TranscriptUnit = UnitResult & { statut: string; mode: string | null; acquise?: string | null };
export type Transcript = {
  etudiant: GradeReport["etudiant"];
  inscriptionId: string;
  classe: GradeReport["classe"];
  semestres: Array<{ semestre: number; moyenne: number | null; creditsAcquis: number; creditsTotal: number; decision: string; unites: TranscriptUnit[] }>;
  resultat: { moyenne: number | null; creditsAcquis: number; creditsTotal: number; rang: number | null; mention: string | null; decision: string };
  effectif: number;
  // Unités encore dues dans la filière, tous niveaux confondus.
  dettes: Array<{ niveau: string; annee: string; code: string; nom: string; credits: number }>;
  finDeCycle: boolean;
  diplome: string | null;
  diplomable: boolean;
  absences: { total: number; injustifiees: number };
  deliberation: { president?: string | null; dateCloture?: string | null };
  retenu?: undefined;
};

export const unitOutcome = (unit: TranscriptUnit) =>
  unit.statut === "DETTE"
    ? "À rattraper"
    : unit.statut !== "ACQUISE"
      ? "Non acquise"
      : unit.mode === "ANTERIEURE"
        ? `Acquise en ${unit.acquise ?? "année antérieure"}`
        : unit.mode === "COMPENSEE"
          ? "Acquise par compensation"
          : unit.mode === "RATTRAPAGE"
            ? "Acquise au rattrapage"
            : "Validée";

const bornLine = (student: Transcript["etudiant"]) =>
  `Né(e) le ${student.dateNaissance ? formatDate(student.dateNaissance) : "-"}${student.lieuNaissance ? ` à ${student.lieuNaissance}` : ""}`;

const longDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "-";

function transcriptPage(pdf: Pdf, data: Transcript) {
  header(pdf, "RELEVÉ DE NOTES ANNUEL", `Année académique ${data.classe.annee}`);
  pdf.setFont("helvetica", "bold").setFontSize(12);
  pdf.text(pdfSafe(`${data.etudiant.nom} ${data.etudiant.prenom}`), 15, 38);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Matricule : ${data.etudiant.matricule ?? "-"}`), 15, 44);
  pdf.text(pdfSafe(bornLine(data.etudiant)), 15, 49);
  pdf.text(pdfSafe(`Filière : ${data.classe.filiere}`), 195, 38, { align: "right" });
  pdf.text(pdfSafe(`Classe : ${data.classe.nom} · ${data.classe.niveau}`), 195, 44, { align: "right" });
  pdf.text(pdfSafe(`Effectif : ${data.effectif}`), 195, 49, { align: "right" });
  const rows: Array<{ cells: string[]; bold?: boolean; fill?: boolean }> = [];
  for (const semester of data.semestres) {
    rows.push({ cells: [`SEMESTRE ${semester.semestre}`, `${semester.creditsAcquis} / ${semester.creditsTotal}`, note(semester.moyenne), DECISION_LABELS[semester.decision] ?? semester.decision], bold: true, fill: true });
    for (const unit of semester.unites) {
      rows.push({ cells: [`${unit.code} · ${unit.nom}`, String(unit.credits), note(unit.moyenne), unitOutcome(unit)], bold: true });
      for (const subject of unit.matieres) rows.push({ cells: [`      ${subject.nom}`, String(subject.coefficient), note(subject.moyenne), ""] });
    }
  }
  let y = table(pdf, 56, [{ label: "Unité d'enseignement / matière", width: 90 }, { label: "Créd./Coef.", width: 24, align: "center" }, { label: "Moyenne", width: 22, align: "center" }, { label: "Résultat", width: 44 }], rows);
  const debts = data.dettes.length ? (pdf.splitTextToSize(pdfSafe(`Crédits restant à rattraper : ${data.dettes.map((debt) => `${debt.code} ${debt.nom} (${debt.credits} cr., ${debt.niveau} ${debt.annee})`).join(" ; ")}`), 170) as string[]) : [];
  const box = 25 + debts.length * 4.5;
  if (y + box + 50 > pdf.internal.pageSize.getHeight()) {
    footer(pdf);
    pdf.addPage();
    y = 14;
  }
  y += 8;
  pdf.setFillColor(248, 243, 228).roundedRect(15, y, 180, box, 2, 2, "F");
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text(pdfSafe(`Moyenne annuelle : ${note(data.resultat.moyenne)} / 20`), 20, y + 8);
  pdf.text(pdfSafe(DECISION_LABELS[data.resultat.decision] ?? data.resultat.decision), 190, y + 8, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Crédits acquis : ${data.resultat.creditsAcquis} / ${data.resultat.creditsTotal}`), 20, y + 15);
  pdf.text(pdfSafe(`Rang : ${data.resultat.rang ?? "-"} sur ${data.effectif} · Mention : ${data.resultat.mention ?? "-"}`), 20, y + 21);
  pdf.text(pdfSafe(`Absences : ${data.absences.total} h, dont ${data.absences.injustifiees} h non justifiées`), 190, y + 15, { align: "right" });
  if (debts.length) pdf.text(debts, 20, y + 27);
  y += box + 10;
  pdf.setFontSize(9);
  pdf.text(pdfSafe(`Délibération du ${data.deliberation.dateCloture ? formatDate(data.deliberation.dateCloture) : "-"} · Président du jury : ${data.deliberation.president ?? "-"}`), 15, y);
  pdf.text("Le responsable de la scolarité", 150, y + 12, { align: "center" });
  pdf.setDrawColor(150, 160, 180).line(120, y + 28, 180, y + 28);
  footer(pdf);
}

export async function transcriptsPdf(list: Transcript[], fileName: string) {
  const pdf = await createPdf();
  list.forEach((data, index) => {
    if (index > 0) pdf.addPage();
    transcriptPage(pdf, data);
  });
  pdf.save(fileName);
}

// ---------- Relevé cumulé : tout le cursus sur un seul document ----------

export type Journey = {
  etudiant: Transcript["etudiant"] & { id: string; telephone?: string | null };
  annees: Array<{
    inscriptionId: string;
    annee: string;
    niveau: string;
    filiere: string;
    statut: string;
    classe: { id: string; nom: string } | null;
    semestres: Transcript["semestres"];
    resultat: (Transcript["resultat"] & { effectif: number }) | null;
    absences: Transcript["absences"];
    // Scolarité impayée : les documents de cette année ne sont pas remis.
    retenue: string | null;
  }>;
  credits: { acquis: number; dettes: Transcript["dettes"] };
};

export async function journeyPdf(data: Journey, fileName: string) {
  const pdf = await createPdf();
  const years = data.annees.filter((year) => year.semestres.length || year.resultat);
  header(pdf, "RELEVÉ DE NOTES CUMULÉ", years.length > 1 ? `Années ${years[0].annee} à ${years[years.length - 1].annee}` : `Année académique ${years[0]?.annee ?? "-"}`);
  pdf.setFont("helvetica", "bold").setFontSize(12);
  pdf.text(pdfSafe(`${data.etudiant.nom} ${data.etudiant.prenom}`), 15, 38);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Matricule : ${data.etudiant.matricule ?? "-"}`), 15, 44);
  pdf.text(pdfSafe(bornLine(data.etudiant)), 15, 49);
  pdf.text(pdfSafe(`Filière : ${years[years.length - 1]?.filiere ?? "-"}`), 195, 38, { align: "right" });
  pdf.text(pdfSafe(`Années délibérées : ${years.length}`), 195, 44, { align: "right" });
  const rows: Array<{ cells: string[]; bold?: boolean; fill?: boolean }> = [];
  for (const year of years) {
    rows.push({
      cells: [
        `${year.annee} · ${year.niveau} · ${year.classe?.nom ?? year.filiere}`,
        year.resultat ? `${year.resultat.creditsAcquis} / ${year.resultat.creditsTotal}` : "",
        year.resultat ? note(year.resultat.moyenne) : "",
        year.resultat ? `${DECISION_LABELS[year.resultat.decision] ?? year.resultat.decision}${year.resultat.mention ? ` · ${year.resultat.mention}` : ""}` : "Année non délibérée",
      ],
      bold: true,
      fill: true,
    });
    for (const semester of year.semestres) {
      rows.push({ cells: [`Semestre ${semester.semestre}`, `${semester.creditsAcquis} / ${semester.creditsTotal}`, note(semester.moyenne), DECISION_LABELS[semester.decision] ?? semester.decision], bold: true });
      for (const unit of semester.unites) {
        rows.push({ cells: [`   ${unit.code} · ${unit.nom}`, String(unit.credits), note(unit.moyenne), unitOutcome(unit)] });
        for (const subject of unit.matieres) rows.push({ cells: [`         ${subject.nom}`, String(subject.coefficient), note(subject.moyenne), ""] });
      }
    }
  }
  let y = table(pdf, 56, [{ label: "Année / unité d'enseignement / matière", width: 90 }, { label: "Créd./Coef.", width: 24, align: "center" }, { label: "Moyenne", width: 22, align: "center" }, { label: "Résultat", width: 44 }], rows);
  const debts = data.credits.dettes.length ? (pdf.splitTextToSize(pdfSafe(`Crédits restant à rattraper : ${data.credits.dettes.map((debt) => `${debt.code} ${debt.nom} (${debt.credits} cr., ${debt.niveau} ${debt.annee})`).join(" ; ")}`), 170) as string[]) : [];
  const box = 19 + debts.length * 4.5;
  if (y + box + 50 > pdf.internal.pageSize.getHeight()) {
    footer(pdf);
    pdf.addPage();
    y = 14;
  }
  y += 8;
  const absences = years.reduce((total, year) => ({ total: total.total + year.absences.total, injustifiees: total.injustifiees + year.absences.injustifiees }), { total: 0, injustifiees: 0 });
  pdf.setFillColor(248, 243, 228).roundedRect(15, y, 180, box, 2, 2, "F");
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text(pdfSafe(`Crédits acquis sur le cursus : ${data.credits.acquis}`), 20, y + 8);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Absences : ${Math.round(absences.total * 10) / 10} h, dont ${Math.round(absences.injustifiees * 10) / 10} h non justifiées`), 20, y + 15);
  if (debts.length) pdf.text(debts, 20, y + 21);
  y += box + 10;
  pdf.setFontSize(9);
  pdf.text(pdfSafe(`Établi le ${longDate(new Date().toISOString())} d'après les délibérations clôturées.`), 15, y);
  pdf.text("Le responsable de la scolarité", 150, y + 12, { align: "center" });
  pdf.setDrawColor(150, 160, 180).line(120, y + 28, 180, y + 28);
  footer(pdf);
  pdf.save(fileName);
}

// ---------- Fiches d'anonymat : 18 par feuille A4 ordinaire ----------

export type AnonymityTable = {
  evaluation: string;
  type: string;
  date?: string | null;
  matiere: string;
  classe: string;
  annee: string;
  lignes: Array<{ code: string; nom: string; prenom: string; matricule?: string | null }>;
};

// Chaque fiche se découpe en deux : le talon nominatif sert à remettre la fiche
// au bon étudiant, la partie codée (sans aucun nom) se colle ou s'agrafe sur la copie.
export async function anonymitySlipsPdf(table: AnonymityTable, fileName: string) {
  const pdf = await createPdf();
  const QRCode = (await import("qrcode")).default;
  const columns = 3;
  const rows = 6;
  // Marge de 6 mm : la plupart des imprimantes n'impriment pas jusqu'au bord de la feuille.
  const margin = 6;
  const width = (210 - 2 * margin) / columns;
  const height = (297 - 2 * margin) / rows;
  const stub = 32;
  const clip = (text: string, max: number) => (pdf.splitTextToSize(pdfSafe(text), max)[0] as string) ?? "";
  const exam = table.date ? `${table.evaluation} · ${formatDate(table.date)}` : table.evaluation;
  for (const [index, line] of table.lignes.entries()) {
    const slot = index % (columns * rows);
    if (index > 0 && slot === 0) pdf.addPage();
    const x = margin + (slot % columns) * width;
    const y = margin + Math.floor(slot / columns) * height;
    // Traits de coupe : le contour de la fiche et la séparation talon / copie.
    pdf.setDrawColor(150, 160, 180).setLineWidth(0.15).setLineDashPattern([1.2, 1.2], 0);
    pdf.rect(x, y, width, height);
    pdf.line(x + stub, y + 3, x + stub, y + height - 3);
    pdf.setLineDashPattern([], 0);

    pdf.setTextColor(110, 120, 135).setFont("helvetica", "normal").setFontSize(5.5);
    pdf.text("TALON - A GARDER", x + 2.5, y + 5);
    pdf.setTextColor(30, 40, 60).setFont("helvetica", "bold").setFontSize(8);
    const name = pdf.splitTextToSize(pdfSafe(`${line.nom} ${line.prenom}`), stub - 5) as string[];
    pdf.text(name.slice(0, 3), x + 2.5, y + 11);
    pdf.setFont("helvetica", "normal").setFontSize(6.5);
    pdf.text(pdfSafe(line.matricule ?? ""), x + 2.5, y + 23);
    pdf.text(clip(table.classe, stub - 5), x + 2.5, y + 28);
    pdf.text(clip(table.matiere, stub - 5), x + 2.5, y + 32);
    pdf.text(clip(table.evaluation, stub - 5), x + 2.5, y + 36);
    pdf.setFont("helvetica", "bold").setFontSize(7.5);
    pdf.text(line.code, x + 2.5, y + 43);

    const copy = x + stub;
    const center = copy + (width - stub) / 2;
    pdf.setTextColor(110, 120, 135).setFont("helvetica", "normal").setFontSize(5.5);
    pdf.text("A COLLER SUR LA COPIE", center, y + 5, { align: "center" });
    // QR code dessiné en vecteur : net à l'impression, et un fichier léger même pour 200 fiches.
    const qr = QRCode.create(line.code, { errorCorrectionLevel: "M" }).modules;
    const cell = 20 / qr.size;
    pdf.setFillColor(0, 0, 0);
    for (let row = 0; row < qr.size; row += 1)
      for (let column = 0; column < qr.size; column += 1)
        if (qr.data[row * qr.size + column]) pdf.rect(center - 10 + column * cell, y + 7 + row * cell, cell + 0.02, cell + 0.02, "F");
    pdf.setTextColor(20, 40, 92).setFont("helvetica", "bold").setFontSize(12);
    pdf.text(line.code, center, y + 33.5, { align: "center" });
    pdf.setTextColor(60, 70, 90).setFont("helvetica", "normal").setFontSize(6);
    pdf.text(clip(table.matiere, width - stub - 4), center, y + 38.5, { align: "center" });
    pdf.text(clip(`${table.classe} · ${exam}`, width - stub - 4), center, y + 42, { align: "center" });
    pdf.setTextColor(30, 40, 60);
  }
  pdf.save(fileName);
}

// ---------- Emploi du temps hebdomadaire ----------

export type TimetableSlot = { jour: number; heureDebut: string; heureFin: string; lignes: string[] };

// Grille de la semaine, en paysage : une colonne par jour, une ligne par plage horaire.
export async function timetablePdf(options: { title: string; subtitle: string; slots: TimetableSlot[]; fileName: string }) {
  const pdf = await createPdf(true);
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const left = 15;
  const hourWidth = 27;
  const dayWidth = (267 - hourWidth) / days.length;
  const lineHeight = 4.2;
  header(pdf, options.title, options.subtitle);
  let y = 36;
  const head = () => {
    pdf.setFillColor(20, 40, 92).rect(left, y, 267, 8, "F");
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
    pdf.text("Horaire", left + 2, y + 5.4);
    days.forEach((day, index) => pdf.text(day, left + hourWidth + index * dayWidth + dayWidth / 2, y + 5.4, { align: "center" }));
    pdf.setTextColor(30, 40, 60);
    y += 8;
  };
  head();
  const ranges = [...new Set(options.slots.map((slot) => `${slot.heureDebut}-${slot.heureFin}`))].sort();
  for (const range of ranges) {
    const [start, end] = range.split("-");
    // Texte de chaque jour pour cette plage ; deux cours simultanés se suivent dans la case.
    const cells = days.map((_, index) =>
      options.slots
        .filter((slot) => slot.jour === index + 1 && slot.heureDebut === start && slot.heureFin === end)
        .flatMap((slot, position) => [...(position ? [""] : []), ...slot.lignes.flatMap((line, row) => (pdf.setFont("helvetica", row ? "normal" : "bold").setFontSize(8), pdf.splitTextToSize(pdfSafe(line), dayWidth - 4) as string[]).map((text) => ({ text, bold: !row })))]),
    ) as Array<Array<{ text: string; bold: boolean } | "">>;
    const height = Math.max(12, Math.max(...cells.map((cell) => cell.length)) * lineHeight + 5);
    if (y + height > pdf.internal.pageSize.getHeight() - 14) {
      footer(pdf);
      pdf.addPage();
      y = 18;
      head();
    }
    pdf.setDrawColor(200, 210, 228).setLineWidth(0.2);
    pdf.setFillColor(232, 238, 248).rect(left, y, hourWidth, height, "FD");
    pdf.setFont("helvetica", "bold").setFontSize(9);
    pdf.text(`${start} - ${end}`, left + hourWidth / 2, y + height / 2 + 1.2, { align: "center" });
    cells.forEach((cell, index) => {
      const x = left + hourWidth + index * dayWidth;
      pdf.rect(x, y, dayWidth, height);
      cell.forEach((line, row) => {
        if (!line) return;
        pdf.setFont("helvetica", line.bold ? "bold" : "normal").setFontSize(8);
        pdf.text(line.text, x + 2, y + 5 + row * lineHeight);
      });
    });
    y += height;
  }
  if (!ranges.length) {
    pdf.setFont("helvetica", "normal").setFontSize(10);
    pdf.text("Aucun cours n'est encore place dans l'emploi du temps.", left, y + 10);
  }
  footer(pdf);
  pdf.save(options.fileName);
}

// ---------- Liste de classe et feuille d'émargement ----------

// Liste nominative en portrait, avec des lignes assez hautes pour signer.
export async function rosterPdf(options: { title: string; subtitle: string; infos?: string[]; columns: PdfColumn[]; rows: Array<Array<string | number | null | undefined>>; rowHeight?: number; note?: string; fileName: string }) {
  const pdf = await createPdf();
  const rowHeight = options.rowHeight ?? 7;
  const total = options.columns.reduce((sum, column) => sum + column.width, 0);
  const left = (210 - total) / 2;
  header(pdf, options.title, options.subtitle);
  let y = 35;
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  for (const info of options.infos ?? []) {
    pdf.text(pdfSafe(info), left, y);
    y += 5;
  }
  y += 2;
  const head = () => {
    pdf.setFillColor(20, 40, 92).rect(left, y, total, 7.5, "F");
    pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(255, 255, 255);
    let x = left;
    for (const column of options.columns) {
      pdf.text(pdfSafe(column.label), column.align === "center" ? x + column.width / 2 : x + 2, y + 5, { align: column.align === "center" ? "center" : "left" });
      x += column.width;
    }
    pdf.setTextColor(30, 40, 60);
    y += 7.5;
  };
  head();
  for (const row of options.rows) {
    if (y + rowHeight > pdf.internal.pageSize.getHeight() - 16) {
      footer(pdf);
      pdf.addPage();
      y = 18;
      head();
    }
    pdf.setDrawColor(190, 200, 220).setLineWidth(0.2);
    let x = left;
    options.columns.forEach((column, index) => {
      pdf.rect(x, y, column.width, rowHeight);
      const value = row[index];
      if (value !== null && value !== undefined && value !== "") {
        pdf.setFont("helvetica", "normal").setFontSize(9);
        const text = (pdf.splitTextToSize(pdfSafe(String(value)), column.width - 3)[0] as string) ?? "";
        pdf.text(text, column.align === "center" ? x + column.width / 2 : x + 2, y + rowHeight / 2 + 1.3, { align: column.align === "center" ? "center" : "left" });
      }
      x += column.width;
    });
    y += rowHeight;
  }
  if (options.note) {
    pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90, 100, 120);
    pdf.text(pdf.splitTextToSize(pdfSafe(options.note), total) as string[], left, Math.min(y + 8, pdf.internal.pageSize.getHeight() - 20));
    pdf.setTextColor(30, 40, 60);
  }
  footer(pdf);
  pdf.save(options.fileName);
}

// ---------- Certificat de scolarité ----------

export type EnrollmentCertificate = {
  etudiant: { nom: string; prenom: string; matricule?: string | null; dateNaissance?: string | null; lieuNaissance?: string | null };
  annee: string;
  niveau: string;
  filiere: string;
  classe: string;
};

export const enrollmentCertificateNumber = (data: EnrollmentCertificate) => `CS-${data.annee.slice(2, 4)}${data.annee.slice(7)}-${data.etudiant.matricule ?? "SANS-MATRICULE"}`;

// Logo de l'établissement pour les documents ; absent hors navigateur ou sans réseau.
async function logoData(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const blob = await (await fetch("/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg")).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Atteste qu'un étudiant est inscrit et affecté à une classe pour l'année en cours.
// Mise en page administrative, volontairement différente des certificats de
// bourse et d'inscription : bandeau vertical, texte en caractères à empattements,
// lignes de formation et QR code de référence.
export async function enrollmentCertificatePdf(data: EnrollmentCertificate, fileName: string) {
  const pdf = await createPdf();
  const [logo, QRCode] = await Promise.all([logoData(), import("qrcode").then((module) => module.default)]);
  const number = enrollmentCertificateNumber(data);
  const band = 40;
  const left = band + 14;
  const right = 194;
  const width = right - left;

  // Bandeau vertical : logo, intitulé couché, année.
  pdf.setFillColor(20, 40, 92).rect(0, 0, band, 297, "F");
  pdf.setFillColor(200, 148, 27).rect(band, 0, 1.4, 297, "F");
  pdf.setFillColor(255, 255, 255).roundedRect(7, 12, 26, 26, 2, 2, "F");
  if (logo) pdf.addImage(logo, "JPEG", 8.5, 13.5, 23, 23);
  else {
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 92);
    pdf.text("IPAIM", 20, 26.5, { align: "center" });
  }
  pdf.setFont("times", "bold").setFontSize(30).setTextColor(255, 255, 255);
  pdf.text("CERTIFICAT DE SCOLARITÉ", 25, 250, { angle: 90 });
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(228, 177, 59);
  pdf.text(pdfSafe(`ANNÉE ACADÉMIQUE ${data.annee}`), 32, 250, { angle: 90 });
  pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(222, 232, 247);
  pdf.text("IPAIM UNIVERSITY", 20, 284, { align: "center" });

  // En-tête de la page.
  pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 40, 92);
  pdf.text("IPAIM UNIVERSITY", left, 22);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(102, 114, 140);
  pdf.text("Direction des études · Service de la scolarité", left, 28);
  pdf.text(pdfSafe(`N° ${number}`), right, 22, { align: "right" });
  pdf.setDrawColor(215, 222, 235).setLineWidth(0.3).line(left, 34, right, 34);

  pdf.setFont("times", "bold").setFontSize(27).setTextColor(20, 40, 92);
  pdf.text("Certificat de scolarité", left, 58);
  pdf.setFillColor(200, 148, 27).rect(left, 62.5, 34, 1.2, "F");
  pdf.setFont("times", "italic").setFontSize(13).setTextColor(102, 114, 140);
  pdf.text(pdfSafe(`Année académique ${data.annee}`), left, 72);

  // Corps du certificat.
  const paragraph = (text: string, y: number, size = 12.5) => {
    pdf.setFont("times", "normal").setFontSize(size).setTextColor(40, 48, 66);
    const lines = pdf.splitTextToSize(pdfSafe(text), width) as string[];
    pdf.text(lines, left, y, { lineHeightFactor: 1.5 });
    return y + lines.length * size * 0.3528 * 1.5;
  };
  let y = paragraph("La direction des études de l'IPAIM University, soussignée, certifie que l'étudiant(e)", 92) + 9;
  pdf.setFont("times", "bold").setFontSize(21).setTextColor(20, 40, 92);
  const name = pdf.splitTextToSize(pdfSafe(`${data.etudiant.nom.toUpperCase()} ${data.etudiant.prenom}`), width) as string[];
  pdf.text(name, left, y);
  y += name.length * 9 + 3;
  y = paragraph(`${bornLine(data.etudiant).replace("Né(e)", "né(e)")}, immatriculé(e) sous le numéro ${data.etudiant.matricule ?? "-"},`, y) + 3;
  y = paragraph(`est régulièrement inscrit(e) dans notre établissement et y poursuit ses études au titre de l'année académique ${data.annee}, dans la formation suivante :`, y) + 5;

  // Formation : une ligne par information, l'intitulé à gauche, la valeur à droite.
  for (const [label, value] of [["Filière", data.filiere], ["Niveau d'études", data.niveau], ["Classe", data.classe], ["Année académique", data.annee]]) {
    pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(102, 114, 140);
    pdf.text(pdfSafe(label.toUpperCase()), left, y + 5);
    pdf.setFont("times", "bold").setFontSize(13).setTextColor(20, 40, 92);
    pdf.text((pdf.splitTextToSize(pdfSafe(value), width - 48)[0] as string) ?? "", right, y + 5.3, { align: "right" });
    pdf.setDrawColor(215, 222, 235).setLineWidth(0.25).line(left, y + 8.5, right, y + 8.5);
    y += 11.5;
  }
  y = paragraph("Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.", y + 10);

  // Référence vérifiable à gauche, signature à droite.
  const base = 232;
  const qr = QRCode.create(number, { errorCorrectionLevel: "M" }).modules;
  const cell = 22 / qr.size;
  pdf.setFillColor(20, 40, 92);
  for (let row = 0; row < qr.size; row += 1)
    for (let column = 0; column < qr.size; column += 1)
      if (qr.data[row * qr.size + column]) pdf.rect(left + column * cell, base + row * cell, cell + 0.02, cell + 0.02, "F");
  pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(102, 114, 140);
  pdf.text(pdfSafe(`Référence ${number}`), left, base + 27);
  pdf.text("Edition consignée dans le registre des impressions.", left, base + 31);

  pdf.setFont("times", "normal").setFontSize(12).setTextColor(40, 48, 66);
  pdf.text(pdfSafe(`Fait le ${longDate(new Date().toISOString())}`), right, base + 2, { align: "right" });
  pdf.setFont("times", "bold").setFontSize(12).setTextColor(20, 40, 92);
  pdf.text("La direction des études", right, base + 9, { align: "right" });
  pdf.setDrawColor(150, 160, 180).setLineWidth(0.3).line(right - 62, base + 31, right, base + 31);
  pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(102, 114, 140);
  pdf.text("Nom, signature et cachet", right, base + 35, { align: "right" });

  pdf.setDrawColor(215, 222, 235).setLineWidth(0.3).line(left, 279, right, 279);
  pdf.setFontSize(7.5);
  pdf.text("Ce certificat n'est valable que pour l'année académique indiquée.", left, 284);
  pdf.text(pdfSafe(generatedByLine()), left, 288.5);
  pdf.setTextColor(30, 40, 60);
  pdf.save(fileName);
}

// Paragraphe centré, renvoyé à la ligne ; retourne la position sous le texte.
function centered(pdf: Pdf, text: string, y: number, width: number, lineHeight: number) {
  const center = pdf.internal.pageSize.getWidth() / 2;
  const lines = pdf.splitTextToSize(pdfSafe(text), width) as string[];
  pdf.text(lines, center, y, { align: "center" });
  return y + lines.length * lineHeight;
}

export const diplomaTitle = (data: Transcript) => data.diplome ?? `Diplôme de fin d'études · ${data.classe.niveau}`;
export const documentNumber = (data: Transcript) => `${data.classe.annee.slice(5)}-${data.etudiant.matricule ?? data.inscriptionId.slice(0, 8).toUpperCase()}`;

// Attestation de réussite : délivrée à l'étudiant admis, en attendant ou à défaut de diplôme.
export async function attestationsPdf(list: Transcript[], fileName: string) {
  const pdf = await createPdf();
  list.forEach((data, index) => {
    if (index > 0) pdf.addPage();
    header(pdf, "ATTESTATION DE RÉUSSITE", `N° ATT-${documentNumber(data)}`);
    pdf.setFont("helvetica", "bold").setFontSize(20).setTextColor(20, 40, 92);
    pdf.text("ATTESTATION DE RÉUSSITE", 105, 62, { align: "center" });
    pdf.setFont("helvetica", "normal").setFontSize(12).setTextColor(30, 40, 60);
    let y = centered(pdf, "La direction des études de l'IPAIM UNIVERSITY atteste que", 82, 160, 6.5) + 8;
    pdf.setFont("helvetica", "bold").setFontSize(17);
    y = centered(pdf, `${data.etudiant.nom.toUpperCase()} ${data.etudiant.prenom}`, y, 170, 8) + 2;
    pdf.setFont("helvetica", "normal").setFontSize(11);
    y = centered(pdf, `${bornLine(data.etudiant)} · Matricule ${data.etudiant.matricule ?? "-"}`, y, 170, 6) + 8;
    pdf.setFontSize(12);
    y = centered(pdf, `a été déclaré(e) admis(e) en ${data.classe.niveau}, filière ${data.classe.filiere}, au titre de l'année académique ${data.classe.annee}, par le jury réuni le ${longDate(data.deliberation.dateCloture)} sous la présidence de ${data.deliberation.president ?? "-"}.`, y, 160, 6.5) + 6;
    if (data.diplomable) y = centered(pdf, `Il (elle) a ainsi satisfait à toutes les conditions d'obtention du diplôme : ${diplomaTitle(data)}.`, y, 160, 6.5) + 6;
    pdf.setFillColor(248, 243, 228).roundedRect(40, y, 130, 24, 2, 2, "F");
    pdf.setFont("helvetica", "bold").setFontSize(12);
    pdf.text(pdfSafe(`Moyenne annuelle : ${note(data.resultat.moyenne)} / 20`), 105, y + 9, { align: "center" });
    pdf.setFont("helvetica", "normal").setFontSize(11);
    pdf.text(pdfSafe(`Mention : ${data.resultat.mention ?? "-"} · Crédits : ${data.resultat.creditsAcquis} / ${data.resultat.creditsTotal}`), 105, y + 17, { align: "center" });
    y += 38;
    y = centered(pdf, "En foi de quoi la présente attestation lui est délivrée pour servir et valoir ce que de droit.", y, 160, 6.5) + 16;
    pdf.setFontSize(10.5);
    pdf.text(pdfSafe(`Délivrée le ${longDate(new Date().toISOString())}`), 150, y, { align: "center" });
    pdf.text("La direction des études", 150, y + 8, { align: "center" });
    pdf.setDrawColor(150, 160, 180).line(120, y + 30, 180, y + 30);
    pdf.setFontSize(8).setTextColor(110, 120, 135);
    pdf.text("Il n'est délivré qu'un seul exemplaire de cette attestation : au titulaire d'en établir des copies certifiées.", 105, 268, { align: "center" });
    pdf.setTextColor(30, 40, 60);
    footer(pdf);
  });
  pdf.save(fileName);
}

// Diplôme au format paysage, à imprimer sur papier fort et à signer.
export async function diplomasPdf(list: Transcript[], fileName: string) {
  const pdf = await createPdf(true);
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  list.forEach((data, index) => {
    if (index > 0) pdf.addPage();
    pdf.setDrawColor(20, 40, 92).setLineWidth(1.4).rect(9, 9, width - 18, height - 18, "S");
    pdf.setDrawColor(200, 148, 27).setLineWidth(0.5).rect(12.5, 12.5, width - 25, height - 25, "S");
    pdf.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 40, 92);
    pdf.text("IPAIM UNIVERSITY", width / 2, 33, { align: "center" });
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(90, 100, 120);
    pdf.text(pdfSafe(`Année académique ${data.classe.annee}`), width / 2, 40, { align: "center" });
    pdf.setFont("times", "bold").setFontSize(34).setTextColor(200, 148, 27);
    pdf.text("DIPLÔME", width / 2, 60, { align: "center" });
    pdf.setFont("times", "bold").setFontSize(20).setTextColor(20, 40, 92);
    let y = centered(pdf, diplomaTitle(data), 73, 240, 9);
    pdf.setFont("times", "italic").setFontSize(13).setTextColor(30, 40, 60);
    y = centered(pdf, `Vu le procès-verbal de la délibération du jury réuni le ${longDate(data.deliberation.dateCloture)}, sous la présidence de ${data.deliberation.president ?? "-"},`, y + 3, 230, 6.5);
    y = centered(pdf, `le présent diplôme, filière ${data.classe.filiere}, est décerné à`, y + 1, 230, 6.5) + 9;
    pdf.setFont("times", "bold").setFontSize(26).setTextColor(20, 40, 92);
    y = centered(pdf, `${data.etudiant.nom.toUpperCase()} ${data.etudiant.prenom}`, y, 240, 11) + 1;
    pdf.setFont("times", "normal").setFontSize(13).setTextColor(30, 40, 60);
    y = centered(pdf, `${bornLine(data.etudiant)} · Matricule ${data.etudiant.matricule ?? "-"}`, y, 230, 6.5) + 3;
    pdf.setFont("times", "bold").setFontSize(14);
    centered(pdf, `Mention : ${data.resultat.mention ?? "-"}`, y, 230, 7);
    pdf.setFont("helvetica", "normal").setFontSize(10);
    const base = height - 42;
    pdf.text("Le titulaire", 55, base, { align: "center" });
    pdf.text("Le président du jury", width / 2, base, { align: "center" });
    pdf.text("Le directeur général", width - 55, base, { align: "center" });
    pdf.setDrawColor(150, 160, 180).setLineWidth(0.2);
    for (const x of [55, width / 2, width - 55]) pdf.line(x - 28, base + 17, x + 28, base + 17);
    pdf.setFontSize(8.5).setTextColor(110, 120, 135);
    pdf.text(pdfSafe(`Diplôme n° ${documentNumber(data)} · délivré le ${longDate(new Date().toISOString())}`), width / 2, height - 16, { align: "center" });
    pdf.setTextColor(30, 40, 60);
  });
  pdf.save(fileName);
}

// ---------- Procès-verbal de délibération ----------

export type MinutesData = {
  classe: { nom: string; niveau: string; filiere: string; annee: string };
  semestre: number;
  deliberation: { president?: string | null; membres?: string | null; observations?: string | null; dateCloture?: string | null } | null;
  resultats: Array<{ rang: number | null; personne: { nom: string; prenom: string; matricule?: string | null }; moyenne: number | null; creditsAcquis: number; creditsTotal: number; mention: string | null; decision: string }>;
  synthese: { effectif: number; reussis: number; taux: number | null; moyenneClasse: number | null };
};

export async function deliberationMinutesPdf(data: MinutesData) {
  const pdf = await createPdf();
  header(pdf, "PROCÈS-VERBAL DE DÉLIBÉRATION", `${data.semestre === 0 ? "Résultats annuels" : `Semestre ${data.semestre}`} · ${data.classe.annee}`);
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text(pdfSafe(`${data.classe.filiere} · ${data.classe.nom} (${data.classe.niveau})`), 15, 38);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text(pdfSafe(`Jury réuni le ${data.deliberation?.dateCloture ? formatDate(data.deliberation.dateCloture) : "-"} sous la présidence de ${data.deliberation?.president ?? "-"}`), 15, 44);
  const members = pdf.splitTextToSize(pdfSafe(`Membres : ${data.deliberation?.membres ?? "-"}`), 180) as string[];
  pdf.text(members, 15, 49);
  let y = 49 + members.length * 4.5 + 3;
  y = table(
    pdf,
    y,
    [{ label: "Rang", width: 12, align: "center" }, { label: "Matricule", width: 28 }, { label: "Nom et prénom", width: 58 }, { label: "Moyenne", width: 18, align: "center" }, { label: "Crédits", width: 18, align: "center" }, { label: "Mention", width: 20 }, { label: "Décision", width: 26 }],
    data.resultats.map((result) => ({
      cells: [String(result.rang ?? "-"), result.personne.matricule ?? "-", `${result.personne.nom} ${result.personne.prenom}`, note(result.moyenne), `${result.creditsAcquis}/${result.creditsTotal}`, result.mention ?? "-", DECISION_LABELS[result.decision] ?? result.decision],
    })),
  );
  y += 8;
  if (y > 250) {
    footer(pdf);
    pdf.addPage();
    y = 20;
  }
  pdf.setFont("helvetica", "bold").setFontSize(10);
  pdf.text(pdfSafe(`Effectif : ${data.synthese.effectif} · Reçus : ${data.synthese.reussis} (${data.synthese.taux ?? "-"} %) · Moyenne de la classe : ${note(data.synthese.moyenneClasse)}`), 15, y);
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  if (data.deliberation?.observations) {
    const remarks = pdf.splitTextToSize(pdfSafe(`Observations : ${data.deliberation.observations}`), 180) as string[];
    pdf.text(remarks, 15, y + 7);
    y += remarks.length * 4.5 + 4;
  }
  pdf.text("Le président du jury", 50, y + 18, { align: "center" });
  pdf.text("Les membres du jury", 150, y + 18, { align: "center" });
  pdf.setDrawColor(150, 160, 180).line(20, y + 36, 80, y + 36).line(120, y + 36, 180, y + 36);
  footer(pdf);
  pdf.save(`pv-deliberation-${data.classe.nom.replace(/\s+/g, "-")}-${data.semestre === 0 ? "annuel" : `s${data.semestre}`}.pdf`);
}

// ---------- Bulletin de paie ----------

export type Payslip = {
  numero: string;
  categorie: string;
  fonction: string;
  salaireBase: string;
  brut: string;
  totalRetenues: string;
  net: string;
  chargesPatronales: string;
  lignes: Array<{ code: string; libelle: string; type: string; base: number | null; taux: number | null; montant: number }>;
  employe: { matricule: string; nom: string; prenom: string; numeroCnss?: string | null; modePaiement?: string | null; dateEmbauche?: string | null };
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (annee: number, mois: number) => `${MONTHS[mois - 1]} ${annee}`;

export async function payslipsPdf(slips: Payslip[], period: { annee: number; mois: number; datePaiement?: string | null }, fileName: string) {
  const pdf = await createPdf();
  slips.forEach((slip, index) => {
    if (index > 0) pdf.addPage();
    header(pdf, "BULLETIN DE PAIE", `${monthLabel(period.annee, period.mois)} · ${slip.numero}`);
    pdf.setFont("helvetica", "bold").setFontSize(12);
    pdf.text(pdfSafe(`${slip.employe.nom} ${slip.employe.prenom}`), 15, 38);
    pdf.setFont("helvetica", "normal").setFontSize(9.5);
    pdf.text(pdfSafe(`Matricule : ${slip.employe.matricule}`), 15, 44);
    pdf.text(pdfSafe(`Fonction : ${slip.fonction}`), 15, 49);
    pdf.text(pdfSafe(`N° CNSS : ${slip.employe.numeroCnss ?? "-"}`), 195, 38, { align: "right" });
    pdf.text(pdfSafe(`Date d'embauche : ${slip.employe.dateEmbauche ? formatDate(slip.employe.dateEmbauche) : "-"}`), 195, 44, { align: "right" });
    pdf.text(pdfSafe(`Versement : ${period.datePaiement ? formatDate(period.datePaiement) : "à venir"}`), 195, 49, { align: "right" });
    const section = (type: string) => slip.lignes.filter((line) => line.type === type);
    const rows = (type: string) =>
      section(type).map((line) => ({
        cells: [line.libelle, line.base === null ? "" : Number(line.base).toLocaleString("fr-FR"), line.taux === null ? "" : `${Number(line.taux).toLocaleString("fr-FR")}${line.code === "VACATION" || line.code === "ABSENCE" ? " F" : " %"}`, formatMoney(line.montant)],
      }));
    const columns = [{ label: "Rubrique", width: 90 }, { label: "Base", width: 30, align: "right" as const }, { label: "Taux", width: 25, align: "right" as const }, { label: "Montant", width: 35, align: "right" as const }];
    let y = table(pdf, 57, columns, [...rows("GAIN"), { cells: ["Salaire brut", "", "", formatMoney(slip.brut)], bold: true, fill: true }, ...rows("RETENUE"), { cells: ["Total des retenues", "", "", formatMoney(slip.totalRetenues)], bold: true, fill: true }]);
    y += 6;
    pdf.setFillColor(248, 243, 228).roundedRect(15, y, 180, 13, 2, 2, "F");
    pdf.setFont("helvetica", "bold").setFontSize(12);
    pdf.text("NET À PAYER", 20, y + 8.5);
    pdf.text(pdfSafe(formatMoney(slip.net)), 190, y + 8.5, { align: "right" });
    y += 20;
    if (section("PATRONALE").length) {
      pdf.setFont("helvetica", "bold").setFontSize(9);
      pdf.text("Charges patronales (à la charge de l'établissement)", 15, y);
      y = table(pdf, y + 3, columns, [...rows("PATRONALE"), { cells: ["Total des charges patronales", "", "", formatMoney(slip.chargesPatronales)], bold: true, fill: true }]);
      y += 8;
    }
    pdf.setFont("helvetica", "normal").setFontSize(9);
    pdf.text("L'employeur", 50, y + 10, { align: "center" });
    pdf.text("Le salarié (reçu pour acquit)", 150, y + 10, { align: "center" });
    pdf.setDrawColor(150, 160, 180).line(20, y + 28, 80, y + 28).line(120, y + 28, 180, y + 28);
    footer(pdf);
  });
  pdf.save(fileName);
}

// ---------- Carte d'étudiant ----------

export type StudentCard = {
  carteId: string;
  /** Contenu du QR code : jeton propre à la carte, reconnu seulement par le contrôle IPAIM. */
  jeton: string;
  nom: string;
  prenom: string;
  matricule: string;
  filiere: string;
  niveau: string;
  annee: string;
  valableJusquau: string;
  /** Photo d'identité recadrée (JPEG en data URL), ou rien. */
  photo?: string | null;
};

export const CARD_CONTACT = "06 400 04 71";
const CARD_RULES = [
  "Cette carte est strictement personnelle. Présentez-la à l'entrée de l'établissement et à toute demande du personnel.",
  "Elle est exigée pour accéder aux salles d'examen, à la bibliothèque et aux services de la scolarité.",
  "Elle n'est valable que pour l'année académique indiquée au recto.",
  "En cas de perte ou de vol, prévenez sans délai la scolarité : la carte est désactivée puis remplacée.",
  "Tout prêt, toute falsification ou utilisation frauduleuse expose à des sanctions disciplinaires.",
];

const NAVY: [number, number, number] = [20, 40, 92];
const GOLD: [number, number, number] = [200, 148, 27];
const CARD_W = 85.6;
const CARD_H = 54;

// Bandeau aux coins supérieurs (ou inférieurs) arrondis, comme la carte.
function cardBand(pdf: Pdf, x: number, y: number, height: number, top: boolean) {
  pdf.setFillColor(...NAVY).roundedRect(x, y, CARD_W, height, 3, 3, "F");
  pdf.rect(x, top ? y + height / 2 : y, CARD_W, height / 2, "F");
}

function cardRecto(pdf: Pdf, card: StudentCard, x: number, y: number, logo: string | null, qrModules: { size: number; data: Uint8Array | boolean[] }) {
  // Un texte trop long pour sa place se termine par « … » plutôt que d'être coupé net.
  const clip = (text: string, max: number) => {
    const safe = pdfSafe(text);
    if (pdf.getTextWidth(safe) <= max) return safe;
    let cut = safe;
    while (cut.length > 1 && pdf.getTextWidth(`${cut}…`) > max) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  };
  // En-tête : logo, établissement, intitulé de la carte et année.
  cardBand(pdf, x, y, 14, true);
  pdf.setFillColor(255, 255, 255).roundedRect(x + 3.5, y + 2, 10, 10, 1.6, 1.6, "F");
  if (logo) pdf.addImage(logo, "JPEG", x + 4, y + 2.5, 9, 9);
  pdf.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(255, 255, 255);
  pdf.text("IPAIM UNIVERSITY", x + 16, y + 6.6);
  pdf.setFont("helvetica", "normal").setFontSize(4.3).setTextColor(196, 206, 228);
  pdf.text(clip("Institut Polytechnique Africain d'Innovation et de Management", 44), x + 16, y + 9.9);
  pdf.setFont("helvetica", "bold").setFontSize(5.2).setTextColor(...GOLD);
  pdf.text(pdfSafe("CARTE D'ÉTUDIANT"), x + CARD_W - 3.5, y + 6.2, { align: "right" });
  pdf.setFontSize(7.2).setTextColor(255, 255, 255);
  pdf.text(pdfSafe(card.annee), x + CARD_W - 3.5, y + 10, { align: "right" });
  pdf.setFillColor(...GOLD).rect(x, y + 14, CARD_W, 0.7, "F");

  // Photo d'identité.
  const photoX = x + 4;
  const photoY = y + 18;
  if (card.photo) pdf.addImage(card.photo, "JPEG", photoX, photoY, 19, 23.75);
  else {
    pdf.setFillColor(232, 238, 248).rect(photoX, photoY, 19, 23.75, "F");
    pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(150, 162, 190);
    pdf.text(pdfSafe(`${card.prenom.slice(0, 1)}${card.nom.slice(0, 1)}`.toUpperCase()), photoX + 9.5, photoY + 14, { align: "center" });
  }
  pdf.setDrawColor(...NAVY).setLineWidth(0.25).rect(photoX, photoY, 19, 23.75, "S");

  // Identité et scolarité.
  const textX = x + 26.5;
  const textWidth = 33;
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...NAVY);
  pdf.text(clip(card.nom.toUpperCase(), textWidth), textX, y + 21.6);
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(55, 65, 85);
  pdf.text(clip(card.prenom, textWidth), textX, y + 25.6);
  const field = (label: string, value: string, top: number, size = 6.8, color: [number, number, number] = [30, 40, 60]) => {
    pdf.setFont("helvetica", "normal").setFontSize(4.2).setTextColor(125, 135, 155);
    pdf.text(pdfSafe(label.toUpperCase()), textX, top);
    pdf.setFont("helvetica", "bold").setFontSize(size).setTextColor(...color);
    pdf.text(clip(value, textWidth), textX, top + 2.9);
  };
  field("Matricule", card.matricule, y + 30.2, 8.4, NAVY);
  field("Filière", card.filiere, y + 36.4);
  field("Niveau", card.niveau, y + 42.3);

  // QR code de contrôle, dessiné en vecteur pour rester net à l'impression.
  const qrSize = 18;
  const qrX = x + CARD_W - qrSize - 3.5;
  const qrY = y + 19;
  const cell = qrSize / qrModules.size;
  pdf.setFillColor(0, 0, 0);
  for (let row = 0; row < qrModules.size; row += 1)
    for (let column = 0; column < qrModules.size; column += 1)
      if (qrModules.data[row * qrModules.size + column]) pdf.rect(qrX + column * cell, qrY + row * cell, cell + 0.02, cell + 0.02, "F");
  pdf.setFont("helvetica", "normal").setFontSize(4).setTextColor(125, 135, 155);
  pdf.text(pdfSafe("Contrôle IPAIM"), qrX + qrSize / 2, qrY + qrSize + 2.6, { align: "center" });

  // Pied : validité.
  cardBand(pdf, x, y + CARD_H - 5, 5, false);
  pdf.setFont("helvetica", "normal").setFontSize(4.6).setTextColor(196, 206, 228);
  pdf.text("Carte strictement personnelle", x + 4, y + CARD_H - 1.9);
  pdf.setFont("helvetica", "bold").setTextColor(255, 255, 255);
  pdf.text(pdfSafe(`Valable jusqu'au ${formatDate(card.valableJusquau)}`), x + CARD_W - 3.5, y + CARD_H - 1.9, { align: "right" });
}

function cardVerso(pdf: Pdf, card: StudentCard, x: number, y: number) {
  cardBand(pdf, x, y, 8.5, true);
  pdf.setFont("helvetica", "bold").setFontSize(6.6).setTextColor(255, 255, 255);
  pdf.text(pdfSafe("CONSIGNES D'UTILISATION"), x + 4, y + 5.5);
  pdf.setFontSize(5.4).setTextColor(...GOLD);
  pdf.text("IPAIM UNIVERSITY", x + CARD_W - 3.5, y + 5.5, { align: "right" });
  pdf.setFillColor(...GOLD).rect(x, y + 8.5, CARD_W, 0.5, "F");

  let top = y + 12.6;
  CARD_RULES.forEach((rule, index) => {
    pdf.setFillColor(...NAVY).circle(x + 5.4, top - 0.75, 1.15, "F");
    pdf.setFont("helvetica", "bold").setFontSize(4.6).setTextColor(255, 255, 255);
    pdf.text(String(index + 1), x + 5.4, top - 0.1, { align: "center" });
    pdf.setFont("helvetica", "normal").setFontSize(5.1).setTextColor(45, 55, 75);
    const lines = pdf.splitTextToSize(pdfSafe(rule), CARD_W - 13) as string[];
    pdf.text(lines, x + 8.2, top);
    top += lines.length * 2.15 + 1.25;
  });

  // Contact de la scolarité.
  const contactY = y + CARD_H - 11.5;
  pdf.setDrawColor(215, 222, 235).setLineWidth(0.2).line(x + 4, contactY - 2.2, x + CARD_W - 4, contactY - 2.2);
  pdf.setFont("helvetica", "normal").setFontSize(4.3).setTextColor(125, 135, 155);
  pdf.text("CONTACT", x + 4, contactY);
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
  pdf.text(pdfSafe(`Tél. ${CARD_CONTACT}`), x + 4, contactY + 3.4);
  pdf.setFont("helvetica", "normal").setFontSize(4.6).setTextColor(85, 95, 115);
  pdf.text(pdf.splitTextToSize(pdfSafe("Carte trouvée ? Merci de la rapporter à l'IPAIM ou d'appeler ce numéro."), 40) as string[], x + CARD_W - 3.5 - 40, contactY + 0.4);
  pdf.setFillColor(...GOLD).rect(x, y + CARD_H - 3.4, CARD_W, 0.5, "F");
  pdf.setFont("helvetica", "normal").setFontSize(3.8).setTextColor(150, 158, 175);
  pdf.text(pdfSafe(`Carte n° ${card.carteId.slice(0, 8).toUpperCase()}`), x + CARD_W - 3.5, y + CARD_H - 0.9, { align: "right" });
}

// Cartes au format bancaire (85,6 × 54 mm), dix par planche A4 : une page de
// rectos, puis une page de versos placés en miroir pour l'impression recto verso
// (bord long). Un fin contour sert de trait de coupe.
export async function studentCardsPdf(cards: StudentCard[], fileName: string) {
  const pdf = await createPdf();
  const [logo, QRCode] = await Promise.all([logoData(), import("qrcode").then((module) => module.default)]);
  const perPage = 10;
  const gapX = 6;
  const gapY = 3;
  const left = (210 - (2 * CARD_W + gapX)) / 2;
  const top = (297 - (5 * CARD_H + 4 * gapY)) / 2;
  const slot = (index: number, mirror: boolean) => {
    const column = index % 2;
    return { x: left + (mirror ? 1 - column : column) * (CARD_W + gapX), y: top + Math.floor(index / 2) * (CARD_H + gapY) };
  };
  const outline = (x: number, y: number) => pdf.setDrawColor(190, 198, 214).setLineWidth(0.1).roundedRect(x, y, CARD_W, CARD_H, 3, 3, "S");
  for (let start = 0; start < cards.length; start += perPage) {
    const sheet = cards.slice(start, start + perPage);
    if (start > 0) pdf.addPage();
    sheet.forEach((card, index) => {
      const { x, y } = slot(index, false);
      cardRecto(pdf, card, x, y, logo, QRCode.create(card.jeton, { errorCorrectionLevel: "M" }).modules);
      outline(x, y);
    });
    pdf.addPage();
    sheet.forEach((card, index) => {
      const { x, y } = slot(index, true);
      cardVerso(pdf, card, x, y);
      outline(x, y);
    });
  }
  pdf.save(fileName);
}
