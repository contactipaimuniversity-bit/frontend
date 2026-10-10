"use client";

import { ReactNode, useEffect, useState } from "react";
import { Award, BadgeCheck, BriefcaseBusiness, ChartColumn, HandCoins, Landmark, PiggyBank, Printer, ReceiptText, BookOpenCheck, CalendarDays, Calculator, ChartPie, DatabaseBackup, IdCard, Coins, NotebookPen, Scale, School, ChevronDown, FileBadge, GraduationCap, Info, LayoutDashboard, type LucideIcon, Menu, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, Users, Wallet } from "lucide-react";
import { Summary, User, ViewName } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";
import { UserAvatar } from "@/components/student-photo";
import { GlobalSearch } from "@/components/global-search";
import { canAccessView } from "@/lib/access";

const MENU_EVENT = "ipaim-menu-toggle";
const CLOSED_GROUPS_KEY = "ipaim-menu-sections-fermees";

// Icônes du menu : bibliothèque Lucide, même tracé que les actions de ligne.
const icons: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  reports: ChartColumn,
  prospects: UserPlus,
  scholarships: Award,
  enrollments: GraduationCap,
  certificates: FileBadge,
  payments: Wallet,
  expenses: ReceiptText,
  approval: BadgeCheck,
  execution: HandCoins,
  budget: PiggyBank,
  finance: Landmark,
  people: Users,
  recruiting: BriefcaseBusiness,
  references: SlidersHorizontal,
  sync: RefreshCw,
  audit: ShieldCheck,
  trash: Trash2,
  prints: Printer,
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
  settings: Settings,
};

function Icon({ name }: { name: string }) {
  const Glyph = icons[name] ?? Info;
  return <span className="nav-icon"><Glyph size={19} strokeWidth={1.7} aria-hidden="true" focusable="false" /></span>;
}
const navGroups: { label: string; items: { label: ViewName; icon: string }[] }[] = [
  { label: "Pilotage", items: [{ label: "Vue d'ensemble", icon: "home" }, { label: "Rapports", icon: "reports" }] },
  {
    label: "Admissions",
    items: [
      { label: "Prospects", icon: "prospects" },
      { label: "Demandes de bourse", icon: "scholarships" },
      { label: "Inscriptions", icon: "enrollments" },
      { label: "Certificats", icon: "certificates" },
    ],
  },
  {
    label: "Académique",
    items: [
      { label: "Structure académique", icon: "structure" },
      { label: "Classes et étudiants", icon: "classes" },
      { label: "Enseignement", icon: "teaching" },
      { label: "Notes", icon: "grades" },
      { label: "Délibérations", icon: "deliberations" },
      { label: "Statistiques académiques", icon: "stats" },
    ],
  },
  {
    label: "Finances",
    items: [
      { label: "Paiements", icon: "payments" },
      { label: "Dépenses", icon: "expenses" },
      { label: "Validation des dépenses", icon: "approval" },
      { label: "Exécution des dépenses", icon: "execution" },
      { label: "Budget", icon: "budget" },
      { label: "Comptabilité", icon: "accounting" },
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
  { label: "Répertoire", items: [{ label: "Personnes", icon: "people" }] },
  {
    label: "Administration",
    items: [
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

export function DashboardLayout({ activeView, setActiveView, user, summary, onLogout, onProfile, onSettings, children }: { activeView: ViewName; setActiveView: (view: ViewName) => void; user: User | null; summary: Summary | null; onLogout: () => void; onProfile: () => void; onSettings: () => void; children: ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Sections du menu repliées par l'utilisateur, mémorisées sur l'appareil.
  const [closedGroups, setClosedGroups] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(CLOSED_GROUPS_KEY) ?? "[]") as string[]; } catch { return []; }
  });
  const toggleGroup = (label: string) => setClosedGroups((current) => {
    const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
    try { window.localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(next)); } catch { /* Stockage indisponible. */ }
    return next;
  });
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
  const canSee = (label: ViewName) =>
    label === "À propos du SGI" ||
    (label === "Corbeille" || label === "Audit" || label === "Impressions" || label === "Sauvegardes" ? user?.role === "admin" : canAccessView(user, label));
  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item.label)) }))
    .filter((group) => group.items.length > 0);
  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarCollapsed && sidebarPeek ? "sidebar-peek" : ""} ${menuOpen ? "menu-open" : ""}`}>
      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <aside
        className="sidebar"
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
          <BrandLogo compact />
          <span className="brand-name">IPAIM</span>
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
        <nav className="main-nav" aria-label="Navigation principale">
          {groups.map((group) => {
            // La section de la page affichée reste toujours dépliée.
            const open = !closedGroups.includes(group.label) || group.items.some((item) => item.label === activeView);
            return (
            <div className={`nav-group ${open ? "open" : ""}`} key={group.label}>
              <button type="button" className="nav-label nav-group-toggle" aria-expanded={open} onClick={() => toggleGroup(group.label)}>
                <span>{group.label}</span>
                <ChevronDown aria-hidden="true" focusable="false" />
              </button>
              <div className="nav-group-items"><div inert={!open && !(sidebarCollapsed && !sidebarPeek)}>
              {group.items.map((item) => (
                <button key={item.label} type="button" title={item.label} aria-current={activeView === item.label ? "page" : undefined} className={`nav-item ${activeView === item.label ? "active" : ""}`} onClick={() => go(() => setActiveView(item.label))}>
                  <Icon name={item.icon} />
                  <span className="nav-text">{item.label}</span>
                  {item.label === "Demandes de bourse" && <span className="nav-count">{summary?.demandesEnCours ?? ""}</span>}
                </button>
              ))}
              </div></div>
            </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {user && <button type="button" title="Paramètres" className={`nav-item ${activeView === "Paramètres" ? "active" : ""}`} onClick={() => go(onSettings)}><Icon name="settings" /><span className="nav-text">Paramètres</span></button>}
          <button type="button" title="Profil" className={`profile-card ${activeView === "Profil" ? "active" : ""}`} onClick={() => go(onProfile)}><UserAvatar user={user} /><span className="profile-text"><strong>{[user?.prenom, user?.nom].filter(Boolean).join(" ") || "Administrateur"}</strong><small>{user?.poste?.nom ?? (user?.role === "admin" ? "Administrateur" : "Équipe")}</small></span><span className="logout-icon">→</span></button>
          <button type="button" title="Se déconnecter" className="logout-button" onClick={() => setLogoutOpen(true)}>Se déconnecter <span>↪</span></button>
        </div>
      </aside>
      <main className="content-area">{children}</main>
      {logoutOpen && <div className="modal-backdrop" onMouseDown={() => setLogoutOpen(false)}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Se déconnecter" onMouseDown={(event) => event.stopPropagation()}><div className="confirm-icon">↪</div><h3>Se déconnecter ?</h3><p>Votre session actuelle sera fermée.</p><div className="form-actions"><button className="secondary-button" onClick={() => setLogoutOpen(false)}>Annuler</button><button className="danger-solid-button" onClick={confirmLogout}>Confirmer la déconnexion</button></div></section></div>}
    </div>
  );
}

export function AppHeader({ title, user, onRefresh, onHelp }: { title: string; user: User | null; onRefresh: () => void; onHelp?: () => void }) {
  return (
    <header className="topbar">
      <button type="button" className="menu-button" aria-label="Ouvrir le menu" onClick={() => window.dispatchEvent(new Event(MENU_EVENT))}>
        <Menu aria-hidden="true" focusable="false" />
      </button>
      <div><p className="breadcrumb">Tableau de bord <span>/</span> {title}</p><h1>{title}</h1></div>
      <div className="topbar-actions">
        <GlobalSearch user={user} />
        {onHelp && <button type="button" className="page-help-button" onClick={onHelp}><Info size={16} aria-hidden="true" focusable="false" /> Info sur la page</button>}
        <button className="refresh-button" onClick={onRefresh}>Actualiser <span>↻</span></button>
      </div>
    </header>
  );
}
