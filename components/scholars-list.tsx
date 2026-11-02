"use client";

import { useState } from "react";
import { toast } from "@/components/feedback";
import { Empty, Modal, messageOf, useLoad } from "@/components/ui-kit";
import { Scholar, scholarSituation, scholarsPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { ScholarshipType } from "@/lib/types";

const SITUATIONS = [
  { value: "", label: "Tous les boursiers", title: "Liste des boursiers" },
  { value: "INSCRITS", label: "Déjà inscrits", title: "Boursiers inscrits" },
  { value: "NON_INSCRITS", label: "Pas encore inscrits", title: "Boursiers pas encore inscrits" },
];

// Liste à imprimer : les boursiers d'un type de bourse, inscrits ou non.
export function ScholarsListModal({ scholarshipTypes, onClose }: { scholarshipTypes: ScholarshipType[]; onClose: () => void }) {
  const [typeBourseId, setTypeBourseId] = useState("");
  const [situation, setSituation] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ ...(typeBourseId ? { typeBourseId } : {}), ...(situation ? { inscription: situation } : {}) }).toString();
  const list = useLoad<Scholar[]>(`/demandes-bourse/boursiers${query ? `?${query}` : ""}`);
  const rows = list.data ?? [];
  const withoutPhone = rows.filter((item) => !item.personne.telephone).length;
  const title = SITUATIONS.find((item) => item.value === situation)?.title ?? SITUATIONS[0].title;
  const typeName = scholarshipTypes.find((type) => type.id === typeBourseId)?.nom ?? "Toutes les bourses";
  const download = async () => {
    setBusy(true);
    try {
      await scholarsPdf(rows, title, typeName);
      logPrint({ typeDocument: "LISTE_BOURSIERS", mode: "PDF", libelle: `${title} · ${typeName} · ${rows.length} étudiant(s)` });
    } catch (failure) {
      toast(messageOf(failure, "Le PDF n'a pas pu être généré."), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal wide title="Liste des boursiers" onClose={onClose}>
      <div className="entity-form">
        <div className="form-grid">
          <label>Type de bourse<select value={typeBourseId} onChange={(event) => setTypeBourseId(event.target.value)}><option value="">Toutes les bourses</option>{scholarshipTypes.map((type) => <option key={type.id} value={type.id}>{type.nom}</option>)}</select></label>
          <label>Situation<select value={situation} onChange={(event) => setSituation(event.target.value)}>{SITUATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {list.error && <p className="form-error">{list.error}</p>}
        {list.data && <p className="panel-subtitle">{rows.length} étudiant(s){withoutPhone ? ` · ${withoutPhone} sans numéro de téléphone` : ""}</p>}
        <div className="table-wrap"><table>
          <thead><tr><th>Étudiant</th><th>Téléphone</th><th>Bourse</th><th>Filière</th><th>Situation</th></tr></thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="strong-cell">{item.personne.nom} {item.personne.prenom}</td>
                <td>{item.personne.telephone ?? <span className="muted-action">Non renseigné</span>}</td>
                <td>{item.typeBourse}</td>
                <td>{item.inscription?.filiere ?? item.filiereSouhaitee}</td>
                <td>{scholarSituation(item)}</td>
              </tr>
            ))}
            {!list.data && !list.error && <Empty columns={5} loading />}
            {list.data && !rows.length && <Empty columns={5}>Aucun boursier avec ces filtres.</Empty>}
          </tbody>
        </table></div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Fermer</button>
          <button type="button" className="primary-button compact" disabled={busy || !rows.length} onClick={() => void download()}>{busy ? "Génération..." : "Télécharger le PDF"}</button>
        </div>
      </div>
    </Modal>
  );
}
