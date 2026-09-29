'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { VynorLogo } from '@/components/common/VynorLogo';
import { DropdownBody, DropdownItem, DropdownMenu, DropdownSection } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Port of VYNOR `components-next/sidebar/SidebarAccountSwitcher.vue`. */
export function SidebarAccountSwitcher({
  collapsed = false,
  className,
}: {
  collapsed?: boolean | undefined;
  className?: string | undefined;
}) {
  const actor = useActor();
  const workspaceName = actor?.workspace.name ?? 'VYNOR Workspace';
  const role = actor?.membership.roles[0]?.replace(/_/g, ' ').toLowerCase() ?? 'agent';

  return (
    <DropdownMenu
      className={cn('min-w-0', className)}
      trigger={({ isOpen, toggle }) =>
        collapsed ? (
          <button
            type="button"
            onClick={toggle}
            title={workspaceName}
            aria-label={`Workspace: ${workspaceName}`}
            className={cn(
              'grid shrink-0 place-content-center rounded-lg p-2 hover:bg-n-alpha-1',
              isOpen && 'bg-n-alpha-1',
            )}
          >
            <VynorLogo variant="mark" size={28} />
          </button>
        ) : (
          <button
            type="button"
            id="sidebar-account-switcher"
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={cn(
              'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 hover:bg-n-alpha-1',
              isOpen && 'bg-n-alpha-1',
            )}
          >
            <span
              className="truncate text-sm font-medium leading-5 text-n-slate-12"
              aria-live="polite"
            >
              {workspaceName}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-n-slate-10" />
          </button>
        )
      }
    >
      <DropdownBody className="left-0 top-full z-50 mt-2 min-w-80">
        <DropdownSection title="Switch account">
          <DropdownItem preserveOpen>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="min-w-0 max-w-36 truncate text-n-slate-12" title={workspaceName}>
                {workspaceName}
              </span>
              <span className="h-3 w-px shrink-0 bg-n-strong" />
              <span className="max-w-24 truncate capitalize text-n-slate-11">{role}</span>
            </span>
            <Check className="size-5 shrink-0 text-n-teal-11" aria-label="Current workspace" />
          </DropdownItem>
        </DropdownSection>
      </DropdownBody>
    </DropdownMenu>
  );
}
