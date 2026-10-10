import {
  ArrowUpRight,
  Ban,
  Banknote,
  CalendarClock,
  CalendarPlus,
  Eye,
  EyeOff,
  FolderOpen,
  Gavel,
  History,
  Link2,
  type LucideIcon,
  Pencil,
  PhoneCall,
  Printer,
  ScrollText,
  Trash2,
  Undo2,
  UserRoundPen,
} from "lucide-react";

// Icônes des actions de ligne, tirées de la bibliothèque Lucide pour un tracé
// homogène. Chaque bouton garde un libellé accessible (aria-label), affiché en
// infobulle au survol et au focus clavier.
const icons: Record<string, LucideIcon> = {
  decide: Gavel,
  pieces: FolderOpen,
  finance: Banknote,
  interview: CalendarClock,
  schedule: CalendarPlus,
  person: UserRoundPen,
  edit: Pencil,
  delete: Trash2,
  cancel: Ban,
  history: History,
  relance: PhoneCall,
  print: Printer,
  assign: Link2,
  details: Eye,
  hide: EyeOff,
  restore: Undo2,
  open: ArrowUpRight,
  journal: ScrollText,
};

export function ActionIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? ArrowUpRight;
  return <Icon className="action-icon" size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
