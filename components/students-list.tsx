"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/feedback";
import { AcademicYear, Pole, Program, useLevels } from "@/components/academic-structure-page";
import { Empty, Modal, messageOf, useLoad } from "@/components/ui-kit";
import { PdfColumn, tablePdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { ScholarshipType, formatDate, statusLabels } from "@/lib/types";

export type EnrolledStudent = {
  id: string;
  anneeScolaire: string;
  niveau: string;
  filiere: string;
  pole: string | null;
  poleOrdre: number | null;
  classe: string | null;
  statut: string;
  viaBourse: boolean;
  bourse: string | null;
  dateInscription: string;
  fraisInscriptionPayes: boolean;
  personne: { nom: string; prenom: string; matricule: string | null; sexe: string | null; telephone: string | null; tuteurTelephone: string | null; dateNaissance: string | null; lieuNaissance: string | null };
};

type ClassOption = { id: string; nom: string };

// Colonnes au choix : la liste se taille selon l'usage (affichage, appel, contacts…).
const COLUMNS: Array<{ key: string; label: string; width: number; value: (item: EnrolledStudent) => string; byDefault: boolean }> = [
  { key: "matricule", label: "Matricule", width: 24, value: (item) => item.personne.matricule ?? "-", byDefault: true },
  { key: "sexe", label: "Sexe", width: 12, value: (item) => item.personne.sexe ?? "-", byDefault: false },
  { key: "naissance", label: "Né(e) le", width: 24, value: (item) => (item.personne.dateNaissance ? formatDate(item.personne.dateNaissance) : "-"), byDefault: false },
  { key: "lieu", label: "Lieu de naissance", width: 30, value: (item) => item.personne.lieuNaissance ?? "-", byDefault: false },
  { key: "telephone", label: "Téléphone", width: 26, value: (item) => item.personne.telephone ?? "-", byDefault: true },
  { key: "tuteur", label: "Tél. tuteur", width: 26, value: (item) => item.personne.tuteurTelephone ?? "-", byDefault: false },
  { key: "pole", label: "Pôle", width: 32, value: (item) => item.pole ?? "Sans pôle", byDefault: false },
  { key: "filiere", label: "Filière", width: 40, value: (item) => item.filiere, byDefault: true },
  { key: "niveau", label: "Niveau", width: 14, value: (item) => item.niveau, byDefault: true },
  { key: "classe", label: "Classe", width: 20, value: (item) => item.classe ?? "-", byDefault: false },
  { key: "bourse", label: "Bourse", width: 30, value: (item) => item.bourse ?? (item.viaBourse ? "Boursier" : "-"), byDefault: false },
  { key: "frais", label: "Frais d'inscription", width: 26, value: (item) => (item.fraisInscriptionPayes ? "Payés" : "Non payés"), byDefault: true },
  { key: "statut", label: "Statut", width: 22, value: (item) => statusLabels[item.statut] ?? item.statut, byDefault: false },
  { key: "date", label: "Inscrit le", width: 22, value: (item) => formatDate(item.dateInscription), byDefault: false },
];

const GROUPS = [
  { value: "pole", label: "Par pôle", key: (item: EnrolledStudent) => item.pole ?? "Sans pôle" },
  { value: "filiere", label: "Par filière", key: (item: EnrolledStudent) => `${item.filiere} · ${item.niveau}` },
  { value: "classe", label: "Par classe", key: (item: EnrolledStudent) => item.classe ?? "Sans classe" },
  { value: "", label: "Une seule liste", key: () => "" },
];

const empty = { anneeScolaire: "", poleId: "", filiereId: "", niveau: "", classeId: "", statut: "", bourse: "", matricule: "", fraisInscription: "" };

// Liste des inscrits à imprimer ou à télécharger, taillée par les filtres.
export function StudentsListModal({ scholarshipTypes, onClose }: { scholarshipTypes: ScholarshipType[]; onClose: () => void }) {
  const years = useLoad<AcademicYear[]>("/academique/annees");
  const poles = useLoad<Pole[]>("/academique/poles");
  const programs = useLoad<Program[]>("/academique/filieres");
  const levels = useLevels();
  const [filters, setFilters] = useState(() => ({ ...empty, anneeScolaire: "" }));
  const yearId = years.data?.find((item) => item.libelle === filters.anneeScolaire)?.id;
  const classes = useLoad<{ classes: ClassOption[] }>(yearId ? `/academique/classes?anneeId=${yearId}` : null);
  const [group, setGroup] = useState("pole");
  const [columns, setColumns] = useState(() => new Set(COLUMNS.filter((column) => column.byDefault).map((column) => column.key)));
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const list = useLoad<EnrolledStudent[]>(`/inscriptions/liste${query ? `?${query}` : ""}`);
  const set = (key: keyof typeof empty, value: string) =>
    setFilters((current) => ({ ...current, [key]: value, ...(key === "poleId" ? { filiereId: "" } : {}), ...(key === "anneeScolaire" ? { classeId: "" } : {}) }));
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const grouping = GROUPS.find((item) => item.value === group) ?? GROUPS[0];
  // Les groupes dans l'ordre des pôles (ou alphabétique), les étudiants par nom.
  const sections = useMemo(() => {
    const map = new Map<string, { label: string; order: number; items: EnrolledStudent[] }>();
    for (const item of rows) {
      const label = grouping.key(item);
      if (!map.has(label)) map.set(label, { label, order: group === "pole" ? item.poleOrdre ?? Infinity : 0, items: [] });
      map.get(label)!.items.push(item);
    }
    return [...map.values()].sort((first, second) => first.order - second.order || first.label.localeCompare(second.label, "fr"));
  }, [rows, grouping, group]);
  const chosen = COLUMNS.filter((column) => columns.has(column.key));
  const filterLabels = [
    filters.anneeScolaire || "Toutes les années",
    poles.data?.find((item) => item.id === filters.poleId)?.nom ?? (filters.poleId === "aucun" ? "Sans pôle" : null),
    programs.data?.find((item) => item.id === filters.filiereId)?.nom,
    filters.niveau || null,
    classes.data?.classes.find((item) => item.id === filters.classeId)?.nom,
    filters.statut ? statusLabels[filters.statut] ?? filters.statut : null,
    filters.bourse === "OUI" ? "Boursiers" : filters.bourse === "NON" ? "Non boursiers" : scholarshipTypes.find((item) => item.id === filters.bourse)?.nom,
    filters.matricule === "AVEC" ? "Avec matricule" : filters.matricule === "SANS" ? "Sans matricule" : null,
    filters.fraisInscription === "PAYES" ? "Frais d'inscription payés" : filters.fraisInscription === "NON_PAYES" ? "Frais d'inscription non payés" : null,
  ].filter(Boolean) as string[];
  const lines = () => {
    const body: string[][] = [];
    const groupRows: number[] = [];
    let index = 0;
    for (const section of sections) {
      if (section.label) {
        groupRows.push(body.length);
        body.push([`${section.label} · ${section.items.length} étudiant(s)`]);
      }
      for (const item of section.items) body.push([String(++index), `${item.personne.nom} ${item.personne.prenom}`, ...chosen.map((column) => column.value(item))]);
    }
    return { body, groupRows };
  };
  const download = async () => {
    setBusy(true);
    try {
      const { body, groupRows } = lines();
      const fixed: PdfColumn[] = [{ label: "N°", width: 10, align: "right" }, { label: "Nom et prénom", width: 55 }];
      const free = 267 - 65;
      const weight = chosen.reduce((total, column) => total + column.width, 0) || 1;
      await tablePdf({
        title: "LISTE DES ÉTUDIANTS INSCRITS",
        subtitle: `${filterLabels.join(" · ")} · ${rows.length} étudiant(s)`,
        fileName: `liste-inscrits${filters.anneeScolaire ? `-${filters.anneeScolaire}` : ""}.pdf`,
        columns: [...fixed, ...chosen.map((column) => ({ label: column.label, width: (column.width / weight) * free }))],
        rows: body,
        groupRows,
      });
      logPrint({ typeDocument: "LISTE_INSCRITS", mode: "PDF", libelle: `${filterLabels.join(" · ")} · ${rows.length} étudiant(s)` });
    } catch (failure) {
      toast(messageOf(failure, "Le PDF n'a pas pu être généré."), "error");
    } finally {
      setBusy(false);
    }
  };
  // Tableur : s'ouvre dans Excel, accents compris (séparateur « ; »).
  const downloadCsv = () => {
    const header = ["N°", "Nom", "Prénom", ...(group ? [GROUPS.find((item) => item.value === group)!.label.replace("Par ", "")] : []), ...chosen.map((column) => column.label)];
    let index = 0;
    const data = sections.flatMap((section) => section.items.map((item) => [String(++index), item.personne.nom, item.personne.prenom, ...(group ? [section.label] : []), ...chosen.map((column) => column.value(item))]));
    const cell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const csv = [header, ...data].map((line) => line.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `liste-inscrits${filters.anneeScolaire ? `-${filters.anneeScolaire}` : ""}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const shownPrograms = (programs.data ?? []).filter((item) => item.actif && !item.troncCommun && (!filters.poleId || (filters.poleId === "aucun" ? !item.poleId : item.poleId === filters.poleId)));
  return (
    <Modal wide title="Liste des étudiants inscrits" onClose={onClose}>
      <div className="entity-form">
        <div className="form-grid students-list-filters">
          <label>Année<select value={filters.anneeScolaire} onChange={(event) => set("anneeScolaire", event.target.value)}><option value="">Toutes</option>{(years.data ?? []).map((item) => <option key={item.id} value={item.libelle}>{item.libelle}</option>)}</select></label>
          <label>Pôle<select value={filters.poleId} onChange={(event) => set("poleId", event.target.value)}><option value="">Tous</option>{(poles.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}<option value="aucun">Sans pôle</option></select></label>
          <label>Filière<select value={filters.filiereId} onChange={(event) => set("filiereId", event.target.value)}><option value="">Toutes</option>{shownPrograms.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
          <label>Niveau<select value={filters.niveau} onChange={(event) => set("niveau", event.target.value)}><option value="">Tous</option>{levels.active.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}</select></label>
          <label>Classe<select value={filters.classeId} disabled={!yearId} title={yearId ? undefined : "Choisissez d'abord une année"} onChange={(event) => set("classeId", event.target.value)}><option value="">Toutes</option>{(classes.data?.classes ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}<option value="aucune">Sans classe</option></select></label>
          <label>Statut<select value={filters.statut} onChange={(event) => set("statut", event.target.value)}><option value="">En cours et complètes</option><option value="EN_COURS">En cours</option><option value="COMPLETE">Complètes</option><option value="ABANDONNEE">Abandonnées</option></select></label>
          <label>Bourse<select value={filters.bourse} onChange={(event) => set("bourse", event.target.value)}><option value="">Tous</option><option value="OUI">Boursiers</option><option value="NON">Non boursiers</option>{scholarshipTypes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
          <label>Matricule<select value={filters.matricule} onChange={(event) => set("matricule", event.target.value)}><option value="">Tous</option><option value="AVEC">Avec matricule</option><option value="SANS">Sans matricule</option></select></label>
          <label>Frais d&apos;inscription<select value={filters.fraisInscription} onChange={(event) => set("fraisInscription", event.target.value)}><option value="">Tous</option><option value="PAYES">Payés</option><option value="NON_PAYES">Non payés</option></select></label>
          <label>Regrouper<select value={group} onChange={(event) => setGroup(event.target.value)}>{GROUPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <fieldset className="students-list-columns">
          <legend>Colonnes</legend>
          {COLUMNS.map((column) => (
            <label key={column.key}><input type="checkbox" checked={columns.has(column.key)} onChange={(event) => setColumns((current) => { const next = new Set(current); if (event.target.checked) next.add(column.key); else next.delete(column.key); return next; })} />{column.label}</label>
          ))}
        </fieldset>
        {list.error && <p className="form-error">{list.error}</p>}
        {list.data && <p className="panel-subtitle">{rows.length} étudiant(s) · {filterLabels.join(" · ")}</p>}
        <div className="table-wrap students-list-preview"><table>
          <thead><tr><th>N°</th><th>Nom et prénom</th>{chosen.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {(() => {
              let index = 0;
              return sections.flatMap((section) => [
                ...(section.label ? [<tr key={`g-${section.label}`} className="tariff-pole-row"><td colSpan={chosen.length + 2}>{section.label} · {section.items.length} étudiant(s)</td></tr>] : []),
                ...section.items.map((item) => <tr key={item.id}><td>{++index}</td><td className="strong-cell">{item.personne.nom} {item.personne.prenom}</td>{chosen.map((column) => <td key={column.key}>{column.value(item)}</td>)}</tr>),
              ]);
            })()}
            {!list.data && !list.error && <Empty columns={chosen.length + 2} loading />}
            {list.data && !rows.length && <Empty columns={chosen.length + 2}>Aucun étudiant avec ces filtres.</Empty>}
          </tbody>
        </table></div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => setFilters(empty)}>Effacer les filtres</button>
          <button type="button" className="secondary-button" disabled={!rows.length} onClick={downloadCsv}>Télécharger pour Excel</button>
          <button type="button" className="primary-button compact" disabled={busy || !rows.length} onClick={() => void download()}>{busy ? "Génération..." : "Télécharger le PDF"}</button>
        </div>
      </div>
    </Modal>
  );
}
