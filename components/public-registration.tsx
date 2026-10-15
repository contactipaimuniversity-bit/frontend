"use client";

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, GraduationCap, HeartHandshake, School, UserRound } from "lucide-react";
import { API_URL } from "@/lib/connectivity";

type Fields = {
  prenom: string;
  nom: string;
  sexe: "" | "M" | "F";
  jour: string;
  mois: string;
  annee: string;
  ecole: string;
  classe: string;
  serie: string;
  serieAutre: string;
  tuteurNom: string;
  tuteurPrenom: string;
  tuteurTelephone: string;
  filiereSouhaitee: string;
  telephone: string;
  // Champ invisible : un humain ne le remplit jamais.
  site: string;
};
type Options = { classes: string[] };
type Errors = Partial<Record<keyof Fields | "naissance", string>>;

const EMPTY: Fields = { prenom: "", nom: "", sexe: "", jour: "", mois: "", annee: "", ecole: "", classe: "", serie: "", serieAutre: "", tuteurNom: "", tuteurPrenom: "", tuteurTelephone: "", filiereSouhaitee: "", telephone: "", site: "" };
const DEFAULT_OPTIONS: Options = { classes: ["Terminale", "Première", "Seconde", "Autre"] };
const SERIES = ["A", "C", "D", "E", "F1", "F2", "F3", "F4", "G", "H1", "H2", "H3", "H4", "H5", "R", "BG", "Autre"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DRAFT_KEY = "ipaim-enregistrement";
const NAME = /^[\p{L}][\p{L}\s'’.-]*$/u;
const LABEL = /^[\p{L}\p{N}][\p{L}\p{N}\s'’.,()/&°-]*$/u;
const PHONE = /^\+?\d{8,15}$/;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const digits = (value: string) => value.replace(/[\s().-]/g, "");
const birthDate = (fields: Fields) => (fields.jour && fields.mois && fields.annee ? `${fields.annee}-${fields.mois.padStart(2, "0")}-${fields.jour.padStart(2, "0")}` : "");

// Ce qui manque ou cloche à une étape ; un objet vide laisse passer à la suivante.
function check(step: number, fields: Fields): Errors {
  const errors: Errors = {};
  const name = (key: "prenom" | "nom" | "tuteurNom" | "tuteurPrenom", label: string) => {
    const value = clean(fields[key]);
    if (value.length < 2) errors[key] = `${label} : au moins 2 lettres.`;
    else if (value.length > 60 || !NAME.test(value)) errors[key] = `${label} : des lettres uniquement.`;
  };
  if (step === 1) {
    name("prenom", "Ton prénom");
    name("nom", "Ton nom");
    if (!fields.sexe) errors.sexe = "Choisis l'une des deux réponses.";
    const date = birthDate(fields);
    const parsed = new Date(date);
    if (!date) errors.naissance = "Indique le jour, le mois et l'année.";
    else if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== Number(fields.jour)) errors.naissance = "Cette date n'existe pas.";
  }
  if (step === 2) {
    const school = clean(fields.ecole);
    if (school.length < 2) errors.ecole = "Indique le nom de ton établissement.";
    else if (school.length > 120 || !LABEL.test(school)) errors.ecole = "Ce nom contient des caractères non autorisés.";
    if (!fields.classe) errors.classe = "Choisis ta classe.";
    const series = fields.serie === "Autre" ? clean(fields.serieAutre) : fields.serie;
    if (!series) errors.serie = fields.serie === "Autre" ? "Précise ta série." : "Choisis ta série.";
    else if (series.length > 30 || !LABEL.test(series)) errors.serie = "Cette série contient des caractères non autorisés.";
  }
  if (step === 3) {
    name("tuteurPrenom", "Son prénom");
    name("tuteurNom", "Son nom");
    if (!PHONE.test(digits(fields.tuteurTelephone))) errors.tuteurTelephone = "Un numéro de 8 à 15 chiffres.";
  }
  if (step === 4) {
    const wish = clean(fields.filiereSouhaitee);
    if (wish.length < 2) errors.filiereSouhaitee = "Écris la filière que tu aimerais faire.";
    else if (!LABEL.test(wish)) errors.filiereSouhaitee = "Cette filière contient des caractères non autorisés.";
    if (fields.telephone.trim() && !PHONE.test(digits(fields.telephone))) errors.telephone = "Un numéro de 8 à 15 chiffres, ou laisse vide.";
  }
  return errors;
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={`reg-field ${error ? "invalid" : ""}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="reg-error" role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Choices({ label, values, value, onChange, error, wide }: { label: string; values: string[]; value: string; onChange: (value: string) => void; error?: string; wide?: boolean }) {
  return (
    <fieldset className={`reg-field ${error ? "invalid" : ""}`}>
      <legend>{label}</legend>
      <div className={`reg-chips ${wide ? "wide" : ""}`}>
        {values.map((item) => (
          <button type="button" key={item} className={value === item ? "selected" : ""} aria-pressed={value === item} onClick={() => onChange(item)}>
            {value === item && <Check size={16} aria-hidden="true" />}
            {item}
          </button>
        ))}
      </div>
      {error && <small className="reg-error" role="alert">{error}</small>}
    </fieldset>
  );
}

// Formulaire public des lycéens : quatre courtes étapes sur une page sobre et
// stable (en-tête fixe, colonne centrée), pensée d'abord pour le téléphone.
export function PublicRegistration() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  // 0 accueil · 1 à 4 étapes · 5 récapitulatif · 6 merci
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const [restored, setRestored] = useState(false);
  const card = useRef<HTMLElement>(null);
  // Téléphone qui affiche la page « comme un ordinateur » (mode « version pour
  // ordinateur » du navigateur) : la page est dessinée sur 980 px puis rétrécie,
  // tout paraît minuscule et le navigateur zoome au moindre champ touché. On
  // agrandit alors le formulaire pour qu'il occupe l'écran, comme en mode normal.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const phone = Math.min(window.screen.width, window.screen.height) < 700;
      setScale(touch && phone && window.innerWidth >= 720 ? window.innerWidth / 400 : 1);
    };
    const timer = window.setTimeout(fit, 0);
    window.addEventListener("resize", fit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", fit);
    };
  }, []);

  // Une saisie interrompue (appel, changement d'application) se retrouve au retour.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(DRAFT_KEY);
        if (saved) setFields({ ...EMPTY, ...(JSON.parse(saved) as Partial<Fields>), site: "" });
      } catch {
        // Stockage indisponible : le formulaire fonctionne quand même.
      }
      setRestored(true);
    }, 0);
    void fetch(`${API_URL}/enregistrements/options`)
      .then((response) => (response.ok ? (response.json() as Promise<Options>) : null))
      .then((loaded) => { if (loaded?.classes?.length) setOptions(loaded); })
      .catch(() => undefined);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!restored || step === 6) return;
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fields)); } catch { /* Stockage indisponible. */ }
  }, [fields, restored, step]);
  // À chaque étape, la carte revient en haut et le premier champ est prêt.
  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    // Le premier champ n'est préparé qu'avec une souris. Sur un écran tactile,
    // y placer le curseur fait zoomer le téléphone sur le champ : la page
    // « grossit » d'un coup, surtout s'il affiche le site en mode ordinateur.
    if (step >= 1 && step <= 4 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) card.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, [step]);

  const set = (patch: Partial<Fields>) => {
    setFields((current) => ({ ...current, ...patch }));
    // L'erreur d'un champ disparaît dès qu'on le corrige.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof Fields];
      if ("jour" in patch || "mois" in patch || "annee" in patch) delete next.naissance;
      if ("serieAutre" in patch) delete next.serie;
      return next;
    });
  };
  const go = (next: number) => {
    setFailure("");
    setStep(next);
  };
  const forward = (event?: FormEvent) => {
    event?.preventDefault();
    if (step >= 1 && step <= 4) {
      const found = check(step, fields);
      setErrors(found);
      if (Object.keys(found).length) {
        // Le premier champ en erreur est amené à l'écran.
        window.requestAnimationFrame(() => card.current?.querySelector(".invalid")?.scrollIntoView({ block: "center", behavior: "smooth" }));
        return;
      }
    }
    go(step + 1);
  };
  const submit = async () => {
    setSending(true);
    setFailure("");
    try {
      const response = await fetch(`${API_URL}/enregistrements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: clean(fields.prenom),
          nom: clean(fields.nom),
          sexe: fields.sexe,
          dateNaissance: birthDate(fields),
          ecole: clean(fields.ecole),
          classe: fields.classe,
          serie: fields.serie === "Autre" ? clean(fields.serieAutre) : fields.serie,
          tuteurNom: clean(fields.tuteurNom),
          tuteurPrenom: clean(fields.tuteurPrenom),
          tuteurTelephone: digits(fields.tuteurTelephone),
          filiereSouhaitee: clean(fields.filiereSouhaitee),
          telephone: digits(fields.telephone),
          site: fields.site,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
        throw new Error(message || "L'envoi n'a pas abouti. Réessaie dans un instant.");
      }
      try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* Stockage indisponible. */ }
      setStep(6);
    } catch (error) {
      setFailure(error instanceof TypeError ? "Pas de connexion : vérifie ton réseau puis réessaie. Tes réponses sont conservées." : error instanceof Error ? error.message : "L'envoi n'a pas abouti.");
    } finally {
      setSending(false);
    }
  };
  const restart = () => {
    setFields(EMPTY);
    setErrors({});
    go(0);
  };

  const firstName = clean(fields.prenom).split(" ")[0];
  const year = new Date().getFullYear();
  const years = Array.from({ length: 34 }, (_, index) => String(year - 12 - index));
  const series = fields.serie === "Autre" ? clean(fields.serieAutre) : fields.serie;

  return (
    <main className="reg" style={scale === 1 ? undefined : { zoom: scale, minHeight: `calc(100dvh / ${scale})` }}>
      <header className="reg-top">
        <ol className="reg-dots" aria-label={step >= 1 && step <= 4 ? `Étape ${step} sur 4` : step >= 5 ? "Les 4 étapes sont remplies" : "4 étapes"}>
          {[1, 2, 3, 4].map((item) => <li key={item} className={step >= item ? "on" : ""} aria-current={step === item ? "step" : undefined} />)}
        </ol>
        <img src="/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg" alt="IPAIM University" width={40} height={40} />
      </header>

      <section className="reg-card" ref={card} aria-live="polite">
        {step === 0 && (
          <div className="reg-hero">
            <h1>Ton avenir commence <em>ici</em>.</h1>
            <p>Tu es au lycée et l&apos;université t&apos;intéresse ? Dis-nous qui tu es : nous te tiendrons au courant des inscriptions, des bourses et des journées portes ouvertes.</p>
            <ul className="reg-promises">
              <li><Check size={16} aria-hidden="true" /> 4 petites étapes, 2 minutes</li>
              <li><Check size={16} aria-hidden="true" /> Gratuit et sans engagement</li>
              <li><Check size={16} aria-hidden="true" /> Tes informations restent à l&apos;université</li>
            </ul>
            <button type="button" className="reg-primary" onClick={() => go(1)}>Commencer</button>
          </div>
        )}

        {step >= 1 && step <= 4 && (
          <form onSubmit={forward} noValidate>
            {/* Piège à robots : hors écran et hors de la navigation au clavier. */}
            <div className="reg-trap" aria-hidden="true"><label>Site web<input tabIndex={-1} autoComplete="off" value={fields.site} onChange={(event) => set({ site: event.target.value })} /></label></div>

            {step === 1 && (
              <>
                <h2>Faisons connaissance</h2>
                <p className="reg-lead">Dis-nous comment tu t&apos;appelles. Cela ne prend que deux minutes.</p>
                <div className="reg-box">
                <Field label="Ton prénom" error={errors.prenom}><input autoComplete="given-name" autoCapitalize="words" maxLength={60} placeholder="Grâce" value={fields.prenom} onChange={(event) => set({ prenom: event.target.value })} /></Field>
                <Field label="Ton nom" error={errors.nom}><input autoComplete="family-name" autoCapitalize="characters" maxLength={60} placeholder="NGOMA" value={fields.nom} onChange={(event) => set({ nom: event.target.value })} /></Field>
                </div>
                <div className="reg-box">
                <fieldset className={`reg-field ${errors.sexe ? "invalid" : ""}`}>
                  <legend>Tu es</legend>
                  <div className="reg-duo">
                    {([["F", "Une fille"], ["M", "Un garçon"]] as const).map(([value, text]) => (
                      <button type="button" key={value} className={fields.sexe === value ? "selected" : ""} aria-pressed={fields.sexe === value} onClick={() => set({ sexe: value })}>
                        <span className="reg-duo-mark">{fields.sexe === value ? <Check size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}</span>
                        {text}
                      </button>
                    ))}
                  </div>
                  {errors.sexe && <small className="reg-error" role="alert">{errors.sexe}</small>}
                </fieldset>
                <fieldset className={`reg-field ${errors.naissance ? "invalid" : ""}`}>
                  <legend>Ta date de naissance</legend>
                  <div className="reg-date">
                    <select aria-label="Jour" autoComplete="bday-day" value={fields.jour} onChange={(event) => set({ jour: event.target.value })}><option value="">Jour</option>{Array.from({ length: 31 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select>
                    <select aria-label="Mois" autoComplete="bday-month" value={fields.mois} onChange={(event) => set({ mois: event.target.value })}><option value="">Mois</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
                    <select aria-label="Année" autoComplete="bday-year" value={fields.annee} onChange={(event) => set({ annee: event.target.value })}><option value="">Année</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </div>
                  {errors.naissance && <small className="reg-error" role="alert">{errors.naissance}</small>}
                </fieldset>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2>{firstName ? `Enchanté, ${firstName} !` : "Ton lycée"}</h2>
                <p className="reg-lead">Où étudies-tu en ce moment ?</p>
                <div className="reg-box">
                <Field label="Ton établissement" error={errors.ecole}><input autoComplete="organization" maxLength={120} placeholder="Lycée Savorgnan de Brazza" value={fields.ecole} onChange={(event) => set({ ecole: event.target.value })} /></Field>
                </div>
                <div className="reg-box">
                <Choices label="Ta classe" values={options.classes} value={fields.classe} onChange={(value) => set({ classe: value })} error={errors.classe} />
                <Choices label="Ta série" values={SERIES} value={fields.serie} onChange={(value) => set({ serie: value })} error={fields.serie === "Autre" ? undefined : errors.serie} />
                {fields.serie === "Autre" && <Field label="Précise ta série" error={errors.serie}><input maxLength={30} placeholder="G2, R1, TI..." value={fields.serieAutre} onChange={(event) => set({ serieAutre: event.target.value })} /></Field>}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Ton parent ou tuteur</h2>
                <p className="reg-lead">La personne que l&apos;université peut joindre pour toi.</p>
                <div className="reg-box">
                <Field label="Son prénom" error={errors.tuteurPrenom}><input autoCapitalize="words" maxLength={60} placeholder="Paul" value={fields.tuteurPrenom} onChange={(event) => set({ tuteurPrenom: event.target.value })} /></Field>
                <Field label="Son nom" error={errors.tuteurNom}><input autoCapitalize="characters" maxLength={60} placeholder="NGOMA" value={fields.tuteurNom} onChange={(event) => set({ tuteurNom: event.target.value })} /></Field>
                <Field label="Son numéro de téléphone" error={errors.tuteurTelephone} hint="Nous l'appellerons seulement pour te donner des nouvelles de l'université."><input type="tel" inputMode="tel" autoComplete="off" maxLength={20} placeholder="06 600 11 22" value={fields.tuteurTelephone} onChange={(event) => set({ tuteurTelephone: event.target.value })} /></Field>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2>Et après le bac{" "}?</h2>
                <p className="reg-lead">Quelle filière aimerais-tu suivre à l&apos;université ?</p>
                <div className="reg-box">
                <Field label="La filière que tu veux faire" error={errors.filiereSouhaitee} hint="Écris-la avec tes mots : informatique, génie civil, comptabilité, agronomie..."><input autoCapitalize="sentences" maxLength={120} placeholder="Rentre ta filière" value={fields.filiereSouhaitee} onChange={(event) => set({ filiereSouhaitee: event.target.value })} /></Field>
                </div>
                <div className="reg-box">
                <Field label="Ton numéro (facultatif)" error={errors.telephone} hint="Si tu en as un, pour te joindre directement."><input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="05 500 33 44" value={fields.telephone} onChange={(event) => set({ telephone: event.target.value })} /></Field>
                </div>
              </>
            )}

            <div className="reg-actions">
              <button className="reg-primary">{step === 4 ? "Vérifier" : "Continuer"}</button>
              <button type="button" className="reg-ghost" onClick={() => go(step - 1)}>Retour</button>
            </div>
          </form>
        )}

        {step === 5 && (
          <div>
            <h2>Tout est correct{firstName ? `, ${firstName}` : ""}{" "}?</h2>
            <p className="reg-lead">Relis tes réponses, puis envoie.</p>
            <dl className="reg-recap">
              <div><dt><UserRound size={16} aria-hidden="true" /> Toi</dt><dd>{clean(fields.prenom)} {clean(fields.nom).toUpperCase()}<small>{fields.sexe === "F" ? "Fille" : "Garçon"} · né(e) le {fields.jour} {MONTHS[Number(fields.mois) - 1]?.toLowerCase()} {fields.annee}</small></dd><button type="button" onClick={() => go(1)}>Modifier</button></div>
              <div><dt><School size={16} aria-hidden="true" /> Ton lycée</dt><dd>{clean(fields.ecole)}<small>{fields.classe} · série {series}</small></dd><button type="button" onClick={() => go(2)}>Modifier</button></div>
              <div><dt><HeartHandshake size={16} aria-hidden="true" /> Ton tuteur</dt><dd>{clean(fields.tuteurPrenom)} {clean(fields.tuteurNom).toUpperCase()}<small>{fields.tuteurTelephone}</small></dd><button type="button" onClick={() => go(3)}>Modifier</button></div>
              <div><dt><GraduationCap size={16} aria-hidden="true" /> Ton projet</dt><dd>{clean(fields.filiereSouhaitee)}{fields.telephone.trim() && <small>Ton numéro : {fields.telephone}</small>}</dd><button type="button" onClick={() => go(4)}>Modifier</button></div>
            </dl>
            {failure && <p className="reg-failure" role="alert">{failure}</p>}
            <div className="reg-actions">
              <button type="button" className="reg-primary" disabled={sending} onClick={() => void submit()}>{sending ? "Envoi en cours..." : "Envoyer"}</button>
              <button type="button" className="reg-ghost" disabled={sending} onClick={() => go(4)}>Retour</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="reg-done">
            <span className="reg-check"><Check size={44} aria-hidden="true" /></span>
            <h2>Merci{firstName ? `, ${firstName}` : ""}{" "}!</h2>
            <p>C&apos;est bien enregistré. L&apos;université te contactera, ou contactera ton tuteur, dès qu&apos;il y aura du nouveau pour toi.</p>
            <p className="reg-wish">Bon courage pour ton année, et à très bientôt.</p>
            <button type="button" className="reg-ghost" onClick={restart}>Inscrire un(e) autre élève</button>
          </div>
        )}
      </section>
      <footer className="reg-foot">IPAIM University · {year}</footer>
    </main>
  );
}
