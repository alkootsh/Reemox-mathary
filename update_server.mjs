import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf8');

// Add deleteCustomFieldDefinition to imports
if (!server.includes("deleteCustomFieldDefinition")) {
  server = server.replace(
    /getCustomFieldDefinitions,\s*createCustomFieldDefinition/,
    "getCustomFieldDefinitions, createCustomFieldDefinition, deleteCustomFieldDefinition"
  );
}

// Add custom field endpoints
const endpoints = `
    // Custom Field Definitions (Hybrid JSONB Custom Fields Engine)
    app.get("/api/custom-field-definitions", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            const entityType = req.query.entityType as string;
            const defs = await getCustomFieldDefinitions(companyId, entityType);
            res.json(defs);
        } catch (err: any) {
            res.status(500).json({ error: err?.message || "Failed to fetch custom field definitions" });
        }
    });

    app.post("/api/custom-field-definitions", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || req.body.companyId || 'company_default';
            const role = (req as any).userContext?.role || 'ADMIN';
            if (role !== 'ADMIN' && role !== 'MANAGER') {
                return res.status(403).json({ error: "Forbidden: Admin or Manager access required" });
            }
            const id = await createCustomFieldDefinition(companyId, req.body);
            res.json({ success: true, id });
        } catch (err: any) {
            res.status(400).json({ error: err?.message || "Failed to create custom field definition" });
        }
    });

    app.delete("/api/custom-field-definitions/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            const role = (req as any).userContext?.role || 'ADMIN';
            if (role !== 'ADMIN' && role !== 'MANAGER') {
                return res.status(403).json({ error: "Forbidden: Admin or Manager access required" });
            }
            await deleteCustomFieldDefinition(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ error: err?.message || "Failed to delete custom field definition" });
        }
    });
`;

if (!server.includes("/api/custom-field-definitions")) {
  server = server.replace(
    /app\.get\("\/api\/categories", async \(req, res\) => \{/,
    endpoints + "\n    app.get(\"/api/categories\", async (req, res) => {"
  );
}

fs.writeFileSync('server.ts', server);
console.log('Successfully updated server.ts');
