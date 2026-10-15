"use client";

import { FormEvent, useState } from "react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { queryParam } from "@/lib/routes";
import { monthLabel } from "@/lib/pdf-docs";
import { User, formatDate, formatMoney } from "@/lib/types";
import { Clock, ClipboardCheck, Users } from "lucide-react";
import { StaffAttendance, TeacherAttendance } from "@/components/attendance-pages";
import { Badge, Empty, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, Tabs, messageOf, personName, send, today, useAction, useForm, useLoad, useHubSection } from "@/components/ui-kit";

export const EMPLOYEE_CATEGORIES: Record<string, string> = {
  ENSEIGNANT_PERMANENT: "Enseignant permanent",
  ENSEIGNANT_VACATAIRE: "Enseignant vacataire",
  ADMINISTRATIF: "Personnel administratif",
  TECHNIQUE: "Personnel technique",
};
const CONTRACT_TYPES: Record<string, string> = { CDI: "CDI", CDD: "CDD", VACATION: "Vacation", STAGE: "Stage" };
const LEAVE_TYPES: Record<string, string> = { ANNUEL: "Congé annuel", MALADIE: "Maladie", MATERNITE: "Maternité", PERMISSION: "Permission", SANS_SOLDE: "Sans solde" };
const LEAVE_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" | "off" }> = {
  DEMANDE: { label: "En attente", tone: "wait" },
  APPROUVE: { label: "Approuvé", tone: "ok" },
  REFUSE: { label: "Refusé", tone: "bad" },
  ANNULE: { label: "Annulé", tone: "off" },
};
export const PAYMENT_MODES: Record<string, string> = { ESPECES: "Espèces", VIREMENT: "Virement bancaire", MOBILE_MONEY: "Mobile money" };
// Rythme de paiement des heures d'un enseignant payé à la séance.
export const PAY_RHYTHMS: Record<string, string> = { MENSUEL: "Chaque mois", BIMESTRIEL: "Tous les 2 mois", TRIMESTRIEL: "Tous les 3 mois", SEMESTRIEL: "Par semestre (à la demande)" };
const SESSION_LENGTHS: Array<[string, string]> = [["60", "1 h"], ["90", "1 h 30"], ["120", "2 h"], ["150", "2 h 30"], ["180", "3 h"], ["240", "4 h"]];
const lengthLabel = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")}` : ""}`;

type Contract = { id: string; type: string; dateDebut: string; dateFin?: string | null; salaireBase: string; tauxHoraire: string; tarifMontant: string; tarifMinutes: number; periodicitePaie: string; statut: string; motifFin?: string | null };
// La rémunération telle qu'elle a été convenue : « 2 400 F pour 1 h 30 » ou un salaire mensuel.
const payLabel = (contract: Contract) =>
  Number(contract.tauxHoraire) > 0
    ? Number(contract.tarifMontant) > 0
      ? `${formatMoney(contract.tarifMontant)} pour ${lengthLabel(contract.tarifMinutes)}`
      : `${formatMoney(contract.tauxHoraire)} / heure`
    : `${formatMoney(contract.salaireBase)} / mois`;
type Leave = { id: string; type: string; dateDebut: string; dateFin: string; jours: number; motif?: string | null; statut: string; demandeParNom: string; decideParNom?: string | null; commentaireDecision?: string | null; employe?: EmployeeRow };
type EmployeeRow = { id: string; matricule: string; nom: string; prenom: string; categorie: string; fonction: string; service?: string | null; statut: string; telephone?: string | null; contrats?: Contract[] };
type Rubric = { id: string; code: string; libelle: string; type: string; mode: string; valeur: string; appliqueATous: boolean; actif: boolean };
type Employee = EmployeeRow & {
  sexe?: string | null;
  dateNaissance?: string | null;
  email?: string | null;
  adresse?: string | null;
  dateEmbauche: string;
  dateSortie?: string | null;
  motifSortie?: string | null;
  numeroCnss?: string | null;
  modePaiement: string;
  coordonneesPaiement?: string | null;
  utilisateurId?: string | null;
  utilisateur?: { id: string; nom: string; prenom?: string | null; email: string } | null;
  contrats: Contract[];
  conges: Leave[];
  absences: Array<{ id: string; date: string; jours: string; justifiee: boolean; motif?: string | null; saisieParNom: string }>;
  rubriques: Array<{ rubriqueId: string; valeur: string; rubrique: Rubric }>;
  bulletins: Array<{ id: string; numero: string; net: string; brut: string; periode: { annee: number; mois: number; statut: string } }>;
  cours: Array<{ id: string; matiere: { nom: string }; classe: { niveau: string; groupe: string; filiere: { code: string } }; creneaux?: Array<{ heureDebut: string; heureFin: string }> }>;
  soldeConges: { acquis: number; pris: number; enAttente: number; disponible: number };
};
type Dashboard = { effectif: number; parCategorie: Array<{ categorie: string; total: number }>; contratsExpirant: Array<Contract & { employe: EmployeeRow }>; congesEnAttente: number; enConge: Array<{ id: string; dateFin: string; employe: EmployeeRow }>; sansContrat: number };
type ArchivedDocument = { id: string; categorie: string; nom: string; url: string; ajouteParNom: string; date: string };

// ---------- Pièces numérisées d'un dossier ----------

export function DocumentsPanel({ target, id, canEdit, suggestions }: { target: "PERSONNE" | "DEMANDE_BOURSE" | "INSCRIPTION" | "EMPLOYE"; id: string; canEdit: boolean; suggestions?: string[] }) {
  const documents = useLoad<ArchivedDocument[]>(`/documents/${target}/${id}`);
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const action = useAction();
  const upload = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    void action.run(async () => {
      const form = new FormData();
      form.append("categorie", category);
      form.append("fichier", file);
      documents.setData(await apiFetch<ArchivedDocument[]>(`/documents/${target}/${id}`, { method: "POST", body: form, silent: true }));
      setCategory("");
      setFile(null);
      setInputKey((current) => current + 1);
      toast("Pièce archivée.");
    });
  };
  const remove = async (document: ArchivedDocument) => {
    const motif = await askReason({ title: `Retirer « ${document.categorie} »`, message: "Le fichier sera retiré du dossier. Le motif est conservé dans le journal d'audit.", confirmLabel: "Retirer", danger: true, reason: { label: "Motif du retrait", minLength: 5 } });
    if (!motif) return;
    void action.run(async () => documents.setData(await send<ArchivedDocument[]>(`/documents/${document.id}`, "DELETE", { motif }, true)));
  };
  return (
    <div className="documents-panel">
      {canEdit && (
        <form className="finance-inline-form" onSubmit={upload}>
          <input required minLength={2} list={`document-kinds-${target}`} placeholder="Nature de la pièce" aria-label="Nature de la pièce" value={category} onChange={(event) => setCategory(event.target.value)} />
          <datalist id={`document-kinds-${target}`}>{(suggestions ?? []).map((item) => <option key={item} value={item} />)}</datalist>
          <input key={inputKey} required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Fichier numérisé" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="outline-button small" disabled={action.busy}>{action.busy ? "Envoi..." : "Archiver"}</button>
        </form>
      )}
      {(action.error || documents.error) && <p className="form-error">{action.error || documents.error}</p>}
      <ul className="expense-pieces">
        {(documents.data ?? []).map((document) => (
          <li key={document.id}>
            <span>
              <a href={document.url} target="_blank" rel="noreferrer">{document.categorie}</a>
              {canEdit && <button className="row-action danger-row-action" onClick={() => void remove(document)}>Retirer</button>}
            </span>
            <small>{document.nom} · {document.ajouteParNom} · {formatDate(document.date)}</small>
          </li>
        ))}
      </ul>
      {documents.data && !documents.data.length && <p className="panel-subtitle">Aucune pièce numérisée. PDF ou image, 10 Mo maximum.</p>}
    </div>
  );
}

// ---------- Fiche employé ----------

const emptyEmployee = { nom: "", prenom: "", sexe: "", dateNaissance: "", telephone: "", email: "", adresse: "", categorie: "ADMINISTRATIF", fonction: "", service: "", dateEmbauche: today(), numeroCnss: "", modePaiement: "ESPECES", coordonneesPaiement: "", utilisateurId: "" };

function EmployeeFields({ form, user }: { form: ReturnType<typeof useForm<typeof emptyEmployee>>; user: User | null }) {
  const users = useLoad<Array<{ id: string; nom: string; prenom?: string | null; email: string }>>(user?.role === "admin" ? "/utilisateurs" : null);
  return (
    <>
      <div className="form-grid">
        <label>Nom<input required {...form.bind("nom")} /></label>
        <label>Prénom<input required {...form.bind("prenom")} /></label>
      </div>
      <div className="form-grid">
        <label>Catégorie<select {...form.bind("categorie")}>{Object.entries(EMPLOYEE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Fonction<input required minLength={2} {...form.bind("fonction")} /></label>
      </div>
      <div className="form-grid">
        <label>Service<input {...form.bind("service")} /></label>
        <label>Date d&apos;embauche<input required type="date" {...form.bind("dateEmbauche")} /></label>
      </div>
      <div className="form-grid">
        <label>Sexe<select {...form.bind("sexe")}><option value="">Non renseigné</option><option value="F">Femme</option><option value="M">Homme</option></select></label>
        <label>Date de naissance<input type="date" {...form.bind("dateNaissance")} /></label>
      </div>
      <div className="form-grid">
        <label>Téléphone<input {...form.bind("telephone")} /></label>
        <label>E-mail<input type="email" {...form.bind("email")} /></label>
      </div>
      <label>Adresse<input {...form.bind("adresse")} /></label>
      <div className="form-grid">
        <label>N° CNSS<input {...form.bind("numeroCnss")} /></label>
        <label>Mode de paiement du salaire<select {...form.bind("modePaiement")}>{Object.entries(PAYMENT_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {form.values.modePaiement !== "ESPECES" && <label>{form.values.modePaiement === "VIREMENT" ? "Banque et numéro de compte" : "Numéro mobile money"}<input {...form.bind("coordonneesPaiement")} /></label>}
      {user?.role === "admin" && (
        <label>
          Compte de connexion lié
          <select {...form.bind("utilisateurId")}>
            <option value="">Aucun compte</option>
            {(users.data ?? []).map((item) => <option key={item.id} value={item.id}>{[item.prenom, item.nom].filter(Boolean).join(" ")} · {item.email}</option>)}
          </select>
          <small className="cell-detail">Un enseignant lié à son compte ne voit et ne renseigne que ses propres cours.</small>
        </label>
      )}
    </>
  );
}

function EmployeeModal({ id, user, canEdit, onClose, onChanged }: { id: string; user: User | null; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  type Tab = "fiche" | "contrats" | "conges" | "absences" | "paie" | "documents";
  const [tab, setTab] = useState<Tab>("fiche");
  const detail = useLoad<Employee>(`/rh/employes/${id}`);
  const rubrics = useLoad<Rubric[]>(tab === "paie" ? "/paie/rubriques" : null);
  const form = useForm(emptyEmployee);
  const [formFor, setFormFor] = useState("");
  const contract = useForm({ type: "CDI", dateDebut: today(), dateFin: "", salaireBase: "", tarifMontant: "", tarifMinutes: "60", periodicitePaie: "MENSUEL" });
  const raise = useForm({ dateEffet: today(), salaireBase: "", tarifMontant: "", tarifMinutes: "60", motif: "" });
  const [raising, setRaising] = useState<Contract | null>(null);
  const leave = useForm({ type: "ANNUEL", dateDebut: "", dateFin: "", motif: "" });
  const absence = useForm({ date: today(), jours: "1", justifiee: false as boolean, motif: "" });
  const [adding, setAdding] = useState<"contrat" | "conge" | "absence" | null>(null);
  const action = useAction();
  const employee = detail.data;
  // Le formulaire se remplit à l'arrivée de la fiche.
  if (employee && formFor !== employee.id) {
    setFormFor(employee.id);
    form.setValues({
      nom: employee.nom, prenom: employee.prenom, sexe: employee.sexe ?? "", dateNaissance: employee.dateNaissance?.slice(0, 10) ?? "", telephone: employee.telephone ?? "", email: employee.email ?? "", adresse: employee.adresse ?? "",
      categorie: employee.categorie, fonction: employee.fonction, service: employee.service ?? "", dateEmbauche: employee.dateEmbauche.slice(0, 10), numeroCnss: employee.numeroCnss ?? "", modePaiement: employee.modePaiement, coordonneesPaiement: employee.coordonneesPaiement ?? "", utilisateurId: employee.utilisateurId ?? "",
    });
  }
  const apply = (next: Employee) => { detail.setData(next); setAdding(null); setRaising(null); onChanged(); };
  const hourly = (amount: string, minutes: string) => (Number(amount) > 0 ? Math.round((Number(amount) * 60) / Number(minutes)) : 0);
  // Heures de cours par semaine d'après l'emploi du temps de l'enseignant.
  const clockMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
  const weeklyHours = (employee?.cours ?? []).reduce((total, course) => total + (course.creneaux ?? []).reduce((sum, slot) => sum + clockMinutes(slot.heureFin) - clockMinutes(slot.heureDebut), 0), 0) / 60;
  const monthlyEstimate = Math.round(hourly(contract.values.tarifMontant, contract.values.tarifMinutes) * weeklyHours * 4);
  const post = (path: string, body: unknown, done?: string) =>
    action.run(async () => {
      apply(await send<Employee>(path, "POST", body, true));
      if (done) toast(done);
    });
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    const { utilisateurId, ...fields } = form.values;
    void action.run(async () => {
      apply(await send<Employee>(`/rh/employes/${id}`, "PATCH", { ...fields, ...(user?.role === "admin" ? { utilisateurId: utilisateurId || null } : {}) }, true));
      toast("Fiche enregistrée.");
    });
  };
  const exit = async () => {
    const motif = await askReason({ title: `Sortie de ${employee ? personName(employee) : ""}`, message: "Son contrat en cours prendra fin aujourd'hui et il ne sera plus payé ensuite.", confirmLabel: "Enregistrer la sortie", danger: true, reason: { label: "Motif (démission, fin de contrat, licenciement...)", minLength: 5 } });
    if (motif) void post(`/rh/employes/${id}/sortie`, { dateSortie: today(), motif }, "Sortie enregistrée.");
  };
  const endContract = async (item: Contract) => {
    const motif = await askReason({ title: "Mettre fin au contrat", message: "Le contrat prendra fin aujourd'hui.", confirmLabel: "Terminer le contrat", danger: true, reason: { label: "Motif de fin de contrat", minLength: 5 } });
    if (motif) void post(`/rh/contrats/${item.id}/fin`, { dateFin: today(), motif });
  };
  const decide = async (item: Leave, approuve: boolean) => {
    const commentaire = approuve ? "" : await askReason({ title: "Refuser ce congé", confirmLabel: "Refuser", danger: true, reason: { label: "Motif du refus", minLength: 5 } });
    if (!approuve && !commentaire) return;
    void post(`/rh/conges/${item.id}/decision`, { approuve, commentaire });
  };
  const setRubric = (rubriqueId: string, valeur: string) => action.run(async () => apply(await send<Employee>(`/paie/employes/${id}/rubriques`, "PUT", { rubriqueId, valeur: valeur === "" ? null : valeur }, true)));
  const editable = canEdit && employee?.statut !== "SORTI";
  return (
    <Modal wide title={employee ? `${personName(employee)} · ${employee.matricule}` : "Employé"} onClose={onClose}>
      {!employee && <p className="empty-state">{detail.error || "Chargement..."}</p>}
      {employee && (
        <>
          <div className="expense-detail-head">
            <Badge tone={employee.statut === "ACTIF" ? "ok" : employee.statut === "SORTI" ? "off" : "wait"}>{employee.statut === "ACTIF" ? "En activité" : employee.statut === "SORTI" ? `Sorti le ${formatDate(employee.dateSortie ?? undefined)}` : "Suspendu"}</Badge>
            <span className="panel-subtitle">{EMPLOYEE_CATEGORIES[employee.categorie]} · {employee.fonction}</span>
            {canEdit && employee.statut !== "SORTI" && <button className="danger-button" onClick={() => void exit()}>Sortie des effectifs</button>}
            {canEdit && employee.statut === "SORTI" && <button className="row-action" onClick={() => void post(`/rh/employes/${id}/reintegration`, {}, "Employé réintégré.")}>Réintégrer</button>}
          </div>
          <Tabs label="Rubrique" value={tab} onChange={(next) => { setTab(next); setAdding(null); action.setError(""); }} tabs={[["fiche", "Fiche"], ["contrats", "Contrats"], ["conges", "Congés"], ["absences", "Absences"], ["paie", "Paie"], ["documents", "Documents"]]} />
          {action.error && <p className="form-error">{action.error}</p>}

          {tab === "fiche" && (
            <form className="entity-form" onSubmit={saveProfile}>
              <fieldset disabled={!canEdit} className="plain-fieldset">
                <EmployeeFields form={form} user={user} />
              </fieldset>
              {employee.cours.length > 0 && <p className="panel-subtitle">Cours en charge : {employee.cours.map((item) => `${item.matiere.nom} (${item.classe.filiere.code} ${item.classe.niveau})`).join(", ")}</p>}
              {canEdit && <FormActions busy={action.busy} onCancel={onClose} />}
            </form>
          )}

          {tab === "contrats" && (
            <>
              {editable && adding !== "contrat" && <div className="finance-inline-form"><button className="outline-button small" onClick={() => { contract.setValues({ ...contract.values, type: employee.categorie.startsWith("ENSEIGNANT") ? "VACATION" : "CDI" }); setRaising(null); setAdding("contrat"); }}>+ Nouveau contrat</button></div>}
              {adding === "contrat" && (
                <form className="entity-form expense-panel" onSubmit={(event) => { event.preventDefault(); const { type, dateDebut, dateFin, salaireBase, ...rate } = contract.values; void post(`/rh/employes/${id}/contrats`, type === "VACATION" ? { type, dateDebut, dateFin, ...rate } : { type, dateDebut, dateFin, salaireBase: salaireBase || 0 }, "Contrat enregistré."); }}>
                  <div className="form-grid">
                    {/* Un vacataire est payé à la séance : pas de salaire mensuel à saisir. */}
                    <label>Type<select {...contract.bind("type")}>{Object.entries(CONTRACT_TYPES).filter(([value]) => employee.categorie !== "ENSEIGNANT_VACATAIRE" || value === "VACATION").map(([value, label]) => <option key={value} value={value}>{value === "VACATION" ? "Vacation (payé à la séance)" : label}</option>)}</select></label>
                    <label>Début<input required type="date" {...contract.bind("dateDebut")} /></label>
                  </div>
                  <div className="form-grid">
                    <label>Fin{["CDD", "STAGE"].includes(contract.values.type) ? "" : " (facultatif)"}<input type="date" required={["CDD", "STAGE"].includes(contract.values.type)} min={contract.values.dateDebut} {...contract.bind("dateFin")} /></label>
                    {contract.values.type !== "VACATION" && <label>Salaire de base mensuel (F)<input required={contract.values.type !== "STAGE"} type="number" min="0" {...contract.bind("salaireBase")} /></label>}
                  </div>
                  {contract.values.type === "VACATION" && (
                    <>
                      <p className="form-section-label">Tarif convenu avec l&apos;enseignant</p>
                      <div className="form-grid">
                        <label>Montant (F)<input required type="number" min="1" placeholder="2400" {...contract.bind("tarifMontant")} /></label>
                        <label>pour une séance de<select {...contract.bind("tarifMinutes")}>{SESSION_LENGTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      </div>
                      <div className="form-grid">
                        <label>Paiement des heures<select {...contract.bind("periodicitePaie")}>{Object.entries(PAY_RHYTHMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label>Salaire mensuel estimé (calculé)
                          <input readOnly tabIndex={-1} aria-describedby="monthly-estimate-help" value={!weeklyHours ? "Aucun cours à l'emploi du temps" : monthlyEstimate ? formatMoney(monthlyEstimate) : "Saisissez le montant"} />
                          <small id="monthly-estimate-help" className="cell-detail">{weeklyHours ? `${Number(weeklyHours.toFixed(1))} h de cours par semaine à l'emploi du temps × 4 semaines. Indicatif : la paie réelle suit les séances émargées.` : "Il se calculera dès que ses cours seront placés dans l'emploi du temps."}</small>
                        </label>
                      </div>
                      <p className="panel-subtitle">{hourly(contract.values.tarifMontant, contract.values.tarifMinutes) ? `Soit ${formatMoney(hourly(contract.values.tarifMontant, contract.values.tarifMinutes))} par heure : une séance de 2 h sera payée ${formatMoney(hourly(contract.values.tarifMontant, contract.values.tarifMinutes) * 2)}. ` : ""}Seules les séances émargées sont payées. Les heures s&apos;accumulent et sont versées à l&apos;échéance choisie ; « par semestre », la RH déclenche le paiement depuis la paie.</p>
                    </>
                  )}
                  <p className="panel-subtitle">Un nouveau contrat met fin au précédent la veille de son début.</p>
                  <FormActions busy={action.busy} onCancel={() => setAdding(null)} />
                </form>
              )}
              {raising && (
                <form className="entity-form expense-panel" onSubmit={(event) => { event.preventDefault(); void post(`/rh/contrats/${raising.id}/augmentation`, Number(raising.tauxHoraire) > 0 ? { dateEffet: raise.values.dateEffet, tarifMontant: raise.values.tarifMontant, tarifMinutes: raise.values.tarifMinutes, motif: raise.values.motif } : { dateEffet: raise.values.dateEffet, salaireBase: raise.values.salaireBase, motif: raise.values.motif }, "Nouvelle rémunération enregistrée."); }}>
                  <p className="form-section-label">Augmentation · actuellement {payLabel(raising)}</p>
                  {Number(raising.tauxHoraire) > 0 ? (
                    <div className="form-grid">
                      <label>Nouveau montant (F)<input required type="number" min="1" {...raise.bind("tarifMontant")} /></label>
                      <label>pour une séance de<select {...raise.bind("tarifMinutes")}>{SESSION_LENGTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    </div>
                  ) : (
                    <label>Nouveau salaire de base mensuel (F)<input required type="number" min="1" {...raise.bind("salaireBase")} /></label>
                  )}
                  <div className="form-grid">
                    <label>Date d&apos;effet<input required type="date" min={raising.dateDebut.slice(0, 10)} {...raise.bind("dateEffet")} /></label>
                    <label>Motif<input required minLength={5} placeholder="Ancienneté, promotion, renégociation..." {...raise.bind("motif")} /></label>
                  </div>
                  <p className="panel-subtitle">L&apos;ancienne rémunération reste dans l&apos;historique et s&apos;applique jusqu&apos;à la veille de la date d&apos;effet. Une prime ponctuelle se saisit plutôt dans la paie du mois (« Variables »), une prime régulière dans l&apos;onglet « Paie ».</p>
                  <FormActions busy={action.busy} label="Appliquer" onCancel={() => setRaising(null)} />
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>Période</th><th>Rémunération</th><th>État</th><th /></tr></thead>
                  <tbody>
                    {employee.contrats.map((item) => (
                      <tr key={item.id}>
                        <td className="strong-cell">{CONTRACT_TYPES[item.type]}</td>
                        <td>{formatDate(item.dateDebut)} → {item.dateFin ? formatDate(item.dateFin) : "sans terme"}</td>
                        <td>{payLabel(item)}{Number(item.tauxHoraire) > 0 && <small className="cell-detail">{PAY_RHYTHMS[item.periodicitePaie] ?? item.periodicitePaie}</small>}</td>
                        <td><Badge tone={item.statut === "ACTIF" ? "ok" : "off"}>{item.statut === "ACTIF" ? "En cours" : "Terminé"}</Badge>{item.motifFin && <small className="cell-detail">{item.motifFin}</small>}</td>
                        <td className="action-group">{editable && item.statut === "ACTIF" && <><button className="row-action" onClick={() => { action.setError(""); raise.setValues({ dateEffet: today(), salaireBase: Number(item.salaireBase) ? String(Number(item.salaireBase)) : "", tarifMontant: Number(item.tarifMontant) ? String(Number(item.tarifMontant)) : "", tarifMinutes: String(item.tarifMinutes), motif: "" }); setAdding(null); setRaising(item); }}>Augmentation</button><button className="row-action danger-row-action" onClick={() => void endContract(item)}>Terminer</button></>}</td>
                      </tr>
                    ))}
                    {!employee.contrats.length && <Empty columns={5}>Aucun contrat : sans contrat, l&apos;employé n&apos;apparaît pas en paie.</Empty>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "conges" && (
            <>
              <dl className="expense-facts">
                <div><dt>Acquis cette année</dt><dd>{employee.soldeConges.acquis} j</dd></div>
                <div><dt>Pris</dt><dd>{employee.soldeConges.pris} j</dd></div>
                <div><dt>En attente</dt><dd>{employee.soldeConges.enAttente} j</dd></div>
                <div><dt>Disponible</dt><dd>{employee.soldeConges.disponible} j</dd></div>
              </dl>
              {editable && adding !== "conge" && <div className="finance-inline-form"><button className="outline-button small" onClick={() => setAdding("conge")}>+ Demande de congé</button></div>}
              {adding === "conge" && (
                <form className="entity-form expense-panel" onSubmit={(event) => { event.preventDefault(); void post(`/rh/employes/${id}/conges`, leave.values, "Demande enregistrée."); }}>
                  <label>Type<select {...leave.bind("type")}>{Object.entries(LEAVE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <div className="form-grid">
                    <label>Du<input required type="date" {...leave.bind("dateDebut")} /></label>
                    <label>au<input required type="date" min={leave.values.dateDebut} {...leave.bind("dateFin")} /></label>
                  </div>
                  <label>Motif{leave.values.type === "ANNUEL" ? " (facultatif)" : ""}<input required={leave.values.type !== "ANNUEL"} {...leave.bind("motif")} /></label>
                  <p className="panel-subtitle">Les dimanches ne sont pas décomptés. Un congé sans solde est retenu sur la paie du mois.</p>
                  <FormActions busy={action.busy} label="Demander" onCancel={() => setAdding(null)} />
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>Période</th><th>Jours</th><th>État</th><th /></tr></thead>
                  <tbody>
                    {employee.conges.map((item) => (
                      <tr key={item.id}>
                        <td className="strong-cell">{LEAVE_TYPES[item.type]}{item.motif && <small className="cell-detail">{item.motif}</small>}</td>
                        <td>{formatDate(item.dateDebut)} → {formatDate(item.dateFin)}</td>
                        <td>{item.jours}</td>
                        <td><Badge tone={LEAVE_STATUS[item.statut].tone}>{LEAVE_STATUS[item.statut].label}</Badge>{item.decideParNom && <small className="cell-detail">{item.decideParNom}{item.commentaireDecision ? ` · ${item.commentaireDecision}` : ""}</small>}</td>
                        <td className="action-group">
                          {canEdit && item.statut === "DEMANDE" && <button className="row-action" onClick={() => void decide(item, true)}>Approuver</button>}
                          {canEdit && item.statut === "DEMANDE" && <button className="row-action danger-row-action" onClick={() => void decide(item, false)}>Refuser</button>}
                          {canEdit && ["DEMANDE", "APPROUVE"].includes(item.statut) && <button className="row-action" onClick={() => void post(`/rh/conges/${item.id}/annulation`, {})}>Annuler</button>}
                        </td>
                      </tr>
                    ))}
                    {!employee.conges.length && <Empty columns={5}>Aucun congé.</Empty>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "absences" && (
            <>
              {editable && adding !== "absence" && <div className="finance-inline-form"><button className="outline-button small" onClick={() => setAdding("absence")}>+ Constater une absence</button></div>}
              {adding === "absence" && (
                <form className="entity-form expense-panel" onSubmit={(event) => { event.preventDefault(); void post(`/rh/employes/${id}/absences`, absence.values, "Absence enregistrée."); }}>
                  <div className="form-grid">
                    <label>Date<input required type="date" max={today()} {...absence.bind("date")} /></label>
                    <label>Durée (jours)<input required type="number" min="0.5" max="31" step="0.5" {...absence.bind("jours")} /></label>
                  </div>
                  <label className="check-row"><input type="checkbox" {...absence.check("justifiee")} /><span>Absence justifiée<small>Une absence non justifiée est retenue sur le salaire du mois.</small></span></label>
                  <label>{absence.values.justifiee ? "Justificatif" : "Observation (facultatif)"}<input required={absence.values.justifiee} {...absence.bind("motif")} /></label>
                  <FormActions busy={action.busy} onCancel={() => setAdding(null)} />
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Durée</th><th>Nature</th><th>Saisie par</th><th /></tr></thead>
                  <tbody>
                    {employee.absences.map((item) => (
                      <tr key={item.id}>
                        <td className="strong-cell">{formatDate(item.date)}</td>
                        <td>{Number(item.jours)} j</td>
                        <td><Badge tone={item.justifiee ? "ok" : "bad"}>{item.justifiee ? "Justifiée" : "Non justifiée"}</Badge>{item.motif && <small className="cell-detail">{item.motif}</small>}</td>
                        <td>{item.saisieParNom}</td>
                        <td>{canEdit && <button className="row-action danger-row-action" onClick={() => void action.run(async () => apply(await send<Employee>(`/rh/absences/${item.id}`, "DELETE", undefined, true)))}>Supprimer</button>}</td>
                      </tr>
                    ))}
                    {!employee.absences.length && <Empty columns={5}>Aucune absence constatée.</Empty>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "paie" && (
            <>
              <p className="form-section-label">Éléments de paie propres à cet employé</p>
              <p className="panel-subtitle">Renseignez une valeur pour lui attribuer une prime fixe ou un taux particulier. Vide : la règle générale s&apos;applique.</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Rubrique</th><th>Règle générale</th><th>Valeur pour cet employé</th></tr></thead>
                  <tbody>
                    {(rubrics.data ?? []).filter((rubric) => rubric.actif).map((rubric) => {
                      const own = employee.rubriques.find((item) => item.rubriqueId === rubric.id);
                      return (
                        <tr key={rubric.id}>
                          <td className="strong-cell">{rubric.libelle}<small className="cell-detail">{rubric.type === "GAIN" ? "Gain" : rubric.type === "RETENUE" ? "Retenue" : "Charge patronale"}</small></td>
                          <td>{rubric.mode === "VARIABLE" ? "Saisie chaque mois" : rubric.mode === "FIXE" ? formatMoney(rubric.valeur) : `${Number(rubric.valeur)} %`}{rubric.appliqueATous ? " · pour tous" : " · sur attribution"}</td>
                          <td><input className="expense-select" type="number" min="0" step="0.01" disabled={!canEdit} aria-label={`Valeur de ${rubric.libelle}`} defaultValue={own ? Number(own.valeur) : ""} key={`${rubric.id}:${own?.valeur ?? ""}`} onBlur={(event) => { if (event.target.value !== (own ? String(Number(own.valeur)) : "")) void setRubric(rubric.id, event.target.value); }} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="form-section-label">Derniers bulletins</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Mois</th><th>Bulletin</th><th>Brut</th><th>Net</th></tr></thead>
                  <tbody>
                    {employee.bulletins.map((item) => (
                      <tr key={item.id}><td className="strong-cell">{monthLabel(item.periode.annee, item.periode.mois)}</td><td>{item.numero}</td><td>{formatMoney(item.brut)}</td><td>{formatMoney(item.net)}</td></tr>
                    ))}
                    {!employee.bulletins.length && <Empty columns={4}>Aucun bulletin.</Empty>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "documents" && <DocumentsPanel target="EMPLOYE" id={id} canEdit={canEdit} suggestions={["Contrat signé", "Pièce d'identité", "Diplôme", "CV", "Attestation CNSS", "Relevé d'identité bancaire", "Certificat médical"]} />}
        </>
      )}
    </Modal>
  );
}

function HireModal({ user, onClose, onCreated }: { user: User | null; onClose: () => void; onCreated: (id: string) => void }) {
  const candidates = useLoad<{ data: Array<{ id: string; nom: string; prenom: string; fonction: string; dateNaissance?: string | null }> }>("/candidatures-personnel?statut=RETENU&limit=100");
  const form = useForm(emptyEmployee);
  const [candidateId, setCandidateId] = useState("");
  const action = useAction();
  const pick = (id: string) => {
    setCandidateId(id);
    const candidate = candidates.data?.data.find((item) => item.id === id);
    if (candidate) form.setValues({ ...form.values, nom: candidate.nom, prenom: candidate.prenom, fonction: candidate.fonction, dateNaissance: candidate.dateNaissance?.slice(0, 10) ?? "" });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const { utilisateurId, ...fields } = form.values;
    void action.run(async () => {
      const created = await send<{ id: string; matricule: string }>("/rh/employes", "POST", { ...fields, candidatureId: candidateId || null }, true);
      if (utilisateurId) await send(`/rh/employes/${created.id}`, "PATCH", { utilisateurId }, true).catch((failure) => toast(messageOf(failure), "error"));
      toast(`Employé ${created.matricule} créé. Établissez maintenant son contrat.`);
      onCreated(created.id);
    });
  };
  return (
    <Modal wide title="Nouvel employé" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {Boolean(candidates.data?.data.length) && (
          <label>
            Embaucher un candidat retenu au recrutement
            <select value={candidateId} onChange={(event) => pick(event.target.value)}>
              <option value="">Saisie libre</option>
              {candidates.data?.data.map((item) => <option key={item.id} value={item.id}>{item.nom} {item.prenom} · {item.fonction}</option>)}
            </select>
          </label>
        )}
        <EmployeeFields form={form} user={user} />
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label="Créer l'employé" onCancel={onClose} />
      </form>
    </Modal>
  );
}

export function HrPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "hr", "edit");
  type Section = "dossiers" | "pointage" | "emargement";
  const [section, setSection] = useHubSection<Section>(["dossiers", "pointage", "emargement"]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("ACTIF");
  const [openId, setOpenId] = useState<string | null>(() => queryParam("employe"));
  const [hiring, setHiring] = useState(false);
  const dashboard = useLoad<Dashboard>("/rh/tableau-de-bord", refreshSignal);
  const pending = useLoad<Leave[]>("/rh/conges/en-attente", refreshSignal);
  const employees = useLoad<{ data: EmployeeRow[]; meta: { total: number } }>(`/rh/employes?limit=200${category ? `&categorie=${category}` : ""}${status ? `&statut=${status}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`, refreshSignal);
  const action = useAction();
  const reload = () => { dashboard.reload(); pending.reload(); employees.reload(); };
  const decide = async (item: Leave, approuve: boolean) => {
    const commentaire = approuve ? "" : await askReason({ title: "Refuser ce congé", confirmLabel: "Refuser", danger: true, reason: { label: "Motif du refus", minLength: 5 } });
    if (!approuve && !commentaire) return;
    if (approuve && !(await askConfirm({ title: `Approuver ${item.jours} jour(s) de ${LEAVE_TYPES[item.type].toLowerCase()} ?`, confirmLabel: "Approuver" }))) return;
    void action.run(async () => { await send(`/rh/conges/${item.id}/decision`, "POST", { approuve, commentaire }); reload(); });
  };
  const board = dashboard.data;
  const teachers = board?.parCategorie.filter((item) => item.categorie.startsWith("ENSEIGNANT")).reduce((total, item) => total + item.total, 0) ?? 0;
  const cards: HubCard<Section>[] = [
    { key: "dossiers", icon: Users, title: "Dossiers du personnel", value: board ? `${board.effectif}` : "…", detail: "employé(s) en activité · contrats, congés, absences", tone: board?.sansContrat ? "warn" : undefined, info: "La fiche de chaque employé : identité, contrats et rémunération (salaire mensuel ou tarif à la séance), augmentations, congés, absences, primes et pièces numérisées." },
    { key: "pointage", icon: Clock, title: "Pointage du personnel", value: board ? `${board.effectif - teachers}` : "…", detail: "administratif(s) et technique(s) · arrivée et départ", info: "Chaque jour, l'heure d'arrivée et l'heure de départ du personnel administratif et technique. Les retards sont signalés ; une absence non justifiée est retenue sur la paie." },
    { key: "emargement", icon: ClipboardCheck, title: "Émargement des enseignants", value: board ? `${teachers}` : "…", detail: "enseignant(s) · présence par créneau de cours", info: "Pour chaque créneau de l'emploi du temps du jour : l'enseignant est-il venu ? Une séance émargée compte pour la paie d'un enseignant rémunéré à la séance." },
  ];
  const titles: Record<Section, string> = { dossiers: "Dossiers du personnel", pointage: "Pointage du personnel", emargement: "Émargement des enseignants" };
  if (section === "pointage" || section === "emargement")
    return (
      <div className="content-scroll">
        <HubBack label="Personnel" onBack={() => setSection(null)} />
        <PageIntro eyebrow="Ressources humaines" title={titles[section]} text={section === "pointage" ? "L'heure d'arrivée et de départ du personnel administratif et technique, jour après jour." : "La présence des enseignants, créneau par créneau, d'après l'emploi du temps."} />
        {section === "pointage" ? <StaffAttendance canEdit={canEdit} /> : <TeacherAttendance canEdit={canEdit || hasAccess(user, "teaching", "edit")} />}
      </div>
    );
  return (
    <div className="content-scroll">
      {section && <HubBack label="Personnel" onBack={() => setSection(null)} />}
      <PageIntro eyebrow="Ressources humaines" title={section ? titles[section] : "Personnel"} text="Dossiers du personnel, contrats, congés et absences. Ces données alimentent directement la paie.">
        {canEdit && <button className="primary-button compact" onClick={() => setHiring(true)}>+ Nouvel employé</button>}
      </PageIntro>
      {(dashboard.error || action.error) && <p className="form-error">{dashboard.error || action.error}</p>}
      {!section && <HubCards cards={cards} onOpen={setSection} />}
      {board && (
        <div className="stats-grid">
          <article className="stat-card blue"><span>Effectif en activité</span><strong>{board.effectif}</strong><p>{board.parCategorie.map((item) => `${item.total} ${EMPLOYEE_CATEGORIES[item.categorie]?.toLowerCase() ?? item.categorie}`).join(" · ") || "Aucun employé"}</p></article>
          <article className={`stat-card ${board.congesEnAttente ? "orange" : "mint"}`}><span>Congés à décider</span><strong>{board.congesEnAttente}</strong><p>{board.enConge.length} personne(s) en congé aujourd&apos;hui</p></article>
          <article className={`stat-card ${board.contratsExpirant.length || board.sansContrat ? "orange" : "mint"}`}><span>Contrats à suivre</span><strong>{board.contratsExpirant.length + board.sansContrat}</strong><p>{board.contratsExpirant.length} se termine(nt) sous 30 jours · {board.sansContrat} employé(s) sans contrat</p></article>
        </div>
      )}
      {Boolean(pending.data?.length) && (
        <Panel eyebrow="À décider" title={`${pending.data?.length} demande(s) de congé`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employé</th><th>Congé</th><th>Période</th><th>Demandé par</th><th /></tr></thead>
              <tbody>
                {pending.data?.map((item) => (
                  <tr key={item.id}>
                    <td className="strong-cell">{item.employe ? personName(item.employe) : "—"}</td>
                    <td>{LEAVE_TYPES[item.type]} · {item.jours} j{item.motif && <small className="cell-detail">{item.motif}</small>}</td>
                    <td>{formatDate(item.dateDebut)} → {formatDate(item.dateFin)}</td>
                    <td>{item.demandeParNom}</td>
                    <td className="action-group">{canEdit && <><button className="row-action" onClick={() => void decide(item, true)}>Approuver</button><button className="row-action danger-row-action" onClick={() => void decide(item, false)}>Refuser</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {Boolean(board?.contratsExpirant.length) && (
        <Panel eyebrow="Échéances" title="Contrats qui se terminent sous 30 jours">
          <ul className="expense-pieces">
            {board?.contratsExpirant.map((item) => <li key={item.id}><button className="dossier-open-button" onClick={() => setOpenId(item.employe.id)}>{personName(item.employe)}</button><small>{CONTRACT_TYPES[item.type]} · fin le {formatDate(item.dateFin ?? undefined)}</small></li>)}
          </ul>
        </Panel>
      )}
      {section === "dossiers" && <Panel
        eyebrow="Dossiers"
        title={`${employees.data?.meta.total ?? "--"} employé(s)`}
        actions={
          <>
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); }}>
              <input aria-label="Rechercher un employé" placeholder="Nom, matricule, fonction..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="outline-button small">Rechercher</button>
            </form>
            <select aria-label="Catégorie" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Toutes les catégories</option>
              <option value="ENSEIGNANT">Tous les enseignants</option>
              {Object.entries(EMPLOYEE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ACTIF">En activité</option>
              <option value="SORTI">Sortis</option>
              <option value="">Tous</option>
            </select>
          </>
        }
      >
        {employees.error && <p className="form-error">{employees.error}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Matricule</th><th>Employé</th><th>Catégorie</th><th>Fonction</th><th>Contrat en cours</th><th /></tr></thead>
            <tbody>
              {(employees.data?.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="strong-cell">{item.matricule}</td>
                  <td><button className="dossier-open-button" onClick={() => setOpenId(item.id)}>{personName(item)}</button><small className="cell-detail">{item.telephone ?? ""}</small></td>
                  <td>{EMPLOYEE_CATEGORIES[item.categorie]}</td>
                  <td>{item.fonction}{item.service && <small className="cell-detail">{item.service}</small>}</td>
                  <td>{item.contrats?.[0] ? <>{CONTRACT_TYPES[item.contrats[0].type]}<small className="cell-detail">{payLabel(item.contrats[0])}</small></> : <Badge tone={item.statut === "SORTI" ? "off" : "bad"}>{item.statut === "SORTI" ? "Sorti" : "Sans contrat"}</Badge>}</td>
                  <td><button className="row-action" onClick={() => setOpenId(item.id)}>Ouvrir</button></td>
                </tr>
              ))}
              {!employees.data?.data.length && <Empty columns={6}>{employees.data ? "Aucun employé sur cette sélection." : "Chargement..."}</Empty>}
            </tbody>
          </table>
        </div>
        <p className="panel-subtitle">Les heures de cours émargées (ou déclarées au cahier de textes) sont reprises automatiquement en paie, au tarif convenu avec chaque enseignant.</p>
      </Panel>}
      {openId && <EmployeeModal key={openId} id={openId} user={user} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={reload} />}
      {hiring && <HireModal user={user} onClose={() => setHiring(false)} onCreated={(id) => { setHiring(false); reload(); setOpenId(id); }} />}
    </div>
  );
}
