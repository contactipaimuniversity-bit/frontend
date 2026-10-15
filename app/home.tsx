"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { DashboardHome } from "@/components/dashboard-home";
import { DailySummaryPage } from "@/components/daily-summary-page";
import { OfflineSync, OfflineSyncPage } from "@/components/offline-sync";
import { CertificatesPage } from "@/components/certificates-page";
import { DashboardLayout, AppHeader } from "@/components/dashboard-layout";
import { ProfilePage, SettingsPage } from "@/components/account-pages";
import { LoginScreen } from "@/components/login-screen";
import { DossierDetailsPage, OperationsPage } from "@/components/operations-page";
import { DeletionInfoPage } from "@/components/deletion-info-page";
import { TrashPage } from "@/components/trash-page";
import { AuditPage } from "@/components/audit-page";
import { PrintsPage } from "@/components/prints-page";
import { AcademicStructurePage } from "@/components/academic-structure-page";
import { AcademicDashboardPage } from "@/components/academic-dashboard-page";
import { FutureStudentsPage } from "@/components/future-students-page";
import { AcademicClassesPage } from "@/components/academic-classes-page";
import { AcademicGradesPage, AcademicTeachingPage } from "@/components/academic-teaching-page";
import { AcademicResultsPage, AcademicStatsPage } from "@/components/academic-results-page";
import { HrPage } from "@/components/hr-page";
import { PayrollPage } from "@/components/payroll-page";
import { AccountingPage, BackupsPage } from "@/components/accounting-page";
import { flushPrintLog } from "@/lib/print-log";
import { usePageTimeTracker } from "@/lib/page-tracker";
import { useClickTracker } from "@/lib/click-tracker";
import { PersonnelPage } from "@/components/personnel-page";
import { AboutSgiPage } from "@/components/about-sgi-page";
import { BudgetPage, ExpenseApprovalPage, ExpenseExecutionPage, ExpensesPage, FinanceSettingsPage } from "@/components/expenses-pages";
import {
  PeoplePage,
  ReferencesPage,
  ReportsPage,
} from "@/components/additional-pages";
import { apiFetch, notifySessionChanged } from "@/lib/api";
import { applyColorMode, applyColorPreset, applyFont, applyTextSize, applyUiStyle, readColorMode, readColorPreset, readFont, readTextSize, readUiStyle } from "@/lib/theme";
import { OfflineAccount } from "@/lib/offline";
import { forgetDataKey } from "@/lib/local-crypto";
import { canAccessView, canOpenPersonFile, hasAccess } from "@/lib/access";
import { helpReturnPath, navigateTo, parsePath, pathForDossier, pathForHelp, pathForView } from "@/lib/routes";
import { PageHelpPage } from "@/components/page-help-page";
import { UserManualPage } from "@/components/user-manual-page";
import { PersonFilePage } from "@/components/person-file-page";
import { CardCheckPage } from "@/components/card-check-page";
import { MANUALS } from "@/lib/manuals";
import { useWork, workBadges } from "@/lib/work";
import { FeedbackHost } from "@/components/feedback";
import {
  Application,
  ApplicationPage,
  DateOrder,
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
  const pathname = usePathname();
  const route = parsePath(pathname);
  const view = route.view;
  const setView = (next: ViewName) => navigateTo(pathForView(next));
  const dossierReference = route.dossier;
  const helpFor = route.helpFor ?? "Vue d'ensemble";
  const manualSection = route.manualSection ?? "finances";
  const dossierReturnView = route.dossier?.type === "inscription" ? "Inscriptions" as const : "Demandes de bourse" as const;
  const [deletionInfoReturnView, setDeletionInfoReturnView] = useState<"Demandes de bourse" | "Inscriptions">("Demandes de bourse");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateOrder, setDateOrder] = useState<DateOrder>("desc");
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
  const [applicationTypeBourseId, setApplicationTypeBourseId] = useState("");
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
  const [sessionExpired, setSessionExpired] = useState(false);
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
  // Mêmes règles que le backend (auth/access-control.ts) : les types de bourse
  // servent aux décisions et aux inscriptions, les retards à la page Paiements.
  const canViewScholarshipTypes = hasAccess(user, "references") || canViewScholarships || canViewEnrollments || hasAccess(user, "payments");
  const canViewLatePayments = hasAccess(user, "reports") || hasAccess(user, "payments");
  const offlineAccount = storedOfflineSession
    ? JSON.parse(storedOfflineSession) as OfflineAccount
    : null;
  const applicationEndpoint = `/demandes-bourse?page=${applicationPage}&limit=20&ordreDate=${dateOrder}${applicationSearch ? `&q=${encodeURIComponent(applicationSearch)}` : ""}${applicationStatus ? `&statut=${encodeURIComponent(applicationStatus)}` : ""}${applicationTypeBourseId ? `&typeBourseId=${encodeURIComponent(applicationTypeBourseId)}` : ""}`;
  const enrollmentEndpoint = `/inscriptions?page=${enrollmentPage}&limit=20&ordreDate=${dateOrder}${enrollmentSearch ? `&q=${encodeURIComponent(enrollmentSearch)}` : ""}${enrollmentTypeBourseId ? `&typeBourseId=${encodeURIComponent(enrollmentTypeBourseId)}` : ""}${enrollmentStatus ? `&statut=${encodeURIComponent(enrollmentStatus)}` : ""}`;
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
  const adminOnlyView = view === "Audit" || view === "Corbeille" || view === "Impressions" || view === "Sauvegardes";
  const allowed = route.personId ? canOpenPersonFile(user) : canAccessView(user, view);
  const activeView = !allowed || (adminOnlyView && user?.role !== "admin") ? "Vue d'ensemble" : view;
  // Le travail en attente est recompté à chaque changement d'écran : les pastilles du menu suivent.
  const work = useWork(user, `${refreshKey}|${activeView}`);
  usePageTimeTracker(pathname ?? "/", activeView, token);
  // Impressions faites hors ligne ou session expirée : on les déclare dès la connexion.
  useEffect(() => {
    if (!token) return;
    const declare = () => void flushPrintLog();
    declare();
    // Retour du réseau ou du serveur en cours de session : même déclaration.
    window.addEventListener("online", declare);
    window.addEventListener("ipaim-server-online", declare);
    return () => {
      window.removeEventListener("online", declare);
      window.removeEventListener("ipaim-server-online", declare);
    };
  }, [token]);
  useClickTracker(pathname ?? "/", activeView, token);

  useEffect(() => {
    const syncColorPreset = () => applyColorPreset(readColorPreset(), false);
    const syncColorMode = () => applyColorMode(readColorMode(), false);
    const syncUiStyle = () => applyUiStyle(readUiStyle(), false);
    syncColorPreset();
    syncColorMode();
    syncUiStyle();
    applyFont(readFont(), false);
    applyTextSize(readTextSize(), false);
    window.addEventListener("storage", syncColorPreset);
    window.addEventListener("storage", syncColorMode);
    window.addEventListener("storage", syncUiStyle);
    return () => {
      window.removeEventListener("storage", syncColorPreset);
      window.removeEventListener("storage", syncColorMode);
      window.removeEventListener("storage", syncUiStyle);
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
            `/prospects?page=${prospectPage}&limit=20&ordreDate=${dateOrder}${prospectSearch ? `&q=${encodeURIComponent(prospectSearch)}` : ""}`,
          ) : Promise.resolve(null),
          canViewPeople ? apiFetch<PersonPage>(
            `/personnes?page=${peoplePage}&limit=20&ordreDate=${dateOrder}${
              peopleSearch
                ? `&q=${encodeURIComponent(peopleSearch)}`
                : ""
            }`,
          ) : Promise.resolve(null),
          canViewRecruiting ? apiFetch<PersonnelApplicationPage>(
            `/candidatures-personnel?page=${personnelPage}&limit=20&ordreDate=${dateOrder}${personnelSearch ? `&q=${encodeURIComponent(personnelSearch)}` : ""}`,
          ) : Promise.resolve(null),
          canViewLatePayments ? apiFetch<{ echeances: LatePayment[] }>(
            "/rapports/paiements-en-retard",
          ) : Promise.resolve(null),
          canViewScholarshipTypes ? apiFetch<ScholarshipType[]>("/types-bourse") : Promise.resolve(null),
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
    dateOrder,
    canViewDashboard,
    canViewPeople,
    canViewProspects,
    canViewRecruiting,
    canViewScholarshipTypes,
    canViewLatePayments,
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
    // Un 401 signifie que le jeton n'est plus accepté. On l'explique dans une
    // fenêtre avant de renvoyer vers la connexion, plutôt que de faire
    // disparaître l'écran sans un mot.
    const announceExpiredSession = () => {
      if (window.sessionStorage.getItem("ipaim-token")) setSessionExpired(true);
    };
    window.addEventListener("ipaim-session-expired", announceExpiredSession);
    return () => window.removeEventListener("ipaim-session-expired", announceExpiredSession);
  }, []);

  // Ferme la session expirée (les enregistrements hors ligne en attente restent
  // sur l'appareil) ; l'adresse de la page est conservée pour y revenir.
  const reconnect = () => {
    window.sessionStorage.removeItem("ipaim-token");
    window.sessionStorage.removeItem("ipaim-user");
    setTemporaryToken(null);
    setTemporaryUser(null);
    setSessionExpired(false);
    setError("");
    notifySessionChanged();
  };

  useEffect(() => {
    if (!enteringApp) return;
    const timeoutId = window.setTimeout(() => setEnteringApp(false), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [enteringApp]);

  useEffect(() => {
    const refreshAfterSync = () => setRefreshKey((value) => value + 1);
    window.addEventListener("ipaim-sync-complete", refreshAfterSync);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").then(async () => {
        // Les fichiers chargés avant l'installation n'ont pas été vus par le service
        // worker : on les lui confie pour que l'application s'ouvre sans réseau dès la première visite.
        const registration = await navigator.serviceWorker.ready;
        const urls = performance.getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(`${window.location.origin}/_next/static/`));
        registration.active?.postMessage({ type: "cache-urls", urls: [...new Set(urls)] });
      }).catch(() => undefined);
    return () => window.removeEventListener("ipaim-sync-complete", refreshAfterSync);
  }, []);

  const logout = () => {
    window.sessionStorage.removeItem("ipaim-token");
    window.sessionStorage.removeItem("ipaim-user");
    window.sessionStorage.removeItem("ipaim-offline-session");
    forgetDataKey();
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
          <p>Chargement de vos dossiers et de vos données hors ligne.</p>
        </div>
      </main>
    );

  return (
    <DashboardLayout
      activeView={activeView}
      activeManual={activeView === "Manuel d'utilisation" ? manualSection : null}
      setActiveView={setView}
      user={user}
      badges={workBadges(work)}
      onLogout={logout}
      onProfile={() => setView("Profil")}
      onSettings={() => setView("Paramètres")}
    >
      <AppHeader
        title={activeView === "Manuel d'utilisation" ? `Manuel · ${MANUALS[manualSection].title}` : activeView}
        user={user}
        onRefresh={refresh}
        onHelp={activeView === "Aide de la page" || activeView === "Manuel d'utilisation" ? undefined : () => navigateTo(pathForHelp(activeView, pathname))}
      />
      <OfflineSync onOpenPage={() => setView("Synchronisation")} />
      {offlineAccessWarning && (
        <div className="api-error">
          L’accès hors ligne n’a pas pu être activé sur cet appareil. Vérifiez les paramètres de stockage du navigateur.
          <button onClick={() => setOfflineAccessWarning(false)}>Fermer</button>
        </div>
      )}
      {error && !sessionExpired && (
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
          onOpenDaily={() => setView("Résumé de la journée")}
          scholarshipTypes={scholarshipTypes}
          refreshSignal={refreshKey}
          work={work}
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
        <SettingsPage currentUser={user} onRefresh={refresh} section={route.settingsSection ?? null} onOpenSection={(section) => navigateTo(section ? `/parametres/${section}` : "/parametres")} onOpenView={setView} />
      ) : activeView === "À propos du SGI" ? (
        <AboutSgiPage onBack={() => setView("Vue d'ensemble")} />
      ) : activeView === "Résumé de la journée" ? (
        <DailySummaryPage onBack={() => setView("Vue d'ensemble")} />
      ) : activeView === "Personnes" && route.personId ? (
        <PersonFilePage key={route.personId} personId={route.personId} user={user} refreshSignal={refreshKey} />
      ) : activeView === "Personnes" ? (
        <PeoplePage
          people={people}
          peopleMeta={peopleMeta}
          dateOrder={dateOrder}
          onDateOrderChange={setDateOrder}
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
          dateOrder={dateOrder}
          onDateOrderChange={setDateOrder}
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
      ) : activeView === "Audit" ? (
        <AuditPage refreshSignal={refreshKey} focusUserId={route.auditUserId} />
      ) : activeView === "Futurs étudiants" ? (
        <FutureStudentsPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Tableau de bord académique" ? (
        <AcademicDashboardPage refreshSignal={refreshKey} />
      ) : activeView === "Structure académique" ? (
        <AcademicStructurePage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Classes et étudiants" ? (
        <AcademicClassesPage user={user} refreshSignal={refreshKey} classId={route.classId ?? null} classSection={route.classSection ?? null} studentId={route.studentId ?? null} />
      ) : activeView === "Enseignement" ? (
        <AcademicTeachingPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Évaluations et notes" ? (
        <AcademicGradesPage user={user} refreshSignal={refreshKey} courseId={route.gradeCourseId ?? null} evaluationId={route.gradeEvaluationId ?? null} />
      ) : activeView === "Délibérations" ? (
        <AcademicResultsPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Statistiques académiques" ? (
        <AcademicStatsPage refreshSignal={refreshKey} />
      ) : activeView === "Personnel" ? (
        <HrPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Paie" ? (
        <PayrollPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Comptabilité" ? (
        <AccountingPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Sauvegardes" ? (
        <BackupsPage refreshSignal={refreshKey} />
      ) : activeView === "Impressions" ? (
        <PrintsPage refreshSignal={refreshKey} />
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
      ) : activeView === "États de besoin" ? (
        <ExpensesPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Validation des dépenses" ? (
        <ExpenseApprovalPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Exécution des dépenses" ? (
        <ExpenseExecutionPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Budget" ? (
        <BudgetPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Paramètres finances" ? (
        <FinanceSettingsPage user={user} refreshSignal={refreshKey} />
      ) : activeView === "Rapports" ? (
        <ReportsPage />
      ) : activeView === "Certificats" ? (
        <CertificatesPage refreshSignal={refreshKey} dateOrder={dateOrder} onDateOrderChange={setDateOrder} />
      ) : activeView === "Contrôle des cartes" ? (
        <CardCheckPage user={user} />
      ) : activeView === "Manuel d'utilisation" ? (
        <UserManualPage key={manualSection} section={manualSection} user={user} onOpen={setView} />
      ) : activeView === "Aide de la page" ? (
        <PageHelpPage view={helpFor} onBack={() => navigateTo(helpReturnPath(helpFor))} />
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
          dateOrder={dateOrder}
          onDateOrderChange={setDateOrder}
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
          applicationTypeBourseId={applicationTypeBourseId}
          onApplicationTypeBourseChange={(typeBourseId) => { setApplicationTypeBourseId(typeBourseId); setApplicationPage(1); }}
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
          onOpenDossier={(reference) => navigateTo(pathForDossier(reference))}
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
      <FeedbackHost />
      {sessionExpired && (
        <div className="modal-backdrop session-expired-backdrop">
          <section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" aria-describedby="session-expired-text">
            <div className="confirm-icon" aria-hidden="true"><Clock /></div>
            <h3 id="session-expired-title">Votre session a expiré</h3>
            <p id="session-expired-text">Pour protéger les données, la connexion se ferme automatiquement après un certain temps. Reconnectez-vous pour reprendre là où vous en étiez.</p>
            <p className="panel-subtitle">Une saisie en cours non enregistrée devra être refaite.</p>
            <div className="form-actions">
              <button autoFocus className="primary-button compact" onClick={reconnect}>Se reconnecter</button>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
