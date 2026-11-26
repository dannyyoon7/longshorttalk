"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

export type Profile = { nickname: string; emoji: string };

const DEFAULT_PROFILE: Profile = { nickname: "게스트트레이더", emoji: "🐳" };

const EMOJI_POOL = ["🐳", "🦈", "🐺", "🦊", "🐯", "🦁", "🐸", "🦅", "🐙", "🦄"];

let state: Profile = DEFAULT_PROFILE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export const profileStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): Profile {
    return state;
  },
  getServerSnapshot(): Profile {
    return DEFAULT_PROFILE;
  },
  hydrate(): void {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.profile);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Profile>;
        if (parsed.nickname) {
          state = {
            nickname: String(parsed.nickname).slice(0, 16),
            emoji: parsed.emoji || DEFAULT_PROFILE.emoji,
          };
          emit();
          return;
        }
      }
      state = {
        nickname: `개미${Math.floor(1000 + Math.random() * 9000)}`,
        emoji: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)],
      };
      persist();
      emit();
    } catch {
      /* noop */
    }
  },
  update(patch: Partial<Profile>): void {
    state = {
      nickname: (patch.nickname ?? state.nickname).slice(0, 16) || state.nickname,
      emoji: patch.emoji ?? state.emoji,
    };
    persist();
    emit();
  },
};

export function useProfile(): Profile {
  return useSyncExternalStore(
    profileStore.subscribe,
    profileStore.getSnapshot,
    profileStore.getServerSnapshot,
  );
}
