import { type ReactNode } from "react";

interface AppProps {
  state: "connecting" | "ready" | "error";
  message: string;
  onRetry: () => void;
  children?: ReactNode;
  compilerEnabled?: boolean;
}

export function App({
  state,
  message,
  onRetry,
  children,
  compilerEnabled = false,
}: AppProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#editor-workspace">
        Skip to editor
      </a>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ∑
          </span>
          <div>
            <h1>Cheat Sheet Generator</h1>
            <p>Write cheat sheets with LaTeX support.</p>
          </div>
        </div>
        <nav aria-label="Workspace">
          <a href="#document-heading">Editor</a>
          <a href="#pdf-heading">PDF preview</a>
        </nav>
        <section
          className={`connection connection--${state}`}
          aria-labelledby="connection-heading"
        >
          <h2 id="connection-heading" className="sr-only">
            Protected local session
          </h2>
          <span className="connection-label">
            <span className="status-dot" aria-hidden="true" />
            {state === "ready"
              ? "Connected"
              : state === "connecting"
                ? "Connecting…"
                : "Disconnected"}
          </span>
          <p
            role={state === "error" ? "alert" : "status"}
            className={state === "error" ? "connection-error" : "sr-only"}
          >
            {message}
          </p>
          <button
            className="quiet-button"
            disabled={state === "connecting"}
            onClick={onRetry}
          >
            Check connection
          </button>
        </section>
      </header>
      <main id="editor-workspace" tabIndex={-1}>
        <div className="workspace-note">
          <p>Structured and raw source editing are available.</p>
          <p>
            {compilerEnabled
              ? "The protected compiler is available. Each PDF must pass browser parser checks before preview or export."
              : "PDF compilation is disabled. Opt in with --compiler and provide the verified local runtime. Source editing and exports remain available."}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
