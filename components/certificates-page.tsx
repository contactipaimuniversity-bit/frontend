"use client";

import { generatedByLine } from "@/lib/session";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { logPrint, PrintRecord } from "@/lib/print-log";
import { DateOrderControl } from "@/components/date-order-control";
import { Application, ApplicationFinance, DateOrder, Enrollment, formatDate, formatMoney, fullName, pdfSafe } from "@/lib/types";

type Paginated<T> = { data: T[]; meta: { totalPages: number } };
type Balance = {
  montantAttenduCumule: string;
  montantPayeCumule: string;
  resteAPayer: string;
};
type PaidEnrollment = { enrollment: Enrollment; balance: Balance };

async function fetchAllPages<T>(resource: string): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await apiFetch<Paginated<T>>(
      `${resource}${resource.includes("?") ? "&" : "?"}page=${page}&limit=100`,
    );
    rows.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page <= totalPages);
  return rows;
}

function isPaid(balance: Balance) {
  return Number(balance.montantAttenduCumule) > 0 && Number(balance.resteAPayer) <= 0;
}

async function loadEnrollmentBalance(enrollmentId: string): Promise<Balance> {
  const finance = await apiFetch<ApplicationFinance>(`/inscriptions/${enrollmentId}/finance`);
  return {
    montantAttenduCumule: finance.totalAttendu,
    montantPayeCumule: finance.totalPaye,
    resteAPayer: (Number(finance.totalAttendu) - Number(finance.totalPaye)).toFixed(2),
  };
}

function displayDate(date?: string | null) {
  if (!date) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function loadLogo() {
  const image = new Image();
  image.src = "/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg";
  await image.decode();
  return image;
}

function addField(
  pdf: import("jspdf").jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  pdf.setFillColor(245, 247, 250);
  pdf.roundedRect(x, y, width, 16, 2, 2, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(label.toUpperCase(), x + 4, y + 5.5);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(value || "-", width - 8)[0], x + 4, y + 11.5);
}

function addCertificateFrame(
  pdf: import("jspdf").jsPDF,
  logo: HTMLImageElement,
  title: string,
) {
  pdf.setFillColor(20, 40, 92);
  pdf.rect(0, 0, 210, 57, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(0, 56, 210, 2, "F");
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(17, 12, 38, 34, 2, 2, "F");
  pdf.addImage(logo, "JPEG", 19, 13, 34, 32);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("IPAIM UNIVERSITY", 65, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(222, 232, 247);
  pdf.text("INNOVER - FORMER - TRANSFORMER", 65, 33);
  pdf.setTextColor(228, 177, 59);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(title, 65, 42);
}

function addStudentName(pdf: import("jspdf").jsPDF, name: string, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  const fittedSize = Math.max(13, Math.min(22, (170 / pdf.getTextWidth(name)) * 22));
  pdf.setFontSize(fittedSize);
  pdf.text(name, 105, y, { align: "center" });
}

// Zone de visa : emplacement du cachet de l'administration et de la signature.
function addCertificateVisa(pdf: import("jspdf").jsPDF) {
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Délivré le ${displayDate(new Date().toISOString())}`, 18, 259);

  pdf.setDrawColor(155, 168, 187);
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([1.6, 1.4], 0);
  pdf.roundedRect(18, 262, 66, 20, 2, 2, "S");
  pdf.setLineDashPattern([], 0);
  pdf.setTextColor(102, 114, 140);
  pdf.setFontSize(7);
  pdf.text("CACHET DE L’ADMINISTRATION", 51, 266.5, { align: "center" });

  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Pour l’administration", 157, 259, { align: "center" });
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Nom, qualité et signature", 157, 263.5, { align: "center" });
  pdf.setDrawColor(155, 168, 187);
  pdf.line(122, 281, 192, 281);
}

function addCertificateFooter(pdf: import("jspdf").jsPDF, identifier: string) {
  pdf.setDrawColor(200, 148, 27);
  pdf.setLineWidth(0.5);
  pdf.line(18, 284.5, 192, 284.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(102, 114, 140);
  pdf.text(`Référence : IPAIM-${identifier.slice(0, 8).toUpperCase()}`, 18, 289.5);
  pdf.text(
    `IPAIM UNIVERSITY | ${new Date().getFullYear()} | Tous droits réservés`,
    192,
    289.5,
    { align: "right" },
  );
  // Traçabilité du document : qui l'a édité, quel jour et à quelle heure.
  pdf.setFontSize(7.5);
  pdf.text(pdfSafe(generatedByLine()), 105, 293.8, { align: "center" });
}

function addStudentDetails(
  pdf: import("jspdf").jsPDF,
  person: Application["personne"] | Enrollment["personne"],
) {
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("INFORMATIONS DE L’ÉTUDIANT", 18, 189);
  addField(pdf, 18, 193, 84, "Date de naissance", displayDate(person?.dateNaissance));
  addField(pdf, 108, 193, 84, "Lieu de naissance", person?.lieuNaissance ?? "-");
  addField(pdf, 18, 211, 84, "Téléphone", person?.telephone ?? "-");
  addField(pdf, 108, 211, 84, "Quartier", person?.quartier ?? "-");
  const guardian = [person?.tuteurPrenom, person?.tuteurNom].filter(Boolean).join(" ");
  addField(pdf, 18, 229, 84, "Tuteur légal", guardian || "-");
  addField(pdf, 108, 229, 84, "Téléphone du tuteur", person?.tuteurTelephone ?? "-");
}

const PRINT_FRAME_ATTRIBUTE = "data-certificate-print";

// Ouvre la boîte d'impression du navigateur sur le PDF. L'impression est
// déclenchée explicitement une fois le document chargé : le script d'impression
// automatique intégré au PDF n'est pas exécuté par tous les navigateurs.
function printPdf(pdf: import("jspdf").jsPDF): Promise<void> {
  return new Promise((resolve, reject) => {
    // Un seul document d'impression à la fois : on retire celui du clic précédent.
    document.querySelectorAll(`iframe[${PRINT_FRAME_ATTRIBUTE}]`).forEach((frame) => frame.remove());
    const objectUrl = URL.createObjectURL(pdf.output("blob"));
    const printFrame = document.createElement("iframe");
    printFrame.setAttribute(PRINT_FRAME_ATTRIBUTE, "");
    printFrame.title = "Certificat à imprimer";
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.tabIndex = -1;
    printFrame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(expiry);
      window.removeEventListener("focus", cleanupAfterDialog);
      printFrame.remove();
      URL.revokeObjectURL(objectUrl);
    };
    // La fenêtre reprend le focus à la fermeture de la boîte d'impression.
    const cleanupAfterDialog = () => window.setTimeout(cleanup, 1000);
    const expiry = window.setTimeout(cleanup, 300_000);
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("L’impression n’a pas pu être lancée. Téléchargez le PDF puis imprimez-le."));
    };

    printFrame.onload = () => {
      // Le lecteur PDF a besoin d'un court instant après le chargement du cadre.
      window.setTimeout(() => {
        if (settled) return;
        try {
          const target = printFrame.contentWindow;
          if (!target) throw new Error("Cadre d’impression indisponible");
          target.focus();
          target.print();
          settled = true;
          window.setTimeout(() => window.addEventListener("focus", cleanupAfterDialog, { once: true }), 1500);
          resolve();
        } catch {
          // Navigateur qui refuse l'impression d'un cadre : on ouvre le PDF dans un onglet.
          const opened = window.open(objectUrl, "_blank");
          if (!opened) return fail();
          settled = true;
          window.clearTimeout(expiry);
          printFrame.remove();
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
          resolve();
        }
      }, 400);
    };
    printFrame.onerror = fail;
    printFrame.src = objectUrl;
    document.body.appendChild(printFrame);
  });
}

async function deliverCertificate(pdf: import("jspdf").jsPDF, fileName: string, shouldPrint = false) {
  if (!shouldPrint) {
    pdf.save(fileName);
    return;
  }
  await printPdf(pdf);
}

async function downloadScholarshipCertificate(application: Application, shouldPrint = false) {
  const current = await apiFetch<Application>(`/demandes-bourse/${application.id}`);
  if (current.statut !== "ACCEPTEE" || !current.typeBourse) {
    throw new Error("Ce dossier n’est plus éligible à un certificat de bourse.");
  }

  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addCertificateFrame(pdf, logo, "CERTIFICAT D’ATTRIBUTION DE BOURSE");
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("Il est certifié que", 105, 77, { align: "center" });
  addStudentName(pdf, fullName(current.personne), 91);
  pdf.setDrawColor(200, 148, 27);
  pdf.setLineWidth(0.8);
  pdf.line(76, 99, 134, 99);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.text("bénéficie d’une bourse d’études accordée par IPAIM University.", 105, 112, { align: "center" });
  pdf.setTextColor(200, 148, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(current.typeBourse.nom, 105, 126, { align: "center" });

  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("PARCOURS ACADÉMIQUE", 18, 143);
  addField(pdf, 18, 148, 84, "Filière principale", current.filiereSouhaitee);
  addField(pdf, 108, 148, 84, "Filière secondaire", current.filiereSecondaireSouhaitee ?? "-");
  addField(pdf, 18, 166, 84, "Niveau d’admission", current.niveauDemande.replaceAll("_", " "));
  addField(pdf, 108, 166, 84, "Établissement d’origine", current.ecoleOrigine ?? "-");
  addStudentDetails(pdf, current.personne);
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    "Félicitations pour cette distinction. Votre inscription est désormais à portée de main.",
    105,
    252,
    { align: "center" },
  );
  addCertificateVisa(pdf);
  addCertificateFooter(pdf, current.id);
  await deliverCertificate(pdf, `certificat-bourse-${safeFileName(fullName(current.personne))}.pdf`, shouldPrint);
}

async function downloadEnrollmentCertificate(item: PaidEnrollment, shouldPrint = false) {
  const current = await apiFetch<Enrollment>(`/inscriptions/${item.enrollment.id}`);
  const balance = await loadEnrollmentBalance(current.id);
  if (current.statut === "ABANDONNEE" || !isPaid(balance)) {
    throw new Error("Le paiement complet de cette inscription n’est pas confirmé.");
  }

  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addCertificateFrame(pdf, logo, "CERTIFICAT D’INSCRIPTION");
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("IPAIM University certifie l’inscription de", 105, 79, { align: "center" });
  addStudentName(pdf, fullName(current.personne), 95);
  pdf.setDrawColor(200, 148, 27);
  pdf.setLineWidth(0.8);
  pdf.line(76, 103, 134, 103);
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("au titre de l’année universitaire", 105, 116, { align: "center" });
  pdf.setTextColor(200, 148, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(current.anneeScolaire, 105, 128, { align: "center" });
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(current.viaBourse ? "Inscription au titre d’une bourse" : "Inscription directe", 105, 137, { align: "center" });

  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("DÉTAILS DE L’INSCRIPTION", 18, 143);
  addField(pdf, 18, 148, 84, "Filière", current.filiere);
  addField(pdf, 108, 148, 84, "Niveau", current.niveau);
  addField(pdf, 18, 166, 84, "Année universitaire", current.anneeScolaire);
  addField(pdf, 108, 166, 84, "Date d’inscription", displayDate(current.dateInscription));
  addStudentDetails(pdf, current.personne);
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Frais intégralement réglés : ${pdfSafe(formatMoney(balance.montantPayeCumule))}. Bienvenue à IPAIM University.`,
    105,
    252,
    { align: "center" },
  );
  addCertificateVisa(pdf);
  addCertificateFooter(pdf, current.id);
  await deliverCertificate(pdf, `certificat-inscription-${safeFileName(fullName(current.personne))}.pdf`, shouldPrint);
}

export function CertificatesPage({ refreshSignal, dateOrder, onDateOrderChange }: { refreshSignal: number; dateOrder: DateOrder; onDateOrderChange: (value: DateOrder) => void }) {
  const [tab, setTab] = useState<"bourses" | "inscriptions">("bourses");
  const [applications, setApplications] = useState<Application[]>([]);
  const [paidEnrollments, setPaidEnrollments] = useState<PaidEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationErrors, setVerificationErrors] = useState(0);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [generatingAction, setGeneratingAction] = useState<"download" | "print">("download");
  const [search, setSearch] = useState("");
  // Recherche sans accents ni majuscules sur le nom, le téléphone, la filière, la bourse, le niveau et l'année.
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
  const term = normalize(search.trim());
  const matches = (...parts: Array<string | null | undefined>) => !term || normalize(parts.filter(Boolean).join(" ")).includes(term);
  const visibleApplications = applications.filter((item) =>
    matches(fullName(item.personne), item.personne?.telephone, item.filiereSouhaitee, item.filiereSecondaireSouhaitee, item.typeBourse?.nom, item.niveauDemande.replaceAll("_", " "), item.ecoleOrigine),
  );
  const visibleEnrollments = paidEnrollments.filter((item) =>
    matches(fullName(item.enrollment.personne), item.enrollment.personne?.telephone, item.enrollment.filiere, item.enrollment.niveau, item.enrollment.anneeScolaire),
  );
  const visibleCount = tab === "bourses" ? visibleApplications.length : visibleEnrollments.length;
  const totalCount = tab === "bourses" ? applications.length : paidEnrollments.length;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [accepted, enrollments] = await Promise.all([
          fetchAllPages<Application>(`/demandes-bourse?statut=ACCEPTEE&ordreDate=${dateOrder}`),
          fetchAllPages<Enrollment>(`/inscriptions?ordreDate=${dateOrder}`),
        ]);
        const candidates = enrollments.filter((item) => item.statut !== "ABANDONNEE");
        const eligible: PaidEnrollment[] = [];
        let failedChecks = 0;
        for (let index = 0; index < candidates.length; index += 8) {
          const results = await Promise.all(
            candidates.slice(index, index + 8).map(async (enrollment) => {
              try {
                const balance = await loadEnrollmentBalance(enrollment.id);
                return isPaid(balance) ? { enrollment, balance } : null;
              } catch {
                failedChecks += 1;
                return null;
              }
            }),
          );
          eligible.push(...results.filter((item): item is PaidEnrollment => item !== null));
        }
        if (active) {
          setApplications(accepted.filter((item) => item.typeBourse));
          setPaidEnrollments(eligible);
          setVerificationErrors(failedChecks);
        }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Impossible de charger les certificats.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [refreshSignal, dateOrder]);

  const generate = async (id: string, mode: "download" | "print", action: (shouldPrint: boolean) => Promise<void>, document: Pick<PrintRecord, "typeDocument" | "dossierType" | "libelle">) => {
    setDownloadingId(id);
    setGeneratingAction(mode);
    setError("");
    try {
      await action(mode === "print");
      logPrint({ ...document, dossierId: id, mode: mode === "print" ? "IMPRESSION" : "PDF" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le certificat n’a pas pu être généré.");
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Documents officiels</p>
          <h2>Certificats</h2>
          <p>Éditez les certificats de bourse accordée et d’inscription réglée.</p>
        </div>
      </div>
      <div className="certificate-tabs" role="tablist" aria-label="Type de certificat">
        <button className={tab === "bourses" ? "active" : ""} role="tab" aria-selected={tab === "bourses"} onClick={() => setTab("bourses")}>
          Bourses accordées <span>{applications.length}</span>
        </button>
        <button className={tab === "inscriptions" ? "active" : ""} role="tab" aria-selected={tab === "inscriptions"} onClick={() => setTab("inscriptions")}>
          Inscriptions réglées <span>{paidEnrollments.length}</span>
        </button>
      </div>
      {error && <div className="api-error">{error}</div>}
      {verificationErrors > 0 && tab === "inscriptions" && (
        <p className="certificate-warning">Le solde de {verificationErrors} inscription(s) n’a pas pu être vérifié. Ces dossiers restent masqués.</p>
      )}
      <section className="panel full-panel certificate-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">IPAIM University</p>
            <h3>{tab === "bourses" ? "Attributions confirmées" : "Paiement intégral confirmé"}</h3>
          </div>
          <div className="toolbar">
            <label className="report-search certificate-search">
              <Search aria-hidden="true" focusable="false" />
              <input type="search" value={search} placeholder="Nom, téléphone, filière, bourse, année…" aria-label="Rechercher un certificat" onChange={(event) => setSearch(event.target.value)} />
            </label>
            <DateOrderControl value={dateOrder} onChange={onDateOrderChange} />
            <span className="certificate-count">{loading ? "Chargement…" : term ? `${visibleCount} sur ${totalCount}` : totalCount}</span>
          </div>
        </div>
        {loading ? <p className="empty-state">Vérification des dossiers et des paiements…</p> : tab === "bourses" ? (
          <div className="certificate-list">
            {visibleApplications.map((item) => (
              <article className="certificate-row" key={item.id}>
                <div className="certificate-person">
                  <strong>{fullName(item.personne)}</strong>
                  <span>{item.filiereSouhaitee} · {item.typeBourse?.nom}</span>
                </div>
                <div className="certificate-meta">
                  <span>{item.niveauDemande.replaceAll("_", " ")}</span>
                  <span>Décision · {formatDate(item.dateDecision ?? undefined)}</span>
                </div>
                <div className="certificate-actions">
                  <button className="outline-button small certificate-download" disabled={downloadingId === item.id} onClick={() => void generate(item.id, "download", (printWindow) => downloadScholarshipCertificate(item, printWindow), { typeDocument: "CERTIFICAT_BOURSE", dossierType: "demande-bourse", libelle: `${fullName(item.personne)} · ${item.filiereSouhaitee}` })}>
                    {downloadingId === item.id && generatingAction === "download" ? "Génération…" : "↓ PDF"}
                  </button>
                  <button className="outline-button small certificate-print" disabled={downloadingId === item.id} onClick={() => void generate(item.id, "print", (printWindow) => downloadScholarshipCertificate(item, printWindow), { typeDocument: "CERTIFICAT_BOURSE", dossierType: "demande-bourse", libelle: `${fullName(item.personne)} · ${item.filiereSouhaitee}` })}>
                    {downloadingId === item.id && generatingAction === "print" ? "Préparation…" : "Imprimer"}
                  </button>
                </div>
              </article>
            ))}
            {!visibleApplications.length && <p className="empty-state">{term ? "Aucun certificat de bourse ne correspond à cette recherche." : "Aucune demande avec bourse attribuée."}</p>}
          </div>
        ) : (
          <div className="certificate-list">
            {visibleEnrollments.map((item) => (
              <article className="certificate-row" key={item.enrollment.id}>
                <div className="certificate-person">
                  <strong>{fullName(item.enrollment.personne)}</strong>
                  <span>{item.enrollment.filiere} · {item.enrollment.anneeScolaire}</span>
                </div>
                <div className="certificate-meta">
                  <span>{item.enrollment.niveau}</span>
                  <span>Réglé · {formatMoney(item.balance.montantPayeCumule)}</span>
                </div>
                <div className="certificate-actions">
                  <button className="outline-button small certificate-download" disabled={downloadingId === item.enrollment.id} onClick={() => void generate(item.enrollment.id, "download", (printWindow) => downloadEnrollmentCertificate(item, printWindow), { typeDocument: "CERTIFICAT_INSCRIPTION", dossierType: "inscription", libelle: `${fullName(item.enrollment.personne)} · ${item.enrollment.filiere}` })}>
                    {downloadingId === item.enrollment.id && generatingAction === "download" ? "Génération…" : "↓ PDF"}
                  </button>
                  <button className="outline-button small certificate-print" disabled={downloadingId === item.enrollment.id} onClick={() => void generate(item.enrollment.id, "print", (printWindow) => downloadEnrollmentCertificate(item, printWindow), { typeDocument: "CERTIFICAT_INSCRIPTION", dossierType: "inscription", libelle: `${fullName(item.enrollment.personne)} · ${item.enrollment.filiere}` })}>
                    {downloadingId === item.enrollment.id && generatingAction === "print" ? "Préparation…" : "Imprimer"}
                  </button>
                </div>
              </article>
            ))}
            {!visibleEnrollments.length && <p className="empty-state">{term ? "Aucun certificat d'inscription ne correspond à cette recherche." : "Aucune inscription entièrement réglée."}</p>}
          </div>
        )}
      </section>
    </div>
  );
}