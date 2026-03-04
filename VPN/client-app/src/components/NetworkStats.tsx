interface Props {
  downSpeed: string;
  upSpeed: string;
}

export default function NetworkStats(props: Props) {
  return (
    <>
      <div class="net-stats">
        <div class="net-stats-globe">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <div class="net-stats-row">
          <div class="net-stats-item">
            <span class="net-stats-value">{props.downSpeed}</span>
            <span class="net-stats-label">↓ DOWN</span>
          </div>
          <div class="net-stats-item">
            <span class="net-stats-value">{props.upSpeed}</span>
            <span class="net-stats-label">↑ UP</span>
          </div>
        </div>
      </div>

      <style>{`
        .net-stats {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          backdrop-filter: blur(12px);
        }
        .net-stats-globe {
          color: #6c3cff;
        }
        .net-stats-row {
          display: flex;
          gap: 32px;
        }
        .net-stats-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .net-stats-value {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
        }
        .net-stats-label {
          font-size: 10px;
          color: var(--color-text-dim);
          font-weight: 600;
          letter-spacing: 1px;
        }
      `}</style>
    </>
  );
}
