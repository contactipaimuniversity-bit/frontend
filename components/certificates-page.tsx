"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Application, Enrollment, formatDate, formatMoney, fullName } from "@/lib/types";

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
  pdf.roundedRect(x, y, width, 19, 2, 2, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(label.toUpperCase(), x + 4, y + 6);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(value || "-", width - 8), x + 4, y + 12);
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

function addCertificateFooter(pdf: import("jspdf").jsPDF, identifier: string) {
  pdf.setDrawColor(200, 148, 27);
  pdf.setLineWidth(0.5);
  pdf.line(18, 273, 192, 273);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(102, 114, 140);
  pdf.text(`Référence : IPAIM-${identifier.slice(0, 8).toUpperCase()}`, 18, 280);
  pdf.text(
    `IPAIM UNIVERSITY | ${new Date().getFullYear()} | Tous droits réservés`,
    192,
    280,
    { align: "right" },
  );
}

function addStudentDetails(
  pdf: import("jspdf").jsPDF,
  person: Application["personne"] | Enrollment["personne"],
) {
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("INFORMATIONS DE L’ÉTUDIANT", 18, 193);
  addField(pdf, 18, 198, 84, "Date de naissance", displayDate(person?.dateNaissance));
  addField(pdf, 108, 198, 84, "Lieu de naissance", person?.lieuNaissance ?? "-");
  addField(pdf, 18, 220, 84, "Téléphone", person?.telephone ?? "-");
  addField(pdf, 108, 220, 84, "Quartier", person?.quartier ?? "-");
  const guardian = [person?.tuteurPrenom, person?.tuteurNom].filter(Boolean).join(" ");
  addField(pdf, 18, 242, 84, "Tuteur légal", guardian || "-");
  addField(pdf, 108, 242, 84, "Téléphone du tuteur", person?.tuteurTelephone ?? "-");
}

async function downloadScholarshipCertificate(application: Application) {
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
  addField(pdf, 18, 170, 84, "Niveau d’admission", current.niveauDemande.replaceAll("_", " "));
  addField(pdf, 108, 170, 84, "Établissement d’origine", current.ecoleOrigine ?? "-");
  addStudentDetails(pdf, current.personne);
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    "Félicitations pour cette distinction. Votre inscription est désormais à portée de main.",
    105,
    266,
    { align: "center" },
  );
  addCertificateFooter(pdf, current.id);
  pdf.save(`certificat-bourse-${safeFileName(fullName(current.personne))}.pdf`);
}

async function downloadEnrollmentCertificate(item: PaidEnrollment) {
  const current = await apiFetch<Enrollment>(`/inscriptions/${item.enrollment.id}`);
  const balance = await apiFetch<Balance>(`/paiements/solde/inscription/${current.id}`);
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
  addField(pdf, 18, 170, 84, "Année universitaire", current.anneeScolaire);
  addField(pdf, 108, 170, 84, "Date d’inscription", displayDate(current.dateInscription));
  addStudentDetails(pdf, current.personne);
  pdf.setTextColor(78, 88, 108);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Frais intégralement réglés : ${formatMoney(balance.montantPayeCumule)}. Bienvenue à IPAIM University.`,
    105,
    266,
    { align: "center" },
  );
  addCertificateFooter(pdf, current.id);
  pdf.save(`certificat-inscription-${safeFileName(fullName(current.personne))}.pdf`);
}

export function CertificatesPage({ refreshSignal }: { refreshSignal: number }) {
  const [tab, setTab] = useState<"bourses" | "inscriptions">("bourses");
  const [applications, setApplications] = useState<Application[]>([]);
  const [paidEnrollments, setPaidEnrollments] = useState<PaidEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationErrors, setVerificationErrors] = useState(0);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [accepted, enrollments] = await Promise.all([
          fetchAllPages<Application>("/demandes-bourse?statut=ACCEPTEE"),
          fetchAllPages<Enrollment>("/inscriptions"),
        ]);
        const candidates = enrollments.filter((item) => item.statut !== "ABANDONNEE");
        const eligible: PaidEnrollment[] = [];
        let failedChecks = 0;
        for (let index = 0; index < candidates.length; index += 8) {
          const results = await Promise.all(
            candidates.slice(index, index + 8).map(async (enrollment) => {
              try {
                const balance = await apiFetch<Balance>(`/paiements/solde/inscription/${enrollment.id}`);
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
  }, [refreshSignal]);

  const generate = async (id: string, action: () => Promise<void>) => {
    setDownloadingId(id);
    setError("");
    try {
      await action();
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
          <span className="certificate-count">{loading ? "Chargement…" : tab === "bourses" ? applications.length : paidEnrollments.length}</span>
        </div>
        {loading ? <p className="empty-state">Vérification des dossiers et des paiements…</p> : tab === "bourses" ? (
          <div className="certificate-list">
            {applications.map((item) => (
              <article className="certificate-row" key={item.id}>
                <div className="certificate-person">
                  <strong>{fullName(item.personne)}</strong>
                  <span>{item.filiereSouhaitee} · {item.typeBourse?.nom}</span>
                </div>
                <div className="certificate-meta">
                  <span>{item.niveauDemande.replaceAll("_", " ")}</span>
                  <span>Décision · {formatDate(item.dateDecision ?? undefined)}</span>
                </div>
                <button className="outline-button small certificate-download" disabled={downloadingId === item.id} onClick={() => void generate(item.id, () => downloadScholarshipCertificate(item))}>
                  {downloadingId === item.id ? "Génération…" : "↓ PDF"}
                </button>
              </article>
            ))}
            {!applications.length && <p className="empty-state">Aucune demande avec bourse attribuée.</p>}
          </div>
        ) : (
          <div className="certificate-list">
            {paidEnrollments.map((item) => (
              <article className="certificate-row" key={item.enrollment.id}>
                <div className="certificate-person">
                  <strong>{fullName(item.enrollment.personne)}</strong>
                  <span>{item.enrollment.filiere} · {item.enrollment.anneeScolaire}</span>
                </div>
                <div className="certificate-meta">
                  <span>{item.enrollment.niveau}</span>
                  <span>Réglé · {formatMoney(item.balance.montantPayeCumule)}</span>
                </div>
                <button className="outline-button small certificate-download" disabled={downloadingId === item.enrollment.id} onClick={() => void generate(item.enrollment.id, () => downloadEnrollmentCertificate(item))}>
                  {downloadingId === item.enrollment.id ? "Génération…" : "↓ PDF"}
                </button>
              </article>
            ))}
            {!paidEnrollments.length && <p className="empty-state">Aucune inscription entièrement réglée.</p>}
          </div>
        )}
      </section>
    </div>
  );
}