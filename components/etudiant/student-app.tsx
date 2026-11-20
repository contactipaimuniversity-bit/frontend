"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BookOpenCheck, CalendarDays, House, UserRound, Wallet } from "lucide-react";
import { InstallBanner } from "@/components/etudiant/install-banner";
import { AnnouncementsScreen } from "@/components/etudiant/student-announcements";
import { StudentLogin } from "@/components/etudiant/student-login";
import { StudentSplash } from "@/components/etudiant/student-splash";
import { AbsencesScreen, HomeScreen, TimetableScreen } from "@/components/etudiant/student-screens";
import { FeesScreen, GradesScreen } from "@/components/etudiant/student-money-grades";
import { CardScreen, PasswordScreen, ProfileScreen } from "@/components/etudiant/student-profile";
import { StudentProfile, useStudentPhoto, useStudentResource, useStudentToken } from "@/lib/student-api";

const TABS = [
  { href: "/etudiant", label: "Accueil", icon: House, match: ["", "annonces"] },
  { href: "/etudiant/cours", label: "Cours", icon: CalendarDays, match: ["cours", "examens"] },
  { href: "/etudiant/notes", label: "Notes", icon: BookOpenCheck, match: ["notes"] },
  { href: "/etudiant/paiements", label: "Paiements", icon: Wallet, match: ["paiements"] },
  { href: "/etudiant/profil", label: "Profil", icon: UserRound, match: ["profil", "absences", "mot-de-passe"] },
] as const;

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/etudiant-sw.js", { scope: "/etudiant" })
      .then(async () => {
        const registration = await navigator.serviceWorker.ready;
        // Fichiers déjà chargés avant que le service worker ne prenne la main.
        const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch(() => undefined);
  }, []);
}

export function StudentApp() {
  const token = useStudentToken();
  useServiceWorker();
  if (token === undefined) return <div className="stu-root"><StudentSplash /></div>;
  return (
    <div className="stu-root">
      <StudentSplash />
      {token ? <StudentShell /> : (
        <>
          <div className="stu-install-slot"><InstallBanner /></div>
          <StudentLogin />
        </>
      )}
    </div>
  );
}

function StudentShell() {
  const pathname = usePathname();
  const tab = pathname.replace(/^\/etudiant\/?/, "").split("/")[0] ?? "";
  const profile = useStudentResource<StudentProfile>("/etudiant/moi");
  const photo = useStudentPhoto(Boolean(profile.data?.etudiant.aPhoto));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  let screen;
  switch (tab) {
    case "cours":
      screen = <TimetableScreen initial="semaine" />;
      break;
    case "examens":
      screen = <TimetableScreen initial="examens" />;
      break;
    case "notes":
      screen = <GradesScreen />;
      break;
    case "paiements":
      screen = <FeesScreen />;
      break;
    case "profil":
      screen = <ProfileScreen profile={profile} photo={photo} />;
      break;
    case "carte":
      screen = <CardScreen profile={profile.data} photo={photo} />;
      break;
    case "absences":
      screen = <AbsencesScreen />;
      break;
    case "annonces":
      screen = <AnnouncementsScreen />;
      break;
    case "mot-de-passe":
      screen = <PasswordScreen />;
      break;
    default:
      screen = <HomeScreen profile={profile} photo={photo} />;
  }

  return (
    <>
      <main className={`stu-main${tab === "carte" ? " stu-main-card" : ""}`}>
        {(tab === "" || tab === "profil") && <div className="stu-install-slot"><InstallBanner /></div>}
        {screen}
      </main>
      {tab !== "carte" && (
        <nav className="stu-tabbar" aria-label="Navigation principale">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = (match as readonly string[]).includes(tab);
            return (
              <Link key={href} href={href} className={active ? "on" : ""} aria-current={active ? "page" : undefined}>
                <span className="stu-tab-icon"><Icon strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" /></span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
