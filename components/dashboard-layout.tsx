"use client";

import { ReactNode, useEffect, useState } from "react";
import { Award, Megaphone, KeyRound, BadgeCheck, Banknote, BookMarked, CalendarCheck2, ScanLine, ClipboardList, Sparkles, BriefcaseBusiness, ChartColumn, HandCoins, Landmark, PiggyBank, Printer, ReceiptText, BookOpenCheck, CalendarDays, Calculator, ChartPie, DatabaseBackup, IdCard, Coins, NotebookPen, Scale, School, FileBadge, GraduationCap, Globe, Info, LayoutDashboard, LayoutGrid, LogOut, type LucideIcon, Menu, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, UserRound, Users, Wallet, ArrowLeft, House } from "lucide-react";
import { User, ViewName } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";
import { UserAvatar } from "@/components/student-photo";
import { GlobalSearch } from "@/components/global-search";
import { InstallAppButton, InstallAppModal } from "@/components/install-app";
import { canAccessView } from "@/lib/access";
import { MANUAL_BY_GROUP } from "@/lib/manuals";
import { ManualSection, navigateTo, pathForManual, pathForSpace } from "@/lib/routes";

const MENU_EVENT = "ipaim-menu-toggle";

// Icônes du menu : bibliothèque Lucide, même tracé que les actions de ligne.
const icons: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  reports: ChartColumn,
  prospects: UserPlus,
  futureStudents: Sparkles,
  scholarships: Award,
  enrollments: GraduationCap,
  certificates: FileBadge,
  payments: Wallet,
  expenses: ReceiptText,
  approval: BadgeCheck,
  execution: HandCoins,
  budget: PiggyBank,
  finance: Landmark,
  tuition: GraduationCap,
  announcements: Megaphone,
  accessSlips: KeyRound,
  people: Users,
  recruiting: BriefcaseBusiness,
  references: SlidersHorizontal,
  sync: RefreshCw,
  audit: ShieldCheck,
  trash: Trash2,
  prints: Printer,
  academicToday: ClipboardList,
  structure: School,
  classes: GraduationCap,
  teaching: CalendarDays,
  grades: NotebookPen,
  deliberations: Scale,
  stats: ChartPie,
  staff: IdCard,
  payroll: Coins,
  accounting: Calculator,
  ledger: BookOpenCheck,
  backups: DatabaseBackup,
  about: Info,
  daily: CalendarCheck2,
  cardScan: ScanLine,
  handover: Banknote,
  settings: Settings,
  website: Globe,
};

type NavItem = { label: ViewName; icon: string; title?: string; views?: ViewName[] };

// Le menu suit le travail de chacun : une entrée par métier, les écrans voisins
// d'un même circuit (la dépense) réunis derrière une seule entrée à onglets.
export const EXPENSE_VIEWS: ViewName[] = ["États de besoin", "Validation des dépenses", "Exécution des dépenses"];
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    items: [
      { label: "Vue d'ensemble", icon: "home" },
      { label: "Résumé de la journée", icon: "daily" },
      { label: "Rapports", icon: "reports" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { label: "Prospects", icon: "prospects" },
      { label: "Futurs étudiants", icon: "futureStudents" },
      { label: "Demandes de bourse", icon: "scholarships" },
      { label: "Inscriptions", icon: "enrollments" },
      { label: "Certificats", icon: "certificates" },
      { label: "Personnes", icon: "people" },
    ],
  },
  {
    label: "Académique",
    items: [
      { label: "Tableau de bord académique", icon: "academicToday" },
      { label: "Structure académique", icon: "structure" },
      { label: "Classes et étudiants", icon: "classes" },
      { label: "Contrôle des cartes", icon: "cardScan" },
      { label: "Enseignement", icon: "teaching" },
      { label: "Évaluations et notes", icon: "grades" },
      { label: "Délibérations", icon: "deliberations" },
      { label: "Statistiques académiques", icon: "stats" },
      { label: "Annonces", icon: "announcements" },
      { label: "Fiches d'accès", icon: "accessSlips" },
    ],
  },
  {
    label: "Finances",
    items: [
      { label: "Paiements", icon: "payments" },
      { label: "Validation des encaissements", icon: "handover" },
      { label: "États de besoin", icon: "expenses", title: "Dépenses", views: EXPENSE_VIEWS },
      { label: "Budget", icon: "budget" },
      { label: "Comptabilité", icon: "accounting" },
      { label: "Frais de scolarité", icon: "tuition" },
      { label: "Paramètres finances", icon: "finance" },
    ],
  },
  {
    label: "Ressources humaines",
    items: [
      { label: "Recrutement", icon: "recruiting" },
      { label: "Personnel", icon: "staff" },
      { label: "Paie", icon: "payroll" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Site vitrine", icon: "website" },
      { label: "Référentiels", icon: "references" },
      { label: "Synchronisation", icon: "sync" },
      { label: "Corbeille", icon: "trash" },
      { label: "Audit", icon: "audit" },
      { label: "Impressions", icon: "prints" },
      { label: "Sauvegardes", icon: "backups" },
      { label: "À propos du SGI", icon: "about" },
    ],
  },
];

// Section du menu d'un écran : sert à ouvrir le manuel et l'espace qui le concernent.
export function groupOfView(view: ViewName): string | null {
  return navGroups.find((group) => group.items.some((item) => (item.views ?? [item.label]).includes(view)))?.label ?? null;
}

// Icône de chaque section du menu.
export const GROUP_ICONS: Record<string, LucideIcon> = {
  Pilotage: ChartColumn,
  Admissions: UserPlus,
  Académique: School,
  Finances: Landmark,
  "Ressources humaines": IdCard,
  Administration: ShieldCheck,
};

export type VisibleNavItem = NavItem & { views: ViewName[] };

// Les écrans auxquels l'utilisateur a accès, section par section. Une entrée qui
// réunit plusieurs écrans ouvre le premier qui lui est permis.
export function visibleNavGroups(user: User | null) {
  const canSee = (label: ViewName) =>
    label === "À propos du SGI" ||
    (label === "Corbeille" || label === "Audit" || label === "Impressions" || label === "Sauvegardes" ? user?.role === "admin" : canAccessView(user, label));
  return navGroups
    .map((group) => ({
      ...group,
      section: MANUAL_BY_GROUP[group.label] ?? "pilotage",
      items: group.items
        .map((item) => {
          const views = (item.views ?? [item.label]).filter(canSee);
          return views.length ? { ...item, label: views[0], views } : null;
        })
        .filter((item): item is VisibleNavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}

export function GroupIcon({ label, size = 20 }: { label: string; size?: number }) {
  const Glyph = GROUP_ICONS[label] ?? LayoutGrid;
  return <Glyph size={size} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}

export function NavIcon({ name, size = 19 }: { name: string; size?: number }) {
  const Glyph = icons[name] ?? Info;
  return <Glyph size={size} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}

export function DashboardLayout({ activeView, activeManual, activeSpace, setActiveView, user, badges, onLogout, onProfile, onSettings, children }: { activeView: ViewName; activeManual: ManualSection | null; activeSpace: ManualSection | null; setActiveView: (view: ViewName) => void; user: User | null; badges: Partial<Record<ViewName, number>>; onLogout: () => void; onProfile: () => void; onSettings: () => void; children: ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const confirmLogout = () => { setLogoutOpen(false); onLogout(); };
  const toggleSidebarCollapsed = () => {
    setSidebarPeek(false);
    setSidebarCollapsed((collapsed) => !collapsed);
  };
  // Sur mobile, le menu est un tiroir ouvert depuis le bouton de l'en-tête.
  useEffect(() => {
    const toggle = () => setMenuOpen((open) => !open);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener(MENU_EVENT, toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(MENU_EVENT, toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const go = (action: () => void) => { setMenuOpen(false); action(); };
  const groups = visibleNavGroups(user);
  // La section de l'écran affiché (ou de l'espace ouvert) reste en surbrillance.
  const currentGroup = activeView === "Espace" ? groups.find((group) => group.section === activeSpace)?.label ?? null : groupOfView(activeView);
  // Le manuel proposé est celui de la section de l'écran affiché.
  const manualSection = activeManual ?? activeSpace ?? MANUAL_BY_GROUP[currentGroup ?? ""] ?? "pilotage";
  const home = activeView === "Vue d'ensemble";
  const homeCount = badges["Vue d'ensemble"] ?? 0;
  const name = [user?.prenom, user?.nom].filter(Boolean).join(" ") || "Administrateur";
  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarCollapsed && sidebarPeek ? "sidebar-peek" : ""} ${menuOpen ? "menu-open" : ""}`}>
      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <aside
        className="sidebar sidebar-panel"
        onMouseEnter={() => {
          if (sidebarCollapsed) setSidebarPeek(true);
        }}
        onMouseLeave={() => setSidebarPeek(false)}
        onFocusCapture={() => {
          if (sidebarCollapsed) setSidebarPeek(true);
        }}
        onBlurCapture={(event) => {
          if (!sidebarCollapsed) return;
          const next = event.relatedTarget;
          if (!next || !event.currentTarget.contains(next as Node)) setSidebarPeek(false);
        }}
      >
        <div className="sidebar-top">
          <span className="sidebar-logo"><BrandLogo compact /></span>
          <span className="brand-name"><small>Institut polytechnique</small>IPAIM<em>Gestion scolaire</em></span>
          <button
            type="button"
            className="collapse-button"
            aria-label={sidebarCollapsed ? "Déployer le menu" : "Réduire le menu"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Déployer le menu" : "Réduire le menu"}
            onClick={(event) => {
              toggleSidebarCollapsed();
              event.currentTarget.blur();
            }}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
        {/* Le menu ne montre que les sections : chacune ouvre son espace, en cartes. */}
        <nav className="main-nav" aria-label="Navigation principale">
          <button type="button" title="Accueil" aria-current={home ? "page" : undefined} className={`nav-item ${home ? "active" : ""}`} onClick={() => go(() => setActiveView("Vue d'ensemble"))}>
            <span className="nav-icon"><House size={20} strokeWidth={1.7} aria-hidden="true" focusable="false" /></span>
            <span className="nav-text">Accueil</span>
            {homeCount > 0 && <span className="nav-count" aria-label={`${homeCount} à traiter`}>{homeCount > 99 ? "99+" : homeCount}</span>}
          </button>
          <span className="nav-separator" aria-hidden="true" />
          {groups.map((group) => {
            const active = currentGroup === group.label && !home;
            const count = group.items.reduce((total, item) => total + item.views.reduce((sum, view) => sum + (badges[view] ?? 0), 0), 0);
            return (
              <button key={group.label} type="button" title={count ? `${group.label} · ${count} à traiter` : group.label} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "active" : ""}`} onClick={() => go(() => navigateTo(pathForSpace(group.section)))}>
                <span className="nav-icon"><GroupIcon label={group.label} /></span>
                <span className="nav-text">{group.label}</span>
                {count > 0 && <span className="nav-count" aria-label={`${count} à traiter`}>{count > 99 ? "99+" : count}</span>}
              </button>
            );
          })}
          {/* Les outils suivent directement les sections : une seule liste, sans défilement séparé. */}
          <span className="nav-separator" aria-hidden="true" />
          <InstallAppButton onDone={() => setMenuOpen(false)} />
          <button type="button" title="Manuel d'utilisation de cette section" className={`nav-item ${activeView === "Manuel d'utilisation" ? "active" : ""}`} onClick={() => go(() => navigateTo(pathForManual(manualSection)))}><span className="nav-icon"><BookMarked size={19} strokeWidth={1.7} aria-hidden="true" focusable="false" /></span><span className="nav-text">Manuel d&apos;utilisation</span></button>
          {user && <button type="button" title="Paramètres" className={`nav-item ${activeView === "Paramètres" ? "active" : ""}`} onClick={() => go(onSettings)}><span className="nav-icon"><Settings size={19} strokeWidth={1.7} aria-hidden="true" focusable="false" /></span><span className="nav-text">Paramètres</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <div className={`sidebar-user ${activeView === "Profil" ? "active" : ""}`}>
            <button type="button" title="Mon compte" className="profile-card" onClick={() => go(onProfile)}><UserAvatar user={user} /><span className="profile-text"><strong>{name}</strong><small>{user?.poste?.nom ?? (user?.role === "admin" ? "Administrateur" : "Équipe")}</small></span></button>
            <div className="sidebar-user-links">
              <button type="button" onClick={() => go(onProfile)}><UserRound size={15} aria-hidden="true" focusable="false" /> <span>Mon compte</span></button>
              <button type="button" title="Se déconnecter" onClick={() => setLogoutOpen(true)}><LogOut size={15} aria-hidden="true" focusable="false" /> <span>Se déconnecter</span></button>
            </div>
            <span className="sidebar-brand-stripe" aria-hidden="true" />
          </div>
        </div>
      </aside>
      <main className="content-area">{children}</main>
      <InstallAppModal />
      {logoutOpen && <div className="modal-backdrop" onMouseDown={() => setLogoutOpen(false)}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Se déconnecter" onMouseDown={(event) => event.stopPropagation()}><div className="confirm-icon">↪</div><h3>Se déconnecter ?</h3><p>Votre session actuelle sera fermée.</p><div className="form-actions"><button className="secondary-button" onClick={() => setLogoutOpen(false)}>Annuler</button><button className="danger-solid-button" onClick={confirmLogout}>Confirmer la déconnexion</button></div></section></div>}
    </div>
  );
}

// En-tête d'un écran. Un écran rangé dans une section affiche « Retour » vers
// l'espace de cette section, et le fil Section — Écran.
export function AppHeader({ title, user, onRefresh, onHelp, space }: { title: string; user: User | null; onRefresh: () => void; onHelp?: () => void; space?: { label: string; section: ManualSection; current: boolean } | null }) {
  return (
    <header className={`topbar ${space?.current ? "topbar-space" : ""}`}>
      <button type="button" className="menu-button" aria-label="Ouvrir le menu" onClick={() => window.dispatchEvent(new Event(MENU_EVENT))}>
        <Menu aria-hidden="true" focusable="false" />
      </button>
      <div>
        {space ? (
          <nav className="page-trail" aria-label="Fil d'Ariane">
            <button type="button" className="trail-back" onClick={() => navigateTo(space.current ? "/" : pathForSpace(space.section))}><ArrowLeft size={17} aria-hidden="true" focusable="false" /> Retour</button>
            <span className="trail-pill">
              <button type="button" className="trail-home" title={space.current ? "Accueil" : `Espace ${space.label}`} aria-label={space.current ? "Accueil" : `Espace ${space.label}`} onClick={() => navigateTo(space.current ? "/" : pathForSpace(space.section))}><LayoutGrid size={16} aria-hidden="true" focusable="false" /></button>
              {!space.current && <><span className="trail-line" aria-hidden="true" /><button type="button" className="trail-step" onClick={() => navigateTo(pathForSpace(space.section))}>{space.label}</button></>}
              <span className="trail-line" aria-hidden="true" />
              <span className="trail-current" aria-current="page"><span className="trail-dot" aria-hidden="true" />{title}</span>
            </span>
          </nav>
        ) : (
          <p className="breadcrumb">Tableau de bord <span>/</span> {title}</p>
        )}
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <GlobalSearch user={user} />
        {onHelp && <button type="button" className="page-help-button" onClick={onHelp}><Info size={16} aria-hidden="true" focusable="false" /> Info sur la page</button>}
        <button className="refresh-button" onClick={onRefresh}>Actualiser <span>↻</span></button>
      </div>
    </header>
  );
}
