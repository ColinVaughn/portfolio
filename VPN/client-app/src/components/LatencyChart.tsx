interface Props {
  history: number[];
  latencyMs: string;
}

export default function LatencyChart(props: Props) {
  const chartW = 320;
  const chartH = 80;

  const buildPath = () => {
    const data = props.history;
    const nonZero = data.filter((v) => v > 0);
    if (nonZero.length === 0) return { line: "", area: "", min: 0, max: 0, avg: 0 };
    const min = Math.min(...nonZero);
    const max = Math.max(...nonZero);
    const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const ceiling = max * 1.2 || 1;
    const step = chartW / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * step;
      const y = v === 0 ? chartH : chartH - (v / ceiling) * chartH;
      return { x, y };
    });
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${chartW},${chartH} L0,${chartH} Z`;
    return { line, area, min: Math.round(min), max: Math.round(max), avg: Math.round(avg) };
  };

  return (
    <>
      {(() => {
        const chart = buildPath();
        return (
          <div class="net-chart">
            <div class="net-chart-header">
              <span>Network Latency</span>
              <span class="net-chart-value">{props.latencyMs}</span>
            </div>
            <svg class="net-chart-svg" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="netLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(108,60,255,0.35)" />
                  <stop offset="100%" stop-color="rgba(108,60,255,0)" />
                </linearGradient>
              </defs>
              <line x1="0" y1={chartH * 0.25} x2={chartW} y2={chartH * 0.25} stroke="var(--color-border)" stroke-width="1" />
              <line x1="0" y1={chartH * 0.5} x2={chartW} y2={chartH * 0.5} stroke="var(--color-border)" stroke-width="1" />
              <line x1="0" y1={chartH * 0.75} x2={chartW} y2={chartH * 0.75} stroke="var(--color-border)" stroke-width="1" />
              <path d={chart.area} fill="url(#netLatencyGrad)" />
              <path d={chart.line} fill="none" stroke="#8b6cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d={chart.line} fill="none" stroke="#8b6cff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.2" filter="blur(3px)" />
            </svg>
            <div class="net-chart-stats">
              <span>Min <b>{chart.min}ms</b></span>
              <span>Avg <b>{chart.avg}ms</b></span>
              <span>Max <b>{chart.max}ms</b></span>
            </div>
          </div>
        );
      })()}

      <style>{`
        .net-chart {
          padding: 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 14px;
          backdrop-filter: blur(12px);
        }
        .net-chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
          color: var(--color-text-dim);
          font-weight: 600;
        }
        .net-chart-value {
          color: #10b981;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-weight: 700;
          font-size: 13px;
        }
        .net-chart-svg {
          width: 100%;
          height: 80px;
          display: block;
          border-radius: 6px;
        }
        .net-chart-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 11px;
          color: var(--color-text-dim);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        .net-chart-stats b {
          color: var(--color-text);
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
