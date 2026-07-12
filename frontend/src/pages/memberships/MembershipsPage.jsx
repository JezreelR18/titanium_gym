import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membershipService } from "../../services/membershipService";
import { memberService } from "../../services/memberService";
import { Plus, Pencil, CreditCard, CheckCircle, XCircle, Clock, Snowflake } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import PlanModal from "./PlanModal";
import AssignModal from "./AssignModal";
import ExportButton from "../../components/ui/ExportButton";
import { exportCSV, exportExcel } from "../../utils/exportUtils";

const STATUS_LABEL = {
  active:    "Activa",
  expired:   "Vencida",
  cancelled: "Cancelada",
  frozen:    "Congelada",
  pending:   "Pendiente",
};

const STATUS_COLOR = {
  active:    "bg-green-100 text-green-700",
  expired:   "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  frozen:    "bg-blue-100 text-blue-700",
  pending:   "bg-yellow-100 text-yellow-700",
};

const STATUS_ICON = {
  active:    <CheckCircle size={13} />,
  expired:   <XCircle size={13} />,
  cancelled: <XCircle size={13} />,
  frozen:    <Snowflake size={13} />,
  pending:   <Clock size={13} />,
};

function fmt(n) {
  return Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 });
}

function daysLeft(endDate) {
  const diff = Math.ceil((new Date(endDate) - new Date()) / 86400000);
  return diff;
}

// ── Plans tab ──────────────────────────────────────────────────

function PlansTab() {
  const [modal, setModal] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => membershipService.getPlans(),
  });

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ mode: "create" })}>
          <Plus size={16} /> Nuevo plan
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay planes creados aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={clsx(
                "card border-2 relative",
                plan.is_active ? "border-transparent" : "border-gray-200 opacity-60"
              )}
            >
              {!plan.is_active && (
                <span className="absolute top-3 right-3 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{plan.duration_days} días</p>
                </div>
                <button
                  onClick={() => setModal({ mode: "edit", plan })}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>

              {plan.description && <p className="text-xs text-gray-500 mb-3">{plan.description}</p>}

              <div className="text-2xl font-bold text-brand-700 mb-3">
                ${fmt(plan.price)} <span className="text-sm font-normal text-gray-400">{plan.currency}</span>
              </div>

              <div className="space-y-1">
                {plan.includes_personal_training && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Entrenamiento personal</p>
                )}
                {plan.includes_locker && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Casillero</p>
                )}
                {plan.max_classes_per_week && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Hasta {plan.max_classes_per_week} clases/semana</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <PlanModal mode={modal.mode} plan={modal.plan} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Memberships tab ────────────────────────────────────────────

function MembershipsTab() {
  const [showAssign, setShowAssign] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [memberSearch, setMemberSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["members-for-memberships", memberSearch],
    queryFn: () => memberService.getAll({ search: memberSearch || undefined, limit: 100 }).then((r) => r.data),
  });

  const memberIds = members.map((m) => m.id);

  const { data: allMemberships = [], isLoading } = useQuery({
    queryKey: ["memberships", statusFilter, memberSearch],
    queryFn: async () => {
      if (members.length === 0) return [];
      const results = await Promise.all(
        members.map((m) => membershipService.getMemberMemberships(m.id).catch(() => []))
      );
      const flat = results.flat();
      if (statusFilter === "all") return flat;
      return flat.filter((ms) => ms.status === statusFilter);
    },
    enabled: !membersLoading,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => membershipService.updateMembership(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      toast.success("Membresía actualizada");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  // Build member lookup
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  function buildRows() {
    return allMemberships.map((ms) => {
      const member = memberMap[ms.member_id];
      return {
        Miembro:  member ? `${member.first_name} ${member.last_name}` : "—",
        Código:   member?.member_code ?? "—",
        Plan:     ms.plan.name,
        Inicio:   ms.start_date,
        Fin:      ms.end_date,
        Precio:   Number(ms.final_price).toFixed(2),
        Estado:   STATUS_LABEL[ms.status] ?? ms.status,
      };
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar miembro..."
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-40">
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="expired">Vencidas</option>
          <option value="cancelled">Canceladas</option>
          <option value="frozen">Congeladas</option>
          <option value="pending">Pendientes</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportCSV(buildRows(), "membresias")}
            onExportExcel={() => exportExcel(buildRows(), null, "membresias")}
            disabled={allMemberships.length === 0}
          />
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAssign(true)}>
            <Plus size={16} /> Asignar membresía
          </button>
        </div>
      </div>

      {isLoading || membersLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : allMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No se encontraron membresías.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left">Miembro</th>
                <th className="text-left">Plan</th>
                <th className="text-left">Vigencia</th>
                <th className="text-left">Precio</th>
                <th className="text-left">Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allMemberships.map((ms) => {
                const member = memberMap[ms.member_id];
                const days = daysLeft(ms.end_date);
                return (
                  <tr key={ms.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {member ? (
                        <div>
                          <p className="font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                          <p className="text-xs font-mono text-brand-600">{member.member_code}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{ms.plan.name}</p>
                      <p className="text-xs text-gray-400">{ms.plan.duration_days} días</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{ms.start_date} → {ms.end_date}</p>
                      {ms.status === "active" && (
                        <p className={clsx("text-xs mt-0.5", days <= 7 ? "text-red-500 font-medium" : "text-gray-400")}>
                          {days > 0 ? `${days} días restantes` : "Vencida hoy"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">${fmt(ms.final_price)} <span className="text-xs text-gray-400">{ms.plan.currency}</span></p>
                      {Number(ms.discount_pct) > 0 && (
                        <p className="text-xs text-green-600">-{ms.discount_pct}% dto.</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", STATUS_COLOR[ms.status])}>
                        {STATUS_ICON[ms.status]}
                        {STATUS_LABEL[ms.status] ?? ms.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ms.status === "active" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateMutation.mutate({ id: ms.id, status: "frozen" })}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          >
                            Congelar
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("¿Cancelar esta membresía?")) updateMutation.mutate({ id: ms.id, status: "cancelled" });
                            }}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {ms.status === "frozen" && (
                        <button
                          onClick={() => updateMutation.mutate({ id: ms.id, status: "active" })}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                        >
                          Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAssign && <AssignModal onClose={() => setShowAssign(false)} />}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function MembershipsPage() {
  const [tab, setTab] = useState("memberships");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membresías</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planes y membresías de miembros</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "memberships", label: "Membresías" },
          { key: "plans",       label: "Planes" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "memberships" && <MembershipsTab />}
        {tab === "plans"       && <PlansTab />}
      </div>
    </div>
  );
}
