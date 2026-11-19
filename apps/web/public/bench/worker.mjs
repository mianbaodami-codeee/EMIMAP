import { cpuIterations, cpuWorkload } from "./workload.mjs";

function measureCpu(seed) {
  cpuWorkload(seed ^ 1); // 预热解释器与 JIT，正式计时仅包含固定工作量。
  const start = performance.now();
  const proof = cpuWorkload(seed);
  const durationMs = performance.now() - start;
  return { value: cpuIterations / durationMs / 1000, durationMs, proof };
}

function measureMemory() {
  const source = new Uint8Array(32 * 1024 * 1024);
  const target = new Uint8Array(source.length);
  source.fill(73);
  target.fill(0);
  const repetitions = 32;
  const start = performance.now();
  for (let i = 0; i < repetitions; i += 1) {
    target.set(source);
  }
  const durationMs = performance.now() - start;
  if (target[target.length - 1] !== 73) throw new Error("内存校验失败");
  return { value: 32 * repetitions / durationMs * 1000, durationMs };
}

function measureGraphics() {
  const canvas = new OffscreenCanvas(512, 512);
  const gl = canvas.getContext("webgl2", { antialias: false });
  if (!gl || gl.isContextLost()) throw new Error("此浏览器未提供可用的 WebGL2");
  const shaders = [];
  let program;
  try {
    const compile = (kind, source) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("图形上下文无法分配着色器");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("图形着色器编译失败");
      return shader;
    };

    program = gl.createProgram();
    if (!program) throw new Error("图形上下文无法分配程序");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
    void main() {
      vec2 uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    }`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform float angle;
    out vec4 pixel;
    void main() {
      vec2 p = gl_FragCoord.xy / 512.0;
      float v = angle;
      for (int i = 0; i < 20; ++i) {
        v = sin(v + p.x * float(i + 2)) * cos(p.y + v);
      }
      pixel = vec4(abs(v), p, 1.0);
    }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("图形程序链接失败");
    gl.useProgram(program);
    const angle = gl.getUniformLocation(program, "angle");
    const pixel = new Uint8Array(4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(10, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const frames = 32;
    const start = performance.now();
    for (let i = 0; i < frames; i += 1) {
      gl.uniform1f(angle, i / frames);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 同步读回确保计时包含实际完成的渲染，而非仅测 JavaScript 提交命令。
      gl.readPixels(10, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    const durationMs = performance.now() - start;
    if (gl.getError() !== gl.NO_ERROR || pixel[3] !== 255) throw new Error("图形测试未绘制有效帧");
    return { value: frames / durationMs * 1000, durationMs };
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
    if (program) gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

async function measureStorage() {
  if (!navigator.storage?.getDirectory) throw new Error("此浏览器未提供来源私有文件系统");
  const root = await navigator.storage.getDirectory();
  const fileName = "omnikit-benchmark-" + crypto.randomUUID();
  const file = await root.getFileHandle(fileName, { create: true });
  try {
    if (!file.createSyncAccessHandle) throw new Error("此浏览器未提供 OPFS 同步读写");
    const handle = await file.createSyncAccessHandle();
    try {
      const sizeMiB = 16;
      const data = new Uint8Array(sizeMiB * 1024 * 1024);
      data.fill(43);
      const start = performance.now();
      const written = handle.write(data, { at: 0 });
      handle.flush();
      const durationMs = performance.now() - start;
      if (written !== data.byteLength) throw new Error("未写完预定数据");
      return { value: sizeMiB / durationMs * 1000, durationMs };
    } finally {
      handle.close();
    }
  } finally {
    await root.removeEntry(fileName);
  }
}

self.onmessage = async ({ data }) => {
  try {
    let result;
    switch (data.metric) {
      case "cpu": result = measureCpu(data.seed); break;
      case "memory": result = measureMemory(); break;
      case "graphics": result = measureGraphics(); break;
      case "storage": result = await measureStorage(); break;
      default: throw new Error("未知测试");
    }
    if (!Number.isFinite(result.value) || result.value <= 0) throw new Error("计时精度不足，请重试");
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({ ok: false, message: error?.message || "测试未完成" });
  }
};
