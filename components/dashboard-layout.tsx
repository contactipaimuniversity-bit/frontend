"use client";

import { ReactNode, useState } from "react";
import { Summary, User, ViewName } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";

const navItems: { label: ViewName; icon: string }[] = [
  { label: "Vue d'ensemble", icon: "⌂" },
  { label: "Demandes de bourse", icon: "◇" },
  { label: "Inscriptions", icon: "▣" },
  { label: "Paiements", icon: "₣" },
  { label: "Prospects", icon: "○" },
  { label: "Personnes", icon: "◎" },
  { label: "Recrutement", icon: "♙" },
  { label: "Référentiels", icon: "≡" },
  { label: "Rapports", icon: "▤" },
];

export function DashboardLayout({ activeView, setActiveView, user, summary, onLogout, onProfile, onSettings, children }: { activeView: ViewName; setActiveView: (view: ViewName) => void; user: User | null; summary: Summary | null; onLogout: () => void; onProfile: () => void; onSettings: () => void; children: ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const confirmLogout = () => { setLogoutOpen(false); onLogout(); };
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-top"><BrandLogo compact /><span className="brand-name">IPAIM</span></div><nav className="main-nav"><p className="nav-label">Navigation</p>{navItems.map((item) => <button key={item.label} className={`nav-item ${activeView === item.label ? "active" : ""}`} onClick={() => setActiveView(item.label)}><span className="nav-icon">{item.icon}</span><span className="nav-text">{item.label}</span>{item.label === "Demandes de bourse" && <span className="nav-count">{summary?.demandesEnCours ?? ""}</span>}</button>)}</nav><div className="sidebar-bottom"><button className={`nav-item ${activeView === "Paramètres" ? "active" : ""}`} onClick={onSettings}><span className="nav-icon">⚙</span><span className="nav-text">Paramètres</span></button><button className={`profile-card ${activeView === "Profil" ? "active" : ""}`} onClick={onProfile}><span className="avatar">{user?.nom?.slice(0, 1) ?? "A"}</span><span className="profile-text"><strong>{user?.nom ?? "Administrateur"}</strong><small>{user?.role ?? "Equipe"}</small></span><span className="logout-icon">→</span></button><button className="logout-button" onClick={() => setLogoutOpen(true)}>Se déconnecter <span>↪</span></button></div></aside><main className="content-area">{children}</main>{logoutOpen && <div className="modal-backdrop" onMouseDown={() => setLogoutOpen(false)}><section className="modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}><div className="confirm-icon">↪</div><h3>Se déconnecter ?</h3><p>Votre session actuelle sera fermée.</p><div className="form-actions"><button className="secondary-button" onClick={() => setLogoutOpen(false)}>Annuler</button><button className="danger-solid-button" onClick={confirmLogout}>Confirmer la déconnexion</button></div></section></div>}</div>;
}

export function AppHeader({ title, onRefresh }: { title: string; onRefresh: () => void }) {
  return <header className="topbar"><div><p className="breadcrumb">Tableau de bord <span>/</span> {title}</p><h1>{title}</h1></div><div className="topbar-actions"><span className="live-status"><i /> Systeme operationnel</span><button className="refresh-button" onClick={onRefresh}>Actualiser <span>↻</span></button></div></header>;
}
