import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { login, signup, getSubscription, startOAuthFlow, finishOAuthFlow } from "../lib/tauri";
import { setUser, setSubscription } from "../lib/stores";
import { useNetworkMonitor } from "../lib/useNetworkMonitor";
import { listen } from "@tauri-apps/api/event";
import NetworkStatus from "./NetworkStatus";
import LatencyChart from "./LatencyChart";
import NetworkStats from "./NetworkStats";

export default function LoginForm() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [loadingMsg, setLoadingMsg] = createSignal("");
  const [isSignup, setIsSignup] = createSignal(false);
  const [showPassword, setShowPassword] = createSignal(false);

  // Setup deep link listener for OAuth PKCE callback
  onMount(async () => {
    const unlisten = await listen<string>("oauth-callback", async (event) => {
      console.log("Deep link payload received:", event.payload);
      try {
        setLoading(true);
        setLoadingMsg("Completing secure login...");
        const url = new URL(event.payload);
        const code = url.searchParams.get("code");
        
        if (!code) {
          throw new Error("No authorization code received from provider");
        }
        
        const profile = await finishOAuthFlow(code);
        setUser(profile);
        
        try {
          const sub = await getSubscription();
          setSubscription(sub);
        } catch {
          // Ignore
        }
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
        setLoadingMsg("");
      }
    });

    onCleanup(() => {
      unlisten();
    });
  });

  const net = useNetworkMonitor();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const action = isSignup() ? signup : login;
      const profile = await action(email(), password());
      setUser(profile);
      // Fetch subscription (already cached in Rust backend after login)
      try {
        const sub = await getSubscription();
        setSubscription(sub);
      } catch {
        // Non-fatal  - subscription will be fetched on next app load
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-screen">
      {/* Background layers */}
      <div class="login-bg">
        <div class="login-bg-grid" />
        <div class="login-bg-glow-1" />
        <div class="login-bg-glow-2" />
        {/* Floating particles */}
        <div class="login-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              class="login-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                "animation-delay": `${Math.random() * 6}s`,
                "animation-duration": `${Math.random() * 4 + 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div class="login-content">
        {/* Left: Form Card */}
        <div class="login-card">
          {/* Brand */}
          <div class="login-brand">
            <span class="login-brand-name">Tunnely</span>
          </div>

          {/* Heading */}
          <h1 class="login-heading">
            {isSignup() ? "Create account" : "Welcome back"}
          </h1>
          <p class="login-subheading">
            {isSignup()
              ? "Start securing your digital footprint today."
              : "Secure your digital footprint. Login to access premium servers."}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} class="login-form">
            {/* Email */}
            <div class="login-field">
              <label class="login-label" for="login-email">Email address</label>
              <div class="login-input-wrap">
                <svg class="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  required
                  class="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div class="login-field">
              <div class="login-label-row">
                <label class="login-label" for="login-password">Password</label>
              </div>
              <div class="login-input-wrap">
                <svg class="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="login-password"
                  type={showPassword() ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                  minLength={6}
                  class="login-input"
                />
                <button
                  type="button"
                  class="login-toggle-pw"
                  onClick={() => setShowPassword(!showPassword())}
                  aria-label={showPassword() ? "Hide password" : "Show password"}
                >
                  <Show when={showPassword()} fallback={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  </Show>
                </button>
              </div>
            </div>

            {/* Error */}
            <div aria-live="polite" aria-atomic="true">
              {error() && (
                <p class="login-error">{error()}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type={loading() && loadingMsg() === "Waiting for browser..." ? "button" : "submit"}
              disabled={loading() && loadingMsg() !== "Waiting for browser..."}
              aria-busy={loading()}
              class="login-submit"
              onClick={(e) => {
                if (loading() && loadingMsg() === "Waiting for browser...") {
                  e.preventDefault();
                  setLoading(false);
                  setLoadingMsg("");
                  setError("");
                }
              }}
            >
              <span>{loading() ? (loadingMsg() || "Please wait...") : isSignup() ? "Create Account" : "Sign In"}</span>
              {loading() && loadingMsg() === "Waiting for browser..." && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{"margin-left": "8px"}}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {!loading() && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div class="login-divider">
            <div class="login-divider-line" />
            <span class="login-divider-text">Or continue with</span>
            <div class="login-divider-line" />
          </div>

          {/* Social Login Buttons */}
          <div class="login-social-row">
            <button 
              class="login-social-btn" 
              aria-label="Continue with Apple"
              disabled={loading()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setLoadingMsg("Waiting for browser...");
                  await startOAuthFlow("apple");
                } catch (e: any) {
                  setError(e.message || String(e));
                  setLoading(false);
                  setLoadingMsg("");
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.636 10.98c-.022-2.825 2.308-4.185 2.413-4.248-1.306-1.92-3.33-2.186-4.06-2.226-1.74-.176-3.398 1.026-4.29 1.026-.893 0-2.27-1.002-3.712-.977-1.902.025-3.662 1.106-4.637 2.805-1.968 3.42-.503 8.47 1.411 11.233.935 1.34 2.035 2.844 3.486 2.787 1.398-.057 1.932-.907 3.633-.907 1.688 0 2.183.907 3.645.88 1.498-.027 2.441-1.353 3.364-2.697 1.066-1.558 1.503-3.076 1.523-3.15-.034-.015-2.952-1.127-2.776-4.526zm-1.89-6.3c.773-.938 1.294-2.24 1.15-3.535-1.11.045-2.463.743-3.264 1.705-.718.84-1.328 2.16-1.168 3.432 1.25.097 2.505-.658 3.282-1.602z"/>
              </svg>
              <span>Apple</span>
            </button>
            <button 
              class="login-social-btn" 
              aria-label="Continue with Google"
              disabled={loading()}
              onClick={async () => {
                try {
                  setLoading(true);
                  setLoadingMsg("Waiting for browser...");
                  await startOAuthFlow("google");
                } catch (e: any) {
                  setError(e.message || String(e));
                  setLoading(false);
                  setLoadingMsg("");
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Toggle Sign Up / Sign In */}
          <Show 
            when={loading() && loadingMsg() === "Waiting for browser..."}
            fallback={
              <p class="login-toggle">
                {isSignup() ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup());
                    setError("");
                  }}
                  class="login-toggle-link"
                >
                  {isSignup() ? "Sign in" : "Sign up now"}
                </button>
              </p>
            }
          >
            <p class="login-toggle">
              <button
                type="button"
                onClick={() => {
                  setLoading(false);
                  setLoadingMsg("");
                  setError("");
                }}
                class="login-toggle-link"
              >
                Cancel Login
              </button>
            </p>
          </Show>
        </div>

        {/* Right: System Visualization */}
        <div class="login-viz">
          <NetworkStatus quality={net.networkQuality()} />
          <LatencyChart history={net.latencyHistory()} latencyMs={net.latencyMs()} />
          <NetworkStats downSpeed={net.downSpeed()} upSpeed={net.upSpeed()} />
        </div>
      </div>

      {/* Inline styles that are specific to this login page */}
      <style>{`
        .login-screen {
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          background: var(--color-bg);
        }

        /* ── Background ── */
        .login-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
        }
        .login-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--color-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
          background-size: 60px 60px;
          opacity: 0.3;
        }
        .login-bg-glow-1 {
          position: absolute;
          top: -30%;
          right: -10%;
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(99,60,255,0.12) 0%, transparent 70%);
          filter: blur(80px);
          pointer-events: none;
        }
        .login-bg-glow-2 {
          position: absolute;
          bottom: -20%;
          left: -5%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
        }

        /* ── Particles ── */
        .login-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .login-particle {
          position: absolute;
          background: rgba(139,92,246,0.3);
          border-radius: 50%;
          animation: login-float ease-in-out infinite;
        }
        @keyframes login-float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.2; }
          50% { transform: translateY(-20px) scale(1.3); opacity: 0.5; }
        }

        /* ── Content Layout ── */
        .login-content {
          position: relative;
          z-index: 1;
          display: flex;
          width: 100%;
          height: 100%;
        }

        /* ── Form Card ── */
        .login-card {
          flex: 0 0 400px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          padding: 40px 48px;
          box-shadow:
            20px 0 60px rgba(0,0,0,0.1),
            inset 0 1px 0 var(--color-surface-hover);
        }

        /* Brand */
        .login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .login-brand-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: 0.3px;
        }

        /* Heading */
        .login-heading {
          font-size: 26px;
          font-weight: 800;
          color: var(--color-text);
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .login-subheading {
          font-size: 13px;
          color: var(--color-text-dim);
          line-height: 1.5;
          margin-bottom: 28px;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .login-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .login-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input-icon {
          position: absolute;
          left: 14px;
          color: var(--color-text-dim);
          pointer-events: none;
          flex-shrink: 0;
        }
        .login-input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          color: var(--color-text);
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }
        .login-input::placeholder {
          color: var(--color-text-dim);
          opacity: 0.6;
        }
        .login-input:focus {
          border-color: rgba(108,60,255,0.4);
          box-shadow: 0 0 0 3px rgba(108,60,255,0.08);
          background: var(--color-surface-hover);
        }

        .login-toggle-pw {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: var(--color-text-dim);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
        }
        .login-toggle-pw:hover { color: var(--color-text); }

        /* Error */
        .login-error {
          font-size: 12px;
          color: var(--color-danger);
          padding: 8px 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          line-height: 1.4;
        }

        /* Submit */
        .login-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #6c3cff, #4f2cd4);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 20px rgba(108,60,255,0.3);
          margin-top: 4px;
        }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(108,60,255,0.45);
          background: linear-gradient(135deg, #7c4cff, #5f3ce4);
        }
        .login-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Toggle */
        .login-toggle {
          text-align: center;
          font-size: 13px;
          color: var(--color-text-dim);
          margin-top: 20px;
        }

        /* Social Divider */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 22px;
        }
        .login-divider-line {
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }
        .login-divider-text {
          font-size: 12px;
          color: var(--color-text-dim);
          white-space: nowrap;
          font-weight: 500;
        }

        /* Social Buttons */
        .login-social-row {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .login-social-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          color: var(--color-text-dim);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .login-social-btn:hover {
          background: var(--color-surface-hover);
          color: var(--color-text);
          transform: translateY(-1px);
        }
        .login-social-btn:active {
          transform: translateY(0);
        }
        .login-toggle-link {
          background: none;
          border: none;
          color: #8b6cff;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .login-toggle-link:hover {
          color: #a78bfa;
          text-decoration: underline;
        }

        /* ── Right Visualization ── */
        .login-viz {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          min-width: 0;
          padding: 40px;
        }

        /* Responsive: hide viz on smaller windows */
        @media (max-width: 800px) {
          .login-viz { display: none; }
          .login-card { flex: 1; border-right: none; }
        }
      `}</style>
    </div>
  );
}
