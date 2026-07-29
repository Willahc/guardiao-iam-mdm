import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": "admin@guardiao.local",
        "oai-authenticated-user-full-name": "Administrador Guardiao",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Guardião control plane", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Guardião/);
  assert.match(html, /Pessoas/);
  assert.match(html, /sob controle/);
  assert.match(html, /Entrada e desligamento/);
  assert.match(html, /Perfis e permissões/);
  assert.match(html, /Notebooks e compliance/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
