"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CircuitBoard, Cpu, Gauge, HardDrive, Layers3, MemoryStick, Play, Timer, Trophy } from "lucide-react";
import type { BenchChallenge, BenchmarkEnvironment, BenchmarkResult, BenchRank, LatencyNode, Metric } from "@/lib/bench/protocol";

const historyKey = "omnikit:browser-bench-1";
const suites = [
  { id: "cpu", label: "CPU 单线程", detail: "固定整数运算 · Web Worker", unit: "M 次/秒", icon: Cpu },
  { id: "cpuMulti", label: "CPU 并行", detail: "最多 4 个任务 · 含 Worker 启动", unit: "M 次/秒", icon: Activity },
  { id: "graphics", label: "浏览器图形", detail: "离屏着色器 · 含同步读取", unit: "帧/秒", icon: Layers3 },
  { id: "memory", label: "内存复制", detail: "连续复制 32 MiB 缓冲区", unit: "MiB/秒", icon: MemoryStick },
  { id: "storage", label: "浏览器存储", detail: "写入并刷新 16 MiB · OPFS", unit: "MiB/秒", icon: HardDrive },
] as const;

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function getEnvironment(): BenchmarkEnvironment {
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" :
    /iPhone|iPad/i.test(ua) ? "iOS / iPadOS" : /Macintosh/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" : "未识别";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chromium" : /Safari\//.test(ua) ? "Safari" : "未识别";
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  const gpuInfo = gl?.getExtension("WEBGL_debug_renderer_info");
  const renderer = gpuInfo && gl?.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL);
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return { os, browser, cores: navigator.hardwareConcurrency || 0, memory, renderer: typeof renderer === "string" ? renderer : "" };
}

function runWorker(metric: Exclude<Metric, "cpuMulti">, seed: number) {
  return new Promise<{ value: number; durationMs: number; proof?: number }>((resolve, reject) => {
    const worker = new Worker("/bench/worker.mjs", { type: "module" });
    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    const timeout = window.setTimeout(() => {
      finish();
      reject(new Error("测试超时，请减少后台负载后重试"));
    }, 20_000);
    worker.onmessage = ({ data }) => {
      finish();
      if (data.ok) resolve(data);
      else reject(new Error(data.message));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("浏览器无法加载测试程序"));
    };
    worker.postMessage({ metric, seed });
  });
}

async function runConcurrentCpu(seed: number) {
  const count = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1));
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: count }, (_, index) => runWorker("cpu", seed ^ index)));
  const durationMs = performance.now() - start;
  const value = results.reduce((sum, item) => sum + item.value * item.durationMs, 0) / durationMs;
  return { value, durationMs, proof: undefined };
}

export function BenchWorkspace({ nodes }: { nodes: LatencyNode[] }) {
  const [env, setEnv] = useState<ReturnType<typeof getEnvironment>>();
  const [history, setHistory] = useState<BenchmarkResult[]>([]);
  const [active, setActive] = useState<Metric | "suite" | null>(null);
  const [problem, setProblem] = useState<Partial<Record<Metric, string>>>({});
  const [pending, setPending] = useState<{ challenge: BenchChallenge; proof: number; durationMs: number }>();
  const [board, setBoard] = useState<BenchRank[]>();
  const [boardStatus, setBoardStatus] = useState("");
  const [transmitting, setTransmitting] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [latency, setLatency] = useState<{ name: string; ms: number | null }[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [historyNotice, setHistoryNotice] = useState("");

  useEffect(() => {
    setEnv(getEnvironment());
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(parsed)) setHistory(parsed.filter((row) => row && suites.some(s => s.id === row.metric) && Number.isFinite(row.value) && typeof row.id === "string" && Number.isFinite(Date.parse(row.at))).slice(0, 40));
    } catch {
      setHistoryNotice("当前浏览器无法读取测试历史。");
    }
  }, []);

  const run = async (metrics: Metric[], forRanking = false) => {
    setActive(metrics.length === 1 ? (metrics[0] ?? null) : "suite");
    setProblem({});
    if (forRanking) {
      setPending(undefined);
      setBoardStatus("");
    }
    const results: BenchmarkResult[] = [];
    try {
      let challenge: BenchChallenge | undefined;
      if (forRanking) {
        const response = await fetch("/api/bench/challenge", { method: "POST", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("榜单服务暂不可用，仍可运行本地测试。");
        challenge = await response.json();
      }

      for (const metric of metrics) {
        try {
          const seed = challenge?.seed ?? Math.floor(Math.random() * 0x7fffffff);
          const measured = await (metric === "cpuMulti" ? runConcurrentCpu(seed) : runWorker(metric, seed));
          if (challenge && measured.proof !== undefined) {
            setPending({ challenge, proof: measured.proof, durationMs: measured.durationMs });
            setBoardStatus("已完成校验负载，可选择发布成绩。");
          }
          results.push({ metric, id: crypto.randomUUID(), value: measured.value, durationMs: measured.durationMs, at: new Date().toISOString(), environment: env });
        } catch (error) {
          setProblem(previous => ({ ...previous, [metric]: error instanceof Error ? error.message : "测试未完成" }));
        }
      }
      if (results.length) {
        const updated = [...results, ...history].slice(0, 40);
        setHistory(updated);
        try {
          localStorage.setItem(historyKey, JSON.stringify(updated));
        } catch {
          setHistoryNotice("结果已保留在本页，此浏览器的存储不可用。");
        }
      }
    } catch (error) {
      setBoardStatus(error instanceof Error ? error.message : "榜单服务暂不可用。");
    } finally {
      setActive(null);
    }
  };

  const loadBoard = async () => {
    const response = await fetch("/api/bench/leaderboard", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("榜单服务暂不可用。");
    setBoard(await response.json());
  };

  const refreshBoard = async () => {
    setTransmitting(true);
    setBoardStatus("");
    try { await loadBoard(); }
    catch { setBoardStatus("榜单服务暂不可用。"); }
    finally { setTransmitting(false); }
  };

  const publish = async () => {
    if (!pending) return;
    setTransmitting(true);
    try {
      const response = await fetch("/api/bench/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.challenge.id, durationMs: pending.durationMs, proof: pending.proof, logicalCores: env?.cores || 1 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "发布失败，请重新获取测试挑战。");
      }
      setPending(undefined);
      setBoardStatus("成绩已发布。");
      await loadBoard();
    } catch (error) {
      setBoardStatus(error instanceof Error ? error.message : "发布失败。");
    } finally {
      setTransmitting(false);
    }
  };

  const measureLatency = async () => {
    setMeasuring(true);
    try {
      const results = [];
      for (const node of nodes) {
        const samples: number[] = [];
        for (let i = 0; i < 3; i += 1) {
          const start = performance.now();
          try {
            const response = await fetch(node.url, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(2800) });
            if (response.ok) samples.push(performance.now() - start);
          } catch { /* 节点不可达会显示为无结果。 */ }
        }
        samples.sort((a, b) => a - b);
        const center = samples[Math.floor(samples.length / 2)];
        const previous = samples[Math.floor(samples.length / 2) - 1];
        const ms = center === undefined ? null :
          samples.length % 2 === 0 && previous !== undefined ? (center + previous) / 2 : center;
        results.push({ name: node.name, ms });
      }
      setLatency(results.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity)));
    } finally {
      setMeasuring(false);
    }
  };

  const [first, second] = compare.map(id => history.find(row => row.id === id));
  const control = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-55";
  const surface = "rounded-2xl border bg-[var(--bg-surface)] p-4 sm:p-5";

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="bench-hero rounded-3xl border px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-lg">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)]"><Activity className="size-4" />在当前设备实测</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Windows 测试</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--fg-secondary)]">测量当前浏览器的计算、图形、内存和存储性能。查看设备型号、驱动和物理磁盘请使用基米大师。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={control + " border-transparent bg-[var(--accent-primary)] !text-white hover:opacity-90 hover:!bg-[var(--accent-primary)]"} onClick={() => void run(suites.map(suite => suite.id))} disabled={!!active}><Play className="size-4" />{active === "suite" ? "测试进行中…" : "开始全部测试"}</button>
            <Link href="/jimi-master" className={control}>基米大师 <ArrowUpRight className="size-4" /></Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="environment-title" className={surface}>
        <h2 id="environment-title" className="flex items-center gap-2 text-sm font-semibold"><CircuitBoard className="size-4 text-[var(--accent-primary)]" />当前测试环境</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
          {[
            ["操作系统", env?.os || "读取中"],
            ["浏览器", env?.browser || "读取中"],
            ["逻辑线程", env ? (env.cores || "浏览器未提供") : "读取中"],
            ["内存估计", env ? (env.memory ? `约 ${env.memory} GB` : "浏览器未提供") : "读取中"],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--fg-muted)]">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}
          <div className="col-span-full break-words text-xs text-[var(--fg-secondary)]"><dt className="inline font-semibold">图形渲染器 </dt><dd className="inline">{env?.renderer || (env ? "浏览器未提供" : "读取中")}</dd></div>
        </dl>
      </section>

      <section aria-label="浏览器基准测试" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {suites.map(suite => {
          const latest = history.find(row => row.metric === suite.id);
          const Icon = suite.icon;
          return <article className={surface + " flex min-h-48 flex-col gap-3"} key={suite.id}>
            <div className="flex items-center gap-2"><Icon className="size-4 text-[var(--accent-primary)]" /><h2 className="font-semibold">{suite.label}</h2></div>
            <p className="text-xs text-[var(--fg-muted)]">{suite.detail}</p>
            <output aria-live="polite" data-bench-result={suite.id} className="block min-h-8 text-sm text-[var(--fg-secondary)]">
              {latest ? <><strong className="text-2xl tabular-nums text-[var(--fg-primary)]">{number.format(latest.value)}</strong> {suite.unit}</> : "等待测试"}
            </output>
            {problem[suite.id] && <p role="status" className="text-xs text-[var(--status-inferred-fg)]">{problem[suite.id]}</p>}
            <button type="button" className={control + " mt-auto self-start"} disabled={!!active} onClick={() => void run([suite.id])}>{active === suite.id ? "测试中…" : `测试${suite.label}`}</button>
          </article>;
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className={surface} aria-labelledby="history-title">
          <h2 id="history-title" className="flex items-center gap-2 font-semibold"><Timer className="size-4 text-[var(--accent-primary)]" />测试历史与对比</h2>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">历史保存在当前浏览器。勾选同一测试的两条记录可查看差异。</p>
          {historyNotice && <p role="status" className="mt-2 text-sm">{historyNotice}</p>}
          <div className="mt-3 space-y-1">
            {history.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-[var(--fg-muted)]">完成测试后，成绩会显示在这里。</p>}
            {history.slice(0, 12).map(row => {
              const suite = suites.find(item => item.id === row.metric)!;
              return <label key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-b px-1 py-2 text-sm">
                <input type="checkbox" checked={compare.includes(row.id)} onChange={() => setCompare(ids => ids.includes(row.id) ? ids.filter(id => id !== row.id) : [...ids.slice(-1), row.id])} />
                <span>{suite.label} <span className="block text-xs text-[var(--fg-muted)] sm:inline">{date.format(new Date(row.at))}</span>{row.environment && <span className="block text-xs text-[var(--fg-muted)]">{row.environment.os} · {row.environment.browser} · {row.environment.cores || "未知"} 逻辑线程</span>}</span>
                <span className="tabular-nums">{number.format(row.value)} {suite.unit}</span>
              </label>;
            })}
          </div>
          {first && second && <p className="mt-3 text-sm" role="status">{first.metric !== second.metric ? "请选择同一测试项目。" : `第二次选择比第一次${second.value >= first.value ? "快" : "慢"} ${number.format(Math.abs((second.value / first.value - 1) * 100))}%`}</p>}
        </section>

        <section className={surface} aria-labelledby="network-title">
          <h2 id="network-title" className="flex items-center gap-2 font-semibold"><Gauge className="size-4 text-[var(--accent-primary)]" />节点延迟</h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--fg-muted)]">每个节点发起三次 HTTP 请求，按可用样本的中位数排序。当前配置 {nodes.length} 个节点。</p>
          <button type="button" className={control + " mt-3"} onClick={() => void measureLatency()} disabled={measuring}>{measuring ? "测量中…" : "测量节点延迟"}</button>
          <ul className="mt-3 space-y-2 text-sm" aria-live="polite">
            {latency.map(node => <li key={node.name} className="flex justify-between gap-2 border-b pb-2"><span>{node.name}</span><span>{node.ms === null ? "不可用" : `${number.format(node.ms)} ms`}</span></li>)}
          </ul>
        </section>
      </div>

      <section className={surface} aria-labelledby="leader-title">
        <h2 id="leader-title" className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-[var(--accent-primary)]" />浏览器 CPU 榜单</h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--fg-muted)]">固定负载版本 CPU-1。发布时公开成绩、浏览器报告的系统类型和逻辑线程数。服务器校验运算结果，耗时与设备信息由浏览器报告。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={control} onClick={() => void run(["cpu"], true)} disabled={!!active || transmitting}>运行榜单测试</button>
          <button type="button" className={control} onClick={() => void refreshBoard()} disabled={transmitting}>刷新成绩榜</button>
          {pending && <button type="button" className={control} onClick={() => void publish()} disabled={transmitting}>发布本次成绩</button>}
        </div>
        {boardStatus && <p className="mt-3 text-sm" role="status">{boardStatus}</p>}
        {board?.length === 0 && <p className="mt-3 text-sm text-[var(--fg-muted)]">当前暂无成绩。</p>}
        {board && board.length > 0 && <ol className="mt-3 divide-y text-sm" aria-label="CPU 成绩排名">
          {board.map((entry, index) => <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2" key={entry.id}>
            <span className="font-semibold tabular-nums">{index + 1}</span><span>{entry.osInfo} · {entry.logicalCores} 逻辑线程</span>
            <span className="tabular-nums">{number.format(entry.cpuSingleScore / 1000)} M 次/秒</span>
          </li>)}
        </ol>}
      </section>
    </div>
  );
}
