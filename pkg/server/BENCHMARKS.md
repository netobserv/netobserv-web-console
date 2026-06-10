# Server Performance Benchmarks

## NETOBSERV-1276: Console Plugin Server-Side Performance Testing

This document describes the server-side performance benchmarks for the network observability console plugin.

### Implementation

Server-side performance benchmarks in `server_perf_test.go` measure the plugin's performance with mocked Loki responses, eliminating network latency and focusing on server processing time.

### How to Run

```bash
# Run all benchmarks
make benchmark-server

# Or run directly with go test
go test -bench=. -benchmem ./pkg/server/ -run=^$

# Compare with baseline using benchstat (detects performance regressions)
# First run creates baseline, subsequent runs compare against it
make benchmark-server-compare

# Run specific benchmark group
go test -bench=BenchmarkTable -benchmem ./pkg/server/ -run=^$
go test -bench=BenchmarkTopologyLoki -benchmem ./pkg/server/ -run=^$
go test -bench=BenchmarkOverviewAuto -benchmem ./pkg/server/ -run=^$

# Run specific sub-benchmark
go test -bench=BenchmarkTable/WithHistogram -benchmem ./pkg/server/ -run=^$
go test -bench=BenchmarkTopologyLoki/DNS -benchmem ./pkg/server/ -run=^$
go test -bench=BenchmarkOverviewAuto/Full -benchmem ./pkg/server/ -run=^$
```

**Baseline Comparison with benchstat:**
The `benchmark-server-compare` target uses [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat) to provide statistical comparison:
- First run: Creates a baseline snapshot
- Subsequent runs: Compares current performance against baseline with statistical significance
- Shows percentage changes in latency, memory, and allocations
- Automatically installs benchstat if not present

### CI/CD Integration

Performance benchmarks run automatically on every pull request via GitHub Actions:

```yaml
- Job: benchmark-server
- Runs on: ubuntu-latest
- Go version: 1.26
```

**What happens in CI:**
1. Checks out your PR branch
2. Installs `benchstat` automatically
3. Runs `make benchmark-server-compare`
4. Compares results against the committed baseline
5. Uploads benchmark results as artifacts (30-day retention)

**Reviewing CI Results:**
- Check the "Server performance benchmarks" job in the GitHub Actions tab
- Download benchmark artifacts to see detailed comparison
- Review the benchstat output for performance regressions marked with `~`
- The same `benchmark-server-compare` target works both locally and in CI

**Understanding CI Benchmark Output:**
- CI runs single-sample benchmarks for speed (completes in ~1-2 minutes)
- You'll see `± ∞` with footnote "need >= 6 samples for confidence interval"
- This is expected and doesn't prevent regression detection
- Percentage changes between baseline and current will still be shown
- For detailed statistical analysis with confidence intervals, run locally with `-count=6`:
  ```bash
  go test -bench=. -benchmem -benchtime=300ms -count=6 ./pkg/server/ -run=^$
  ```

### Benchmark Scenarios

**Table View:**
- Basic: Flow records only (1 API call)
- WithHistogram: Flow records + histogram metrics (2 API calls)

**Topology Page:**
The Topology page makes 1-2 API calls depending on the selected metric and whether packet drop is enabled:
- Bytes Rate (Loki/Auto): 1 call for bytes rate metric
- Packets Rate (Loki/Auto): 1 call for packets rate metric
- DNS Latency (Loki/Auto): 1 call for DNS latency metric
- RTT (Loki/Auto): 1 call for TCP RTT metric
- Dropped Packets (Loki/Auto): 1 call for dropped packets metric
- Bytes + Drops (Loki/Auto): 2 calls for bytes rate + dropped packets

**Overview Page:**
The Overview page makes different numbers of API calls depending on which features are enabled:
- Basic (Loki/Auto): 4 calls for Bytes + Packets rate metrics
- Basic + DNS (Loki/Auto): 11 calls for Basic + DNS latency/names/response codes
- Basic + RTT (Loki/Auto): 10 calls for Basic + TCP RTT metrics
- Basic + Dropped (Loki/Auto): 10 calls for Basic + Packet drop metrics
- Full (Loki/Auto): 23 calls for all features enabled

**Notes:**
- All measurements exclude actual backend query time (mocked responses)
- Benchmarks use Go sub-benchmarks (b.Run) to reduce resource usage
- Sub-benchmarks share mock server setup, reducing from 25+ individual servers to 6 servers total
- Connection pooling (MaxIdleConns=100) further reduces port exhaustion
- Auto mode intelligently chooses between Loki and Prometheus based on query type and availability

### Metrics Explained

**Benchmark Name Format:** `BenchmarkTableView-12`
- `BenchmarkTableView` - The benchmark function name
- `-12` - GOMAXPROCS (number of CPU threads used)
  - This number indicates how many OS threads Go used during the benchmark
  - `-12` means the benchmark ran on 12 CPU cores/threads
  - Reflects the test environment's available parallelism
  - Your results will vary based on your CPU (e.g., `-4` on a 4-core system)

**Performance Metrics:**
- **Iterations** - Number of times the benchmark ran (e.g., `2340`)
- **ns/op** - Nanoseconds per operation (lower is better)
- **B/op** - Bytes allocated per operation (lower is better)
- **allocs/op** - Number of memory allocations per operation (lower is better)

### What's Being Measured

These benchmarks measure **server-side processing time only**, with:
- ✅ Mocked Loki HTTP responses (no real Loki queries)
- ✅ Mocked authentication
- ✅ Real HTTP routing and handler logic
- ✅ Real JSON serialization/deserialization
- ✅ Real flow record processing

### Coverage

| Component                          | Status      | Notes                                           |
|------------------------------------|-------------|-------------------------------------------------|
| Table View (Flow Records)          | ✅ Covered  | `/api/loki/flow/records` (1 call)               |
| Table View + Histogram             | ✅ Covered  | Records + histogram metrics (2 calls)           |
| Topology - Bytes Rate (Loki/Auto)  | ✅ Covered  | 1 call: Bytes rate metric                       |
| Topology - Packets Rate (Loki/Auto)| ✅ Covered  | 1 call: Packets rate metric                     |
| Topology - DNS Latency (Loki/Auto) | ✅ Covered  | 1 call: DNS latency metric                      |
| Topology - RTT (Loki/Auto)         | ✅ Covered  | 1 call: TCP RTT metric                          |
| Topology - Dropped (Loki/Auto)     | ✅ Covered  | 1 call: Dropped packets metric                  |
| Topology - Bytes + Drops (Loki/Auto)| ✅ Covered | 2 calls: Bytes rate + dropped packets           |
| Overview Basic (Loki/Auto)         | ✅ Covered  | 4 calls: Bytes + Packets rates                  |
| Overview + DNS (Loki/Auto)         | ✅ Covered  | 11 calls: Basic + DNS latency/names/codes       |
| Overview + RTT (Loki/Auto)         | ✅ Covered  | 10 calls: Basic + TCP RTT metrics               |
| Overview + Dropped (Loki/Auto)     | ✅ Covered  | 10 calls: Basic + Packet drop metrics           |
| Overview Full (Loki/Auto)          | ✅ Covered  | 23 calls: All features enabled                  |
| Export Flows                       | ⚠️ Future   | Can be added if needed                          |
| Resource Endpoints                 | ⚠️ Future   | Can be added if needed                          |
| Prometheus-only Data Source        | ⚠️ Future   | Requires Prometheus metrics inventory setup     |

### Interpreting Results

Use `make benchmark-server-compare` to track performance over time and detect regressions.

**In CI (Single Sample Mode):**
- CI benchmarks provide quick feedback with single-sample runs
- Look for percentage differences between baseline and current values
- Example: `Table/Basic-4: 602.5µs (baseline) vs 649.1µs (current) = +7.7% slower`
- Confidence intervals won't be shown (requires ≥6 samples)
- Even without confidence intervals, large differences (>10-15%) indicate potential regressions worth investigating

**Locally (Multi-Sample Mode with `-count=6`):**
- Run with `-count=6` to get statistical confidence intervals
- benchstat will show `~` symbol for statistically significant changes at 95% confidence
- Confidence intervals help distinguish real changes from random variation
- Use this when investigating performance issues found in CI

**When to Investigate:**
- ⚠️ Latency increase >10-15% between baseline and current runs
- ⚠️ Memory usage growing unexpectedly
- ⚠️ Allocation count increasing significantly
- ⚠️ benchstat shows `~` (statistically significant regressions in local runs)

### Port Exhaustion on macOS

**Issue:**
When running all benchmark groups together on macOS, you may encounter port exhaustion errors:
```
dial tcp 127.0.0.1:xxxxx: connect: can't assign requested address
```

**Why it happens:**
- Each `httptest.NewServer()` creates a new TCP socket on an ephemeral port
- macOS has a limited pool of ephemeral ports (~16K)
- Ports enter TIME_WAIT state after closing and aren't immediately reusable
- Running 5 benchmark groups with 25 sub-benchmarks can exhaust available ports

**Solutions:**

**Option 1: Run individual benchmark groups** (Recommended for local development)
```bash
# Run groups separately with delays
go test -bench=BenchmarkTable -benchmem ./pkg/server/ -run=^$
sleep 20
go test -bench=BenchmarkTopologyLoki -benchmem ./pkg/server/ -run=^$
sleep 20
go test -bench=BenchmarkTopologyAuto -benchmem ./pkg/server/ -run=^$
sleep 20
go test -bench=BenchmarkOverviewLoki -benchmem ./pkg/server/ -run=^$
sleep 20
go test -bench=BenchmarkOverviewAuto -benchmem ./pkg/server/ -run=^$
```

**Option 2: Wait between runs**
```bash
# Wait 30-60 seconds before re-running benchmarks
sleep 60
make benchmark-server
```

**Option 3: Check and wait for ports to clear**
```bash
# Check current TIME_WAIT connections
netstat -an | grep TIME_WAIT | wc -l

# Wait until count drops significantly before running again
```

**Option 4: Run in CI on Linux**
- Linux doesn't have the same port limitations as macOS
- GitHub Actions runners (ubuntu-latest) handle this better

**Already Implemented Mitigations:**
- ✅ Sub-benchmarks share mock server setup (6 servers instead of 25+)
- ✅ HTTP connection pooling (MaxIdleConns=100) to reuse connections
- ✅ Reduced `benchtime=300ms` instead of `1s` to minimize iterations

**Note:** If you see port exhaustion errors, the benchmarks that completed before the error are still valid. You can combine results from multiple runs or use Option 1 to run groups individually.

### Future Improvements

Additional benchmarks can be added for:
- Export flows endpoint with different formats
- Large result set handling
- Filter-heavy queries
- Concurrent user scenarios
- Prometheus-only data source (requires metrics inventory configuration)
