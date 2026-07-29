import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

async function initialize(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL, device_serial TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, profile_id INTEGER, notebook_id INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, target_user TEXT NOT NULL, action_type TEXT NOT NULL,
      details TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0b6b4b', created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS profile_tools (
      profile_id INTEGER NOT NULL, tool_id INTEGER NOT NULL,
      UNIQUE(profile_id, tool_id), FOREIGN KEY(profile_id) REFERENCES profiles(id), FOREIGN KEY(tool_id) REFERENCES tools(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, asset_tag TEXT NOT NULL UNIQUE, serial TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', condition TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL, location TEXT NOT NULL DEFAULT 'Matriz', warranty_until TEXT,
      encrypted INTEGER NOT NULL DEFAULT 0, last_seen_at TEXT,
      custody_location TEXT NOT NULL DEFAULT 'Estoque TI', next_maintenance_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS profile_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, tool_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', scope TEXT NOT NULL DEFAULT 'department',
      restrictions TEXT NOT NULL DEFAULT 'Dispositivo gerenciado'
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, tool_id INTEGER NOT NULL,
      requested_role TEXT NOT NULL, justification TEXT NOT NULL, expires_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL, approved_by TEXT, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recertification_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', total_items INTEGER NOT NULL, reviewed_items INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS connectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready', auth_type TEXT NOT NULL, description TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS asset_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, notebook_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      details TEXT NOT NULL, performed_by TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS asset_work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, notebook_id INTEGER NOT NULL, order_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', assignee TEXT NOT NULL, due_at TEXT,
      checklist TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL, completed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL,
      permissions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS installed_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, notebook_id INTEGER NOT NULL, name TEXT NOT NULL,
      version TEXT NOT NULL, publisher TEXT NOT NULL, policy_status TEXT NOT NULL DEFAULT 'allowed',
      detected_at TEXT NOT NULL, UNIQUE(notebook_id, name)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS software_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT, notebook_id INTEGER NOT NULL, action TEXT NOT NULL,
      application_name TEXT NOT NULL, target_version TEXT, justification TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', execution_mode TEXT NOT NULL DEFAULT 'simulated',
      requested_by TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, completed_at TEXT
    )`),
  ]);

  const columns = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("profile_id")) await db.prepare("ALTER TABLE users ADD COLUMN profile_id INTEGER").run();
  if (!names.has("notebook_id")) await db.prepare("ALTER TABLE users ADD COLUMN notebook_id INTEGER").run();
  const notebookColumns = await db.prepare("PRAGMA table_info(notebooks)").all<{ name: string }>();
  const notebookNames = new Set(notebookColumns.results.map((column) => column.name));
  if (!notebookNames.has("location")) await db.prepare("ALTER TABLE notebooks ADD COLUMN location TEXT NOT NULL DEFAULT 'Matriz'").run();
  if (!notebookNames.has("warranty_until")) await db.prepare("ALTER TABLE notebooks ADD COLUMN warranty_until TEXT").run();
  if (!notebookNames.has("encrypted")) await db.prepare("ALTER TABLE notebooks ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0").run();
  if (!notebookNames.has("last_seen_at")) await db.prepare("ALTER TABLE notebooks ADD COLUMN last_seen_at TEXT").run();
  if (!notebookNames.has("custody_location")) await db.prepare("ALTER TABLE notebooks ADD COLUMN custody_location TEXT NOT NULL DEFAULT 'Estoque TI'").run();
  if (!notebookNames.has("next_maintenance_at")) await db.prepare("ALTER TABLE notebooks ADD COLUMN next_maintenance_at TEXT").run();

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('Google Workspace', 'Produtividade')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('Slack', 'Comunicação')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('ERP Financeiro', 'Finanças')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('Internet Banking', 'Finanças')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('CRM', 'Comercial')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('GitHub', 'Engenharia')"),
    db.prepare("INSERT OR IGNORE INTO tools (name, category) VALUES ('AWS Console', 'Infraestrutura')"),
    db.prepare("INSERT OR IGNORE INTO connectors (name, category, auth_type, description) VALUES ('Microsoft Entra ID', 'Identidade', 'OAuth 2.0', 'Provisionamento, grupos e desligamento')"),
    db.prepare("INSERT OR IGNORE INTO connectors (name, category, auth_type, description) VALUES ('Google Workspace', 'Identidade', 'Service Account', 'Usuários, grupos e sessões')"),
    db.prepare("INSERT OR IGNORE INTO connectors (name, category, auth_type, description) VALUES ('Intune / MDM', 'Dispositivos', 'OAuth 2.0', 'Compliance, bloqueio e inventário')"),
    db.prepare("INSERT OR IGNORE INTO connectors (name, category, auth_type, description) VALUES ('RH / Folha', 'Pessoas', 'Webhook assinado', 'Admissão, movimentação e desligamento')"),
    db.prepare("INSERT OR IGNORE INTO connectors (name, category, auth_type, description) VALUES ('Service Desk', 'Workflow', 'API Token', 'Chamados, aprovações e evidências')"),
    db.prepare(`INSERT OR IGNORE INTO installed_applications (notebook_id, name, version, publisher, policy_status, detected_at)
      SELECT id, 'Microsoft 365 Apps', '2406', 'Microsoft', 'allowed', datetime('now') FROM notebooks ORDER BY id LIMIT 1`),
    db.prepare(`INSERT OR IGNORE INTO installed_applications (notebook_id, name, version, publisher, policy_status, detected_at)
      SELECT id, 'Google Chrome', '126.0', 'Google', 'allowed', datetime('now') FROM notebooks ORDER BY id LIMIT 1`),
    db.prepare(`INSERT OR IGNORE INTO installed_applications (notebook_id, name, version, publisher, policy_status, detected_at)
      SELECT id, 'AnyDesk', '8.0', 'AnyDesk Software', 'prohibited', datetime('now') FROM notebooks ORDER BY id LIMIT 1`),
  ]);
}

async function overview(db: D1Database) {
  const [users, profiles, tools, notebooks, requests, campaigns, connectors, audit, admins, assetEvents, applications, softwareCommands, workOrders] = await Promise.all([
    db.prepare(`SELECT u.id, u.name, u.email, u.department, u.device_serial, u.status, u.profile_id,
      p.name AS profile_name, p.color AS profile_color, n.id AS notebook_id, n.asset_tag, n.model
      FROM users u LEFT JOIN profiles p ON p.id = u.profile_id
      LEFT JOIN notebooks n ON n.id = u.notebook_id ORDER BY u.id DESC`).all(),
    db.prepare(`SELECT p.id, p.name, p.description, p.color,
      GROUP_CONCAT(t.name, '|||') AS tool_names,
      GROUP_CONCAT(t.name || '::' || COALESCE(pe.role, 'user') || '::' || COALESCE(pe.scope, 'department'), '|||') AS entitlements,
      (SELECT COUNT(*) FROM users u WHERE u.profile_id = p.id AND u.status = 'active') AS members
      FROM profiles p LEFT JOIN profile_tools pt ON pt.profile_id = p.id
      LEFT JOIN tools t ON t.id = pt.tool_id
      LEFT JOIN profile_entitlements pe ON pe.profile_id=p.id AND pe.tool_id=t.id
      GROUP BY p.id ORDER BY p.name`).all(),
    db.prepare("SELECT id, name, category FROM tools ORDER BY category, name").all(),
    db.prepare(`SELECT n.id, n.asset_tag, n.serial, n.model, n.status, n.condition, n.location,
      n.warranty_until, n.encrypted, n.last_seen_at, n.custody_location, n.next_maintenance_at,
      u.name AS assigned_to, u.email AS assigned_email
      FROM notebooks n LEFT JOIN users u ON u.notebook_id = n.id AND u.status = 'active'
      ORDER BY CASE n.status WHEN 'available' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END, n.id DESC`).all(),
    db.prepare(`SELECT ar.id, ar.requested_role, ar.justification, ar.expires_at, ar.status, ar.requested_by,
      u.name AS user_name, u.email, t.name AS tool_name FROM access_requests ar
      JOIN users u ON u.id=ar.user_id JOIN tools t ON t.id=ar.tool_id ORDER BY ar.id DESC LIMIT 30`).all(),
    db.prepare("SELECT * FROM recertification_campaigns ORDER BY id DESC LIMIT 20").all(),
    db.prepare("SELECT * FROM connectors ORDER BY category, name").all(),
    db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50").all(),
    db.prepare("SELECT * FROM admin_assignments ORDER BY role, email").all(),
    db.prepare(`SELECT ae.*, n.asset_tag FROM asset_events ae JOIN notebooks n ON n.id=ae.notebook_id ORDER BY ae.id DESC LIMIT 30`).all(),
    db.prepare(`SELECT ia.*, n.asset_tag, n.model FROM installed_applications ia
      JOIN notebooks n ON n.id=ia.notebook_id ORDER BY ia.policy_status DESC, ia.name`).all(),
    db.prepare(`SELECT sc.*, n.asset_tag FROM software_commands sc
      JOIN notebooks n ON n.id=sc.notebook_id ORDER BY sc.id DESC LIMIT 30`).all(),
    db.prepare(`SELECT wo.*, n.asset_tag, n.model FROM asset_work_orders wo
      JOIN notebooks n ON n.id=wo.notebook_id ORDER BY CASE wo.status WHEN 'open' THEN 0 ELSE 1 END, wo.id DESC LIMIT 50`).all(),
  ]);
  const riskFindings = [
    ...notebooks.results.filter((item) => !Number((item as Record<string, unknown>).encrypted)).map((item) => ({ severity: "high", title: "Notebook sem criptografia", subject: (item as Record<string, unknown>).asset_tag, recommendation: "Habilitar criptografia antes da próxima atribuição." })),
    ...users.results.filter((item) => !(item as Record<string, unknown>).profile_id && (item as Record<string, unknown>).status === "active").map((item) => ({ severity: "medium", title: "Identidade sem perfil governado", subject: (item as Record<string, unknown>).email, recommendation: "Associar um perfil de acesso aprovado." })),
    ...requests.results.filter((item) => (item as Record<string, unknown>).status === "pending").map((item) => ({ severity: "low", title: "Solicitação aguardando aprovação", subject: (item as Record<string, unknown>).email, recommendation: "Revisar justificativa e prazo." })),
    ...applications.results.filter((item) => (item as Record<string, unknown>).policy_status === "prohibited").map((item) => ({ severity: "high", title: "Aplicativo proibido detectado", subject: `${(item as Record<string, unknown>).name} em ${(item as Record<string, unknown>).asset_tag}`, recommendation: "Revisar e solicitar desinstalação administrativa." })),
  ];
  return { users: users.results, profiles: profiles.results, tools: tools.results, notebooks: notebooks.results,
    requests: requests.results, campaigns: campaigns.results, connectors: connectors.results, audit: audit.results,
    admins: admins.results, assetEvents: assetEvents.results, applications: applications.results,
    softwareCommands: softwareCommands.results, workOrders: workOrders.results, riskFindings };
}

async function api(request: Request, env: Env) {
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email");
  if (!authenticatedEmail) return json({ detail: "Autenticação administrativa necessária." }, 401);
  if (!env.DB) return json({ detail: "Persistência indisponível." }, 503);
  await initialize(env.DB);
  const adminCount = await env.DB.prepare("SELECT COUNT(*) AS total FROM admin_assignments").first<{ total: number }>();
  if (!adminCount?.total) {
    await env.DB.prepare("INSERT INTO admin_assignments (email, role, permissions, status) VALUES (?, 'Superadministrador', 'all', 'active')")
      .bind(authenticatedEmail).run();
  }
  const currentAdmin = await env.DB.prepare("SELECT role, permissions, status FROM admin_assignments WHERE email=?")
    .bind(authenticatedEmail).first<{ role: string; permissions: string; status: string }>();
  if (!currentAdmin || currentAdmin.status !== "active") return json({ detail: "Usuário autenticado sem função administrativa ativa." }, 403);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/v1/overview") return json(await overview(env.DB));

  if (request.method === "GET" && url.pathname.startsWith("/api/v1/agent/status/")) {
    const serial = decodeURIComponent(url.pathname.split("/").pop() || "");
    const user = await env.DB.prepare("SELECT status FROM users WHERE device_serial = ?").bind(serial).first<{ status: string }>();
    if (!user) return json({ status: "unknown", action: "none" });
    return json(user.status === "suspended" ? { status: "locked", action: "lock_screen" } : { status: "active", action: "none" });
  }

  if (request.method !== "POST") return json({ detail: "Método não permitido." }, 405);
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  if (url.pathname === "/api/v1/profiles") {
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const toolIds = Array.isArray(body.tool_ids) ? body.tool_ids.map(Number).filter(Boolean) : [];
    if (!name || !description || toolIds.length === 0) return json({ detail: "Informe nome, descrição e pelo menos uma ferramenta." }, 400);
    try {
      const created = await env.DB.prepare("INSERT INTO profiles (name, description, color, created_at) VALUES (?, ?, ?, ?) RETURNING id")
        .bind(name, description, String(body.color || "#0b6b4b"), now).first<{ id: number }>();
      if (!created) throw new Error("profile");
      await env.DB.batch(toolIds.flatMap((toolId) => [
        env.DB.prepare("INSERT INTO profile_tools (profile_id, tool_id) VALUES (?, ?)").bind(created.id, toolId),
        env.DB.prepare("INSERT INTO profile_entitlements (profile_id, tool_id, role, scope, restrictions) VALUES (?, ?, ?, ?, ?)")
          .bind(created.id, toolId, String(body.role || "Usuário"), String(body.scope || "Departamento"), "Dispositivo gerenciado"),
      ]));
      return json({ status: "sucesso", message: `Perfil ${name} criado com ${toolIds.length} ferramentas.` }, 201);
    } catch {
      return json({ detail: "Já existe um perfil com esse nome." }, 409);
    }
  }

  if (url.pathname === "/api/v1/notebooks") {
    const assetTag = String(body.asset_tag || "").trim().toUpperCase();
    const serial = String(body.serial || "").trim().toUpperCase();
    const model = String(body.model || "").trim();
    if (!assetTag || !serial || !model) return json({ detail: "Preencha patrimônio, serial e modelo." }, 400);
    try {
      await env.DB.prepare(`INSERT INTO notebooks
        (asset_tag, serial, model, status, condition, location, warranty_until, encrypted, last_seen_at, created_at)
        VALUES (?, ?, ?, 'available', ?, ?, ?, ?, ?, ?)`)
        .bind(assetTag, serial, model, String(body.condition || "new"), String(body.location || "Matriz"),
          body.warranty_until ? String(body.warranty_until) : null, body.encrypted ? 1 : 0, now, now).run();
      return json({ status: "sucesso", message: `Notebook ${assetTag} adicionado ao estoque.` }, 201);
    } catch {
      return json({ detail: "Patrimônio ou serial já cadastrado." }, 409);
    }
  }

  if (url.pathname === "/api/v1/onboarding") {
    const profileId = Number(body.profile_id);
    const notebookId = Number(body.notebook_id);
    const profile = await env.DB.prepare("SELECT id, name FROM profiles WHERE id = ?").bind(profileId).first<{ id: number; name: string }>();
    const notebook = await env.DB.prepare("SELECT id, serial, status FROM notebooks WHERE id = ?").bind(notebookId).first<{ id: number; serial: string; status: string }>();
    if (!profile || !notebook || notebook.status !== "available") return json({ detail: "Selecione um perfil válido e um notebook disponível." }, 400);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!name || !email) return json({ detail: "Preencha nome e e-mail." }, 400);
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO users (name, email, department, device_serial, profile_id, notebook_id, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`).bind(name, email, profile.name, notebook.serial, profile.id, notebook.id, now),
        env.DB.prepare("UPDATE notebooks SET status = 'preparing', custody_location = 'Bancada de preparação' WHERE id = ? AND status = 'available'").bind(notebook.id),
        env.DB.prepare(`INSERT INTO asset_work_orders
          (notebook_id, order_type, status, assignee, due_at, checklist, notes, created_by, created_at)
          VALUES (?, 'onboarding_preparation', 'open', 'Equipe de TI', NULL, ?, ?, ?, ?)`)
          .bind(notebook.id, JSON.stringify(["Inspeção física", "Formatação segura", "Imagem corporativa", "Criptografia", "Agente Guardião", "Aplicativos do perfil", "Testes funcionais"]),
            `Preparar para ${name}`, authenticatedEmail, now),
        env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'onboarding', ?, ?)")
          .bind(email, JSON.stringify({ profile: profile.name, notebook: notebook.serial }), now),
      ]);
      const access = await env.DB.prepare(`SELECT t.name FROM tools t JOIN profile_tools pt ON pt.tool_id = t.id WHERE pt.profile_id = ? ORDER BY t.name`).bind(profile.id).all<{ name: string }>();
      return json({
        status: "sucesso",
        message: `${name} entrou no perfil ${profile.name}.`,
        detalhe: `${access.results.length} acessos concedidos automaticamente.`,
        logs: access.results.map((tool) => `${tool.name}: acesso concedido.`),
      }, 201);
    } catch {
      return json({ detail: "E-mail ou notebook já está vinculado." }, 409);
    }
  }

  if (url.pathname === "/api/v1/offboarding") {
    const email = String(body.email || "").trim().toLowerCase();
    const user = await env.DB.prepare("SELECT id, notebook_id FROM users WHERE email = ?").bind(email).first<{ id: number; notebook_id: number | null }>();
    if (!user) return json({ detail: "Usuário não encontrado." }, 404);
    const statements = [
      env.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").bind(user.id),
      env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'offboarding', ?, ?)").bind(email, JSON.stringify({ access_revoked: true }), now),
    ];
    if (user.notebook_id) {
      statements.push(
        env.DB.prepare("UPDATE notebooks SET status = 'return_requested', custody_location = 'Com ex-colaborador' WHERE id = ?").bind(user.notebook_id),
        env.DB.prepare(`INSERT INTO asset_work_orders
          (notebook_id, order_type, status, assignee, due_at, checklist, notes, created_by, created_at)
          VALUES (?, 'offboarding_return', 'open', 'Logística reversa', NULL, ?, ?, ?, ?)`)
          .bind(user.notebook_id, JSON.stringify(["Solicitar devolução", "Confirmar acessórios", "Acompanhar transporte", "Receber e conferir"]),
            `Recolher notebook de ${email}`, authenticatedEmail, now),
        env.DB.prepare("INSERT INTO asset_events (notebook_id, event_type, details, performed_by, created_at) VALUES (?, 'return_requested', ?, ?, ?)")
          .bind(user.notebook_id, `Devolução solicitada após offboarding de ${email}`, authenticatedEmail, now),
      );
    }
    await env.DB.batch(statements);
    return json({ status: "sucesso", message: `Acessos de ${email} revogados.`, detalhe: "A devolução física do notebook foi aberta e aguarda recebimento." });
  }

  if (url.pathname === "/api/v1/access-requests") {
    const userId = Number(body.user_id);
    const toolId = Number(body.tool_id);
    if (!userId || !toolId || !body.justification) return json({ detail: "Informe colaborador, ferramenta e justificativa." }, 400);
    await env.DB.prepare(`INSERT INTO access_requests
      (user_id, tool_id, requested_role, justification, expires_at, status, requested_by, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`)
      .bind(userId, toolId, String(body.requested_role || "Usuário"), String(body.justification),
        body.expires_at ? String(body.expires_at) : null, authenticatedEmail, now).run();
    await env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'access_request', ?, ?)")
      .bind(String(userId), JSON.stringify({ tool_id: toolId, requested_by: authenticatedEmail }), now).run();
    return json({ status: "sucesso", message: "Solicitação enviada para aprovação.", detalhe: "Nenhum acesso foi concedido antes da decisão." }, 201);
  }

  if (url.pathname === "/api/v1/access-decisions") {
    const requestId = Number(body.request_id);
    const decision = body.decision === "approved" ? "approved" : "rejected";
    await env.DB.prepare("UPDATE access_requests SET status=?, approved_by=? WHERE id=? AND status='pending'")
      .bind(decision, authenticatedEmail, requestId).run();
    await env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'access_decision', ?, ?)")
      .bind(String(requestId), JSON.stringify({ decision, approved_by: authenticatedEmail }), now).run();
    return json({ status: "sucesso", message: decision === "approved" ? "Acesso aprovado em modo simulado." : "Solicitação rejeitada.", detalhe: "O conector externo permanecerá inativo até receber credenciais." });
  }

  if (url.pathname === "/api/v1/recertifications") {
    const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE status='active'").first<{ total: number }>();
    await env.DB.prepare(`INSERT INTO recertification_campaigns
      (name, due_at, status, total_items, reviewed_items, created_at) VALUES (?, ?, 'active', ?, 0, ?)`)
      .bind(String(body.name || "Revisão periódica"), String(body.due_at || now), total?.total || 0, now).run();
    return json({ status: "sucesso", message: "Campanha de recertificação iniciada.", detalhe: `${total?.total || 0} identidades aguardam revisão.` }, 201);
  }

  if (url.pathname === "/api/v1/admin-assignments") {
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "Auditor");
    if (!email) return json({ detail: "Informe o e-mail administrativo." }, 400);
    const permissions: Record<string, string> = {
      "Superadministrador": "all", "Administrador IAM": "users,profiles,requests",
      "Gestor de área": "reviews,requests", "Gestor de ativos": "notebooks,assets,software", "Auditor": "read,audit",
    };
    await env.DB.prepare("INSERT OR REPLACE INTO admin_assignments (email, role, permissions, status) VALUES (?, ?, ?, 'active')")
      .bind(email, role, permissions[role] || "read").run();
    return json({ status: "sucesso", message: `${email} recebeu a função ${role}.` }, 201);
  }

  if (url.pathname === "/api/v1/asset-lifecycle") {
    const mayManageAssets = currentAdmin.permissions === "all" || currentAdmin.permissions.split(",").some((permission) => ["assets", "notebooks"].includes(permission));
    if (!mayManageAssets) return json({ detail: "Seu perfil administrativo não permite movimentar ativos." }, 403);
    const notebookId = Number(body.notebook_id);
    const action = String(body.action || "");
    const notes = String(body.notes || "").trim();
    const assignee = String(body.assignee || "Equipe de TI").trim();
    const dueAt = body.due_at ? String(body.due_at) : null;
    const notebook = await env.DB.prepare("SELECT asset_tag, status FROM notebooks WHERE id=?").bind(notebookId).first<{ asset_tag: string; status: string }>();
    if (!notebook || !action || !notes) return json({ detail: "Informe notebook, etapa e observações." }, 400);

    const transitions: Record<string, { status: string; location: string; label: string; orderType?: string }> = {
      start_preparation: { status: "preparing", location: "Bancada de preparação", label: "Preparação iniciada", orderType: "onboarding_preparation" },
      ready_for_delivery: { status: "ready", location: "Expedição TI", label: "Notebook aprovado para entrega" },
      dispatch: { status: "in_transit", location: String(body.location || "Em transporte"), label: "Notebook despachado", orderType: "delivery" },
      confirm_delivery: { status: "assigned", location: String(body.location || "Com colaborador"), label: "Entrega confirmada" },
      request_return: { status: "return_requested", location: "Com colaborador", label: "Devolução solicitada", orderType: "offboarding_return" },
      receive_return: { status: "inspection", location: "Recebimento TI", label: "Notebook recebido para conferência", orderType: "physical_inspection" },
      send_maintenance: { status: "maintenance", location: String(body.location || "Laboratório técnico"), label: "Enviado para manutenção", orderType: String(body.maintenance_type || "corrective_maintenance") },
      start_sanitization: { status: "sanitizing", location: "Bancada de higienização", label: "Higienização e formatação iniciadas", orderType: "sanitization" },
      release_stock: { status: "available", location: "Estoque TI", label: "Notebook validado e liberado para novo ciclo" },
      mark_lost: { status: "lost", location: "Localização desconhecida", label: "Notebook marcado como extraviado" },
    };

    if (action === "schedule_preventive") {
      if (!dueAt) return json({ detail: "Informe a data da manutenção preventiva." }, 400);
      await env.DB.batch([
        env.DB.prepare("UPDATE notebooks SET next_maintenance_at=? WHERE id=?").bind(dueAt, notebookId),
        env.DB.prepare(`INSERT INTO asset_work_orders
          (notebook_id, order_type, status, assignee, due_at, checklist, notes, created_by, created_at)
          VALUES (?, 'preventive_maintenance', 'open', ?, ?, ?, ?, ?, ?)`)
          .bind(notebookId, assignee, dueAt, JSON.stringify(["Limpeza interna", "Pasta térmica", "Ventoinhas", "Saúde da bateria e SSD", "BIOS e firmware", "Memória e carregador"]), notes, authenticatedEmail, now),
        env.DB.prepare("INSERT INTO asset_events (notebook_id, event_type, details, performed_by, created_at) VALUES (?, 'preventive_scheduled', ?, ?, ?)")
          .bind(notebookId, JSON.stringify({ due_at: dueAt, assignee, notes }), authenticatedEmail, now),
      ]);
      return json({ status: "sucesso", message: `Manutenção preventiva de ${notebook.asset_tag} agendada.`, detalhe: `Responsável: ${assignee}.` }, 201);
    }

    const transition = transitions[action];
    if (!transition) return json({ detail: "Etapa patrimonial inválida." }, 400);
    if (action === "release_stock" && !(body.confirm_physical && body.confirm_wipe && body.confirm_tests)) {
      return json({ detail: "Para liberar ao estoque, confirme inspeção física, apagamento seguro e testes funcionais." }, 400);
    }
    const eventDetails = JSON.stringify({
      from: notebook.status, to: transition.status, notes, assignee,
      delivery_method: body.delivery_method || null, tracking_code: body.tracking_code || null,
      accessories: body.accessories || null,
    });
    const statements = [
      env.DB.prepare("UPDATE notebooks SET status=?, custody_location=? WHERE id=?").bind(transition.status, transition.location, notebookId),
      env.DB.prepare("INSERT INTO asset_events (notebook_id, event_type, details, performed_by, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(notebookId, action, eventDetails, authenticatedEmail, now),
      env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'asset_lifecycle', ?, ?)")
        .bind(notebook.asset_tag, eventDetails, now),
    ];
    if (transition.orderType) {
      statements.push(env.DB.prepare(`INSERT INTO asset_work_orders
        (notebook_id, order_type, status, assignee, due_at, checklist, notes, created_by, created_at)
        VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?)`)
        .bind(notebookId, transition.orderType, assignee, dueAt, JSON.stringify(body.checklist || []), notes, authenticatedEmail, now));
    }
    if (["ready_for_delivery", "confirm_delivery", "release_stock"].includes(action)) {
      statements.push(env.DB.prepare("UPDATE asset_work_orders SET status='completed', completed_at=? WHERE notebook_id=? AND status='open'").bind(now, notebookId));
    }
    await env.DB.batch(statements);
    return json({ status: "sucesso", message: `${transition.label}: ${notebook.asset_tag}.`, detalhe: `Custódia atual: ${transition.location}.` }, 201);
  }

  if (url.pathname === "/api/v1/asset-events") {
    const notebookId = Number(body.notebook_id);
    await env.DB.prepare("INSERT INTO asset_events (notebook_id, event_type, details, performed_by, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(notebookId, String(body.event_type || "inspection"), String(body.details || "Sem observações"), authenticatedEmail, now).run();
    if (body.event_type === "maintenance") await env.DB.prepare("UPDATE notebooks SET status='maintenance' WHERE id=?").bind(notebookId).run();
    if (body.event_type === "returned") await env.DB.prepare("UPDATE notebooks SET status='available' WHERE id=?").bind(notebookId).run();
    return json({ status: "sucesso", message: "Evento patrimonial registrado na linha do tempo." }, 201);
  }

  if (url.pathname === "/api/v1/software-commands") {
    const mayManageSoftware = currentAdmin.permissions === "all" || currentAdmin.permissions.split(",").includes("software");
    if (!mayManageSoftware) return json({ detail: "Seu perfil administrativo não permite gerenciar aplicativos." }, 403);
    const notebookId = Number(body.notebook_id);
    const action = body.action === "uninstall" ? "uninstall" : "install";
    const applicationName = String(body.application_name || "").trim();
    const targetVersion = String(body.target_version || "").trim() || null;
    const justification = String(body.justification || "").trim();
    if (!notebookId || !applicationName || !justification) return json({ detail: "Informe notebook, aplicativo e justificativa." }, 400);
    if (action === "uninstall" && body.confirm_uninstall !== true) return json({ detail: "Confirme explicitamente a desinstalação." }, 400);
    const notebook = await env.DB.prepare("SELECT asset_tag FROM notebooks WHERE id=?").bind(notebookId).first<{ asset_tag: string }>();
    if (!notebook) return json({ detail: "Notebook não encontrado." }, 404);
    const result = "Aguardando conexão segura com o agente do notebook.";
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO software_commands
        (notebook_id, action, application_name, target_version, justification, status, execution_mode, requested_by, result, created_at)
        VALUES (?, ?, ?, ?, ?, 'queued', 'simulated', ?, ?, ?)`)
        .bind(notebookId, action, applicationName, targetVersion, justification, authenticatedEmail, result, now),
      env.DB.prepare("INSERT INTO audit_logs (target_user, action_type, details, created_at) VALUES (?, 'software_command', ?, ?)")
        .bind(notebook.asset_tag, JSON.stringify({ action, application: applicationName, requested_by: authenticatedEmail, mode: "simulated" }), now),
    ]);
    return json({
      status: "sucesso",
      message: `${action === "install" ? "Instalação" : "Desinstalação"} adicionada à fila administrativa.`,
      detalhe: "Modo simulado: nenhuma alteração real foi executada no notebook.",
    }, 201);
  }

  return json({ detail: "Rota não encontrada." }, 404);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/v1/")) return api(request, env);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
