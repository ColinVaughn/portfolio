import { onMount, createSignal } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = createSignal(false);
  const appWindow = getCurrentWindow();

  onMount(async () => {
    // Check initial state
    setIsMaximized(await appWindow.isMaximized());
    
    // Listen for resize events to update the maximize icon
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
  });

  const minimize = () => appWindow.minimize();
  const toggleMaximize = async () => {
    if (isMaximized()) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };
  const close = () => appWindow.close();

  return (
    <div
      class="h-8 shrink-0 flex justify-end items-center w-full z-50 select-none relative"
      style={{
        background: "var(--color-surface)",
        "border-bottom": "1px solid var(--color-border)"
      }}
    >
      <div 
        data-tauri-drag-region
        class="flex-1 h-full px-4 flex items-center gap-2"
      >
        <span class="text-xs font-semibold pointer-events-none" style={{ color: "var(--color-text-dim)" }}>
          Tunnely
        </span>
      </div>

      <div class="flex h-full">
        <button
          onClick={minimize}
          class="h-full w-12 flex justify-center items-center hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          aria-label="Minimize window"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" class="stroke-current" aria-hidden="true">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke-width="1.5" />
          </svg>
        </button>

        <button
          onClick={toggleMaximize}
          class="h-full w-12 flex justify-center items-center hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          aria-label={isMaximized() ? "Restore down window" : "Maximize window"}
          title={isMaximized() ? "Restore Down" : "Maximize"}
        >
          {isMaximized() ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="stroke-current relative" aria-hidden="true">
              <rect x="2" y="0.5" width="7.5" height="7.5" stroke-width="1.5" />
              <path d="M0.5 2.5V9.5H7.5" stroke-width="1.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="stroke-current" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" stroke-width="1.5" />
            </svg>
          )}
        </button>

        <button
          onClick={close}
          class="h-full w-12 flex justify-center items-center hover:bg-red-500 transition-colors group focus-visible:outline-none focus-visible:bg-red-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          aria-label="Close window"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="stroke-current group-hover:text-text relative" aria-hidden="true">
            <path d="M1 1L9 9M9 1L1 9" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
