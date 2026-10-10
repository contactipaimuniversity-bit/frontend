"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { BrandLogo } from "@/components/brand-logo";
import { logPrint } from "@/lib/print-log";
import { generatedByLine } from "@/lib/session";
import { PaymentTransaction, formatMoney, fullName, pdfSafe } from "@/lib/types";

const longDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const refundReference = (refund: PaymentTransaction) => refund.numeroRecu ?? `REMB-${refund.id.slice(0, 8).toUpperCase()}`;
const refundAmount = (refund: PaymentTransaction) => Math.abs(Number(refund.montant));
const acknowledgement = (refund: PaymentTransaction) =>
  `Je soussigné(e) reconnais avoir reçu de l'IPAIM la somme de ${formatMoney(refundAmount(refund))}, au titre du remboursement d'un trop-perçu.`;

async function downloadRefundReceiptPdf(refund: PaymentTransaction) {
  const logo = new Image();
  logo.src = "/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg";
  const [{ jsPDF }] = await Promise.all([import("jspdf"), logo.decode()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(20, 40, 92);
  pdf.rect(0, 0, pageWidth, 54, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(0, 53, pageWidth, 2, "F");
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(18, 11, 30, 30, 2, 2, "F");
  pdf.addImage(logo, "JPEG", 19, 12, 28, 28);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("IPAIM UNIVERSITY", 58, 23);
  pdf.setTextColor(222, 232, 247);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("INNOVER · FORMER · TRANSFORMER", 58, 31);
  pdf.setTextColor(228, 177, 59);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("REÇU DE REMBOURSEMENT", 58, 41);

  pdf.setFillColor(242, 245, 250);
  pdf.roundedRect(18, 63, 174, 19, 2, 2, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("RÉFÉRENCE DU REÇU", 22, 70);
  pdf.text("DATE DU REMBOURSEMENT", 116, 70);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(refundReference(refund), 22, 77);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(longDate(refund.datePaiement), 116, 77);

  pdf.setTextColor(102, 114, 140);
  pdf.setFontSize(9);
  pdf.text("REMBOURSÉ À", 18, 96);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  const nameLines = pdf.splitTextToSize(fullName(refund.personne), 174);
  pdf.setFontSize(nameLines.length > 1 ? 17 : 21);
  pdf.text(nameLines, 18, 106);
  let y = 112 + nameLines.length * 6;
  if (refund.personne?.telephone) {
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Téléphone : ${refund.personne.telephone}`, 18, y);
    y += 8;
  }

  const row = (label: string, value: string) => {
    const lines = pdf.splitTextToSize(value || "-", 118);
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(label.toUpperCase(), 20, y + 5);
    pdf.setTextColor(36, 51, 76);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text(lines, 72, y + 5);
    y += 6 + lines.length * 4.2;
    pdf.setDrawColor(226, 232, 242);
    pdf.line(18, y, 192, y);
  };
  row("Dossier concerné", refund.dossier);
  row("Obligation concernée", refund.obligation ?? "-");
  row("Motif du remboursement", refund.motif ?? "-");
  row("Remboursement effectué par", refund.saisiParNom ?? "-");

  y += 8;
  pdf.setFillColor(247, 239, 217);
  pdf.roundedRect(18, y, 174, 19, 2, 2, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(18, y, 3, 19, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("MONTANT REMBOURSÉ", 25, y + 11.5);
  pdf.setTextColor(20, 40, 92);
  pdf.setFontSize(17);
  pdf.text(pdfSafe(formatMoney(refundAmount(refund))), 185, y + 12.5, { align: "right" });

  y += 32;
  pdf.setTextColor(36, 51, 76);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(pdf.splitTextToSize(pdfSafe(acknowledgement(refund)), 174), 18, y);

  // Les deux signatures : celui qui reçoit l'argent, celui qui le remet.
  const signatureY = 232;
  pdf.setDrawColor(155, 168, 187);
  pdf.line(18, signatureY + 22, 92, signatureY + 22);
  pdf.line(118, signatureY + 22, 192, signatureY + 22);
  pdf.setTextColor(102, 114, 140);
  pdf.setFontSize(7.5);
  pdf.text("L'étudiant ou son parent", 18, signatureY);
  pdf.text("Nom, date et signature, précédés de « Lu et approuvé »", 18, signatureY + 4);
  pdf.text("Le service de comptabilité", 118, signatureY);
  pdf.text("Signature et cachet de l'établissement", 118, signatureY + 4);

  pdf.setDrawColor(200, 148, 27);
  pdf.line(18, 285.5, 192, 285.5);
  pdf.setFontSize(7);
  pdf.text(`Référence de transaction : ${refund.id}`, 18, 290);
  pdf.text("IPAIM UNIVERSITY", 192, 290, { align: "right" });
  pdf.text(pdfSafe(generatedByLine()), 105, 294, { align: "center" });
  pdf.save(`recu-remboursement-ipaim-${refund.id.slice(0, 8)}.pdf`);
}

// Reçu remis à l'étudiant quand un trop-perçu lui est rendu : il le signe, l'établissement en garde un exemplaire.
export function RefundReceipt({ refund, onClose }: { refund: PaymentTransaction; onClose: () => void }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [generatedBy] = useState(() => generatedByLine());
  const recordPrint = (mode: "IMPRESSION" | "PDF") =>
    logPrint({ typeDocument: "RECU_REMBOURSEMENT", mode, dossierType: refund.dossierType, dossierId: refund.dossierId, libelle: `${fullName(refund.personne)} · ${formatMoney(refundAmount(refund))}`, reference: refundReference(refund) });
  const createPdf = async () => {
    setPdfBusy(true);
    setPdfError("");
    try {
      await downloadRefundReceiptPdf(refund);
      recordPrint("PDF");
    } catch (failure) {
      setPdfError(failure instanceof Error ? failure.message : "Impossible de générer le PDF.");
    } finally {
      setPdfBusy(false);
    }
  };
  return createPortal((
    <div className="modal-backdrop receipt-backdrop" onMouseDown={onClose}>
      <section className="modal payment-receipt-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header receipt-modal-header">
          <h3>Reçu de remboursement</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fermer l’aperçu">×</button>
        </div>
        <p className="refund-receipt-hint">Imprimez ce reçu en deux exemplaires : l&apos;étudiant (ou son parent) signe les deux, il en garde un et l&apos;établissement conserve l&apos;autre.</p>
        <article className="payment-receipt-print">
          <header className="receipt-brand-header">
            <BrandLogo compact />
            <div>
              <strong>IPAIM UNIVERSITY</strong>
              <span>INNOVER · FORMER · TRANSFORMER</span>
            </div>
            <p>REÇU DE REMBOURSEMENT</p>
          </header>
          <div className="receipt-reference">
            <div><span>Référence du reçu</span><strong>{refundReference(refund)}</strong></div>
            <div><span>Date du remboursement</span><strong>{longDate(refund.datePaiement)}</strong></div>
          </div>
          <p className="receipt-intro">Remboursé à</p>
          <h2 className="receipt-student-name">{fullName(refund.personne)}</h2>
          {refund.personne?.telephone && <p className="receipt-contact">Téléphone : {refund.personne.telephone}</p>}
          <section className="receipt-detail-list">
            <div><span>Dossier concerné</span><strong>{refund.dossier}</strong></div>
            <div><span>Obligation concernée</span><strong>{refund.obligation ?? "-"}</strong></div>
            <div><span>Motif du remboursement</span><strong>{refund.motif ?? "-"}</strong></div>
            <div><span>Remboursement effectué par</span><strong>{refund.saisiParNom ?? "-"}</strong></div>
          </section>
          <div className="receipt-amount"><span>Montant remboursé</span><strong>{formatMoney(refundAmount(refund))}</strong></div>
          <p className="receipt-thanks">{acknowledgement(refund)}</p>
          <footer className="receipt-signature">
            <div><span>L&apos;étudiant ou son parent · nom, date et signature, précédés de « Lu et approuvé »</span><i /></div>
            <div><span>Le service de comptabilité · signature et cachet</span><i /></div>
          </footer>
          <div className="receipt-footer">IPAIM UNIVERSITY · Référence de transaction : {refund.id}<br />{generatedBy}</div>
        </article>
        {pdfError && <p className="form-error receipt-pdf-error" role="alert">{pdfError}</p>}
        <div className="receipt-print-actions">
          <button className="secondary-button" onClick={onClose}>Fermer</button>
          <button className="outline-button" onClick={() => void createPdf()} disabled={pdfBusy}>{pdfBusy ? "Génération..." : "Télécharger le PDF"}</button>
          <button className="primary-button compact" onClick={() => { recordPrint("IMPRESSION"); window.print(); }}>Imprimer le reçu</button>
        </div>
      </section>
    </div>
  ), document.body);
}
