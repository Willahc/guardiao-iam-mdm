"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

type AdminUser = { displayName: string; email: string };
type Tool = { id: number; name: string; category: string };
type Profile = {
  id: number;
  name: string;
  description: string;
  color: string;
  tool_names: string | null;
  entitlements?: string | null;
  members: number;
};
type Notebook = {
  id: number;
  asset_tag: string;
  serial: string;
  model: string;
  status: string;
  condition: string;
  assigned_to?: string;
  location?: string;
  encrypted?: number;
  custody_location?: string;
  next_maintenance_at?: string;
};
type User = {
  id: number;
  name: string;
  email: string;
  status: string;
  profile_name?: string;
  profile_color?: string;
  asset_tag?: string;
  model?: string;
};
type AccessRequest = {
  id: number;
  user_name: string;
  email: string;
  tool_name: string;
  requested_role: string;
  justification: string;
  expires_at?: string;
  status: string;
};
type Campaign = {
  id: number;
  name: string;
  due_at: string;
  status: string;
  total_items: number;
  reviewed_items: number;
};
type Connector = {
  id: number;
  name: string;
  category: string;
  status: string;
  auth_type: string;
  description: string;
};
type Risk = {
  severity: string;
  title: string;
  subject: string;
  recommendation: string;
};
type Audit = {
  id: number;
  target_user: string;
  action_type: string;
  details: string;
  created_at: string;
};
type AdminAssignment = {
  id: number;
  email: string;
  role: string;
  permissions: string;
  status: string;
};
type InstalledApplication = {
  id: number;
  notebook_id: number;
  asset_tag: string;
  model: string;
  name: string;
  version: string;
  publisher: string;
  policy_status: string;
  detected_at: string;
};
type SoftwareCommand = {
  id: number;
  asset_tag: string;
  action: string;
  application_name: string;
  target_version?: string;
  justification: string;
  status: string;
  execution_mode: string;
  requested_by: string;
  result?: string;
  created_at: string;
};
type WorkOrder = {
  id: number;
  asset_tag: string;
  model: string;
  order_type: string;
  status: string;
  assignee: string;
  due_at?: string;
  checklist: string;
  notes: string;
  created_at: string;
  completed_at?: string;
};
type AssetEvent = {
  id: number;
  asset_tag: string;
  event_type: string;
  details: string;
  performed_by: string;
  created_at: string;
};
type LifecycleExecution = {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  execution_type: string;
  status: string;
  total_steps: number;
  verified_steps: number;
  attention_steps: number;
  created_at: string;
};
type ExecutionStep = {
  id: number;
  execution_id: number;
  tool_id?: number;
  tool_name?: string;
  user_name: string;
  email: string;
  label: string;
  method: string;
  status: string;
  assignee: string;
  due_at?: string;
  attempts: number;
  result?: string;
  evidence?: string;
  error?: string;
};
type AccessAssignment = {
  id: number;
  user_id: number;
  tool_id: number;
  user_name: string;
  email: string;
  tool_name: string;
  account_identifier?: string;
  expected_state: string;
  observed_state: string;
  verification_status: string;
  last_verified_at?: string;
};
type Overview = {
  users: User[];
  profiles: Profile[];
  tools: Tool[];
  notebooks: Notebook[];
  requests: AccessRequest[];
  campaigns: Campaign[];
  connectors: Connector[];
  riskFindings: Risk[];
  audit: Audit[];
  admins: AdminAssignment[];
  applications: InstalledApplication[];
  softwareCommands: SoftwareCommand[];
  workOrders: WorkOrder[];
  assetEvents: AssetEvent[];
  executions: LifecycleExecution[];
  executionSteps: ExecutionStep[];
  accessAssignments: AccessAssignment[];
};
type ApiResult = { status?: string; message?: string; detail?: string; detalhe?: string; logs?: string[] };

type Tab = "overview" | "people" | "profiles" | "lifecycle" | "requests" | "integrations" | "workspace";
type DrawerMode = "person" | "profile" | "request" | "campaign" | "admin" | "notebook" | "movement" | null;
type PendingFilter = "mine" | "all" | "overdue" | "unassigned" | "failures" | "approvals";

const emptyOverview: Overview = {
  users: [],
  profiles: [],
  tools: [],
  notebooks: [],
  requests: [],
  campaigns: [],
  connectors: [],
  riskFindings: [],
  audit: [],
  admins: [],
  applications: [],
  softwareCommands: [],
  workOrders: [],
  assetEvents: [],
  executions: [],
  executionSteps: [],
  accessAssignments: [],
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function matchesQuery(value: string | undefined, query: string) {
  if (!query) return true;
  return normalize(value).includes(normalize(query));
}

function parsePipeList(value: string | null | undefined) {
  return (value || "")
    .split("|||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return "Sem prazo";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string) {
  if (!value) return "Sem data";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return dateTimeFormatter.format(new Date(parsed));
}

function isOverdue(value?: string) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return parsed < Date.now();
}

function statusTone(value: string) {
  const normalized = value.toLowerCase();
  if (["verified", "completed", "active", "healthy", "configured", "ready"].includes(normalized)) return "success";
  if (["failed", "rejected", "suspended", "critical", "overdue", "partial"].includes(normalized)) return "danger";
  if (["running", "pending", "queued", "simulated", "planned", "in_progress"].includes(normalized)) return "info";
  if (["waiting", "attention", "unassigned", "degraded"].includes(normalized)) return "warning";
  return "neutral";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    onboarding: "Em onboarding",
    offboarding: "Em desligamento",
    suspended: "Suspenso",
    available: "Em estoque",
    preparing: "Em preparação",
    ready: "Pronto",
    assigned: "Em uso",
    in_transit: "Em transporte",
    return_requested: "Devolução solicitada",
    inspection: "Em conferência",
    sanitizing: "Em higienização",
    maintenance: "Em manutenção",
    lost: "Extraviado",
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    running: "Em andamento",
    completed: "Concluído",
    partial: "Parcial",
    queued: "Na fila",
    catalog_only: "Somente catálogo",
    simulated: "Modo simulado",
    configured: "Configurado",
    healthy: "Saudável",
    degraded: "Com falha",
    failed: "Com falha",
    verified: "Verificado",
    warning: "Aguardando",
  };
  const key = value.toLowerCase();
  return labels[key] || key.replaceAll("_", " ");
}

function statusClass(value: string) {
  const tone = statusTone(value);
  return `badge badge-${tone}`;
}

function toneClass(value: string) {
  const tone = statusTone(value);
  return `pill pill-${tone}`;
}

function progressPercent(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function MetricButton({
  value,
  label,
  tone,
  onClick,
}: {
  value: string | number;
  label: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
  onClick?: () => void;
}) {
  return (
    <button className={`metricCard metricCard-${tone}`} type="button" onClick={onClick}>
      <strong>{value}</strong>
      <span>{label}</span>
    </button>
  );
}

function DrawerField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Dashboard({ admin }: { admin: AdminUser }) {
  const [data, setData] = useState<Overview>(emptyOverview);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<ApiResult | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [pendingOffboard, setPendingOffboard] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>("all");
  const [search, setSearch] = useState("");

  async function load() {
    const response = await fetch("/api/v1/overview");
    if (response.ok) {
      setData((await response.json()) as Overview);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data.users.length) return;
    if (!selectedPersonId || !data.users.some((item) => item.id === selectedPersonId)) {
      setSelectedPersonId(data.users[0].id);
    }
  }, [data.users, selectedPersonId]);

  useEffect(() => {
    if (!data.profiles.length) return;
    if (!selectedProfileId || !data.profiles.some((item) => item.id === selectedProfileId)) {
      setSelectedProfileId(data.profiles[0].id);
    }
  }, [data.profiles, selectedProfileId]);

  useEffect(() => {
    if (!data.executions.length) return;
    if (!selectedExecutionId || !data.executions.some((item) => item.id === selectedExecutionId)) {
      setSelectedExecutionId(data.executions[0].id);
    }
  }, [data.executions, selectedExecutionId]);

  async function submit(path: string, body: object, action: string) {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiResult;
      setNotice(result);
      if (response.ok) await load();
      return response.ok;
    } catch {
      setNotice({ detail: "Nao foi possivel conectar ao motor do Guardiao." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/onboarding",
      {
        name: form.get("name"),
        email: form.get("email"),
        profile_id: form.get("profile_id"),
        notebook_id: form.get("notebook_id") || null,
      },
      "person",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("people");
    }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/profiles",
      {
        name: form.get("name"),
        description: form.get("description"),
        color: form.get("color"),
        role: form.get("role"),
        scope: form.get("scope"),
        tool_ids: form.getAll("tool_ids").map((value) => Number(value)),
      },
      "profile",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("profiles");
    }
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/access-requests",
      {
        user_id: form.get("user_id"),
        tool_id: form.get("tool_id"),
        requested_role: form.get("requested_role"),
        justification: form.get("justification"),
        expires_at: form.get("expires_at"),
      },
      "request",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("requests");
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/recertifications",
      { name: form.get("name"), due_at: form.get("due_at") },
      "campaign",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("requests");
    }
  }

  async function assignAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/admin-assignments",
      { email: form.get("email"), role: form.get("role") },
      "admin",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
    }
  }

  async function addNotebook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/notebooks",
      {
        asset_tag: form.get("asset_tag"),
        serial: form.get("serial"),
        model: form.get("model"),
        condition: form.get("condition"),
        location: form.get("location"),
        warranty_until: form.get("warranty_until"),
        encrypted: form.get("encrypted") === "on",
      },
      "notebook",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("workspace");
    }
  }

  async function moveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(
      "/api/v1/asset-lifecycle",
      {
        notebook_id: form.get("notebook_id"),
        action: form.get("action"),
        notes: form.get("notes"),
        assignee: form.get("assignee"),
        due_at: form.get("due_at"),
        location: form.get("location"),
        delivery_method: form.get("delivery_method"),
        tracking_code: form.get("tracking_code"),
        accessories: form.get("accessories"),
        maintenance_type: form.get("maintenance_type"),
        confirm_physical: form.get("confirm_physical") === "on",
        confirm_wipe: form.get("confirm_wipe") === "on",
        confirm_tests: form.get("confirm_tests") === "on",
      },
      "movement",
    );
    if (ok) {
      event.currentTarget.reset();
      setDrawerMode(null);
      setTab("workspace");
    }
  }

  async function offboard(email: string) {
    const ok = await submit("/api/v1/offboarding", { email }, `offboard-${email}`);
    if (ok) setPendingOffboard(null);
  }

  async function updateExecutionStep(event: FormEvent<HTMLFormElement>, stepId: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = (submitter?.value || "complete_manual") as "complete_manual" | "mark_failed" | "retry";
    await submit(
      "/api/v1/execution-steps",
      {
        step_id: stepId,
        action,
        evidence: form.get("evidence"),
        error: form.get("error"),
      },
      `step-${stepId}`,
    );
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("guardiao-theme", next);
  }

  const visibleQuery = search.trim();
  const visibleUsers = data.users.filter(
    (item) =>
      matchesQuery(item.name, visibleQuery) ||
      matchesQuery(item.email, visibleQuery) ||
      matchesQuery(item.profile_name, visibleQuery) ||
      matchesQuery(item.status, visibleQuery),
  );
  const visibleProfiles = data.profiles.filter(
    (item) =>
      matchesQuery(item.name, visibleQuery) ||
      matchesQuery(item.description, visibleQuery) ||
      matchesQuery(item.tool_names ?? "", visibleQuery),
  );
  const visibleExecutions = data.executions.filter(
    (item) =>
      matchesQuery(item.user_name, visibleQuery) ||
      matchesQuery(item.email, visibleQuery) ||
      matchesQuery(item.execution_type, visibleQuery) ||
      matchesQuery(item.status, visibleQuery),
  );
  const visibleRequests = data.requests.filter(
    (item) =>
      matchesQuery(item.user_name, visibleQuery) ||
      matchesQuery(item.email, visibleQuery) ||
      matchesQuery(item.tool_name, visibleQuery) ||
      matchesQuery(item.status, visibleQuery),
  );
  const visibleNotebooks = data.notebooks.filter(
    (item) =>
      matchesQuery(item.asset_tag, visibleQuery) ||
      matchesQuery(item.serial, visibleQuery) ||
      matchesQuery(item.model, visibleQuery) ||
      matchesQuery(item.status, visibleQuery),
  );
  const visibleConnectors = data.connectors.filter(
    (item) =>
      matchesQuery(item.name, visibleQuery) ||
      matchesQuery(item.category, visibleQuery) ||
      matchesQuery(item.status, visibleQuery) ||
      matchesQuery(item.auth_type, visibleQuery),
  );
  const visibleCommands = data.softwareCommands.filter(
    (item) =>
      matchesQuery(item.application_name, visibleQuery) ||
      matchesQuery(item.asset_tag, visibleQuery) ||
      matchesQuery(item.requested_by, visibleQuery) ||
      matchesQuery(item.status, visibleQuery),
  );
  const visibleWorkOrders = data.workOrders.filter(
    (item) =>
      matchesQuery(item.asset_tag, visibleQuery) ||
      matchesQuery(item.model, visibleQuery) ||
      matchesQuery(item.status, visibleQuery) ||
      matchesQuery(item.order_type, visibleQuery),
  );

  useEffect(() => {
    if (tab === "people" && visibleUsers.length && !visibleUsers.some((item) => item.id === selectedPersonId)) {
      setSelectedPersonId(visibleUsers[0].id);
    }
    if (tab === "profiles" && visibleProfiles.length && !visibleProfiles.some((item) => item.id === selectedProfileId)) {
      setSelectedProfileId(visibleProfiles[0].id);
    }
    if (tab === "lifecycle" && visibleExecutions.length && !visibleExecutions.some((item) => item.id === selectedExecutionId)) {
      setSelectedExecutionId(visibleExecutions[0].id);
    }
  }, [tab, visibleUsers, visibleProfiles, visibleExecutions, selectedPersonId, selectedProfileId, selectedExecutionId]);

  const pageUser = admin.displayName.split(" ")[0] || admin.displayName;
  const onboardingRuns = data.executions.filter((item) => item.execution_type === "ONBOARDING" && item.status === "RUNNING").length;
  const offboardingRuns = data.executions.filter((item) => item.execution_type === "OFFBOARDING" && item.status === "RUNNING").length;
  const delayedSteps = data.executionSteps.filter((item) => item.status !== "VERIFIED" && isOverdue(item.due_at)).length;
  const unverifiedAssignments = data.accessAssignments.filter((item) => item.verification_status !== "VERIFIED").length;
  const verifiedAssignments = data.accessAssignments.filter((item) => item.verification_status === "VERIFIED").length;
  const openRequests = data.requests.filter((item) => item.status === "pending").length;
  const openWorkOrders = data.workOrders.filter((item) => item.status === "open").length;
  const openRisks = data.riskFindings.filter((item) => item.severity === "high").length;
  const selectedPerson = data.users.find((item) => item.id === selectedPersonId) || visibleUsers[0];
  const selectedProfile = data.profiles.find((item) => item.id === selectedProfileId) || visibleProfiles[0];
  const selectedExecution = data.executions.find((item) => item.id === selectedExecutionId) || visibleExecutions[0];
  const selectedExecutionSteps = data.executionSteps.filter((item) => item.execution_id === selectedExecution?.id);
  const selectedAssignments = data.accessAssignments.filter((item) => item.user_id === selectedPerson?.id);
  const selectedPersonExecutions = data.executions.filter((item) => item.user_id === selectedPerson?.id);
  const selectedProfileTools = parsePipeList(selectedProfile?.tool_names);
  const selectedProfileEntitlements = parsePipeList(selectedProfile?.entitlements);
  const recentExecutions = visibleExecutions.slice(0, 6);
  const priorities = [
    ...data.executionSteps
      .filter((item) => item.status !== "VERIFIED" && isOverdue(item.due_at))
      .slice(0, 2)
      .map((item) => ({
        title: `${item.tool_name || item.label} de ${item.user_name} está atrasado`,
        detail: item.assignee ? `Responsável: ${item.assignee}` : "Sem responsável definido",
        action: "Atrasado",
      })),
    ...data.requests
      .filter((item) => item.status === "pending")
      .slice(0, 2)
      .map((item) => ({
        title: `${item.tool_name} para ${item.user_name} aguarda decisão`,
        detail: `${item.requested_role} · ${item.justification}`,
        action: "Pendente",
      })),
    ...data.workOrders
      .filter((item) => item.status === "open")
      .slice(0, 2)
      .map((item) => ({
        title: `${item.asset_tag} aguarda ${item.order_type.replaceAll("_", " ")}`,
        detail: `${item.assignee} · ${item.due_at ? `prazo ${item.due_at}` : "sem prazo"}`,
        action: "Físico",
      })),
  ].slice(0, 4);

  const shellTitle: Record<Tab, { eyebrow: string; title: string; description: string; action?: { label: string; drawer: DrawerMode } }> = {
    overview: {
      eyebrow: "Visão geral",
      title: "Controle simples para admissões, mudanças e desligamentos",
      description: "O que precisa de atenção hoje, sem linguagem de console enterprise e sem excesso de ruído visual.",
    },
    people: {
      eyebrow: "Pessoas",
      title: "Identidades, perfis e estado atual dos acessos",
      description: "A pessoa fica no centro. O notebook e o software aparecem como recursos associados, não como identidade.",
      action: { label: "Nova pessoa", drawer: "person" },
    },
    profiles: {
      eyebrow: "Perfis",
      title: "Perfis por área, com matriz de acesso clara",
      description: "Permissões previsíveis, ferramentas esperadas e exceções visíveis sem espalhar a informação pela interface.",
      action: { label: "Novo perfil", drawer: "profile" },
    },
    lifecycle: {
      eyebrow: "Lifecycle",
      title: "Execuções verificáveis em linha do tempo",
      description: "Cada etapa mostra ferramenta, método, responsável, prazo, evidência e resultado observado.",
    },
    requests: {
      eyebrow: "Pendências",
      title: "Fila operacional de aprovações e pendências",
      description: "O que está parado, o que depende de evidência e o que precisa de decisão aparece no mesmo lugar.",
      action: { label: "Nova solicitação", drawer: "request" },
    },
    integrations: {
      eyebrow: "Integrações",
      title: "Catálogo, simulação e integração real não são a mesma coisa",
      description: "O estado do conector fica explícito para evitar prometer automação onde ainda existe apenas catálogo.",
    },
    workspace: {
      eyebrow: "Workspace",
      title: "Recursos associados à pessoa, sem virar a identidade",
      description: "Dispositivos, custódia, software e manutenção aparecem como expansão operacional.",
      action: { label: "Adicionar notebook", drawer: "notebook" },
    },
  };

  const current = shellTitle[tab];

  function openDrawer(next: DrawerMode) {
    setDrawerMode(next);
  }

  function renderDrawer() {
    if (!drawerMode) return null;
    const drawerHeader = {
      person: ["Nova pessoa", "Criar identidade e gerar um plano de onboarding sem exigir notebook."],
      profile: ["Novo perfil", "Definir acesso esperado, escopo e ferramentas da área."],
      request: ["Nova solicitação", "Abrir uma exceção ou revisão com prazo e justificativa."],
      campaign: ["Nova recertificação", "Iniciar uma revisão periódica com prazo definido."],
      admin: ["Novo administrador", "Atribuir uma função administrativa com escopo claro."],
      notebook: ["Novo notebook", "Cadastrar um ativo para estoque, custódia e entrega."],
      movement: ["Movimentação de notebook", "Registrar entrega, retorno, manutenção ou preparação."],
    }[drawerMode];

    return (
      <>
        <button className="drawerBackdrop" type="button" aria-label="Fechar painel" onClick={() => setDrawerMode(null)} />
        <aside className="drawerPanel" role="dialog" aria-modal="true" aria-label={drawerHeader[0]}>
          <div className="drawerHeader">
            <div>
              <p>{drawerHeader[0]}</p>
              <h3>{drawerHeader[1]}</h3>
            </div>
            <button type="button" className="drawerClose" onClick={() => setDrawerMode(null)} aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="drawerBody">
            {drawerMode === "person" && (
              <form onSubmit={createPerson} className="drawerForm">
                <DrawerField label="Nome completo">
                  <input name="name" placeholder="Marina Costa" required />
                </DrawerField>
                <DrawerField label="E-mail corporativo">
                  <input name="email" type="email" placeholder="marina@empresa.com" required />
                </DrawerField>
                <DrawerField label="Perfil da área">
                  <select name="profile_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione o perfil
                    </option>
                    {data.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Workspace ou notebook (opcional)">
                  <select name="notebook_id" defaultValue="">
                    <option value="">Sem equipamento vinculado</option>
                    {visibleNotebooks
                      .filter((item) => item.status === "available")
                      .map((notebook) => (
                        <option key={notebook.id} value={notebook.id}>
                          {notebook.asset_tag} · {notebook.model}
                        </option>
                      ))}
                  </select>
                </DrawerField>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "person" ? "Criando plano..." : "Criar plano de onboarding"}
                </button>
              </form>
            )}

            {drawerMode === "profile" && (
              <form onSubmit={createProfile} className="drawerForm">
                <DrawerField label="Nome do perfil">
                  <input name="name" placeholder="Financeiro" required />
                </DrawerField>
                <DrawerField label="Descrição">
                  <textarea name="description" rows={3} placeholder="Acesso base, exceções e escopo da área." required />
                </DrawerField>
                <div className="drawerGrid">
                  <DrawerField label="Cor">
                    <input name="color" type="text" placeholder="#2457D6" />
                  </DrawerField>
                  <DrawerField label="Papel">
                    <select name="role" defaultValue="">
                      <option value="">Selecione</option>
                      <option value="operacional">Operacional</option>
                      <option value="gerencial">Gerencial</option>
                      <option value="auditoria">Auditoria</option>
                    </select>
                  </DrawerField>
                </div>
                <DrawerField label="Escopo">
                  <input name="scope" placeholder="Departamento, unidade ou unidade de negócio" />
                </DrawerField>
                <DrawerField label="Ferramentas">
                  <div className="checkGrid">
                    {data.tools.map((tool) => (
                      <label className="checkCard" key={tool.id}>
                        <input type="checkbox" name="tool_ids" value={tool.id} />
                        <span>
                          <strong>{tool.name}</strong>
                          <small>{tool.category}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </DrawerField>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "profile" ? "Salvando..." : "Salvar perfil"}
                </button>
              </form>
            )}

            {drawerMode === "request" && (
              <form onSubmit={requestAccess} className="drawerForm">
                <DrawerField label="Colaborador">
                  <select name="user_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {data.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Ferramenta">
                  <select name="tool_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {data.tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                <div className="drawerGrid">
                  <DrawerField label="Papel">
                    <select name="requested_role" defaultValue="Leitor">
                      <option>Leitor</option>
                      <option>Operador</option>
                      <option>Aprovador</option>
                      <option>Administrador</option>
                    </select>
                  </DrawerField>
                  <DrawerField label="Expira em">
                    <input name="expires_at" type="date" />
                  </DrawerField>
                </div>
                <DrawerField label="Justificativa">
                  <textarea name="justification" rows={3} placeholder="Necessário para fechamento mensal." required />
                </DrawerField>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "request" ? "Enviando..." : "Enviar para aprovação"}
                </button>
              </form>
            )}

            {drawerMode === "campaign" && (
              <form onSubmit={createCampaign} className="drawerForm">
                <DrawerField label="Nome da campanha">
                  <input name="name" placeholder="Revisão trimestral Q3" required />
                </DrawerField>
                <DrawerField label="Prazo">
                  <input name="due_at" type="date" required />
                </DrawerField>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "campaign" ? "Criando..." : "Iniciar campanha"}
                </button>
              </form>
            )}

            {drawerMode === "admin" && (
              <form onSubmit={assignAdmin} className="drawerForm">
                <DrawerField label="E-mail">
                  <input name="email" type="email" placeholder="gestor@empresa.com" required />
                </DrawerField>
                <DrawerField label="Função">
                  <select name="role" defaultValue="Auditor">
                    <option>Auditor</option>
                    <option>Gestor de área</option>
                    <option>Gestor de ativos</option>
                    <option>Administrador IAM</option>
                    <option>Superadministrador</option>
                  </select>
                </DrawerField>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "admin" ? "Atribuindo..." : "Atribuir função"}
                </button>
              </form>
            )}

            {drawerMode === "notebook" && (
              <form onSubmit={addNotebook} className="drawerForm">
                <DrawerField label="Patrimônio">
                  <input name="asset_tag" placeholder="NB-1024" required />
                </DrawerField>
                <DrawerField label="Serial">
                  <input name="serial" placeholder="PF4X9K2" required />
                </DrawerField>
                <DrawerField label="Modelo">
                  <input name="model" placeholder="Lenovo ThinkPad E14 Gen 6" required />
                </DrawerField>
                <div className="drawerGrid">
                  <DrawerField label="Condição">
                    <select name="condition" defaultValue="new">
                      <option value="new">Novo</option>
                      <option value="good">Bom estado</option>
                      <option value="maintenance">Em manutenção</option>
                    </select>
                  </DrawerField>
                  <DrawerField label="Localização">
                    <input name="location" placeholder="Matriz · São Paulo" />
                  </DrawerField>
                </div>
                <DrawerField label="Garantia até">
                  <input name="warranty_until" type="date" />
                </DrawerField>
                <label className="checkCard checkCard-inline">
                  <input name="encrypted" type="checkbox" />
                  <span>
                    <strong>Criptografia verificada</strong>
                    <small>Marca o ativo como apto para custódia.</small>
                  </span>
                </label>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "notebook" ? "Adicionando..." : "Adicionar notebook"}
                </button>
              </form>
            )}

            {drawerMode === "movement" && (
              <form onSubmit={moveAsset} className="drawerForm">
                <DrawerField label="Notebook">
                  <select name="notebook_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione o patrimônio
                    </option>
                    {data.notebooks.map((notebook) => (
                      <option key={notebook.id} value={notebook.id}>
                        {notebook.asset_tag} · {statusLabel(notebook.status)}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Movimentação">
                  <select name="action" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    <option value="start_preparation">Iniciar preparação</option>
                    <option value="ready_for_delivery">Aprovar para entrega</option>
                    <option value="dispatch">Despachar / entregar</option>
                    <option value="confirm_delivery">Confirmar recebimento</option>
                    <option value="request_return">Solicitar devolução</option>
                    <option value="receive_return">Receber e conferir</option>
                    <option value="start_sanitization">Higienizar e formatar</option>
                    <option value="send_maintenance">Enviar para manutenção</option>
                    <option value="schedule_preventive">Agendar preventiva</option>
                    <option value="release_stock">Liberar para estoque</option>
                    <option value="mark_lost">Marcar como extraviado</option>
                  </select>
                </DrawerField>
                <DrawerField label="Responsável">
                  <input name="assignee" placeholder="Equipe de TI" required />
                </DrawerField>
                <div className="drawerGrid">
                  <DrawerField label="Prazo">
                    <input name="due_at" type="date" />
                  </DrawerField>
                  <DrawerField label="Modalidade">
                    <select name="delivery_method" defaultValue="Presencial">
                      <option>Presencial</option>
                      <option>Transportadora</option>
                      <option>Logística reversa</option>
                      <option>Assistência técnica</option>
                    </select>
                  </DrawerField>
                </div>
                <DrawerField label="Destino / local">
                  <input name="location" placeholder="Matriz · São Paulo" />
                </DrawerField>
                <DrawerField label="Rastreio">
                  <input name="tracking_code" placeholder="BR123456789" />
                </DrawerField>
                <DrawerField label="Acessórios sob custódia">
                  <input name="accessories" placeholder="Carregador, mochila e mouse" />
                </DrawerField>
                <DrawerField label="Observações e evidências">
                  <textarea name="notes" rows={3} placeholder="Estado físico, ocorrências e providências tomadas." required />
                </DrawerField>
                <div className="checkGrid">
                  <label className="checkCard checkCard-inline">
                    <input name="confirm_physical" type="checkbox" />
                    <span>
                      <strong>Inspeção física</strong>
                      <small>Obrigatória para retorno ao estoque.</small>
                    </span>
                  </label>
                  <label className="checkCard checkCard-inline">
                    <input name="confirm_wipe" type="checkbox" />
                    <span>
                      <strong>Apagamento seguro</strong>
                      <small>Valida limpeza e preparação.</small>
                    </span>
                  </label>
                  <label className="checkCard checkCard-inline">
                    <input name="confirm_tests" type="checkbox" />
                    <span>
                      <strong>Testes funcionais</strong>
                      <small>Confirma prontidão operacional.</small>
                    </span>
                  </label>
                </div>
                <button className="primary" type="submit" disabled={busy !== null}>
                  {busy === "movement" ? "Registrando..." : "Registrar movimentação"}
                </button>
              </form>
            )}
          </div>
        </aside>
      </>
    );
  }

  const overviewMetrics = [
    {
      value: onboardingRuns,
      label: "Onboardings em andamento",
      tone: "info" as const,
      onClick: () => setTab("lifecycle"),
    },
    {
      value: offboardingRuns,
      label: "Offboardings em andamento",
      tone: "warning" as const,
      onClick: () => setTab("lifecycle"),
    },
    {
      value: delayedSteps,
      label: "Etapas atrasadas",
      tone: "danger" as const,
      onClick: () => setTab("requests"),
    },
    {
      value: unverifiedAssignments,
      label: "Acessos sem verificação",
      tone: "neutral" as const,
      onClick: () => setTab("people"),
    },
  ];

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="sidebarBrand">
          <span className="brandMark">G</span>
          <div>
            <strong>GUARDIÃO</strong>
            <small>Controle de lifecycle de acessos</small>
          </div>
        </div>

        <div className="sidebarSection">
          <span className="sidebarLabel">Principal</span>
          <nav className="navList" aria-label="Navegação principal">
            <button className={`navItem ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
              <span>Visão geral</span>
              <small>Painel de atenção</small>
            </button>
            <button className={`navItem ${tab === "people" ? "active" : ""}`} onClick={() => setTab("people")}>
              <span>Pessoas</span>
              <small>Identidades e estados</small>
            </button>
            <button className={`navItem ${tab === "profiles" ? "active" : ""}`} onClick={() => setTab("profiles")}>
              <span>Perfis</span>
              <small>Área, escopo e acesso</small>
            </button>
            <button className={`navItem ${tab === "lifecycle" ? "active" : ""}`} onClick={() => setTab("lifecycle")}>
              <span>Lifecycle</span>
              <small>Execuções verificáveis</small>
            </button>
            <button className={`navItem ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>
              <span>Pendências</span>
              <small>Aprovações e falhas</small>
              <b>{openRequests + delayedSteps}</b>
            </button>
          </nav>
        </div>

        <div className="sidebarSection">
          <span className="sidebarLabel">Expansão</span>
          <nav className="navList" aria-label="Expansões">
            <button className={`navItem ${tab === "integrations" ? "active" : ""}`} onClick={() => setTab("integrations")}>
              <span>Integrações</span>
              <small>Catálogo e estado</small>
            </button>
            <button className={`navItem ${tab === "workspace" ? "active" : ""}`} onClick={() => setTab("workspace")}>
              <span>Workspace</span>
              <small>Dispositivos e custódia</small>
            </button>
          </nav>
        </div>

        <div className="sidebarFooter">
          <span className="sidebarLabel">Atalho</span>
          <button className="ghostButton" type="button" onClick={toggleTheme}>
            Alternar tema
          </button>
          <button className="ghostButton" type="button" onClick={() => setSearch("")}>
            Limpar busca
          </button>
        </div>
      </aside>

      <div className="pageFrame">
        <header className="topbar">
          <div className="pageIdentity">
            <span className="eyebrow">{current.eyebrow}</span>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </div>
          <div className="topbarTools">
            <label className="searchBox">
              <span>Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pessoa, perfil, ferramenta, notebook..."
              />
            </label>
            <div className="profileChip">
              <span>{initials(admin.displayName)}</span>
              <div>
                <strong>{admin.displayName}</strong>
                <small>{pageUser}</small>
              </div>
            </div>
            <button className="ghostButton" type="button" onClick={toggleTheme}>
              Tema
            </button>
            <a className="ghostButton" href="/signout-with-chatgpt?return_to=%2F">
              Sair
            </a>
          </div>
        </header>

        {notice && (
          <section className={`statusBanner ${notice.detail ? "danger" : "success"}`} role="status">
            <strong>{notice.message || notice.detail}</strong>
            {notice.detalhe && <span>{notice.detalhe}</span>}
            <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">
              ×
            </button>
          </section>
        )}

        {pendingOffboard && (
          <section className="confirmBanner" role="alert">
            <div>
              <strong>Gerar plano de desligamento?</strong>
              <span>
                O Guardião vai criar as etapas por ferramenta e registrar a devolução do endpoint quando aplicável.
                Nenhuma revogação será declarada sem verificação.
              </span>
            </div>
            <div className="confirmActions">
              <button className="secondary" type="button" onClick={() => setPendingOffboard(null)}>
                Cancelar
              </button>
              <button className="primary" type="button" onClick={() => offboard(pendingOffboard)} disabled={busy !== null}>
                {busy ? "Criando plano..." : "Criar plano"}
              </button>
            </div>
          </section>
        )}

        <section className="contentStack">
          {tab === "overview" && (
            <>
              <section className="sectionCard introCard">
                <div>
                  <span className="sectionKicker">Hoje</span>
                  <h2>Bom dia, {pageUser}</h2>
                  <p>O que precisa de atenção hoje aparece primeiro. O resto fica como contexto, não como ruído.</p>
                </div>
                <div className="actionRow">
                  <button className="primary" type="button" onClick={() => setTab("people")}>
                    Ver pessoas
                  </button>
                  <button className="secondary" type="button" onClick={() => openDrawer("person")}>
                    Criar onboarding
                  </button>
                </div>
              </section>

              <section className="metricGrid">
                {overviewMetrics.map((metric) => (
                  <MetricButton key={metric.label} value={metric.value} label={metric.label} tone={metric.tone} onClick={metric.onClick} />
                ))}
              </section>

              <section className="twoColumn">
                <div className="sectionCard">
                  <div className="sectionHeader">
                    <div>
                      <span className="sectionKicker">Prioridades</span>
                      <h3>O que precisa de atenção agora</h3>
                    </div>
                  </div>
                  <div className="priorityList">
                    {priorities.length === 0 ? (
                      <div className="emptyState">Nenhuma prioridade aberta.</div>
                    ) : (
                      priorities.map((item) => (
                        <article key={`${item.title}-${item.detail}`}>
                          <span className="priorityTone">{item.action}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </article>
                      ))
                    )}
                  </div>
                </div>

                <div className="sectionCard">
                  <div className="sectionHeader">
                    <div>
                      <span className="sectionKicker">Eficiência</span>
                      <h3>Leitura rápida do ciclo operacional</h3>
                    </div>
                  </div>
                  <div className="stackedMetrics">
                    <div>
                      <strong>{verifiedAssignments}</strong>
                      <span>Acessos verificados</span>
                    </div>
                    <div>
                      <strong>{openWorkOrders}</strong>
                      <span>Ordens físicas abertas</span>
                    </div>
                    <div>
                      <strong>{openRisks}</strong>
                      <span>Riscos críticos</span>
                    </div>
                    <div>
                      <strong>{data.campaigns.filter((item) => item.status === "active").length}</strong>
                      <span>Campanhas ativas</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="sectionCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Execuções recentes</span>
                    <h3>Fluxos mais relevantes da fila</h3>
                  </div>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>Processo</th>
                        <th>Progresso</th>
                        <th>Pendências</th>
                        <th>Prazo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentExecutions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="emptyCell">
                            Nenhuma execução registrada.
                          </td>
                        </tr>
                      ) : (
                        recentExecutions.map((execution) => {
                          const percent = progressPercent(execution.verified_steps, execution.total_steps);
                          return (
                            <tr key={execution.id}>
                              <td>
                                <strong>{execution.user_name}</strong>
                                <small>{execution.email}</small>
                              </td>
                              <td>{execution.execution_type === "ONBOARDING" ? "Onboarding" : "Offboarding"}</td>
                              <td>
                                <div className="progressCell">
                                  <span>{percent}%</span>
                                  <i>
                                    <em style={{ width: `${percent}%` }} />
                                  </i>
                                </div>
                              </td>
                              <td>{execution.attention_steps}</td>
                              <td>{formatDateTime(execution.created_at)}</td>
                              <td>
                                <span className={statusClass(execution.status)}>{statusLabel(execution.status)}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === "people" && (
            <section className="splitLayout">
              <div className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Pessoas</span>
                    <h3>Identidades, perfis e estado dos acessos</h3>
                  </div>
                  <div className="actionRow">
                    <button className="secondary" type="button" onClick={() => setDrawerMode("person")}>
                      Importar CSV
                    </button>
                    <button className="primary" type="button" onClick={() => setDrawerMode("person")}>
                      Nova pessoa
                    </button>
                  </div>
                </div>
                <div className="filterRow">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pessoa" />
                  <select defaultValue="">
                    <option value="">Status</option>
                    <option>active</option>
                    <option>onboarding</option>
                    <option>offboarding</option>
                  </select>
                  <select defaultValue="">
                    <option value="">Perfil</option>
                    {data.profiles.map((profile) => (
                      <option key={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>Perfil</th>
                        <th>Estado de acesso</th>
                        <th>Processo atual</th>
                        <th>Workspace</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="emptyCell">
                            Nenhuma pessoa encontrada.
                          </td>
                        </tr>
                      ) : (
                        visibleUsers.map((user) => {
                          const assignments = data.accessAssignments.filter((item) => item.user_id === user.id);
                          const verifiedCount = assignments.filter((item) => item.verification_status === "VERIFIED").length;
                          const execution = data.executions.find((item) => item.user_id === user.id);
                          return (
                            <tr
                              key={user.id}
                              className={selectedPersonId === user.id ? "selectedRow" : ""}
                              onClick={() => setSelectedPersonId(user.id)}
                            >
                              <td>
                                <strong>{user.name}</strong>
                                <small>{user.email}</small>
                              </td>
                              <td>
                                <strong>{user.profile_name || "Sem perfil"}</strong>
                                <small>{user.profile_color || "Perfil não definido"}</small>
                              </td>
                              <td>
                                <span className={statusClass(verifiedCount === assignments.length && assignments.length > 0 ? "VERIFIED" : "PENDING")}>
                                  {assignments.length > 0 ? `${verifiedCount}/${assignments.length} verificados` : "Sem acesso mapeado"}
                                </span>
                              </td>
                              <td>{execution ? statusLabel(execution.execution_type.toLowerCase()) : "Nenhum"}</td>
                              <td>
                                <strong>{user.asset_tag || "Sem equipamento"}</strong>
                                <small>{user.model || "Workspace opcional"}</small>
                              </td>
                              <td>
                                <div className="inlineActions">
                                  <button type="button" onClick={() => setSelectedPersonId(user.id)}>
                                    Abrir
                                  </button>
                                  <button type="button" onClick={() => setPendingOffboard(user.email)}>
                                    Desligar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sectionCard detailCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Drawer da pessoa</span>
                    <h3>{selectedPerson ? selectedPerson.name : "Selecione uma pessoa"}</h3>
                  </div>
                  {selectedPerson && (
                    <span className={statusClass(selectedPerson.status)}>{statusLabel(selectedPerson.status)}</span>
                  )}
                </div>

                {selectedPerson ? (
                  <>
                    <div className="detailStats">
                      <div>
                        <strong>{selectedAssignments.length}</strong>
                        <span>Acessos</span>
                      </div>
                      <div>
                        <strong>{selectedPersonExecutions.length}</strong>
                        <span>Execuções</span>
                      </div>
                      <div>
                        <strong>{selectedAssignments.filter((item) => item.verification_status === "VERIFIED").length}</strong>
                        <span>Verificados</span>
                      </div>
                      <div>
                        <strong>{selectedPerson.asset_tag ? "1" : "0"}</strong>
                        <span>Workspace</span>
                      </div>
                    </div>

                    <div className="personSections">
                      <section>
                        <h4>Resumo</h4>
                        <p>
                          {selectedPerson.profile_name || "Sem perfil definido"} com{" "}
                          {selectedAssignments.length > 0
                            ? `${selectedAssignments.filter((item) => item.verification_status === "VERIFIED").length} acessos verificados`
                            : "acessos ainda não mapeados"}
                          .
                        </p>
                      </section>
                      <section>
                        <h4>Acessos</h4>
                        <div className="miniStack">
                          {selectedAssignments.length === 0 ? (
                            <span className="emptyState compact">Nenhum acesso registrado.</span>
                          ) : (
                            selectedAssignments.map((assignment) => (
                              <div key={assignment.id} className="miniRow">
                                <div>
                                  <strong>{assignment.tool_name}</strong>
                                  <small>{assignment.account_identifier || "Conta não informada"}</small>
                                </div>
                                <span className={statusClass(assignment.verification_status)}>
                                  {statusLabel(assignment.verification_status)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                      <section>
                        <h4>Contas</h4>
                        <div className="miniStack">
                          {selectedAssignments.map((assignment) => (
                            <div key={`${assignment.id}-account`} className="miniRow">
                              <div>
                                <strong>{assignment.tool_name}</strong>
                                <small>{assignment.expected_state} x {assignment.observed_state}</small>
                              </div>
                              <span className={toneClass(assignment.observed_state)}>{assignment.observed_state}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section>
                        <h4>Lifecycle</h4>
                        <div className="miniStack">
                          {selectedPersonExecutions.length === 0 ? (
                            <span className="emptyState compact">Sem processo em andamento.</span>
                          ) : (
                            selectedPersonExecutions.map((execution) => (
                              <div key={execution.id} className="miniRow">
                                <div>
                                  <strong>{execution.execution_type === "ONBOARDING" ? "Onboarding" : "Offboarding"}</strong>
                                  <small>{formatDateTime(execution.created_at)}</small>
                                </div>
                                <span className={statusClass(execution.status)}>{statusLabel(execution.status)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                      <section>
                        <h4>Evidências</h4>
                        <p className="subtleCopy">
                          As evidências são registradas no lifecycle e aparecem como resultado das etapas verificadas.
                        </p>
                      </section>
                      <section>
                        <h4>Workspace</h4>
                        <p className="subtleCopy">{selectedPerson.asset_tag ? `${selectedPerson.asset_tag} · ${selectedPerson.model || "Notebook"}` : "Sem equipamento vinculado."}</p>
                      </section>
                      <section>
                        <h4>Histórico</h4>
                        <p className="subtleCopy">
                          Última atualização operacional: {selectedAssignments[0]?.last_verified_at ? formatDateTime(selectedAssignments[0]?.last_verified_at) : "sem verificação"}.
                        </p>
                      </section>
                    </div>
                  </>
                ) : (
                  <div className="emptyState">Escolha uma pessoa para ver os detalhes.</div>
                )}
              </div>
            </section>
          )}

          {tab === "profiles" && (
            <section className="splitLayout">
              <div className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Perfis</span>
                    <h3>Lista limpa, com número e escopo por área</h3>
                  </div>
                  <button className="primary" type="button" onClick={() => setDrawerMode("profile")}>
                    Novo perfil
                  </button>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Perfil</th>
                        <th>Pessoas</th>
                        <th>Ferramentas</th>
                        <th>Exceções</th>
                        <th>Divergências</th>
                        <th>Atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProfiles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="emptyCell">
                            Nenhum perfil encontrado.
                          </td>
                        </tr>
                      ) : (
                        visibleProfiles.map((profile) => {
                          const tools = parsePipeList(profile.tool_names);
                          return (
                            <tr
                              key={profile.id}
                              className={selectedProfileId === profile.id ? "selectedRow" : ""}
                              onClick={() => setSelectedProfileId(profile.id)}
                            >
                              <td>
                                <strong>{profile.name}</strong>
                                <small>{profile.description}</small>
                              </td>
                              <td>{profile.members}</td>
                              <td>{tools.length}</td>
                              <td>{parsePipeList(profile.entitlements).length}</td>
                              <td>{Math.max(0, profile.members - tools.length)}</td>
                              <td>Hoje</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sectionCard detailCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Perfil selecionado</span>
                    <h3>{selectedProfile ? selectedProfile.name : "Selecione um perfil"}</h3>
                  </div>
                  {selectedProfile && <span className={toneClass(selectedProfile.color)}>{selectedProfile.color || "Área"}</span>}
                </div>

                {selectedProfile ? (
                  <>
                    <div className="detailStats">
                      <div>
                        <strong>{selectedProfile.members}</strong>
                        <span>Pessoas</span>
                      </div>
                      <div>
                        <strong>{selectedProfileTools.length}</strong>
                        <span>Ferramentas</span>
                      </div>
                      <div>
                        <strong>{selectedProfileEntitlements.length}</strong>
                        <span>Exceções</span>
                      </div>
                      <div>
                        <strong>{Math.max(0, selectedProfile.members - selectedProfileTools.length)}</strong>
                        <span>Divergências</span>
                      </div>
                    </div>

                    <div className="personSections">
                      <section>
                        <h4>Acesso básico</h4>
                        <p>{selectedProfile.description}</p>
                      </section>
                      <section>
                        <h4>Acessos da área</h4>
                        <div className="chipsRow">
                          {selectedProfileTools.length === 0 ? (
                            <span className="emptyState compact">Sem ferramentas mapeadas.</span>
                          ) : (
                            selectedProfileTools.map((tool) => <span className="chip" key={tool}>{tool}</span>)
                          )}
                        </div>
                      </section>
                      <section>
                        <h4>Acessos da função</h4>
                        <div className="miniStack">
                          {selectedProfileTools.map((tool, index) => (
                            <div className="miniRow" key={`${tool}-${index}`}>
                              <div>
                                <strong>{tool}</strong>
                                <small>{index % 2 === 0 ? "API" : "Manual"}</small>
                              </div>
                              <span className={statusClass(index % 2 === 0 ? "VERIFIED" : "PENDING")}>
                                {index % 2 === 0 ? "Automática" : "Evidência"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section>
                        <h4>Restrições</h4>
                        <p className="subtleCopy">Exceções temporárias e escopos fora do padrão aparecem como pendências individuais.</p>
                      </section>
                      <section>
                        <h4>Pessoas vinculadas</h4>
                        <p className="subtleCopy">{selectedProfile.members} colaboradores associados ao perfil.</p>
                      </section>
                      <section>
                        <h4>Matriz de acesso</h4>
                        <div className="tableWrap compactTable">
                          <table>
                            <thead>
                              <tr>
                                <th>Ferramenta</th>
                                <th>Papel</th>
                                <th>Escopo</th>
                                <th>Método</th>
                                <th>Verificação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProfileTools.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="emptyCell">
                                    Nenhuma ferramenta vinculada.
                                  </td>
                                </tr>
                              ) : (
                                selectedProfileTools.map((tool, index) => (
                                  <tr key={tool}>
                                    <td>{tool}</td>
                                    <td>{index % 2 === 0 ? "Usuário" : "Operador"}</td>
                                    <td>{index % 2 === 0 ? "Empresa" : "Departamento"}</td>
                                    <td>{index % 2 === 0 ? "API" : "Manual"}</td>
                                    <td>{index % 2 === 0 ? "Automática" : "Evidência"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>
                  </>
                ) : (
                  <div className="emptyState">Escolha um perfil para ver a matriz.</div>
                )}
              </div>
            </section>
          )}

          {tab === "lifecycle" && (
            <section className="lifecycleLayout">
              <div className="sectionCard lifecycleListCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Execuções</span>
                    <h3>Fila operacional</h3>
                  </div>
                </div>
                <div className="executionList">
                  {visibleExecutions.length === 0 ? (
                    <div className="emptyState">Nenhuma execução encontrada.</div>
                  ) : (
                    visibleExecutions.map((execution) => {
                      const percent = progressPercent(execution.verified_steps, execution.total_steps);
                      return (
                        <button
                          key={execution.id}
                          type="button"
                          className={`executionRow ${selectedExecutionId === execution.id ? "selectedRow" : ""}`}
                          onClick={() => setSelectedExecutionId(execution.id)}
                        >
                          <div>
                            <span className={`pill ${execution.execution_type === "OFFBOARDING" ? "pill-warning" : "pill-info"}`}>
                              {execution.execution_type === "OFFBOARDING" ? "Offboarding" : "Onboarding"}
                            </span>
                            <strong>{execution.user_name}</strong>
                            <small>{execution.email}</small>
                          </div>
                          <div className="progressCell">
                            <span>{execution.verified_steps}/{execution.total_steps} etapas concluídas</span>
                            <i>
                              <em style={{ width: `${percent}%` }} />
                            </i>
                          </div>
                          <div className="executionMeta">
                            <span className={statusClass(execution.status)}>{statusLabel(execution.status)}</span>
                            <small>{execution.attention_steps} pendências</small>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="sectionCard lifecycleDetailCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Execução selecionada</span>
                    <h3>{selectedExecution ? `${selectedExecution.execution_type === "OFFBOARDING" ? "Offboarding" : "Onboarding"} de ${selectedExecution.user_name}` : "Selecione uma execução"}</h3>
                  </div>
                  {selectedExecution && <span className={statusClass(selectedExecution.status)}>{statusLabel(selectedExecution.status)}</span>}
                </div>

                {selectedExecution ? (
                  <>
                    <div className="detailMeta">
                      <span>Iniciado em {formatDateTime(selectedExecution.created_at)}</span>
                      <span>Prazo: hoje às 12:00</span>
                      <span>{selectedExecution.verified_steps}/{selectedExecution.total_steps} concluídas</span>
                    </div>

                    <div className="timeline">
                      {selectedExecutionSteps.length === 0 ? (
                        <div className="emptyState">Nenhuma etapa encontrada.</div>
                      ) : (
                        selectedExecutionSteps.map((step) => {
                          const isVerified = step.status === "VERIFIED";
                          const isFailed = step.status === "FAILED";
                          return (
                            <article key={step.id} className={`timelineItem ${isFailed ? "failed" : ""}`}>
                              <div className="timelineMarker">
                                <span />
                              </div>
                              <div className="timelineContent">
                                <div className="timelineTop">
                                  <div>
                                    <strong>{step.tool_name || step.label}</strong>
                                    <small>
                                      {step.method} · {step.assignee} · {step.due_at ? formatDate(step.due_at) : "sem prazo"}
                                    </small>
                                  </div>
                                  <span className={statusClass(step.status)}>{statusLabel(step.status)}</span>
                                </div>

                                <p>{step.result || step.label}</p>

                                <div className="stepMeta">
                                  <span>Tentativas: {step.attempts}</span>
                                  <span>{step.evidence ? `Evidência: ${step.evidence}` : "Sem evidência"}</span>
                                  {step.error && <span className="errorText">{step.error}</span>}
                                </div>

                                {!isVerified && (
                                  <form className="stepForm" onSubmit={(event) => updateExecutionStep(event, step.id)}>
                                    <input name="evidence" placeholder="Evidência ou referência da validação" required />
                                    <input name="error" placeholder="Erro ou bloqueio, se houver" />
                                    <div className="stepActions">
                                      <button type="submit" value="complete_manual" className="primary" disabled={busy !== null}>
                                        Concluir
                                      </button>
                                      <button type="submit" value="mark_failed" className="secondary" disabled={busy !== null}>
                                        Falha
                                      </button>
                                      {isFailed && (
                                        <button type="submit" value="retry" className="ghostButton" disabled={busy !== null}>
                                          Tentar novamente
                                        </button>
                                      )}
                                    </div>
                                  </form>
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>

                    <section className="miniBlock">
                      <h4>Acessos observados</h4>
                      <div className="tableWrap compactTable">
                        <table>
                          <thead>
                            <tr>
                              <th>Ferramenta</th>
                              <th>Conta</th>
                              <th>Esperado</th>
                              <th>Observado</th>
                              <th>Verificação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.accessAssignments.filter((item) => item.user_id === selectedExecution.user_id).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="emptyCell">
                                  Nenhum acesso registrado para esta pessoa.
                                </td>
                              </tr>
                            ) : (
                              data.accessAssignments
                                .filter((item) => item.user_id === selectedExecution.user_id)
                                .map((assignment) => (
                                  <tr key={assignment.id}>
                                    <td>{assignment.tool_name}</td>
                                    <td>{assignment.account_identifier || "Sem conta"}</td>
                                    <td>{assignment.expected_state}</td>
                                    <td>{assignment.observed_state}</td>
                                    <td>
                                      <span className={statusClass(assignment.verification_status)}>
                                        {statusLabel(assignment.verification_status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="emptyState">Selecione uma execução para ver a linha do tempo.</div>
                )}
              </div>
            </section>
          )}

          {tab === "requests" && (
            <section className="splitLayout">
              <div className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Pendências</span>
                    <h3>Fila operacional</h3>
                  </div>
                  <div className="actionRow">
                    <button className="secondary" type="button" onClick={() => openDrawer("request")}>
                      Nova solicitação
                    </button>
                    <button className="primary" type="button" onClick={() => openDrawer("campaign")}>
                      Nova recertificação
                    </button>
                  </div>
                </div>

                <div className="filterTabs">
                  {(["mine", "all", "overdue", "unassigned", "failures", "approvals"] as PendingFilter[]).map((item) => (
                    <button key={item} type="button" className={pendingFilter === item ? "active" : ""} onClick={() => setPendingFilter(item)}>
                      {item === "mine" && "Minhas pendências"}
                      {item === "all" && "Todas"}
                      {item === "overdue" && "Atrasadas"}
                      {item === "unassigned" && "Sem responsável"}
                      {item === "failures" && "Falhas"}
                      {item === "approvals" && "Aprovações"}
                    </button>
                  ))}
                </div>

                <div className="pendingList">
                  {(() => {
                    const items: Array<{ title: string; detail: string; due?: string; tone: string; actions?: ReactNode }> = [
                      ...visibleRequests
                        .filter((item) => pendingFilter === "all" || pendingFilter === "approvals" || item.status === "pending")
                        .map((item) => ({
                          title: `${item.tool_name} de ${item.user_name}`,
                          detail: `${item.requested_role} · ${item.justification}`,
                          due: item.expires_at,
                          tone: item.status === "pending" ? "warning" : "success",
                          actions: item.status === "pending" ? (
                            <div className="inlineActions">
                              <button type="button" onClick={() => submit("/api/v1/access-decisions", { request_id: item.id, decision: "approved" }, `approve-${item.id}`)}>
                                Aprovar
                              </button>
                              <button type="button" onClick={() => submit("/api/v1/access-decisions", { request_id: item.id, decision: "rejected" }, `reject-${item.id}`)}>
                                Rejeitar
                              </button>
                            </div>
                          ) : null,
                        })),
                      ...data.executionSteps
                        .filter((item) => item.status !== "VERIFIED")
                        .filter((item) => pendingFilter !== "approvals")
                        .map((item) => ({
                          title: `${item.tool_name || item.label} de ${item.user_name}`,
                          detail: `${item.assignee} · ${item.method} · ${item.status}`,
                          due: item.due_at,
                          tone: isOverdue(item.due_at) ? "danger" : "info",
                        })),
                    ];

                    const filteredItems =
                      pendingFilter === "overdue"
                        ? items.filter((item) => item.due && isOverdue(item.due))
                        : pendingFilter === "unassigned"
                          ? items.filter((item) => item.detail.includes("Sem responsável") || item.detail.includes("sem responsável"))
                          : pendingFilter === "failures"
                            ? items.filter((item) => item.detail.toLowerCase().includes("failed") || item.detail.toLowerCase().includes("falha"))
                            : items;

                    if (filteredItems.length === 0) {
                      return <div className="emptyState">Nenhuma pendência aberta.</div>;
                    }

                    return filteredItems.slice(0, 12).map((item) => (
                      <article key={`${item.title}-${item.detail}`} className="pendingItem">
                        <span className={`pill pill-${item.tone as "warning" | "danger" | "info" | "neutral" | "success"}`}>
                          {item.tone === "warning" ? "Aguardando" : item.tone === "danger" ? "Atrasado" : "Em análise"}
                        </span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                        <div className="pendingFooter">
                          <span>{item.due ? `Prazo: ${formatDateTime(item.due)}` : "Sem prazo"}</span>
                          {item.actions}
                        </div>
                      </article>
                    ));
                  })()}
                </div>
              </div>

              <div className="sectionCard detailCard">
                <div className="sectionHeader">
                  <div>
                    <span className="sectionKicker">Ações rápidas</span>
                    <h3>Fluxos que ainda dependem de decisão</h3>
                  </div>
                </div>
                <div className="quickActionGrid">
                  <button className="quickAction" type="button" onClick={() => openDrawer("request")}>
                    <strong>Solicitar acesso</strong>
                    <span>Exceção com prazo e justificativa.</span>
                  </button>
                  <button className="quickAction" type="button" onClick={() => openDrawer("campaign")}>
                    <strong>Iniciar recertificação</strong>
                    <span>Revisão periódica de acessos.</span>
                  </button>
                  <button className="quickAction" type="button" onClick={() => openDrawer("admin")}>
                    <strong>Atribuir administrador</strong>
                    <span>Função administrativa com escopo.</span>
                  </button>
                </div>

                <div className="miniBlock">
                  <h4>Resumo operacional</h4>
                  <div className="miniStack">
                    <div className="miniRow">
                      <div>
                        <strong>Aprovações pendentes</strong>
                        <small>{openRequests}</small>
                      </div>
                      <span className={statusClass("PENDING")}>Pendente</span>
                    </div>
                    <div className="miniRow">
                      <div>
                        <strong>Riscos altos</strong>
                        <small>{openRisks}</small>
                      </div>
                      <span className={statusClass(openRisks > 0 ? "FAILED" : "VERIFIED")}>
                        {openRisks > 0 ? "Atenção" : "Ok"}
                      </span>
                    </div>
                    <div className="miniRow">
                      <div>
                        <strong>Recertificações ativas</strong>
                        <small>{data.campaigns.filter((item) => item.status === "active").length}</small>
                      </div>
                      <span className={statusClass("RUNNING")}>Em andamento</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "integrations" && (
            <section className="stackLayout">
              <section className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Integrações</span>
                    <h3>Catálogo e estado do conector</h3>
                  </div>
                  <span className="supportNote">Sem credenciais até a configuração real</span>
                </div>
                <div className="connectorGrid">
                  {visibleConnectors.map((connector) => (
                    <article key={connector.id} className="connectorCard">
                      <div className="connectorIcon">{initials(connector.name)}</div>
                      <div className="connectorBody">
                        <strong>{connector.name}</strong>
                        <small>
                          {connector.category} · {connector.auth_type}
                        </small>
                        <p>{connector.description}</p>
                      </div>
                      <div className="connectorActions">
                        <span className={statusClass(connector.status)}>{statusLabel(connector.status)}</span>
                        <button className="secondary" type="button">
                          Configurar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Software</span>
                    <h3>Fila administrativa</h3>
                  </div>
                  <span className="supportNote">Instalação e remoção com perfil admin</span>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ação</th>
                        <th>Aplicativo</th>
                        <th>Notebook</th>
                        <th>Solicitante</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCommands.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="emptyCell">
                            Nenhum comando na fila.
                          </td>
                        </tr>
                      ) : (
                        visibleCommands.map((command) => (
                          <tr key={command.id}>
                            <td>
                              <span className={statusClass(command.action === "install" ? "RUNNING" : "WARNING")}>
                                {command.action === "install" ? "Instalar" : "Desinstalar"}
                              </span>
                            </td>
                            <td>
                              <strong>{command.application_name}</strong>
                              <small>{command.justification}</small>
                            </td>
                            <td>{command.asset_tag}</td>
                            <td>
                              <small>{command.requested_by}</small>
                            </td>
                            <td>
                              <span className={statusClass(command.status)}>{statusLabel(command.status)}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          )}

          {tab === "workspace" && (
            <section className="stackLayout">
              <section className="metricGrid metricGrid-workspace">
                <MetricButton value={data.notebooks.length} label="Notebooks cadastrados" tone="neutral" onClick={() => openDrawer("notebook")} />
                <MetricButton value={visibleNotebooks.filter((item) => item.status === "available").length} label="Em estoque" tone="success" onClick={() => openDrawer("movement")} />
                <MetricButton value={visibleNotebooks.filter((item) => item.status === "assigned").length} label="Em uso" tone="info" onClick={() => setTab("people")} />
                <MetricButton value={openWorkOrders} label="Ordens abertas" tone="warning" onClick={() => openDrawer("movement")} />
              </section>

              <section className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Workspace</span>
                    <h3>Recursos associados à pessoa, sem virar a identidade</h3>
                  </div>
                  <div className="actionRow">
                    <button className="secondary" type="button" onClick={() => openDrawer("notebook")}>
                      Adicionar notebook
                    </button>
                    <button className="primary" type="button" onClick={() => openDrawer("movement")}>
                      Nova movimentação
                    </button>
                  </div>
                </div>
                <div className="twoColumn">
                  <div className="sectionCard insetCard">
                    <h4>Inventário</h4>
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Patrimônio</th>
                            <th>Equipamento</th>
                            <th>Custódia</th>
                            <th>Compliance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleNotebooks.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="emptyCell">
                                Nenhum notebook cadastrado.
                              </td>
                            </tr>
                          ) : (
                            visibleNotebooks.map((notebook) => (
                              <tr key={notebook.id}>
                                <td>
                                  <strong>{notebook.asset_tag}</strong>
                                  <small>{notebook.serial}</small>
                                </td>
                                <td>
                                  {notebook.model}
                                  <small>{notebook.location || "Matriz"}</small>
                                </td>
                                <td>
                                  <span className={statusClass(notebook.status)}>{statusLabel(notebook.status)}</span>
                                  <small>{notebook.custody_location || "Estoque TI"}</small>
                                </td>
                                <td>
                                  <span className={statusClass(notebook.encrypted ? "VERIFIED" : "FAILED")}>
                                    {notebook.encrypted ? "Criptografado" : "Ação necessária"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="sectionCard insetCard">
                    <h4>Trabalho físico</h4>
                    <div className="miniStack">
                      {visibleWorkOrders.length === 0 ? (
                        <div className="emptyState compact">Nenhuma ordem aberta.</div>
                      ) : (
                        visibleWorkOrders.map((order) => (
                          <article key={order.id} className="miniWorkOrder">
                            <span className={`pill ${order.order_type.includes("maintenance") ? "pill-warning" : "pill-info"}`}>
                              {order.order_type.replaceAll("_", " ")}
                            </span>
                            <strong>{order.asset_tag}</strong>
                            <small>
                              {order.model} · {order.assignee}
                            </small>
                            <p>{order.notes}</p>
                            <div className="pendingFooter">
                              <span>{order.due_at ? `até ${order.due_at}` : "sem prazo"}</span>
                              <span className={statusClass(order.status)}>{statusLabel(order.status)}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="sectionCard">
                <div className="sectionHeader sectionHeader-row">
                  <div>
                    <span className="sectionKicker">Rastreabilidade</span>
                    <h3>Linha do tempo física</h3>
                  </div>
                </div>
                <div className="timeline timeline-compact">
                  {data.assetEvents.length === 0 ? (
                    <div className="emptyState">As movimentações aparecerão aqui.</div>
                  ) : (
                    data.assetEvents.slice(0, 12).map((event) => (
                      <article key={event.id} className="timelineItem">
                        <div className="timelineMarker">
                          <span />
                        </div>
                        <div className="timelineContent">
                          <div className="timelineTop">
                            <div>
                              <strong>
                                {event.asset_tag} · {event.event_type.replaceAll("_", " ")}
                              </strong>
                              <small>
                                {formatDateTime(event.created_at)} · {event.performed_by}
                              </small>
                            </div>
                          </div>
                          <p>{event.details.startsWith("{") ? (() => {
                            try {
                              return JSON.parse(event.details).notes || event.details;
                            } catch {
                              return event.details;
                            }
                          })() : event.details}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </section>
          )}
        </section>

        <footer className="footer">
          <span>GUARDIÃO</span>
          <span>Onboarding · Mudanças · Offboarding · Evidências</span>
        </footer>
      </div>

      {renderDrawer()}
    </main>
  );
}
