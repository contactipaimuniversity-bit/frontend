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

export type StudentCard = { nom: string; prenom: string; matricule?: string | null; dateNaissance?: string | null; filiere: string; niveau: string; annee: string };

// Cartes au format bancaire (85,6 × 54 mm), dix par page, à découper et plastifier.
export async function studentCardsPdf(cards: StudentCard[], fileName: string) {
  const pdf = await createPdf();
  const width = 85.6;
  const height = 54;
  cards.forEach((card, index) => {
    const slot = index % 10;
    if (index > 0 && slot === 0) pdf.addPage();
    const x = 15 + (slot % 2) * (width + 9);
    const y = 12 + Math.floor(slot / 2) * (height + 2.5);
    pdf.setDrawColor(150, 160, 180).setLineWidth(0.2).roundedRect(x, y, width, height, 2.5, 2.5, "S");
    pdf.setFillColor(20, 40, 92).roundedRect(x, y, width, 12, 2.5, 2.5, "F");
    pdf.rect(x, y + 6, width, 6, "F");
    pdf.setFillColor(200, 148, 27).rect(x, y + 12, width, 1, "F");
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
    pdf.text("IPAIM UNIVERSITY", x + 4, y + 7.6);
    pdf.setFontSize(6.5);
    pdf.text(pdfSafe(`CARTE D'ÉTUDIANT · ${card.annee}`), x + width - 4, y + 7.6, { align: "right" });
    // Emplacement de la photo d'identité.
    pdf.setDrawColor(170, 178, 195).setLineWidth(0.2).rect(x + 4, y + 16, 22, 28, "S");
    pdf.setFont("helvetica", "normal").setFontSize(6).setTextColor(150, 158, 175);
    pdf.text("Photo", x + 15, y + 31, { align: "center" });
    pdf.setTextColor(20, 40, 92).setFont("helvetica", "bold").setFontSize(10.5);
    pdf.text(pdf.splitTextToSize(pdfSafe(card.nom.toUpperCase()), 52)[0] as string, x + 30, y + 20);
    pdf.setFontSize(9.5);
    pdf.text(pdf.splitTextToSize(pdfSafe(card.prenom), 52)[0] as string, x + 30, y + 25);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(60, 70, 90);
    pdf.text(pdf.splitTextToSize(pdfSafe(`${card.filiere} · ${card.niveau}`), 52)[0] as string, x + 30, y + 31);
    pdf.text(pdfSafe(`Né(e) le ${card.dateNaissance ? formatDate(card.dateNaissance) : "-"}`), x + 30, y + 35.5);
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 40, 92);
    pdf.text(pdfSafe(`N° ${card.matricule ?? "-"}`), x + 30, y + 42);
    pdf.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(120, 128, 145);
    pdf.text(pdfSafe(`Valable pour l'année académique ${card.annee}. Carte strictement personnelle.`), x + 4, y + height - 3);
  });
  pdf.save(fileName);
}
