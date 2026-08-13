async function api(method, url, token, body = null) {
    const options = {
        method,
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch("http://localhost:3000" + url, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

async function run() {
    console.log("Starting Black-Box Audit for Phase 3\n");
    let results = [];
    const report = (name, expected, actual, status, pass) => {
        const resultStr = pass ? "PASS" : "FAIL";
        console.log(`[${resultStr}] ${name}\n  Expected: ${expected}\n  Actual: ${actual}\n  HTTP: ${status}\n`);
        results.push(pass);
    };

    const tknAdmin = "test-user-a-token";   // company_a, ADMIN
    
    // First clear all existing module overrides for company_a if possible, or just set INDUSTRY:RETAIL
    await api("POST", "/api/config/modules/company", tknAdmin, { moduleName: "INDUSTRY:RETAIL", isEnabled: true });
    
    let res = await api("GET", "/api/config/runtime", tknAdmin);
    let enabledModules = res.data?.data?.enabledModules || [];
    let pass = enabledModules.includes("POS") && enabledModules.includes("SALES") && enabledModules.includes("INVENTORY") && enabledModules.includes("ACCOUNTING");
    report("1. Retail Industry Defaults", "POS, SALES, INVENTORY, ACCOUNTING enabled", enabledModules.join(', '), res.status, pass);
    
    await api("POST", "/api/config/modules/company", tknAdmin, { moduleName: "INDUSTRY:FOOD", isEnabled: true });
    res = await api("GET", "/api/config/runtime", tknAdmin);
    enabledModules = res.data?.data?.enabledModules || [];
    pass = enabledModules.includes("BATCHES");
    report("2. Food Industry Overlay", "Adds BATCHES", enabledModules.join(', '), res.status, pass);
    
    // Disable Food, should remove BATCHES
    await api("POST", "/api/config/modules/company", tknAdmin, { moduleName: "INDUSTRY:FOOD", isEnabled: false });
    res = await api("GET", "/api/config/runtime", tknAdmin);
    enabledModules = res.data?.data?.enabledModules || [];
    pass = !enabledModules.includes("BATCHES");
    report("3. Food Industry Disable", "Removes BATCHES", enabledModules.join(', '), res.status, pass);

    // Module Disabled -> API 403
    // We disable PURCHASES for example
    await api("POST", "/api/config/modules/company", tknAdmin, { moduleName: "PURCHASES", isEnabled: false });
    let purchRes = await api("GET", "/api/purchases", tknAdmin);
    pass = purchRes.status === 403;
    report("4. Module Disabled -> API 403", "403 Forbidden", `${purchRes.status} ${purchRes.data?.error}`, purchRes.status, pass);

    // Re-enable PURCHASES
    await api("POST", "/api/config/modules/company", tknAdmin, { moduleName: "PURCHASES", isEnabled: true });
    purchRes = await api("GET", "/api/purchases", tknAdmin);
    pass = purchRes.status === 200;
    report("5. Module Enabled -> API 200", "200 OK", purchRes.status, purchRes.status, pass);
    
    const allPassed = results.every(r => r);
    console.log(`\nOverall Status: ${allPassed ? "PASS" : "FAIL"}`);
}
run();
