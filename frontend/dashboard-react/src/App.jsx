import { useState, useEffect, useRef } from "react";
import axios from "axios";

// ─── Dummy Data ────────────────────────────────────────────────────────────────
const dummyData = {
  cpu: { usage: 0, cores: 16, temperature: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  jvm: { heapUsed: 0, heapMax: 8.0, nonHeap: 0, gcCount: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  redis: {
    status: "offline", // 기본값을 offline으로 변경
    totalCommands: 0,
    opsPerSec: 0,
    hitRate: 0,
    memory: "0 MB",
    connections: 0,
    delta: 0,
  },
  rabbitmq: {
    status: "offline", // 기본값을 offline으로 변경
    totalMessages: 0,
    publishRate: 0,
    consumeRate: 0,
    queues: 0,
    consumers: 0,
    delta: 0,
  },
  nats: {
    status: "offline", // 기본값을 offline으로 변경
    totalMsgs: 0,
    msgRate: 0,
    bytesIn: "0 KB",
    subjects: 0,
    subscriptions: 0,
    delta: 0,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + "M"
    : n >= 1_000
    ? (n / 1_000).toFixed(1) + "K"
    : n.toString();

const pct = (v, max) => Math.min(100, (v / max) * 100);

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 120, H = 36;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H * 0.85 - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* area fill */}
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`url(#sg-${color})`}
      />
    </svg>
  );
}

// ─── Radial Gauge ──────────────────────────────────────────────────────────────
function RadialGauge({ value, max = 100, color, size = 80 }) {
  const r = (size - 10) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ * 0.75;
  const rotation = -225;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset="0"
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 1s ease" }}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
        {value.toFixed(0)}%
      </text>
    </svg>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const w = pct(value, max);
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{
          width: `${w}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 8px ${color}66`,
        }}
      />
    </div>
  );
}

// ─── Pulse Dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = "#22c55e" }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color }} />
    </span>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const online = status === "online";
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide px-2 py-0.5 rounded-full"
      style={{
        background: online ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: online ? "#4ade80" : "#f87171",
        border: `1px solid ${online ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      }}>
      <PulseDot color={online ? "#4ade80" : "#f87171"} />
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────
function Header({ lastSync }) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: "0 0 20px rgba(99,102,241,0.5)",
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2"
            style={{ borderColor: "#0a0a14" }} />
        </div>
        <div>
          <div className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: "'DM Mono', 'IBM Plex Mono', monospace", letterSpacing: "-0.02em" }}>
            INFRA<span className="text-indigo-400">PULSE</span>
          </div>
          <div className="text-xs text-slate-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Infrastructure Monitor
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <PulseDot color="#4ade80" />
          <span className="text-xs font-medium text-emerald-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            실시간 동기화 중
          </span>
        </div>
        <div className="text-xs text-slate-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {lastSync}
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
          OP
        </div>
      </div>
    </header>
  );
}

// ─── CPU Card ──────────────────────────────────────────────────────────────────
function CpuCard({ data }) {
  return (
    <div className="group relative rounded-2xl p-6 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "rgba(15,15,30,0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
      }}>
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: "inset 0 0 40px rgba(99,102,241,0.08), 0 0 40px rgba(99,102,241,0.1)" }} />
      {/* Top accent */}
      <div className="absolute top-0 left-6 right-6 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)" }} />
      {/* BG glow blob */}
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />

      <div className="relative flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="#818cf8" strokeWidth="2"/>
                <rect x="9" y="9" width="6" height="6" fill="#818cf8"/>
                <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase text-slate-400"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>CPU Usage</span>
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-5xl font-bold text-white" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
              {data.usage.toFixed(1)}
            </span>
            <span className="text-2xl text-slate-500 font-light">%</span>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs text-slate-500">{data.cores} cores</span>
            <span className="w-px h-3 bg-slate-700" />
            <span className="text-xs" style={{ color: data.temperature > 80 ? "#f87171" : "#fb923c" }}>
              {data.temperature}°C
            </span>
          </div>

          <ProgressBar value={data.usage} max={100} color="#6366f1" />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>0%</span>
            <span className="text-xs text-slate-600" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>100%</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[["User", "54.1%", "#6366f1"], ["System", "13.3%", "#818cf8"], ["I/O Wait", "0.2%", "#a5b4fc"]].map(([label, val, c]) => (
              <div key={label} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                <div className="text-sm font-semibold" style={{ color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <RadialGauge value={data.usage} color="#6366f1" size={90} />
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">7s trend</div>
            <Sparkline data={data.trend} color="#6366f1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── JVM Card ─────────────────────────────────────────────────────────────────
function JvmCard({ data }) {
  const heapPct = pct(data.heapUsed, data.heapMax);
  return (
    <div className="group relative rounded-2xl p-6 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "rgba(15,15,30,0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
      }}>
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: "inset 0 0 40px rgba(16,185,129,0.06), 0 0 40px rgba(16,185,129,0.08)" }} />
      <div className="absolute top-0 left-6 right-6 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)" }} />
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)" }} />

      <div className="relative flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 3 1.5 4L6 14h12l-1.5-3C17.5 10 18 8.5 18 7c0-2.5-2.5-5-6-5z" stroke="#10b981" strokeWidth="1.8"/>
                <path d="M9 14v6M15 14v6M7 20h10" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase text-slate-400"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>JVM Memory</span>
          </div>

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-5xl font-bold text-white" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
              {data.heapUsed.toFixed(1)}
            </span>
            <span className="text-2xl text-slate-500 font-light">GB</span>
          </div>
          <div className="flex items-center gap-1.5 mb-5">
            <span className="text-xs text-slate-500">Heap Used</span>
            <span className="text-xs text-slate-600">/</span>
            <span className="text-xs text-emerald-500/70">{data.heapMax} GB max</span>
            <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
              {heapPct.toFixed(0)}%
            </span>
          </div>

          <ProgressBar value={data.heapUsed} max={data.heapMax} color="#10b981" />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>0</span>
            <span className="text-xs text-slate-600" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{data.heapMax} GB</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Non-Heap", `${data.nonHeap} GB`, "#6ee7b7"],
              ["GC Count", `${data.gcCount}`, "#34d399"],
              ["Heap Free", `${(data.heapMax - data.heapUsed).toFixed(1)} GB`, "#a7f3d0"],
            ].map(([label, val, c]) => (
              <div key={label} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                <div className="text-sm font-semibold" style={{ color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <RadialGauge value={heapPct} color="#10b981" size={90} />
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">7s trend</div>
            <Sparkline data={data.trend} color="#10b981" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MQ Card ──────────────────────────────────────────────────────────────────
const MQ_CONFIG = {
  redis:    { label: "Redis",    color: "#ef4444", glow: "rgba(239,68,68,0.18)",  icon: "R", accent: "#f87171" },
  rabbitmq: { label: "RabbitMQ", color: "#f97316", glow: "rgba(249,115,22,0.15)", icon: "Q", accent: "#fb923c" },
  nats:     { label: "NATS",     color: "#14b8a6", glow: "rgba(20,184,166,0.15)", icon: "N", accent: "#2dd4bf" },
};

function MqCard({ type, data }) {
  const cfg = MQ_CONFIG[type];

  const rows =
    type === "redis"
      ? [
          ["Ops/sec",     fmt(data.opsPerSec),   cfg.accent],
          ["Hit Rate",    `${data.hitRate}%`,     "#fbbf24"],
          ["Memory",      data.memory,            "#94a3b8"],
          ["Connections", data.connections,       "#94a3b8"],
        ]
      : type === "rabbitmq"
      ? [
          ["Publish/s",  fmt(data.publishRate),  cfg.accent],
          ["Consume/s",  fmt(data.consumeRate),  "#fbbf24"],
          ["Queues",     data.queues,             "#94a3b8"],
          ["Consumers",  data.consumers,          "#94a3b8"],
        ]
      : [
          ["Msg/s",         fmt(data.msgRate),      cfg.accent],
          ["Bytes In",      data.bytesIn,           "#fbbf24"],
          ["Subjects",      data.subjects,           "#94a3b8"],
          ["Subscriptions", data.subscriptions,      "#94a3b8"],
        ];

  const total = type === "redis" ? data.totalCommands : type === "rabbitmq" ? data.totalMessages : data.totalMsgs;

  return (
    <div className="group relative rounded-2xl p-5 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background: "rgba(12,12,24,0.75)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}>
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: `0 0 40px ${cfg.glow}` }} />
      {/* Top bar accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />
      {/* Corner glow */}
      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)` }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
              style={{
                background: `${cfg.color}22`,
                border: `1px solid ${cfg.color}44`,
                color: cfg.color,
                fontFamily: "'IBM Plex Mono', monospace",
                boxShadow: `0 0 12px ${cfg.glow}`,
              }}>
              {cfg.icon}
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide">{cfg.label}</div>
              <StatusBadge status={data.status} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Δ/s</div>
            <div className="text-sm font-bold" style={{ color: cfg.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              +{fmt(data.delta)}
            </div>
          </div>
        </div>

        {/* Total counter */}
        <div className="rounded-xl px-4 py-3 mb-4"
          style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}1a` }}>
          <div className="text-xs text-slate-500 mb-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Total {type === "redis" ? "Commands" : type === "rabbitmq" ? "Messages" : "Messages"}
          </div>
          <div className="text-2xl font-bold tracking-tight" style={{ color: cfg.accent, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
            {fmt(total)}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {rows.map(([label, val, c]) => (
            <div key={label} className="rounded-lg px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-xs text-slate-500 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
              <div className="text-sm font-bold" style={{ color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section Title ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="text-lg">{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-200 tracking-wide">{title}</div>
        {sub && <div className="text-xs text-slate-600">{sub}</div>}
      </div>
      <div className="flex-1 h-px ml-2" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [time, setTime] = useState(new Date());
  // 1. 더미 데이터를 초기 상태로 사용
  const [metrics, setMetrics] = useState(dummyData);

  // 2. 프로메테우스에서 데이터를 가져오는 실시간 로직
  const fetchAllData = async () => {
  try {
    // 1. 모든 지표를 동시에 요청 (Promise.all로 속도 최적화)
    const [resRedis, resRabbit, resNats, resCpu, resMem] = await Promise.all([
      axios.get('/api/prometheus/api/v1/query', { params: { query: 'mq_transaction_total{type="redis"}' } }),
      axios.get('/api/prometheus/api/v1/query', { params: { query: 'mq_transaction_total{type="rabbitmq"}' } }),
      axios.get('/api/prometheus/api/v1/query', { params: { query: 'mq_transaction_total{type="nats"}' } }),
      axios.get('/api/prometheus/api/v1/query', { params: { query: 'system_cpu_usage' } }),
      axios.get('/api/prometheus/api/v1/query', { params: { query: 'jvm_memory_used_bytes' } })
    ]);

    // 2. 결과값이 있을 때만 상태 업데이트
    setMetrics(prev => {
  // 기존 상태를 복사하여 새로운 객체 생성
  const next = JSON.parse(JSON.stringify(prev)); 

  // 1. Redis 동기화
  if (resRedis.data.data.result[0]) {
    const val = parseInt(resRedis.data.data.result[0].value[1]);
    next.redis.totalCommands = val;
    next.redis.delta = val - prev.redis.totalCommands;
    next.redis.status = "online";
  } else {
    next.redis.status = "offline";
  }

  // 2. RabbitMQ 동기화
  if (resRabbit.data.data.result[0]) {
    const val = parseInt(resRabbit.data.data.result[0].value[1]);
    next.rabbitmq.totalMessages = val;
    next.rabbitmq.delta = val - prev.rabbitmq.totalMessages;
    next.rabbitmq.status = "online";
  } else {
    next.rabbitmq.status = "offline";
  }

  // 3. NATS 동기화
  if (resNats.data.data.result[0]) {
    const val = parseInt(resNats.data.data.result[0].value[1]);
    next.nats.totalMsgs = val;
    next.nats.delta = val - prev.nats.totalMsgs;
    next.nats.status = "online";
  } else {
    next.nats.status = "offline";
  }

  // 4. CPU 동기화 (0.0~1.0 사이 값을 %로 변환)
  if (resCpu.data.data.result[0]) {
    const cpuVal = parseFloat(resCpu.data.data.result[0].value[1]) * 100;
    next.cpu.usage = cpuVal;
    // 트렌드 그래프 업데이트 (가장 오래된 값을 버리고 새 값을 추가)
    next.cpu.trend = [...prev.cpu.trend.slice(1), cpuVal];
  }

  // 5. JVM Memory 동기화 (Bytes -> GB 변환)
  if (resMem.data.data.result[0]) {
    const memGb = parseFloat(resMem.data.data.result[0].value[1]) / (1024 * 1024 * 1024);
    next.jvm.heapUsed = memGb;
    next.jvm.trend = [...prev.jvm.trend.slice(1), memGb];
  }

  return next;
});
  } catch (err) {
    console.error("전체 데이터 동기화 실패:", err);
  }
};
  useEffect(() => {
    fetchAllData(); // 초기 로드
    const dataId = setInterval(fetchAllData, 5000); // 5초마다 갱신
    const timeId = setInterval(() => setTime(new Date()), 1000); // 1초마다 시계

    return () => {
      clearInterval(dataId);
      clearInterval(timeId);
    };
  }, []);

  const lastSync = time.toLocaleTimeString("ko-KR", { hour12: false }) + " KST";

  return (
    <div className="min-h-screen" style={{
      background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 60%), #07071a",
      fontFamily: "'IBM Plex Mono', 'DM Mono', monospace",
    }}>
      {/* 노이즈 텍스처 레이어 */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px",
        }} />

      <Header lastSync={lastSync} />

      <main className="px-6 md:px-8 pb-10 max-w-7xl mx-auto space-y-8">
        {/* System Summary 섹션 */}
        <section>
          <SectionTitle icon="⚙️" title="System Summary" sub="CPU & JVM Heap — 실시간 지표" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* dummyData가 아닌 metrics 상태를 연결 */}
            <CpuCard data={metrics.cpu} />
            <JvmCard data={metrics.jvm} />
          </div>
        </section>

        {/* MQ Traffic 섹션 */}
        <section>
          <SectionTitle icon="📡" title="MQ Traffic" sub="Redis · RabbitMQ · NATS — 트랜잭션 현황" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MqCard type="redis" data={metrics.redis} />
            <MqCard type="rabbitmq" data={metrics.rabbitmq} />
            <MqCard type="nats" data={metrics.nats} />
          </div>
        </section>
      </main>
    </div>
  );
}