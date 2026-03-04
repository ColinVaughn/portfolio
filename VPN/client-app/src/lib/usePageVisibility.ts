import { createSignal, onMount, onCleanup } from "solid-js";

const [isPageVisible, setIsPageVisible] = createSignal(
  typeof document !== "undefined" ? document.visibilityState === "visible" : true
);

let listenersAttached = false;

function attach() {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;
  document.addEventListener("visibilitychange", () => {
    setIsPageVisible(document.visibilityState === "visible");
  });
}

attach();

/** Whether the page/app is currently in the foreground. Shared across all consumers. */
export { isPageVisible };

/**
 * Returns true if the app is running on a mobile device (Android/iOS via Tauri).
 * Uses the user-agent string as a lightweight check  - no async import needed.
 */
export function isMobilePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
