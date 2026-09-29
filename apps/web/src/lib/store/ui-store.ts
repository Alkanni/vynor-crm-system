import { create } from 'zustand';

/**
 * ARCHITECTURAL RULE: PROHIBITED SERVER-STATE DUPLICATION (FND-FE-005)
 *
 * 1. TanStack Query (@tanstack/react-query) owns ALL server domain data:
 *    - Conversations, messages, contacts, campaigns, channels, memberships, audit logs.
 *    - Server queries and mutations must never be synchronized or stored in Zustand.
 *
 * 2. Zustand is restricted STRICTLY to local, ephemeral client UI interaction state:
 *    - Sidebar width / collapse / mobile open status.
 *    - Active modal/dialog IDs.
 *    - Active client theme preference (light / dark / system).
 *    - Session expiry banner/dialog toggle.
 *
 * 3. NEVER copy, duplicate, or mirror server entity records into this Zustand store.
 *    Duplication leads to cache drift, inconsistency with optimistic updates,
 *    and prevents Socket.IO events from properly invalidating TanStack Query keys.
 */

/** Sidebar geometry mirrors VYNOR `components-next/sidebar/provider.js`. */
export const SIDEBAR_DEFAULT_WIDTH = 200;
export const SIDEBAR_MIN_WIDTH = 56;
export const SIDEBAR_COLLAPSED_THRESHOLD = 160;
export const SIDEBAR_MAX_WIDTH = 320;
const SIDEBAR_WIDTH_KEY = 'vynor_sidebar_width';

export type ThemePreference = 'light' | 'dark' | 'system';
export type AvailabilityStatus = 'online' | 'busy' | 'offline';

function clampSidebarWidth(width: number): number {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(width)));
}

function persist(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); UI state stays in memory.
  }
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export interface UiState {
  // Sidebar State (desktop width + collapse, mobile flyout)
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number, options?: { persist?: boolean }) => void;

  // Customer Context Panel State (320px right panel)
  customerContextOpen: boolean;
  toggleCustomerContext: () => void;
  setCustomerContextOpen: (open: boolean) => void;

  // Command Palette & Modal Shortcuts State
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;
  toggleShortcutsModal: () => void;

  // Unified Inbox Ephemeral UI State
  activeQueueTab: 'unassigned' | 'mine' | 'all';
  setActiveQueueTab: (tab: 'unassigned' | 'mine' | 'all') => void;
  composerMode: 'reply' | 'note';
  setComposerMode: (mode: 'reply' | 'note') => void;
  toggleComposerMode: () => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Theme State
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** Reads persisted preferences after hydration (theme + sidebar width). */
  hydratePreferences: () => void;

  // Agent availability shown on the sidebar profile avatar
  availability: AvailabilityStatus;
  setAvailability: (status: AvailabilityStatus) => void;

  // Modal / Dialog State
  activeModal: string | null;
  openModal: (modalId: string) => void;
  closeModal: () => void;

  // Session Expiry UI State
  isSessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => get().setSidebarCollapsed(!get().sidebarCollapsed),
  setSidebarCollapsed: (collapsed) => {
    const width = collapsed ? SIDEBAR_MIN_WIDTH : SIDEBAR_DEFAULT_WIDTH;
    set({ sidebarCollapsed: collapsed, sidebarWidth: width });
    persist(SIDEBAR_WIDTH_KEY, String(width));
  },
  setSidebarWidth: (width, options) => {
    const next = clampSidebarWidth(width);
    set({ sidebarWidth: next, sidebarCollapsed: next < SIDEBAR_COLLAPSED_THRESHOLD });
    if (options?.persist) persist(SIDEBAR_WIDTH_KEY, String(next));
  },

  customerContextOpen: true,
  toggleCustomerContext: () =>
    set((state) => ({ customerContextOpen: !state.customerContextOpen })),
  setCustomerContextOpen: (open) => set({ customerContextOpen: open }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  shortcutsModalOpen: false,
  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
  toggleShortcutsModal: () => set((state) => ({ shortcutsModalOpen: !state.shortcutsModalOpen })),

  activeQueueTab: 'mine',
  setActiveQueueTab: (tab) => set({ activeQueueTab: tab }),

  composerMode: 'reply',
  setComposerMode: (mode) => set({ composerMode: mode }),
  toggleComposerMode: () =>
    set((state) => ({ composerMode: state.composerMode === 'reply' ? 'note' : 'reply' })),

  selectedConversationId: null,
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),

  // Starts as 'system' on server and client alike to keep hydration stable;
  // `hydratePreferences` then restores the persisted choice.
  theme: 'system',
  setTheme: (theme) => {
    set({ theme });
    persist('vynor_theme', theme);
    applyThemePreference(theme);
  },
  hydratePreferences: () => {
    if (typeof window === 'undefined') return;
    try {
      const storedTheme = localStorage.getItem('vynor_theme');
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        set({ theme: storedTheme });
      }
      const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        get().setSidebarWidth(storedWidth);
      }
    } catch {
      // Ignore unavailable storage.
    }
  },

  availability: 'online',
  setAvailability: (status) => set({ availability: status }),

  activeModal: null,
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  isSessionExpired: false,
  setSessionExpired: (expired) => set({ isSessionExpired: expired }),
}));
