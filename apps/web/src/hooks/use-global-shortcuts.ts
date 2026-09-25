'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/lib/store/ui-store';

/**
 * Global Keyboard Shortcut Listener for VYNOR CRM (Section 11, 41)
 *
 * Supported interactions:
 * - Ctrl+K / Cmd+K: Open Command Palette
 * - ?: Open Keyboard Shortcuts Cheatsheet
 * - G-Chords (G followed by a key):
 *   - G + I: Navigate to /inbox
 *   - G + C: Navigate to /contacts
 *   - G + P: Navigate to /channels
 *   - G + A: Navigate to /ai-agent
 *   - G + B: Navigate to /campaigns (Broadcast)
 *   - G + T: Navigate to /tickets
 *   - G + D: Navigate to / (Dashboard)
 *   - G + R: Navigate to /analytics (Reports)
 *   - G + S: Navigate to /settings
 */
export function useGlobalShortcuts() {
  const router = useRouter();
  const { toggleCommandPalette, toggleShortcutsModal, commandPaletteOpen, shortcutsModalOpen } =
    useUiStore();
  const gKeyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isGKeyPressedRef = useRef(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox');

      // Command Palette (Ctrl+K or Cmd+K) - works everywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // If user is inside an input/textarea, ignore single-key and G-chords
      if (isInputFocused) {
        return;
      }

      // Cheatsheet modal (?)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }

      // Handle Escape to close active modals
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          toggleCommandPalette();
          return;
        }
        if (shortcutsModalOpen) {
          toggleShortcutsModal();
          return;
        }
      }

      // G-Chord navigation detection
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        isGKeyPressedRef.current = true;
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
        gKeyTimerRef.current = setTimeout(() => {
          isGKeyPressedRef.current = false;
        }, 1200);
        return;
      }

      if (isGKeyPressedRef.current) {
        const chord = e.key.toLowerCase();
        isGKeyPressedRef.current = false;
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);

        const routeMap: Record<string, string> = {
          i: '/inbox',
          c: '/contacts',
          p: '/channels',
          a: '/ai-agent',
          b: '/campaigns',
          t: '/tickets',
          d: '/',
          r: '/analytics',
          s: '/settings',
        };

        if (routeMap[chord]) {
          e.preventDefault();
          router.push(routeMap[chord]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current);
    };
  }, [router, toggleCommandPalette, toggleShortcutsModal, commandPaletteOpen, shortcutsModalOpen]);
}
