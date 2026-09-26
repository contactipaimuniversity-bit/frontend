"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DashboardHome } from "@/components/dashboard-home";
import { CertificatesPage } from "@/components/certificates-page";
import { DashboardLayout, AppHeader } from "@/components/dashboard-layout";
import { ProfilePage, SettingsPage } from "@/components/account-pages";
import { LoginScreen } from "@/components/login-screen";
import { OperationsPage } from "@/components/operations-page";
import { PersonnelPage } from "@/components/personnel-page";
import {
  PeoplePage,
  ReferencesPage,
  ReportsPage,
} from "@/components/additional-pages";
import { apiFetch, notifySessionChanged } from "@/lib/api";
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
  const [temporaryToken, setTemporaryToken] = useState<string | null>(null);
  const [temporaryUser, setTemporaryUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewName>("Vue d'ensemble");
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
  const [error, setError] = useState("");
  const token = temporaryToken ?? storedToken;
  const user =
    temporaryUser ?? (storedUser ? (JSON.parse(storedUser) as User) : null);

  useEffect(() => {
    if (!token) return;
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
            `/inscriptions?page=${enrollmentPage}&limit=20${enrollmentSearch ? `&q=${encodeURIComponent(enrollmentSearch)}` : ""}`,
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
    prospectPage,
    prospectSearch,
    peoplePage,
    peopleSearch,
    personnelPage,
    personnelSearch,
    token,
    refreshKey,
  ]);

  const logout = () => {
    window.sessionStorage.removeItem("ipaim-token");
    window.sessionStorage.removeItem("ipaim-user");
    setTemporaryToken(null);
    setTemporaryUser(null);
    notifySessionChanged();
  };
  const refresh = () => setRefreshKey((value) => value + 1);
  if (!token)
    return (
      <LoginScreen
        onLoggedIn={(newToken, newUser) => {
          setTemporaryToken(newToken);
          setTemporaryUser(newUser);
        }}
      />
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
          loading={loading}
          onOpen={setView}
        />
      ) : view === "Profil" ? (
        <ProfilePage user={user} onLogout={logout} />
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
      ) : view === "Rapports" ? (
        <ReportsPage />
      ) : view === "Certificats" ? (
        <CertificatesPage refreshSignal={refreshKey} />
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
        />
      )}
    </DashboardLayout>
  );
}
