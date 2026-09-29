import {
  BarChart2,
  Bot,
  Cpu,
  FileCode,
  FileSpreadsheet,
  History,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Plug,
  Radio,
  Settings,
  Shield,
  Ticket,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Icon per navigation item id (`lib/auth/navigation.ts`). */
export const NAV_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  contacts: Users,
  channels: Radio,
  'ai-agent': Bot,
  campaigns: Megaphone,
  blast: FileSpreadsheet,
  tickets: Ticket,
  automations: Cpu,
  templates: FileCode,
  dashboard: LayoutDashboard,
  analytics: BarChart2,
  settings: Settings,
  'settings-team': UserPlus,
  'settings-roles': Shield,
  'settings-integrations': Plug,
  'settings-audit': History,
};

export function navIcon(id: string): LucideIcon {
  return NAV_ICONS[id] ?? LayoutDashboard;
}
