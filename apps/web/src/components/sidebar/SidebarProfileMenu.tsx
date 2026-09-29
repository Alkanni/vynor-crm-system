'use client';

import { ChevronDown, Keyboard, Laptop, Moon, Power, Radio, Sun, UserPen } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { useUiStore, type AvailabilityStatus, type ThemePreference } from '@/lib/store/ui-store';
import {
  Avatar,
  Button,
  DropdownBody,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownSeparator,
} from '@/components/ui';
import { cn } from '@/lib/utils';

const AVAILABILITY: { value: AvailabilityStatus; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: 'bg-n-teal-9' },
  { value: 'busy', label: 'Busy', color: 'bg-n-amber-9' },
  { value: 'offline', label: 'Offline', color: 'bg-n-slate-9' },
];

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

const REALTIME_LABEL: Record<string, { label: string; dot: string }> = {
  connected: { label: 'Connected', dot: 'bg-n-teal-9' },
  connecting: { label: 'Connecting…', dot: 'bg-n-amber-9 animate-loader-pulse' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-n-amber-9 animate-loader-pulse' },
  disconnected: { label: 'Disconnected', dot: 'bg-n-slate-9' },
  auth_error: { label: 'Sign-in required', dot: 'bg-n-ruby-9' },
};

/** Port of VYNOR `SidebarProfileMenu.vue` + `SidebarProfileMenuStatus.vue`. */
export function SidebarProfileMenu({ collapsed = false }: { collapsed?: boolean | undefined }) {
  const { actor, signOut } = useAuth();
  const { status } = useRealtime();
  const { availability, setAvailability, theme, setTheme, toggleShortcutsModal } = useUiStore();

  const name = actor?.user.displayName || actor?.user.email?.split('@')[0] || 'Operator';
  const email = actor?.user.email ?? '';
  const activeStatus = AVAILABILITY.find((s) => s.value === availability) ?? AVAILABILITY[0]!;
  const realtime = REALTIME_LABEL[status] ?? REALTIME_LABEL.disconnected!;

  return (
    <DropdownMenu
      className={cn('min-w-0', collapsed ? 'w-auto' : 'w-full')}
      trigger={({ isOpen, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={collapsed ? name : undefined}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg p-1 text-left hover:bg-n-alpha-1',
            isOpen && 'bg-n-alpha-1',
            collapsed ? 'justify-center' : 'w-full',
          )}
        >
          <Avatar
            size={32}
            name={name}
            src={actor?.user.avatarUrl}
            status={availability}
            className="shrink-0"
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-4 text-n-slate-12">
                {name}
              </span>
              <span className="block truncate text-xs text-n-slate-11">{email}</span>
            </span>
          )}
        </button>
      )}
    >
      <DropdownBody className="bottom-full left-0 z-50 mb-2 w-80">
        <DropdownSection listClassName="overflow-visible">
          <DropdownItem preserveOpen className="gap-1">
            <span className="flex min-w-0 grow items-center gap-1">Set your availability</span>
            <DropdownMenu
              className="shrink-0"
              trigger={({ toggle }) => (
                <Button
                  size="sm"
                  color="slate"
                  variant="faded"
                  icon={ChevronDown}
                  trailingIcon
                  onClick={toggle}
                  aria-label="Change availability"
                >
                  <span className="flex min-w-0 items-center gap-1 text-sm">
                    <span className="shrink-0 p-1">
                      <span className={cn('block size-2 rounded-xs', activeStatus.color)} />
                    </span>
                    <span className="max-w-[7rem] truncate">{activeStatus.label}</span>
                  </span>
                </Button>
              )}
            >
              <DropdownBody className="right-0 top-full z-20 mt-1 min-w-32">
                {AVAILABILITY.map((option) => (
                  <DropdownItem
                    key={option.value}
                    label={option.label}
                    leading={<span className={cn('size-2 shrink-0 rounded-xs', option.color)} />}
                    onClick={() => setAvailability(option.value)}
                  />
                ))}
              </DropdownBody>
            </DropdownMenu>
          </DropdownItem>
          <DropdownItem preserveOpen className="gap-2">
            <span className="grow">Appearance</span>
            <span
              role="radiogroup"
              aria-label="Theme"
              className="flex items-center gap-0.5 rounded-lg bg-n-alpha-1 p-0.5 dark:bg-n-solid-1"
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  title={label}
                  aria-label={`${label} theme`}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'grid size-7 place-content-center rounded-md transition-colors',
                    theme === value
                      ? 'bg-n-solid-active text-n-blue-11 shadow-sm outline outline-1 outline-n-container'
                      : 'text-n-slate-10 hover:text-n-slate-12',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </span>
          </DropdownItem>
        </DropdownSection>
        <DropdownSeparator />
        <DropdownItem icon={Keyboard} label="Keyboard shortcuts" onClick={toggleShortcutsModal} />
        <DropdownItem icon={UserPen} label="Profile settings" href="/settings" />
        <DropdownItem preserveOpen className="gap-3 rounded-lg">
          <Radio className="size-4 shrink-0 text-n-slate-11" aria-hidden="true" />
          <span className="grow">Realtime</span>
          <span className="flex items-center gap-1.5 text-xs text-n-slate-11" aria-live="polite">
            <span className={cn('size-2 rounded-full', realtime.dot)} />
            {realtime.label}
          </span>
        </DropdownItem>
        <DropdownItem icon={Power} label="Log out" onClick={() => void signOut()} />
      </DropdownBody>
    </DropdownMenu>
  );
}
