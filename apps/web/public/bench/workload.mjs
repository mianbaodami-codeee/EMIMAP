// 浏览器与服务器使用同一版本的整数负载，由服务器在发布成绩前复算校验值。
export const cpuIterations = 20_000_000;
export const cpuVersion = "cpu-1";

export function cpuWorkload(seed) {
  let value = seed | 0;
  for (let i = 0; i < cpuIterations; i += 1) {
    value = Math.imul(value ^ (value >>> 13), 0x5bd1e995) + i | 0;
  }
  return value >>> 0;
}
