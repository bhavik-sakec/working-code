const autocannon = require("autocannon");
const fs = require("fs");
const path = require("path");

async function runTest(name, config) {
  console.log(`Starting performance test: ${name}...`);
  const result = await autocannon(config);
  console.log(`Finished: ${name}`);
  return result;
}

async function main() {
  const baseUrl = "http://localhost:8080/api";

  // Test 1: Health Check (Lightweight)
  const healthResult = await runTest("Health Check", {
    url: `${baseUrl}/health`,
    connections: 10,
    duration: 10,
  });

  // Test 2: Get Layouts (Read-heavy)
  const layoutsResult = await runTest("Get Layouts", {
    url: `${baseUrl}/layouts`,
    connections: 20,
    duration: 20,
  });

  // Test 3: Validate Status Change (Logic-heavy)
  const validateResult = await runTest("Validate Status Change", {
    url: `${baseUrl}/validate`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "STATUS_CHANGE",
      unitsApproved: 5,
      totalUnits: 10,
      newStatus: "PA",
    }),
    connections: 20,
    duration: 20,
  });

  const reportPath = path.join(__dirname, "performance_report.json");
  const reportData = {
    timestamp: new Date().toISOString(),
    results: {
      health: healthResult,
      layouts: layoutsResult,
      validate: validateResult,
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`Summary report saved to ${reportPath}`);

  // Generate Markdown Summary
  let markdown = `# Performance Test Report\n\nGenerated on: ${new Date().toLocaleString()}\n\n`;

  const formatResult = (name, res) => {
    return `## ${name}
- **Requests/sec:** ${res.requests.average}
- **Latency (avg):** ${res.latency.average} ms
- **Latency (p99):** ${res.latency.p99} ms
- **Throughput:** ${(res.throughput.average / 1024 / 1024).toFixed(2)} MB/s
- **Errors:** ${res.errors}
\n`;
  };

  markdown += formatResult("Health Check", healthResult);
  markdown += formatResult("Get Layouts", layoutsResult);
  markdown += formatResult("Validate Status Change", validateResult);

  fs.writeFileSync(path.join(__dirname, "performance_report.md"), markdown);
  console.log(`Markdown report saved to performance_report.md`);
}

main().catch(console.error);
