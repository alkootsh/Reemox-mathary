async function run() {
    await fetch("http://localhost:3000/api/config/runtime", { headers: { "Authorization": "Bearer test-user-a-token" } });
    await fetch("http://localhost:3000/api/config/runtime", { headers: { "Authorization": "Bearer test-user-b-token" } });
    await fetch("http://localhost:3000/api/config/runtime", { headers: { "Authorization": "Bearer test-cashier-token" } });
}
run();
