async function runTests() {
  const adminToken = "Bearer test-admin-token";
  const cashierToken = "Bearer test-cashier-token";

  console.log("1. Admin Fetch Runtime Config (company_default)");
  let res = await fetch("http://localhost:3000/api/config/runtime", { headers: { "Authorization": adminToken } });
  let config = await res.json();
  console.log(config);

  console.log("\n2. Cashier Try to Enable Module (should fail)");
  res = await fetch("http://localhost:3000/api/config/modules/company", {
    method: "POST",
    headers: { "Authorization": cashierToken, "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName: "MANUFACTURING", isEnabled: true })
  });
  console.log(await res.json());

  console.log("\n3. Admin Try to Enable POS without INVENTORY (if INVENTORY is disabled)");
  // Let's first disable INVENTORY
  await fetch("http://localhost:3000/api/config/modules/company", {
    method: "POST",
    headers: { "Authorization": adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName: "INVENTORY", isEnabled: false })
  });

  res = await fetch("http://localhost:3000/api/config/modules/company", {
    method: "POST",
    headers: { "Authorization": adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName: "POS", isEnabled: true })
  });
  console.log(await res.json());

  console.log("\n4. Admin Re-enable INVENTORY and then POS");
  await fetch("http://localhost:3000/api/config/modules/company", {
    method: "POST",
    headers: { "Authorization": adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName: "INVENTORY", isEnabled: true })
  });
  res = await fetch("http://localhost:3000/api/config/modules/company", {
    method: "POST",
    headers: { "Authorization": adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName: "POS", isEnabled: true })
  });
  console.log(await res.json());

  console.log("\n5. Check Cache Update");
  res = await fetch("http://localhost:3000/api/config/runtime", { headers: { "Authorization": adminToken } });
  config = await res.json();
  console.log("Is POS enabled?", config.data.enabledModules.includes("POS"));
}

runTests().catch(console.error);
