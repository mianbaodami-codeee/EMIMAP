using System.Diagnostics;

namespace JimiMaster;

internal static class NativeBenchmark
{
    private static uint Compute(uint seed, int iterations)
    {
        uint value = seed;
        for (uint i = 0; i < iterations; i++)
            value = unchecked((value ^ (value >> 13)) * 0x5bd1e995u + i);
        return value;
    }

    internal static async Task<string> Run(IProgress<string> progress)
    {
        return await Task.Run(() =>
        {
            const int iterations = 30_000_000;
            progress.Report("运行单线程 CPU 负载…");
            Compute(0x4d3, iterations);
            var timer = Stopwatch.StartNew();
            uint value = Compute(0x4d2, iterations);
            double cpu = iterations / timer.Elapsed.TotalSeconds / 1_000_000;

            progress.Report("运行多线程 CPU 负载…");
            int workers = Math.Clamp(Environment.ProcessorCount, 1, 8);
            var proofs = new uint[workers];
            timer.Restart();
            Parallel.For(0, workers, new ParallelOptions { MaxDegreeOfParallelism = workers },
                index => proofs[index] = Compute((uint)(0x4d2 + index), iterations));
            double multi = (double)iterations * workers / timer.Elapsed.TotalSeconds / 1_000_000;

            progress.Report("测试连续内存复制…");
            const int mebibyte = 1024 * 1024;
            var source = new byte[32 * mebibyte];
            var target = new byte[source.Length];
            Array.Fill(source, (byte)73);
            Buffer.BlockCopy(source, 0, target, 0, source.Length);
            timer.Restart();
            for (int i = 0; i < 32; i++) Buffer.BlockCopy(source, 0, target, 0, source.Length);
            double memory = 1024 / timer.Elapsed.TotalSeconds;
            if (target[^1] != 73) throw new InvalidOperationException("复制校验失败");

            progress.Report("写入并读取临时文件…");
            string file = Path.Combine(Path.GetTempPath(), $"jimi-bench-{Guid.NewGuid():N}.tmp");
            double write, read;
            try
            {
                using var stream = new FileStream(file, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 4096,
                    FileOptions.DeleteOnClose);
                timer.Restart();
                stream.Write(source);
                stream.Flush(flushToDisk: true);
                write = 32 / timer.Elapsed.TotalSeconds;
                stream.Position = 0;
                timer.Restart();
                stream.ReadExactly(target);
                read = 32 / timer.Elapsed.TotalSeconds;
                if (target[^1] != 73) throw new InvalidOperationException("临时文件校验失败");
            }
            finally
            {
                if (File.Exists(file)) File.Delete(file);
            }
            return $"""
                原生套件 0.3 · {DateTimeOffset.Now:g}
                {Environment.OSVersion.VersionString}

                CPU 单线程       {cpu:N1} M 次/秒
                CPU 并行        {multi:N1} M 次/秒（{workers} 个任务）
                内存复制        {memory:N1} MiB/秒
                临时卷写入刷新  {write:N1} MiB/秒
                临时卷读取      {read:N1} MiB/秒（包含系统文件缓存）
                CPU 校验值      {value:X8} / {proofs.Aggregate(0u, (left, right) => left ^ right):X8}
                临时文件目录    {Path.GetTempPath()}
                """;
        });
    }
}
