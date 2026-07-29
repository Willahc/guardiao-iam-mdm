import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");

test("enforces the P0 permission matrix on privileged routes", () => {
  for (const [route, permission] of [
    ["/api/v1/profiles", "profiles:write"],
    ["/api/v1/onboarding", "people:onboard"],
    ["/api/v1/offboarding", "people:offboard"],
    ["/api/v1/access-decisions", "access:approve"],
    ["/api/v1/admin-assignments", "admin:manage"],
    ["/api/v1/asset-lifecycle", "assets:manage"],
    ["/api/v1/software-commands", "software:manage"],
  ]) {
    assert.match(worker, new RegExp(`"${route}": "${permission}"`));
  }
  assert.match(worker, /if \(requiredPermission && !hasPermission/);
});

test("restricts first-admin bootstrap to an explicit allowlist", () => {
  assert.match(worker, /GUARDIAO_BOOTSTRAP_ADMIN_EMAILS/);
  assert.match(worker, /allowedBootstrap\.includes/);
  assert.doesNotMatch(worker, /if \(!adminCount\?\.total\) \{\s*await env\.DB\.prepare/);
});

test("keeps a person independent from an endpoint", () => {
  assert.match(schema, /deviceSerial: text\("device_serial"\)\.unique\(\)/);
  assert.doesNotMatch(schema, /deviceSerial: text\("device_serial"\)\.notNull/);
  assert.match(worker, /body\.notebook_id \? Number\(body\.notebook_id\) : null/);
  assert.match(dashboard, /Sem equipamento vinculado/);
});

test("creates idempotent, step-based offboarding plans", () => {
  assert.match(worker, /execution_type='OFFBOARDING'/);
  assert.match(worker, /Já existe um plano de desligamento em andamento/);
  assert.match(worker, /Revogar \$\{assignment\.name\}/);
  assert.match(worker, /access_revoked: false/);
});

test("never represents simulated access as verified automatically", () => {
  assert.match(worker, /'SIMULATED', 'PLANNED'/);
  assert.match(worker, /verification_status.*'unverified'/s);
  assert.match(worker, /Nenhuma revogação será declarada sem verificação|nenhum foi marcado como concedido sem verificação/i);
  assert.doesNotMatch(worker, /acessos concedidos automaticamente/);
});

test("requires evidence and supports partial execution state", () => {
  assert.match(worker, /Inclua uma evidência antes de concluir manualmente/);
  assert.match(worker, /Number\(remaining\?\.failed \|\| 0\) > 0 \? "PARTIAL"/);
  assert.match(worker, /status!='VERIFIED'/);
});
