// 将当前锁定版本的 MapLibre Worker 作为同源 ES 模块提供，避免打包器改写 Worker 入口。
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = dirname(fileURLToPath(import.meta.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs")));
const target = fileURLToPath(new URL("../public/maplibre/", import.meta.url));
await mkdir(target, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(source, name), join(target, name));
}
