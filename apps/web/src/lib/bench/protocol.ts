export type Metric = "cpu" | "cpuMulti" | "memory" | "graphics" | "storage";
export type BenchmarkEnvironment = { os: string; browser: string; cores: number; memory?: number; renderer: string };
export type BenchmarkResult = {
  id: string;
  metric: Metric;
  value: number;
  durationMs: number;
  at: string;
  environment?: BenchmarkEnvironment;
};
export type BenchChallenge = { id: string; seed: number };
export type BenchRank = {
  id: string;
  cpuSingleScore: number;
  logicalCores: number;
  osInfo: string;
  createdAt: string;
};
export type LatencyNode = { name: string; url: string };
