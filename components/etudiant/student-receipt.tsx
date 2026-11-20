"use client";

import Image from "next/image";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";
import { FeePayment, money, shortDate } from "@/lib/student-api";

const MODES: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile money", VIREMENT: "Virement", CHEQUE: "Chèque" };

// Aperçu d'un reçu, en lecture seule : l'étudiant le consulte, il ne peut ni
// le modifier ni l'imprimer d'ici. L'original reste celui remis à la caisse.
export function ReceiptSheet({ payment, student, dossier, onClose }: { payment: FeePayment; student: { nom: string; prenom: string; matricule: string | null } | null; dossier: { filiere: string; niveau: string } | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const date = shortDate(payment.date, { day: "numeric", month: "long", year: "numeric" });
  return createPortal(
    <div className="stu-root stu-sheet-backdrop" onClick={onClose}>
      <section className="stu-sheet" role="dialog" aria-modal="true" aria-label="Reçu de paiement" onClick={(event) => event.stopPropagation()}>
        <div className="stu-sheet-bar">
          <span className="stu-readonly"><Eye size={14} aria-hidden="true" /> Lecture seule</span>
          <button type="button" className="stu-icon-button" onClick={onClose} aria-label="Fermer le reçu"><X size={20} aria-hidden="true" /></button>
        </div>
        <article className="stu-receipt">
          <header className="stu-receipt-head">
            <Image src="/etudiant/icon-192.png" alt="" width={48} height={48} />
            <div>
              <strong>IPAIM UNIVERSITY</strong>
              <span>Innover · Former · Transformer</span>
            </div>
          </header>
          <p className="stu-receipt-kind">Reçu de paiement</p>
          <dl className="stu-receipt-ref">
            <div><dt>Reçu n°</dt><dd>{payment.numeroRecu ?? "—"}</dd></div>
            <div><dt>Date</dt><dd>{date}</dd></div>
          </dl>
          <p className="stu-receipt-from">Reçu de la part de</p>
          <h2 className="stu-receipt-name">{student ? `${student.prenom} ${student.nom}` : "—"}</h2>
          {student?.matricule && <p className="stu-receipt-from">Matricule {student.matricule}</p>}
          <dl className="stu-receipt-lines">
            {dossier && <div><dt>Filière</dt><dd>{dossier.filiere} · {dossier.niveau}</dd></div>}
            <div><dt>Nature</dt><dd>{payment.nature ?? payment.libelle}</dd></div>
            {payment.nature && payment.nature !== payment.libelle && <div><dt>Objet</dt><dd>{payment.libelle}</dd></div>}
            <div><dt>Mode de paiement</dt><dd>{payment.mode ? MODES[payment.mode] ?? payment.mode : "—"}</dd></div>
            <div><dt>Encaissé par</dt><dd>{payment.encaissePar ?? "—"}</dd></div>
          </dl>
          <div className="stu-receipt-amount">
            <span>Montant reçu</span>
            <strong>{money(payment.montant)}</strong>
          </div>
          <p className="stu-receipt-note">Copie consultable dans ton espace. Le reçu remis à la caisse fait foi.</p>
        </article>
      </section>
    </div>,
    document.body,
  );
}
