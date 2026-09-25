'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/lib/store/ui-store';

interface UseInboxShortcutsOptions {
  onNextConversation?: () => void;
  onPrevConversation?: () => void;
  onFocusComposer?: () => void;
  onClaimConversation?: () => void;
  onCompleteConversation?: () => void;
  enabled?: boolean;
}

/**
 * High-Velocity Keyboard Shortcuts for the Unified Inbox Operational Loop (Section 41 & 50)
 *
 * Supported keys:
 * - J: Select next conversation in list
 * - K: Select previous conversation in list
 * - C: Focus message composer textarea
 * - A: Claim conversation (Take ownership)
 * - E: Complete conversation (Archive & move to next)
 * - Alt+N: Toggle Internal Note mode (handled globally or here)
 * - [: Toggle navigation rail collapse
 * - ]: Toggle customer context panel collapse
 */
export function useInboxKeyboardShortcuts({
  onNextConversation,
  onPrevConversation,
  onFocusComposer,
  onClaimConversation,
  onCompleteConversation,
  enabled = true,
}: UseInboxShortcutsOptions) {
  const { toggleComposerMode, toggleSidebarCollapsed, toggleCustomerContext } = useUiStore();

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Alt+N toggles internal note mode from anywhere
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        toggleComposerMode();
        onFocusComposer?.();
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox');

      // If user is inside an input/textarea, ignore single-character shortcuts
      if (isInputFocused) {
        return;
      }

      // Panel toggles
      if (e.key === '[') {
        e.preventDefault();
        toggleSidebarCollapsed();
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        toggleCustomerContext();
        return;
      }

      // Operational Loop single keys
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          onNextConversation?.();
          break;
        case 'k':
          e.preventDefault();
          onPrevConversation?.();
          break;
        case 'c':
          e.preventDefault();
          onFocusComposer?.();
          break;
        case 'a':
          e.preventDefault();
          onClaimConversation?.();
          break;
        case 'e':
          e.preventDefault();
          onCompleteConversation?.();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onNextConversation,
    onPrevConversation,
    onFocusComposer,
    onClaimConversation,
    onCompleteConversation,
    toggleComposerMode,
    toggleSidebarCollapsed,
    toggleCustomerContext,
  ]);
}
