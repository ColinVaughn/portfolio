import { Show, onMount, createEffect } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { listen } from "@tauri-apps/api/event";
import {
  user,
  setUser,
  authLoading,
  setAuthLoading,
  setConnectionState,
  selectedServerId,
  setSubscription,
  preferences,
  setPreferences,
  setUpdateInfo,
} from "./lib/stores";
import { getAuthState, connect, disconnect, getSubscription, loadPreferences, checkForUpdates } from "./lib/tauri";
import type { ConnectionState } from "./lib/types";
import LoginForm from "./components/LoginForm";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import ServersPage from "./pages/ServersPage";
import SettingsPage from "./pages/SettingsPage";

function AppShell(props: { children?: any }) {
  onMount(async () => {
    // Try restoring auth from keychain
    try {
      const profile = await getAuthState();
      if (profile) {
        setUser(profile);
        // Fetch subscription (already cached in Rust after auth restore)
        try {
          const sub = await getSubscription();
          setSubscription(sub);
        } catch (err) {
          console.error("Failed to fetch subscription:", err);
        }
      }
    } catch (err) {
      console.error("Auth restore failed:", err);
    } finally {
      setAuthLoading(false);
    }

    // Load user preferences immediately
    try {
      const prefs = await loadPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error("Failed to load preferences on startup:", err);
    }

    // Check for updates (non-blocking)
    checkForUpdates()
      .then((info) => {
        setUpdateInfo(info);
        if (info.update_available) {
          console.log(`Update available: v${info.latest_version}`);
        }
      })
      .catch((err) => console.error("Update check failed:", err));

    // Listen for connection state changes from Rust backend
    await listen<ConnectionState>("connection-state-changed", (event) => {
      setConnectionState(event.payload);
    });

    // Listen for tray connect/disconnect events
    await listen("tray-connect", async () => {
      try {
        await connect(selectedServerId() ?? undefined);
      } catch (err) {
        console.error("Tray connect failed:", err);
      }
    });

    await listen("tray-disconnect", async () => {
      try {
        await disconnect();
      } catch (err) {
        console.error("Tray disconnect failed:", err);
      }
    });

    // Listen for tray connect-to-server events
    await listen<{ server_id: string }>("tray-connect-to", async (event) => {
      try {
        await connect(event.payload.server_id);
      } catch (err) {
        console.error("Tray connect-to failed:", err);
      }
    });
  });

  // Watch for theme changes and system preference changes
  createEffect(() => {
    const theme = preferences().theme;
    const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    let isDark = false;
    if (theme === "dark") {
      isDark = true;
    } else if (theme === "system" && isSystemDark) {
      isDark = true;
    } else if (theme === "light") {
      isDark = false;
    } else {
      isDark = isSystemDark;
    }

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  });

  // Also listen for OS theme changes specifically if set to system
  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (preferences().theme === "system") {
        if (e.matches) {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        } else {
          document.documentElement.classList.add("light");
          document.documentElement.classList.remove("dark");
        }
      }
    };
    mediaQuery.addEventListener("change", handleChange);
  });

  return (
    <Show
      when={!authLoading()}
      fallback={
        <div class="flex items-center justify-center h-screen">
          <div
            class="w-8 h-8 border-2 rounded-full animate-spin"
            style="border-color: var(--color-border); border-top-color: var(--color-accent)"
          />
        </div>
      }
    >
      <Show when={user()} fallback={<LoginForm />}>
        <MainLayout>{props.children}</MainLayout>
      </Show>
    </Show>
  );
}

export default function App() {
  return (
    <Router root={AppShell}>
      <Route path="/" component={HomePage} />
      <Route path="/servers" component={ServersPage} />
      <Route path="/settings" component={SettingsPage} />
    </Router>
  );
}
