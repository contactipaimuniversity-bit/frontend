"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Pin } from "lucide-react";
import { EmptyState, Loaded, ScreenHeader, Section } from "@/components/etudiant/student-ui";
import { Announcement, markAnnouncementsRead, shortDate, useAnnouncements } from "@/lib/student-api";

function when(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return shortDate(value, { day: "numeric", month: "long" });
}

export function AnnouncementCard({ item, unread, open = false }: { item: Announcement; unread: boolean; open?: boolean }) {
  const [expanded, setExpanded] = useState(open);
  const long = item.contenu.length > 180;
  return (
    <article className={`stu-message${item.importance === "IMPORTANTE" ? " stu-message-important" : ""}${unread ? " stu-message-unread" : ""}`}>
      <header>
        <span className="stu-message-meta">
          {item.epinglee && <Pin size={13} aria-label="Épinglée" />}
          {item.importance === "IMPORTANTE" ? "Important · " : ""}{when(item.publieeLe)}
        </span>
        {unread && <span className="stu-message-dot" aria-label="Non lu" />}
      </header>
      <h3>{item.titre}</h3>
      <p className={expanded || !long ? "" : "stu-message-clamp"}>{item.contenu}</p>
      {long && <button type="button" className="stu-link" onClick={() => setExpanded((value) => !value)}>{expanded ? "Réduire" : "Lire la suite"}</button>}
      <footer>{item.auteur}</footer>
    </article>
  );
}

// Écran « Messages » : toutes les annonces ; les ouvrir les marque comme lues.
export function AnnouncementsScreen() {
  const announcements = useAnnouncements();
  // Ce qui était non lu à l'ouverture reste signalé pendant la visite.
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string> | null>(null);
  const data = announcements.data;

  useEffect(() => {
    if (!data) return;
    queueMicrotask(() => setUnreadAtOpen((previous) => previous ?? new Set(announcements.unread.map((item) => item.id))));
    markAnnouncementsRead(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement quand la liste arrive
  }, [data]);

  return (
    <div className="stu-screen">
      <ScreenHeader title="Messages" subtitle="Annonces de l'administration" back="/etudiant" />
      <Loaded resource={announcements} lines={3}>
        {(items) =>
          items.length ? (
            <div className="stu-list">{items.map((item) => <AnnouncementCard key={item.id} item={item} unread={Boolean(unreadAtOpen?.has(item.id))} open={items.length === 1} />)}</div>
          ) : (
            <EmptyState icon={null} title="Aucun message pour l'instant." />
          )
        }
      </Loaded>
    </div>
  );
}

/** Sur l'accueil : les messages non lus, importants d'abord. */
export function HomeAnnouncements() {
  const announcements = useAnnouncements();
  const items = [...announcements.unread].sort((a, b) => Number(b.importance === "IMPORTANTE") - Number(a.importance === "IMPORTANTE")).slice(0, 2);
  if (!items.length) return null;
  return (
    <Section title="Nouveaux messages" action={<Link href="/etudiant/annonces" className="stu-link">Tout lire</Link>}>
      <div className="stu-list">{items.map((item) => <AnnouncementCard key={item.id} item={item} unread />)}</div>
    </Section>
  );
}

/** Cloche de l'accueil, avec le nombre de messages non lus. */
export function MessagesBell() {
  const { unread } = useAnnouncements();
  return (
    <Link href="/etudiant/annonces" className="stu-icon-button stu-bell" aria-label={unread.length ? `${unread.length} message(s) non lu(s)` : "Messages"}>
      <Bell size={22} aria-hidden="true" />
      {unread.length > 0 && <span className="stu-badge">{unread.length > 9 ? "9+" : unread.length}</span>}
    </Link>
  );
}
