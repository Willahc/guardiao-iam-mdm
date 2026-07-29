"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AdminUser = { displayName: string; email: string };
type Tool = { id: number; name: string; category: string };
type Profile = { id: number; name: string; description: string; color: string; tool_names: string | null; entitlements?: string | null; members: number };
type Notebook = { id: number; asset_tag: string; serial: string; model: string; status: string; condition: string; assigned_to?: string; location?: string; encrypted?: number; custody_location?: string; next_maintenance_at?: string };
type User = { id: number; name: string; email: string; status: string; profile_name?: string; profile_color?: string; asset_tag?: string; model?: string };
type AccessRequest = { id: number; user_name: string; email: string; tool_name: string; requested_role: string; justification: string; expires_at?: string; status: string };
type Campaign = { id: number; name: string; due_at: string; status: string; total_items: number; reviewed_items: number };
type Connector = { id: number; name: string; category: string; status: string; auth_type: string; description: string };
type Risk = { severity: string; title: string; subject: string; recommendation: string };
type Audit = { id: number; target_user: string; action_type: string; details: string; created_at: string };
type AdminAssignment = { id: number; email: string; role: string; permissions: string; status: string };
type InstalledApplication = { id: number; notebook_id: number; asset_tag: string; model: string; name: string; version: string; publisher: string; policy_status: string; detected_at: string };
type SoftwareCommand = { id: number; asset_tag: string; action: string; application_name: string; target_version?: string; justification: string; status: string; execution_mode: string; requested_by: string; result?: string; created_at: string };
type WorkOrder = { id: number; asset_tag: string; model: string; order_type: string; status: string; assignee: string; due_at?: string; checklist: string; notes: string; created_at: string; completed_at?: string };
type AssetEvent = { id: number; asset_tag: string; event_type: string; details: string; performed_by: string; created_at: string };
type Overview = { users: User[]; profiles: Profile[]; tools: Tool[]; notebooks: Notebook[]; requests: AccessRequest[]; campaigns: Campaign[]; connectors: Connector[]; riskFindings: Risk[]; audit: Audit[]; admins: AdminAssignment[]; applications: InstalledApplication[]; softwareCommands: SoftwareCommand[]; workOrders: WorkOrder[]; assetEvents: AssetEvent[] };
type ApiResult = { status?: string; message?: string; detail?: string; detalhe?: string; logs?: string[] };

const emptyOverview: Overview = { users: [], profiles: [], tools: [], notebooks: [], requests: [], campaigns: [], connectors: [], riskFindings: [], audit: [], admins: [], applications: [], softwareCommands: [], workOrders: [], assetEvents: [] };

export default function Dashboard({ admin }: { admin: AdminUser }) {
  const [data, setData] = useState<Overview>(emptyOverview);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<ApiResult | null>(null);
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [tab, setTab] = useState<"people" | "profiles" | "inventory" | "applications" | "governance">("people");
  const [activeDialog, setActiveDialog] = useState<"people" | "profiles" | "inventory" | "applications" | "governance" | null>(null);
  const [pendingOffboard, setPendingOffboard] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/overview");
    if (response.ok) setData(await response.json() as Overview);
  }, []);

  useEffect(() => {
    fetch("/api/v1/overview")
      .then((response) => response.ok ? response.json() as Promise<Overview> : emptyOverview)
      .then(setData)
      .catch(() => undefined);
  }, []);

  async function submit(path: string, body: object, action: string) {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as ApiResult;
      setNotice(result);
      if (response.ok) await load();
      return response.ok;
    } catch {
      setNotice({ detail: "Não foi possível conectar ao motor do Guardião." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await submit("/api/v1/profiles", {
      name: form.get("name"), description: form.get("description"), color: form.get("color"),
      role: form.get("role"), scope: form.get("scope"), tool_ids: selectedTools,
    }, "profile");
    if (ok) { formElement.reset(); setSelectedTools([]); setActiveDialog(null); }
  }

  async function addNotebook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await submit("/api/v1/notebooks", {
      asset_tag: form.get("asset_tag"), serial: form.get("serial"), model: form.get("model"),
      condition: form.get("condition"), location: form.get("location"), warranty_until: form.get("warranty_until"),
      encrypted: form.get("encrypted") === "on",
    }, "notebook");
    if (ok) { formElement.reset(); setActiveDialog(null); }
  }

  async function onboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await submit("/api/v1/onboarding", {
      name: form.get("name"), email: form.get("email"), profile_id: form.get("profile_id"), notebook_id: form.get("notebook_id"),
    }, "onboarding");
    if (ok) { formElement.reset(); setActiveDialog(null); }
  }

  async function offboard(email: string) {
    const ok = await submit("/api/v1/offboarding", { email }, `offboard-${email}`);
    if (ok) setPendingOffboard(null);
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const ok = await submit("/api/v1/access-requests", { user_id: form.get("user_id"), tool_id: form.get("tool_id"), requested_role: form.get("requested_role"), justification: form.get("justification"), expires_at: form.get("expires_at") }, "access-request");
    if (ok) { formElement.reset(); setActiveDialog(null); }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const ok = await submit("/api/v1/recertifications", { name: form.get("name"), due_at: form.get("due_at") }, "campaign");
    if (ok) { formElement.reset(); setActiveDialog(null); }
  }

  async function assignAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const ok = await submit("/api/v1/admin-assignments", { email: form.get("email"), role: form.get("role") }, "admin");
    if (ok) formElement.reset();
  }

  async function manageSoftware(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const action = String(form.get("action"));
    const ok = await submit("/api/v1/software-commands", {
      notebook_id: form.get("notebook_id"), action, application_name: form.get("application_name"),
      target_version: form.get("target_version"), justification: form.get("justification"),
      confirm_uninstall: action !== "uninstall" || form.get("confirm_uninstall") === "on",
    }, "software-command");
    if (ok) formElement.reset();
  }

  async function moveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const ok = await submit("/api/v1/asset-lifecycle", {
      notebook_id: form.get("notebook_id"), action: form.get("action"), notes: form.get("notes"),
      assignee: form.get("assignee"), due_at: form.get("due_at"), location: form.get("location"),
      delivery_method: form.get("delivery_method"), tracking_code: form.get("tracking_code"),
      accessories: form.get("accessories"), maintenance_type: form.get("maintenance_type"),
      confirm_physical: form.get("confirm_physical") === "on", confirm_wipe: form.get("confirm_wipe") === "on",
      confirm_tests: form.get("confirm_tests") === "on",
    }, "asset-lifecycle");
    if (ok) formElement.reset();
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("guardiao-theme", next);
  }

  const available = data.notebooks.filter((notebook) => notebook.status === "available");
  const activeUsers = data.users.filter((user) => user.status === "active");
  const statusLabels: Record<string, string> = {
    available: "Em estoque", preparing: "Em preparação", ready: "Pronto para entrega",
    in_transit: "Em transporte", assigned: "Em uso", return_requested: "Devolução solicitada",
    inspection: "Em conferência", sanitizing: "Em higienização", maintenance: "Em manutenção",
    lost: "Extraviado",
  };
  const moduleMeta = {
    people: { eyebrow: "Identidades / Pessoas", title: "Pessoas", highlight: "e ciclo de vida", copy: "Admissões, movimentações e desligamentos com acesso e equipamento no mesmo fluxo.", action: "Nova admissão", target: "people-action" },
    profiles: { eyebrow: "Identidades / Acessos", title: "Perfis", highlight: "e permissões", copy: "Perfis por área, menor privilégio e concessões previsíveis desde o primeiro dia.", action: "Novo perfil", target: "profiles-action" },
    inventory: { eyebrow: "Dispositivos / Inventário", title: "Notebooks", highlight: "e custódia", copy: "Estoque, entrega, devolução, manutenção e preparação para o próximo ciclo.", action: "Adicionar ativo", target: "inventory-action" },
    applications: { eyebrow: "Dispositivos / Software", title: "Aplicativos", highlight: "e políticas", copy: "Inventário, conformidade e execução administrativa auditável.", action: "Nova execução", target: "applications-action" },
    governance: { eyebrow: "Controle / Governança", title: "Governança", highlight: "e auditoria", copy: "Aprovações, recertificações, riscos e evidências em uma fila operacional.", action: "Solicitar acesso", target: "governance-action" },
  }[tab];

  return (
    <main>
      <header className="topbar">
        <div className="brandBlock"><a className="brand" href="#top" aria-label="Guardião — início"><span className="brandMark">G</span><span>Guardião</span></a><small>IDENTITY CONTROL PLANE</small></div>
        <div className="headerActions">
          <button className="themeToggle" type="button" onClick={toggleTheme} aria-label="Alternar tema"><span className="themeMoon">☾</span><span className="themeSun">☀</span> Tema</button>
          <div className="adminMenu"><span className="adminAvatar">{admin.displayName[0]?.toUpperCase()}</span><div><small>Administrador</small><strong>{admin.displayName}</strong></div><a href="/signout-with-chatgpt?return_to=%2F">Sair</a></div>
        </div>
      </header>

      <section className="hero compactHero moduleHero" id="top">
        <div className="pageIdentity"><p className="eyebrow">{moduleMeta.eyebrow}</p><h1>{moduleMeta.title} <em>{moduleMeta.highlight}</em></h1><p className="heroCopy">{moduleMeta.copy}</p></div>
        <div className="pageActions"><span className="environmentState"><i /> Ambiente operacional</span><button className="primary compactAction" type="button" onClick={() => setActiveDialog(tab)}>+ {moduleMeta.action}</button></div>
        <div className="statusCard">
          <div className="pulse"><i /> POSTURA OPERACIONAL</div>
          <div className="metric"><strong>{activeUsers.length}</strong><span>identidades ativas</span></div>
          <div className="metric attention"><strong>{data.requests.filter((item) => item.status === "pending").length}</strong><span>decisões pendentes</span></div>
          <div className="metric danger"><strong>{data.riskFindings.filter((item) => item.severity === "high").length}</strong><span>riscos altos</span></div>
          <div className="metric"><strong>{available.length}</strong><span>ativos disponíveis</span></div>
        </div>
      </section>

      {notice && <div className={`notice ${notice.detail ? "noticeDanger" : ""}`} role="status"><strong>{notice.message || notice.detail}</strong>{notice.detalhe && <span>{notice.detalhe}</span>}<button onClick={() => setNotice(null)} aria-label="Fechar">×</button></div>}
      {pendingOffboard && <div className="confirmBar" role="alert">
        <div><strong>Confirmar offboarding?</strong><span>Todos os acessos de {pendingOffboard} serão revogados e uma devolução física será aberta para o notebook.</span></div>
        <div><button className="cancelAction" onClick={() => setPendingOffboard(null)}>Cancelar</button><button className="confirmAction" onClick={() => offboard(pendingOffboard)} disabled={busy !== null}>{busy ? "Revogando…" : "Confirmar revogação"}</button></div>
      </div>}

      <nav className="moduleTabs" aria-label="Módulos">
        <p>OPERAÇÃO</p>
        <button className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}><span className="navIcon">P</span><span><strong>Pessoas</strong><small>Entrada e desligamento</small></span></button>
        <button className={tab === "profiles" ? "active" : ""} onClick={() => setTab("profiles")}><span className="navIcon">A</span><span><strong>Acessos</strong><small>Perfis e permissões</small></span></button>
        <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}><span className="navIcon">N</span><span><strong>Ativos</strong><small>Notebooks e compliance</small></span></button>
        <button className={tab === "applications" ? "active" : ""} onClick={() => setTab("applications")}><span className="navIcon">S</span><span><strong>Aplicativos</strong><small>Inventário e execução</small></span><b>{data.applications.filter((item) => item.policy_status === "prohibited").length}</b></button>
        <p>CONTROLE</p>
        <button className={tab === "governance" ? "active" : ""} onClick={() => setTab("governance")}><span className="navIcon">G</span><span><strong>Governança</strong><small>Decisões, riscos e auditoria</small></span><b>{data.requests.filter((item) => item.status === "pending").length}</b></button>
      </nav>

      {activeDialog && <button className="drawerBackdrop" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar painel" />}

      {tab === "people" && <section className="module">
        <div className={`panel onboardingPanel actionDrawer ${activeDialog === "people" ? "open" : ""}`} id="people-action">
          <div className="panelHeading"><span className="step">01</span><div><p>ENTRADA DE COLABORADOR</p><h2>Provisionar por perfil</h2></div><button className="drawerClose" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar">×</button></div>
          <p className="panelCopy">Ao selecionar o perfil, todas as ferramentas permitidas para aquela área são concedidas automaticamente.</p>
          <div className="flowRail"><span className="done">Identidade</span><i /><span>Perfil</span><i /><span>Notebook</span><i /><span>Acessos</span><i /><span>Concluído</span></div>
          {data.profiles.length === 0 || available.length === 0 ? <div className="callout">Cadastre pelo menos um perfil e um notebook disponível antes de provisionar.</div> :
          <form onSubmit={onboarding}>
            <div className="formRow"><label>Nome completo<input name="name" placeholder="Marina Costa" required /></label><label>E-mail corporativo<input name="email" type="email" placeholder="marina@empresa.com" required /></label></div>
            <div className="formRow"><label>Perfil da área<select name="profile_id" required defaultValue=""><option value="" disabled>Selecione o perfil</option>{data.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {(profile.tool_names || "").split("|||").filter(Boolean).length} ferramentas</option>)}</select></label>
            <label>Notebook disponível<select name="notebook_id" required defaultValue=""><option value="" disabled>Selecione o ativo</option>{available.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.asset_tag} · {notebook.model}</option>)}</select></label></div>
            <button className="primary" disabled={busy !== null}>{busy === "onboarding" ? "Provisionando…" : "Criar identidade e conceder acessos"}<span>→</span></button>
          </form>}
        </div>
        <div className="registry embedded">
          <div className="registryHead"><div><p className="eyebrow">DIRETÓRIO</p><h2>Colaboradores</h2></div><span>{activeUsers.length} ativos</span></div>
          {data.users.length === 0 ? <div className="empty">Nenhum colaborador provisionado.</div> : <div className="tableWrap"><table><thead><tr><th>Colaborador</th><th>Perfil</th><th>Notebook</th><th>Estado</th><th /></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className="profileDot" style={{ background: user.profile_color || "#6d756f" }} />{user.profile_name || "Legado"}</td><td>{user.asset_tag ? <><strong>{user.asset_tag}</strong><small>{user.model}</small></> : "—"}</td><td><span className={`badge ${user.status}`}>{user.status === "active" ? "Ativo" : "Suspenso"}</span></td><td>{user.status === "active" && <button className="rowAction" disabled={busy !== null} onClick={() => setPendingOffboard(user.email)}>Revogar</button>}</td></tr>)}</tbody></table></div>}
        </div>
      </section>}

      {tab === "profiles" && <section className="module twoColumns">
        <div className={`panel actionDrawer ${activeDialog === "profiles" ? "open" : ""}`} id="profiles-action">
          <div className="panelHeading"><span className="step">02</span><div><p>ROLE-BASED ACCESS</p><h2>Novo perfil de área</h2></div><button className="drawerClose" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar">×</button></div>
          <form onSubmit={createProfile}>
            <div className="formRow"><label>Nome do perfil<input name="name" placeholder="Financeiro" required /></label><label>Cor de identificação<input name="color" type="color" defaultValue="#0b6b4b" /></label></div>
            <label>Descrição<input name="description" placeholder="Conciliação, contas a pagar e controladoria" required /></label>
            <div className="formRow"><label>Papel padrão<select name="role"><option>Usuário</option><option>Operador</option><option>Aprovador</option><option>Administrador</option></select></label><label>Escopo<select name="scope"><option>Departamento</option><option>Filial</option><option>Projeto</option><option>Empresa</option></select></label></div>
            <fieldset><legend>Ferramentas permitidas</legend><div className="toolPicker">{data.tools.map((tool) => <label className="checkCard" key={tool.id}><input type="checkbox" checked={selectedTools.includes(tool.id)} onChange={() => setSelectedTools((current) => current.includes(tool.id) ? current.filter((id) => id !== tool.id) : [...current, tool.id])} /><span><strong>{tool.name}</strong><small>{tool.category}</small></span></label>)}</div></fieldset>
            <button className="primary" disabled={busy !== null || selectedTools.length === 0}>{busy === "profile" ? "Criando…" : "Salvar perfil de acesso"}<span>→</span></button>
          </form>
        </div>
        <div className="profileList">
          {data.profiles.length === 0 ? <div className="panel empty">Crie o primeiro perfil de área.</div> : data.profiles.map((profile) => <article className="profileCard" key={profile.id} style={{ borderTopColor: profile.color }}>
            <div className="profileCardHead"><div><p className="eyebrow">PERFIL DE ACESSO</p><h3>{profile.name}</h3></div><strong>{profile.members}<small>pessoas</small></strong></div>
            <p>{profile.description}</p><div className="chips">{(profile.entitlements || profile.tool_names || "").split("|||").filter(Boolean).map((item) => { const [tool, role, scope] = item.split("::"); return <span key={item}>{tool}{role && <small>{role} · {scope}</small>}</span>; })}</div>
          </article>)}
        </div>
      </section>}

      {tab === "inventory" && <section className="module twoColumns inventoryLayout">
        <div className={`panel actionDrawer ${activeDialog === "inventory" ? "open" : ""}`} id="inventory-action">
          <div className="panelHeading"><span className="step">03</span><div><p>ASSET MANAGEMENT</p><h2>Entrada no estoque</h2></div><button className="drawerClose" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar">×</button></div>
          <form onSubmit={addNotebook}>
            <div className="formRow"><label>Patrimônio<input name="asset_tag" placeholder="NTB-0042" required /></label><label>Número de série<input name="serial" placeholder="PF4X9K2" required /></label></div>
            <label>Fabricante e modelo<input name="model" placeholder="Lenovo ThinkPad E14 Gen 6" required /></label>
            <div className="formRow"><label>Condição<select name="condition"><option value="new">Novo</option><option value="good">Bom estado</option><option value="maintenance">Em manutenção</option></select></label><label>Localização<input name="location" placeholder="Matriz · São Paulo" /></label></div>
            <div className="formRow"><label>Garantia até<input name="warranty_until" type="date" /></label><label className="inlineCheck"><input name="encrypted" type="checkbox" /> Criptografia verificada</label></div>
            <button className="primary" disabled={busy !== null}>{busy === "notebook" ? "Adicionando…" : "Adicionar notebook"}<span>→</span></button>
          </form>
        </div>
        <div className="inventorySummary">
          <div><strong>{data.notebooks.length}</strong><span>Total</span></div><div><strong>{available.length}</strong><span>Em estoque</span></div><div><strong>{data.notebooks.filter((n) => n.status === "assigned").length}</strong><span>Em uso</span></div>
        </div>
        <div className="lifecycleWorkspace">
          <div className="panel lifecycleControl">
            <div className="panelHeading"><span className="step">C</span><div><p>CADEIA DE CUSTÓDIA</p><h2>Movimentar notebook</h2></div></div>
            <p className="panelCopy">Registre cada passagem física. Um ativo devolvido somente retorna ao estoque após conferência, apagamento seguro e testes.</p>
            <div className="lifecycleRail" aria-label="Ciclo patrimonial">
              <span>Estoque</span><i /><span>Preparação</span><i /><span>Entrega</span><i /><span>Em uso</span><i /><span>Devolução</span><i /><span>Validação</span>
            </div>
            <form onSubmit={moveAsset}>
              <div className="formRow"><label>Notebook<select name="notebook_id" required defaultValue=""><option value="" disabled>Selecione o patrimônio</option>{data.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.asset_tag} · {statusLabels[notebook.status] || notebook.status}</option>)}</select></label>
              <label>Próxima etapa<select name="action" required defaultValue=""><option value="" disabled>Selecione a movimentação</option><option value="start_preparation">Iniciar preparação</option><option value="ready_for_delivery">Aprovar para entrega</option><option value="dispatch">Despachar / entregar</option><option value="confirm_delivery">Confirmar recebimento</option><option value="request_return">Solicitar devolução</option><option value="receive_return">Receber e conferir</option><option value="start_sanitization">Higienizar e formatar</option><option value="send_maintenance">Enviar para manutenção</option><option value="schedule_preventive">Agendar preventiva</option><option value="release_stock">Liberar para estoque</option><option value="mark_lost">Marcar como extraviado</option></select></label></div>
              <div className="formRow"><label>Responsável<input name="assignee" placeholder="Equipe de TI" required /></label><label>Prazo / preventiva<input name="due_at" type="date" /></label></div>
              <div className="formRow"><label>Local ou destino<input name="location" placeholder="Matriz · São Paulo" /></label><label>Modalidade<select name="delivery_method"><option>Presencial</option><option>Transportadora</option><option>Logística reversa</option><option>Assistência técnica</option></select></label></div>
              <div className="formRow"><label>Rastreio<input name="tracking_code" placeholder="BR123456789" /></label><label>Tipo de manutenção<select name="maintenance_type"><option value="corrective_maintenance">Corretiva</option><option value="preventive_maintenance">Preventiva</option><option value="warranty">Garantia</option></select></label></div>
              <label>Acessórios sob custódia<input name="accessories" placeholder="Carregador, mochila e mouse" /></label>
              <label>Observações e evidências<input name="notes" placeholder="Estado físico, ocorrências e providências tomadas" required /></label>
              <fieldset className="releaseChecklist"><legend>Validação obrigatória para retorno ao estoque</legend><div><label className="inlineCheck"><input name="confirm_physical" type="checkbox" /> Inspeção física</label><label className="inlineCheck"><input name="confirm_wipe" type="checkbox" /> Apagamento seguro</label><label className="inlineCheck"><input name="confirm_tests" type="checkbox" /> Testes funcionais</label></div></fieldset>
              <button className="primary" disabled={busy !== null}>{busy === "asset-lifecycle" ? "Registrando etapa…" : "Registrar movimentação"}<span>→</span></button>
            </form>
          </div>
          <div className="workOrderPanel">
            <div className="registryHead"><div><p className="eyebrow">ORDENS DE SERVIÇO</p><h2>Trabalho físico</h2></div><span>{data.workOrders.filter((order) => order.status === "open").length} abertas</span></div>
            <div className="workOrderList">{data.workOrders.filter((order) => order.status === "open").length === 0 ? <div className="empty">Nenhuma ordem aberta.</div> : data.workOrders.filter((order) => order.status === "open").map((order) => <article key={order.id}>
              <div><span className="workOrderType">{order.order_type.replaceAll("_", " ")}</span><strong>{order.asset_tag}</strong><small>{order.model}</small></div>
              <p>{order.notes}</p>
              <div className="workOrderMeta"><span>{order.assignee}</span><b>{order.due_at ? `até ${order.due_at}` : "sem prazo"}</b></div>
            </article>)}</div>
          </div>
        </div>
        <div className="registry embedded inventoryTable">
          <div className="registryHead"><div><p className="eyebrow">INVENTÁRIO</p><h2>Notebooks</h2></div><span>{data.notebooks.length} ativos</span></div>
          {data.notebooks.length === 0 ? <div className="empty">Nenhum notebook cadastrado.</div> : <div className="tableWrap"><table><thead><tr><th>Patrimônio</th><th>Equipamento</th><th>Custódia</th><th>Compliance</th><th>Estado físico</th><th>Próxima preventiva</th></tr></thead><tbody>{data.notebooks.map((notebook) => <tr key={notebook.id}><td><strong>{notebook.asset_tag}</strong><small>{notebook.serial}</small></td><td>{notebook.model}<small>{notebook.location || "Matriz"}</small></td><td><span className={`stockStatus ${notebook.status}`}>{statusLabels[notebook.status] || notebook.status}</span><small>{notebook.custody_location || "Estoque TI"}</small></td><td><span className={`compliance ${notebook.encrypted ? "ok" : "risk"}`}>{notebook.encrypted ? "Criptografado" : "Ação necessária"}</span></td><td>{notebook.condition === "new" ? "Novo" : notebook.condition === "good" ? "Bom estado" : "Requer manutenção"}</td><td>{notebook.next_maintenance_at || "Não agendada"}<small>{notebook.assigned_to || "Sem responsável"}</small></td></tr>)}</tbody></table></div>}
        </div>
        <div className="registry embedded inventoryTimeline">
          <div className="registryHead"><div><p className="eyebrow">RASTREABILIDADE</p><h2>Linha do tempo física</h2></div><span>{data.assetEvents.length} eventos</span></div>
          {data.assetEvents.length === 0 ? <div className="empty">As movimentações aparecerão aqui.</div> : <div className="assetTimeline">{data.assetEvents.slice(0, 12).map((event) => <article key={event.id}><i /><div><strong>{event.asset_tag} · {event.event_type.replaceAll("_", " ")}</strong><small>{new Date(event.created_at).toLocaleString("pt-BR")} · {event.performed_by}</small><p>{event.details.startsWith("{") ? (() => { try { return JSON.parse(event.details).notes || event.details; } catch { return event.details; } })() : event.details}</p></div></article>)}</div>}
        </div>
      </section>}

      {tab === "applications" && <section className="module applicationsModule">
        <div className="applicationStats">
          <div><strong>{data.applications.length}</strong><span>Instalações detectadas</span></div>
          <div><strong>{new Set(data.applications.map((item) => item.name)).size}</strong><span>Aplicativos únicos</span></div>
          <div><strong>{data.applications.filter((item) => item.policy_status === "prohibited").length}</strong><span>Fora da política</span></div>
          <div><strong>{data.softwareCommands.filter((item) => item.status === "queued").length}</strong><span>Comandos na fila</span></div>
        </div>
        <div className="softwareGrid">
          <div className={`panel actionDrawer ${activeDialog === "applications" ? "open" : ""}`} id="applications-action">
            <div className="panelHeading"><span className="step">04</span><div><p>ADMINISTRAÇÃO REMOTA</p><h2>Instalar ou remover</h2></div><button className="drawerClose" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar">×</button></div>
            <p className="panelCopy">A ação exige perfil administrativo, justificativa e fica registrada. Até o agente ser conectado, a fila opera em modo simulado.</p>
            <div className="simulationBanner"><strong>Modo seguro de simulação</strong><span>Nenhum comando será executado fisicamente no notebook.</span></div>
            <form onSubmit={manageSoftware}>
              <label>Notebook<select name="notebook_id" required defaultValue=""><option value="" disabled>Selecione o ativo</option>{data.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.asset_tag} · {notebook.model}</option>)}</select></label>
              <div className="formRow"><label>Ação<select name="action"><option value="install">Instalar</option><option value="uninstall">Desinstalar</option></select></label><label>Versão desejada<input name="target_version" placeholder="Mais recente" /></label></div>
              <label>Aplicativo<input name="application_name" placeholder="Microsoft Teams" required /></label>
              <label>Justificativa<input name="justification" placeholder="Necessário para as atividades do colaborador" required /></label>
              <label className="inlineCheck criticalCheck"><input name="confirm_uninstall" type="checkbox" /> Confirmo ações de desinstalação e seu impacto</label>
              <button className="primary" disabled={busy !== null}>{busy === "software-command" ? "Adicionando à fila…" : "Solicitar execução administrativa"}<span>→</span></button>
            </form>
          </div>
          <div className="registry embedded">
            <div className="registryHead"><div><p className="eyebrow">SOFTWARE INVENTORY</p><h2>Aplicativos detectados</h2></div><span>coleta pelo agente</span></div>
            {data.applications.length === 0 ? <div className="empty">O inventário será preenchido quando o agente sincronizar.</div> : <div className="tableWrap"><table><thead><tr><th>Aplicativo</th><th>Notebook</th><th>Versão</th><th>Política</th></tr></thead><tbody>{data.applications.map((application) => <tr key={application.id}><td><strong>{application.name}</strong><small>{application.publisher}</small></td><td><strong>{application.asset_tag}</strong><small>{application.model}</small></td><td><code>{application.version}</code></td><td><span className={`softwarePolicy ${application.policy_status}`}>{application.policy_status === "prohibited" ? "Proibido" : "Permitido"}</span></td></tr>)}</tbody></table></div>}
          </div>
        </div>
        <div className="registry embedded commandQueue">
          <div className="registryHead"><div><p className="eyebrow">EXECUTION QUEUE</p><h2>Fila administrativa</h2></div><span>assinada e auditável</span></div>
          {data.softwareCommands.length === 0 ? <div className="empty">Nenhuma instalação ou desinstalação solicitada.</div> : <div className="tableWrap"><table><thead><tr><th>Ação</th><th>Aplicativo</th><th>Notebook</th><th>Solicitante</th><th>Estado</th></tr></thead><tbody>{data.softwareCommands.map((command) => <tr key={command.id}><td><span className={`commandAction ${command.action}`}>{command.action === "install" ? "Instalar" : "Desinstalar"}</span></td><td><strong>{command.application_name}</strong><small>{command.justification}</small></td><td>{command.asset_tag}</td><td><small>{command.requested_by}</small></td><td><span className="commandStatus">{command.status === "queued" ? "Na fila · simulado" : command.status}</span></td></tr>)}</tbody></table></div>}
        </div>
      </section>}

      {tab === "governance" && <section className="module governanceModule">
        <div className="governanceStats">
          <div><strong>{data.requests.filter((item) => item.status === "pending").length}</strong><span>Aprovações pendentes</span></div>
          <div><strong>{data.riskFindings.filter((item) => item.severity === "high").length}</strong><span>Riscos altos</span></div>
          <div><strong>{data.campaigns.filter((item) => item.status === "active").length}</strong><span>Campanhas ativas</span></div>
          <div><strong>{data.connectors.length}</strong><span>Conectores preparados</span></div>
        </div>

        <div className="governanceGrid">
          <div className={`panel actionDrawer ${activeDialog === "governance" ? "open" : ""}`} id="governance-action"><div className="panelHeading"><span className="step">A</span><div><p>ACESSO SOB DEMANDA</p><h2>Solicitar exceção</h2></div><button className="drawerClose" type="button" onClick={() => setActiveDialog(null)} aria-label="Fechar">×</button></div>
            <form onSubmit={requestAccess}><label>Colaborador<select name="user_id" required defaultValue=""><option value="" disabled>Selecione</option>{activeUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
              <div className="formRow"><label>Ferramenta<select name="tool_id" required defaultValue=""><option value="" disabled>Selecione</option>{data.tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></label><label>Papel<select name="requested_role"><option>Leitor</option><option>Operador</option><option>Aprovador</option><option>Administrador</option></select></label></div>
              <label>Justificativa<input name="justification" placeholder="Necessário para fechamento mensal" required /></label><label>Expira em<input name="expires_at" type="date" /></label><button className="primary" disabled={busy !== null}>Enviar para aprovação <span>→</span></button>
            </form>
          </div>
          <div className="panel"><div className="panelHeading"><span className="step">B</span><div><p>RECERTIFICAÇÃO</p><h2>Revisão periódica</h2></div></div>
            <form onSubmit={createCampaign}><label>Nome da campanha<input name="name" placeholder="Revisão trimestral Q3" required /></label><label>Prazo<input name="due_at" type="date" required /></label><button className="secondary" disabled={busy !== null}>Iniciar campanha</button></form>
            <div className="miniList">{data.campaigns.map((campaign) => <div key={campaign.id}><span><strong>{campaign.name}</strong><small>Prazo {campaign.due_at}</small></span><b>{campaign.reviewed_items}/{campaign.total_items}</b></div>)}</div>
          </div>
          <div className="panel"><div className="panelHeading"><span className="step">C</span><div><p>SEGREGAÇÃO DE FUNÇÕES</p><h2>Administradores</h2></div></div>
            <form onSubmit={assignAdmin}><label>E-mail<input name="email" type="email" required placeholder="gestor@empresa.com" /></label><label>Função<select name="role"><option>Auditor</option><option>Gestor de área</option><option>Gestor de ativos</option><option>Administrador IAM</option><option>Superadministrador</option></select></label><button className="secondary" disabled={busy !== null}>Atribuir função</button></form>
            <div className="miniList">{data.admins.map((item) => <div key={item.id}><span><strong>{item.email}</strong><small>{item.permissions}</small></span><b>{item.role}</b></div>)}</div>
          </div>
          <div className="panel riskPanel"><div className="panelHeading"><span className="step">D</span><div><p>RISK ENGINE</p><h2>Achados automáticos</h2></div></div>
            <div className="riskList">{data.riskFindings.length === 0 ? <div className="empty">Nenhum risco aberto.</div> : data.riskFindings.map((risk, index) => <article key={`${risk.subject}-${index}`}><i className={risk.severity} /><div><strong>{risk.title}</strong><span>{risk.subject}</span><small>{risk.recommendation}</small></div></article>)}</div>
          </div>
        </div>

        <div className="registry embedded governanceTable"><div className="registryHead"><div><p className="eyebrow">APROVAÇÕES</p><h2>Solicitações de acesso</h2></div><span>dupla decisão</span></div>
          {data.requests.length === 0 ? <div className="empty">Nenhuma solicitação registrada.</div> : <div className="tableWrap"><table><thead><tr><th>Colaborador</th><th>Acesso solicitado</th><th>Justificativa</th><th>Status</th><th>Decisão</th></tr></thead><tbody>{data.requests.map((request) => <tr key={request.id}><td><strong>{request.user_name}</strong><small>{request.email}</small></td><td>{request.tool_name}<small>{request.requested_role}</small></td><td>{request.justification}</td><td><span className={`requestStatus ${request.status}`}>{request.status}</span></td><td>{request.status === "pending" && <div className="decisionButtons"><button onClick={() => submit("/api/v1/access-decisions", {request_id: request.id, decision:"approved"}, `approve-${request.id}`)}>Aprovar</button><button onClick={() => submit("/api/v1/access-decisions", {request_id: request.id, decision:"rejected"}, `reject-${request.id}`)}>Rejeitar</button></div>}</td></tr>)}</tbody></table></div>}
        </div>

        <div className="connectorSection"><div className="registryHead"><div><p className="eyebrow">INTEGRATION HUB</p><h2>Portas abertas para a empresa</h2></div><span>sem credenciais · nenhuma chamada externa</span></div><div className="connectorGrid">{data.connectors.map((connector) => <article key={connector.id}><span className="connectorIcon">{connector.name[0]}</span><div><strong>{connector.name}</strong><small>{connector.category} · {connector.auth_type}</small><p>{connector.description}</p></div><b>Preparado</b></article>)}</div></div>

        <div className="registry embedded auditTable"><div className="registryHead"><div><p className="eyebrow">EVIDÊNCIAS</p><h2>Auditoria imutável</h2></div><span>{data.audit.length} eventos recentes</span></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Ação</th><th>Alvo</th><th>Evidência</th></tr></thead><tbody>{data.audit.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString("pt-BR")}</td><td><code>{event.action_type}</code></td><td>{event.target_user}</td><td><small>{event.details}</small></td></tr>)}</tbody></table></div></div>
      </section>}

      <footer><span>GUARDIÃO · Enterprise IAM & MDM</span><span>Governança · Riscos · Evidências · Conectores preparados</span></footer>
    </main>
  );
}
