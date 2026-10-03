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
import { PersonnelPage } from "@/components/personnel-page";
import {
  PeoplePage,
  ReferencesPage,
  ReportsPage,
} from "@/components/additional-pages";
import { apiFetch, notifySessionChanged } from "@/lib/api";
import { OfflineAccount } from "@/lib/offline";
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
  const [applicationPage, setApplicationPage] = useState(1);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentMeta, setEnrollmentMeta] = useState<EnrollmentPage["meta"]>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [enrollmentPage, setEnrollmentPage] = useState(1);
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
  const [offlineAccessWarning, setOfflineAccessWarning] = useState(false);
  const token = temporaryToken ?? storedToken;
  const user =
    temporaryUser ?? (storedUser ? (JSON.parse(storedUser) as User) : null) ??
    (storedOfflineSession ? (JSON.parse(storedOfflineSession) as OfflineAccount).user : null);
  const offlineAccount = storedOfflineSession
    ? JSON.parse(storedOfflineSession) as OfflineAccount
    : null;

  useEffect(() => {
    if (!token && !storedOfflineSession) return;
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [
          summaryData,
          applicationData,
          enrollmentData,
          prospectData,
          personData,
          personnelData,
          paymentData,
          typeData,
        ] = await Promise.all([
          apiFetch<Summary>("/rapports/synthese"),
          apiFetch<ApplicationPage>(
            `/demandes-bourse?page=${applicationPage}&limit=20${applicationSearch ? `&q=${encodeURIComponent(applicationSearch)}` : ""}`,
          ),
          apiFetch<EnrollmentPage>(
            `/inscriptions?page=${enrollmentPage}&limit=20${enrollmentSearch ? `&q=${encodeURIComponent(enrollmentSearch)}` : ""}${enrollmentTypeBourseId ? `&typeBourseId=${encodeURIComponent(enrollmentTypeBourseId)}` : ""}`,
          ),
          apiFetch<ProspectPage>(
            `/prospects?page=${prospectPage}&limit=20${prospectSearch ? `&q=${encodeURIComponent(prospectSearch)}` : ""}`,
          ),
          apiFetch<PersonPage>(
            `/personnes?page=${peoplePage}&limit=20${
              peopleSearch
                ? `&q=${encodeURIComponent(peopleSearch)}`
                : ""
            }`,
          ),
          apiFetch<PersonnelApplicationPage>(
            `/candidatures-personnel?page=${personnelPage}&limit=20${personnelSearch ? `&q=${encodeURIComponent(personnelSearch)}` : ""}`,
          ),
          apiFetch<{ echeances: LatePayment[] }>(
            "/rapports/paiements-en-retard",
          ),
          apiFetch<ScholarshipType[]>("/types-bourse"),
        ]);
        setSummary(summaryData);
        setApplications(applicationData.data);
        setApplicationMeta(applicationData.meta);
        setEnrollments(enrollmentData.data);
        setEnrollmentMeta(enrollmentData.meta);
        setProspects(prospectData.data);
        setProspectMeta(prospectData.meta);
        setPeople(personData.data);
        setPeopleMeta(personData.meta);
        setPersonnelApplications(personnelData.data);
        setPersonnelMeta(personnelData.meta);
        setLatePayments(paymentData.echeances);
        setScholarshipTypes(typeData);
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
    applicationPage,
    applicationSearch,
    enrollmentPage,
    enrollmentSearch,
    enrollmentTypeBourseId,
    prospectPage,
    prospectSearch,
    peoplePage,
    peopleSearch,
    personnelPage,
    personnelSearch,
    token,
    storedOfflineSession,
    refreshKey,
  ]);

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
      activeView={view}
      setActiveView={setView}
      user={user}
      summary={summary}
      onLogout={logout}
      onProfile={() => setView("Profil")}
      onSettings={() => setView("Paramètres")}
    >
      <AppHeader title={view} onRefresh={refresh} />
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
      {view === "Vue d'ensemble" ? (
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
      ) : view === "Profil" ? (
        <ProfilePage user={user} onLogout={logout} onUpdated={(updated) => { setTemporaryUser(updated); window.sessionStorage.setItem("ipaim-user", JSON.stringify(updated)); }} />
      ) : view === "Paramètres" ? (
        <SettingsPage currentUser={user} onRefresh={refresh} />
      ) : view === "Personnes" ? (
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
      ) : view === "Recrutement" ? (
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
        />
      ) : view === "Référentiels" ? (
        <ReferencesPage onRefresh={refresh} />
      ) : view === "Synchronisation" ? (
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
      ) : view === "Rapports" ? (
        <ReportsPage />
      ) : view === "Certificats" ? (
        <CertificatesPage refreshSignal={refreshKey} />
      ) : view === "Suppression des dossiers" ? (
        <DeletionInfoPage onBack={() => setView(deletionInfoReturnView)} />
      ) : view === "Fiche dossier" && dossierReference ? (
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
          view={view}
          applications={applications}
          enrollments={enrollments}
          prospects={prospects}
          people={people}
          latePayments={latePayments}
          scholarshipTypes={scholarshipTypes}
          applicationMeta={applicationMeta}
          onApplicationSearch={(value) => {
            setApplicationSearch(value);
            setApplicationPage(1);
          }}
          onApplicationPage={setApplicationPage}
          enrollmentMeta={enrollmentMeta}
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
    </DashboardLayout>
  );
}
