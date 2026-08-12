fetch("http://localhost:3000/api/config/runtime", {
  headers: {
    "Authorization": "Bearer test-admin-token"
  }
}).then(res => res.json()).then(console.log).catch(console.error);
