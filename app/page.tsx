"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DashboardHome } from "@/components/dashboard-home";
import { OfflineSync, OfflineSyncPage } from "@/components/offline-sync";
import { CertificatesPage } from "@/components/certificates-page";
import { DashboardLayout, AppHeader } from "@/components/dashboard-layout";
import { ProfilePage, SettingsPage } from "@/components/account-pages";
import { LoginScreen } from "@/components/login-screen";
import { DossierDetailsPage, DossierReference, OperationsPage } from "@/components/operations-page";
import { DeletionInfoPage } from "@/components/deletion-info-page";
import { TrashPage } from "@/components/trash-page";
import { PersonnelPage } from "@/components/personnel-page";
import { AboutSgiPage } from "@/components/about-sgi-page";
import {
  PeoplePage,
  ReferencesPage,
  ReportsPage,
} from "@/components/additional-pages";
import { apiFetch, notifySessionChanged } from "@/lib/api";
import { applyColorMode, applyColorPreset, readColorMode, readColorPreset } from "@/lib/theme";
import { OfflineAccount } from "@/lib/offline";
import { hasAccess, VIEW_ACCESS } from "@/lib/access";
import {
  Application,
  ApplicationPage,
  Enrollment,
  EnrollmentPage,
  LatePayment,
  Person,
  PersonPage,
  Prospect,
  ProspectPage,
  PersonnelApplication,
  PersonnelApplicationPage,
  ScholarshipType,
  Summary,
  User,
  ViewName,
} from "@/lib/types";

const subscribeToSession = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener("ipaim-session", onChange);
  window.addEventListener("ipaim-session-expired", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("ipaim-session", onChange);
    window.removeEventListener("ipaim-session-expired", onChange);
  };
};

const subscribeToStableNotice = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener("ipaim-stable-notice-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("ipaim-stable-notice-change", onChange);
  };
};

const useStoredValue = (key: string) =>
  useSyncExternalStore(
    subscribeToSession,
    () => window.sessionStorage.getItem(key),
    () => null,
  );

export default function Home() {
  const storedToken = useStoredValue("ipaim-token");
  const storedUser = useStoredValue("ipaim-user");
  const storedOfflineSession = useStoredValue("ipaim-offline-session");
  const [temporaryToken, setTemporaryToken] = useState<string | null>(null);
  const [temporaryUser, setTemporaryUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewName>("Vue d'ensemble");
  const [deletionInfoReturnView, setDeletionInfoReturnView] = useState<"Demandes de bourse" | "Inscriptions">("Demandes de bourse");
  const [dossierReference, setDossierReference] = useState<DossierReference | null>(null);
  const [dossierReturnView, setDossierReturnView] = useState<"Demandes de bourse" | "Inscriptions">("Demandes de bourse");
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationMeta, setApplicationMeta] = useState<ApplicationPage["meta"]>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("");
  const [applicationPage, setApplicationPage] = useState(1);
  const [loadedApplicationRequest, setLoadedApplicationRequest] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentMeta, setEnrollmentMeta] = useState<EnrollmentPage["meta"]>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [loadedEnrollmentRequest, setLoadedEnrollmentRequest] = useState("");
  const [enrollmentTypeBourseId, setEnrollmentTypeBourseId] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectMeta, setProspectMeta] = useState<ProspectPage["meta"]>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectPage, setProspectPage] = useState(1);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleMeta, setPeopleMeta] = useState<PersonPage["meta"]>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peoplePage, setPeoplePage] = useState(1);
  const [personnelApplications, setPersonnelApplications] = useState<PersonnelApplication[]>([]);
  const [personnelMeta, setPersonnelMeta] = useState<PersonnelApplicationPage["meta"]>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelPage, setPersonnelPage] = useState(1);
  const [latePayments, setLatePayments] = useState<LatePayment[]>([]);
  const [scholarshipTypes, setScholarshipTypes] = useState<ScholarshipType[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [enteringApp, setEnteringApp] = useState(false);
  const [error, setError] = useState("");
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(null);
  const [offlineAccessWarning, setOfflineAccessWarning] = useState(false);
  const token = temporaryToken ?? storedToken;
  const user =
    temporaryUser ?? (storedUser ? (JSON.parse(storedUser) as User) : null) ??
    (storedOfflineSession ? (JSON.parse(storedOfflineSession) as OfflineAccount).user : null);
  const canViewDashboard = hasAccess(user, "dashboard");
  const canViewScholarships = hasAccess(user, "scholarships");
  const canViewEnrollments = hasAccess(user, "enrollments");
  const canViewProspects = hasAccess(user, "prospects");
  const canViewPeople = hasAccess(user, "people");
  const canViewRecruiting = hasAccess(user, "recruiting");
  const canViewReports = hasAccess(user, "reports");
  const canViewReferences = hasAccess(user, "references");
  const offlineAccount = storedOfflineSession
    ? JSON.parse(storedOfflineSession) as OfflineAccount
    : null;
  const applicationEndpoint = `/demandes-bourse?page=${applicationPage}&limit=20${applicationSearch ? `&q=${encodeURIComponent(applicationSearch)}` : ""}${applicationStatus ? `&statut=${encodeURIComponent(applicationStatus)}` : ""}`;
  const enrollmentEndpoint = `/inscriptions?page=${enrollmentPage}&limit=20${enrollmentSearch ? `&q=${encodeURIComponent(enrollmentSearch)}` : ""}${enrollmentTypeBourseId ? `&typeBourseId=${encodeURIComponent(enrollmentTypeBourseId)}` : ""}${enrollmentStatus ? `&statut=${encodeURIComponent(enrollmentStatus)}` : ""}`;
  const applicationRequestKey = `${applicationEndpoint}|refresh:${refreshKey}`;
  const enrollmentRequestKey = `${enrollmentEndpoint}|refresh:${refreshKey}`;
  const applicationLoading = Boolean((token || storedOfflineSession) && canViewScholarships && loadedApplicationRequest !== applicationRequestKey);
  const enrollmentLoading = Boolean((token || storedOfflineSession) && canViewEnrollments && loadedEnrollmentRequest !== enrollmentRequestKey);
  const stableNoticeKey = user?.id ? `ipaim-stable-notice:${user.id}` : null;
  const stableNoticeOpen = useSyncExternalStore(
    subscribeToStableNotice,
    () => {
      if (!token || !stableNoticeKey || dismissedNoticeKey === stableNoticeKey) return false;
      try { return window.localStorage.getItem(stableNoticeKey) !== "seen"; } catch { return true; }
    },
    () => false,
  );
  const activeView = VIEW_ACCESS[view] && !hasAccess(user, VIEW_ACCESS[view]!) ? "Profil" : view;

  useEffect(() => {
    const syncColorPreset = () => applyColorPreset(readColorPreset(), false);
    const syncColorMode = () => applyColorMode(readColorMode(), false);
    syncColorPreset();
    syncColorMode();
    window.addEventListener("storage", syncColorPreset);
    window.addEventListener("storage", syncColorMode);
    return () => {
      window.removeEventListener("storage", syncColorPreset);
      window.removeEventListener("storage", syncColorMode);
    };
  }, []);

  const dismissStableNotice = () => {
    if (stableNoticeKey) {
      setDismissedNoticeKey(stableNoticeKey);
      try { window.localStorage.setItem(stableNoticeKey, "seen"); } catch { /* Storage may be unavailable. */ }
      window.dispatchEvent(new Event("ipaim-stable-notice-change"));
    }
  };

  useEffect(() => {
    if (!token && !storedOfflineSession) return;
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [
          summaryData,
          prospectData,
          personData,
          personnelData,
          paymentData,
          typeData,
        ] = await Promise.all([
          canViewDashboard ? apiFetch<Summary>("/rapports/synthese") : Promise.resolve(null),
          canViewProspects ? apiFetch<ProspectPage>(
            `/prospects?page=${prospectPage}&limit=20${prospectSearch ? `&q=${encodeURIComponent(prospectSearch)}` : ""}`,
          ) : Promise.resolve(null),
          canViewPeople ? apiFetch<PersonPage>(
            `/personnes?page=${peoplePage}&limit=20${
              peopleSearch
                ? `&q=${encodeURIComponent(peopleSearch)}`
                : ""
            }`,
          ) : Promise.resolve(null),
          canViewRecruiting ? apiFetch<PersonnelApplicationPage>(
            `/candidatures-personnel?page=${personnelPage}&limit=20${personnelSearch ? `&q=${encodeURIComponent(personnelSearch)}` : ""}`,
          ) : Promise.resolve(null),
          canViewReports ? apiFetch<{ echeances: LatePayment[] }>(
            "/rapports/paiements-en-retard",
          ) : Promise.resolve(null),
          canViewReferences ? apiFetch<ScholarshipType[]>("/types-bourse") : Promise.resolve(null),
        ]);
        if (summaryData) setSummary(summaryData);
        setProspects(prospectData?.data ?? []);
        if (prospectData) setProspectMeta(prospectData.meta);
        setPeople(personData?.data ?? []);
        if (personData) setPeopleMeta(personData.meta);
        setPersonnelApplications(personnelData?.data ?? []);
        if (personnelData) setPersonnelMeta(personnelData.meta);
        setLatePayments(paymentData?.echeances ?? []);
        setScholarshipTypes(typeData ?? []);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Le backend est indisponible.",
        );
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [
    prospectPage,
    prospectSearch,
    peoplePage,
    peopleSearch,
    personnelPage,
    personnelSearch,
    canViewDashboard,
    canViewPeople,
    canViewProspects,
    canViewRecruiting,
    canViewReferences,
    canViewReports,
    token,
    storedOfflineSession,
    refreshKey,
  ]);

  useEffect(() => {
    if (!token && !storedOfflineSession) return;
    if (!canViewScholarships) return;
    let active = true;
    void apiFetch<ApplicationPage>(
      applicationEndpoint,
    )
      .then((result) => {
        if (active) {
          setApplications(result.data);
          setApplicationMeta(result.meta);
          setLoadedApplicationRequest(applicationRequestKey);
        }
      })
      .catch((failure) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "Demandes indisponibles.");
          setLoadedApplicationRequest(applicationRequestKey);
        }
      })
      ;
    return () => { active = false; };
  }, [applicationEndpoint, applicationRequestKey, canViewScholarships, storedOfflineSession, token]);

  useEffect(() => {
    if (!token && !storedOfflineSession) return;
    if (!canViewEnrollments) return;
    let active = true;
    void apiFetch<EnrollmentPage>(
      enrollmentEndpoint,
    )
      .then((result) => {
        if (active) {
          setEnrollments(result.data);
          setEnrollmentMeta(result.meta);
          setLoadedEnrollmentRequest(enrollmentRequestKey);
        }
      })
      .catch((failure) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : "Inscriptions indisponibles.");
          setLoadedEnrollmentRequest(enrollmentRequestKey);
        }
      })
      ;
    return () => { active = false; };
  }, [canViewEnrollments, enrollmentEndpoint, enrollmentRequestKey, storedOfflineSession, token]);

  useEffect(() => {
    if (!enteringApp) return;
    const timeoutId = window.setTimeout(() => setEnteringApp(false), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [enteringApp]);

  useEffect(() => {
    const refreshAfterSync = () => setRefreshKey((value) => value + 1);
    window.addEventListener("ipaim-sync-complete", refreshAfterSync);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
    return () => window.removeEventListener("ipaim-sync-complete", refreshAfterSync);
  }, []);

  const logout = () => {
    window.sessionStorage.removeItem("ipaim-token");
    window.sessionStorage.removeItem("ipaim-user");
    window.sessionStorage.removeItem("ipaim-offline-session");
    setTemporaryToken(null);
    setTemporaryUser(null);
    notifySessionChanged();
  };
  const refresh = () => setRefreshKey((value) => value + 1);
  if (!token && !offlineAccount)
    return (
      <LoginScreen
        onLoggedIn={(newToken, newUser, offlineReady) => {
          setTemporaryToken(newToken);
          setTemporaryUser(newUser);
          setOfflineAccessWarning(offlineReady === false);
          setEnteringApp(true);
        }}
      />
    );

  if (enteringApp)
    return (
      <main className="entry-loading" role="status" aria-live="polite">
        <div className="entry-loading-content">
          <div className="entry-loading-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <rect x="12" y="12" width="40" height="30" rx="3" />
              <path d="M7 49h50l-4 5H11l-4-5Z" />
              <path d="M25 49h14" />
            </svg>
            <span className="entry-loading-spinner" />
          </div>
          <p className="eyebrow">IPAIM</p>
          <h1>Préparation de votre espace</h1>
          <p>Pour une meilleure expérience, utilisez votre ordinateur.</p>
        </div>
      </main>
    );

  return (
    <DashboardLayout
      activeView={activeView}
      setActiveView={setView}
      user={user}
      summary={summary}
      onLogout={logout}
      onProfile={() => setView("Profil")}
      onSettings={() => setView("Paramètres")}
    >
      <AppHeader title={activeView} onRefresh={refresh} />
      <OfflineSync onOpenPage={() => setView("Synchronisation")} />
      {offlineAccessWarning && (
        <div className="api-error">
          L’accès hors ligne n’a pas pu être activé sur cet appareil. Vérifiez les paramètres de stockage du navigateur.
          <button onClick={() => setOfflineAccessWarning(false)}>Fermer</button>
        </div>
      )}
      {error && (
        <div className="api-error">
          <strong>Erreur de chargement.</strong> {error}
          <button onClick={refresh}>Réessayer</button>
        </div>
      )}
      {activeView === "Vue d'ensemble" ? (
        <DashboardHome
          summary={summary}
          applications={applications}
          enrollments={enrollments}
          user={user}
          loading={loading}
          onOpen={setView}
          scholarshipTypes={scholarshipTypes}
          onOpenScholarship={(typeBourseId) => {
            setEnrollmentTypeBourseId(typeBourseId);
            setEnrollmentSearch("");
            setEnrollmentPage(1);
            setView("Inscriptions");
          }}
        />
      ) : activeView === "Profil" ? (
        <ProfilePage user={user} onLogout={logout} onUpdated={(updated) => { setTemporaryUser(updated); window.sessionStorage.setItem("ipaim-user", JSON.stringify(updated)); }} />
      ) : activeView === "Paramètres" ? (
        <SettingsPage currentUser={user} onRefresh={refresh} />
      ) : activeView === "À propos du SGI" ? (
        <AboutSgiPage onBack={() => setView("Vue d'ensemble")} />
      ) : activeView === "Personnes" ? (
        <PeoplePage
          people={people}
          peopleMeta={peopleMeta}
          onPeopleSearch={(value) => {
            setPeopleSearch(value);
            setPeoplePage(1);
          }}
          onPeoplePage={setPeoplePage}
          onRefresh={refresh}
        />
      ) : activeView === "Recrutement" ? (
        <PersonnelPage
          data={personnelApplications}
          meta={personnelMeta}
          search={personnelSearch}
          onSearch={(value) => {
            setPersonnelSearch(value);
            setPersonnelPage(1);
          }}
          onPage={setPersonnelPage}
          onRefresh={refresh}
          canEdit={hasAccess(user, "recruiting", "edit")}
        />
      ) : activeView === "Référentiels" ? (
        <ReferencesPage onRefresh={refresh} />
      ) : activeView === "Corbeille" ? (
        <TrashPage />
      ) : activeView === "Synchronisation" ? (
        <OfflineSyncPage
          needsOnlineAuthentication={!token && Boolean(offlineAccount)}
          onReconnect={() => {
            window.sessionStorage.removeItem("ipaim-offline-session");
            window.sessionStorage.removeItem("ipaim-user");
            setTemporaryToken(null);
            setTemporaryUser(null);
            notifySessionChanged();
          }}
        />
      ) : activeView === "Rapports" ? (
        <ReportsPage />
      ) : activeView === "Certificats" ? (
        <CertificatesPage refreshSignal={refreshKey} />
      ) : activeView === "Suppression des dossiers" ? (
        <DeletionInfoPage onBack={() => setView(deletionInfoReturnView)} />
      ) : activeView === "Fiche dossier" && dossierReference ? (
        <DossierDetailsPage
          reference={dossierReference}
          returnView={dossierReturnView}
          scholarshipTypes={scholarshipTypes}
          onBack={() => setView(dossierReturnView)}
          onRefresh={refresh}
          onShowDeletionInfo={(returnView) => {
            setDeletionInfoReturnView(returnView);
            setView("Suppression des dossiers");
          }}
        />
      ) : (
        <OperationsPage
          view={activeView}
          applications={applications}
          enrollments={enrollments}
          prospects={prospects}
          people={people}
          latePayments={latePayments}
          scholarshipTypes={scholarshipTypes}
          applicationMeta={applicationMeta}
          applicationStatus={applicationStatus || "ALL"}
          applicationsLoading={applicationLoading}
          onApplicationStatusChange={(value) => { setApplicationStatus(value === "ALL" ? "" : value); setApplicationPage(1); }}
          onApplicationSearch={(value) => {
            setApplicationSearch(value);
            setApplicationPage(1);
          }}
          onApplicationPage={setApplicationPage}
          enrollmentMeta={enrollmentMeta}
          enrollmentStatus={enrollmentStatus || "ALL"}
          enrollmentsLoading={enrollmentLoading}
          onEnrollmentStatusChange={(value) => { setEnrollmentStatus(value === "ALL" ? "" : value); setEnrollmentPage(1); }}
          enrollmentTypeBourseId={enrollmentTypeBourseId}
          onEnrollmentTypeBourseChange={(typeBourseId) => {
            setEnrollmentTypeBourseId(typeBourseId);
            setEnrollmentPage(1);
          }}
          onEnrollmentSearch={(value) => {
            setEnrollmentSearch(value);
            setEnrollmentPage(1);
          }}
          onEnrollmentPage={setEnrollmentPage}
          prospectMeta={prospectMeta}
          onProspectSearch={(value) => {
            setProspectSearch(value);
            setProspectPage(1);
          }}
          onProspectPage={setProspectPage}
          onRefresh={refresh}
          onShowDeletionInfo={(returnView) => {
            setDeletionInfoReturnView(returnView);
            setView("Suppression des dossiers");
          }}
          onOpenDossier={(reference) => {
            setDossierReference(reference);
            setDossierReturnView(view === "Inscriptions" ? "Inscriptions" : "Demandes de bourse");
            setView("Fiche dossier");
          }}
        />
      )}
      {stableNoticeOpen && (
        <div className="modal-backdrop stable-notice-backdrop" onMouseDown={dismissStableNotice}>
          <section className="modal stable-notice-modal" role="dialog" aria-modal="true" aria-labelledby="stable-notice-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="stable-notice-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">IPAIM · Système de gestion intégré</p>
            <h2 id="stable-notice-title">Votre espace est à jour.</h2>
            <p>Vous utilisez la dernière version stable du SGI IPAIM, conçue pour rendre le suivi de vos activités plus clair et plus maîtrisé.</p>
            <div className="stable-notice-actions">
              <button className="text-button" onClick={() => { dismissStableNotice(); setView("À propos du SGI"); }}>En savoir plus <span>→</span></button>
              <button className="primary-button compact" onClick={dismissStableNotice}>Continuer</button>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
