import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memberService } from "../../services/memberService";
import { trainingService } from "../../services/trainingService";
import { Search, Plus, Pencil, Trash2, UserCircle, ChevronLeft, ChevronRight, Dumbbell, X } from "lucide-react";
import toast from "react-hot-toast";
import MemberModal from "./MemberModal";
import clsx from "clsx";
import ExportButton from "../../components/ui/ExportButton";
import { exportCSV, exportExcel } from "../../utils/exportUtils";

const ROUTINE_STATUS_LABEL = { active: "Activa", completed: "Completada", paused: "Pausada", cancelled: "Cancelada" };
const ROUTINE_STATUS_COLOR = { active: "bg-green-100 text-green-700", completed: "bg-gray-100 text-gray-500", paused: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700" };
const DIFFICULTY_LABELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };

function MemberRoutinesModal({ member, onClose }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["member-routines", member.id],
    queryFn: () => trainingService.getMemberRoutines(member.id),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">Rutinas asignadas</h2>
            <p className="text-xs text-gray-400 mt-0.5">{member.first_name} {member.last_name} · {member.member_code}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <p className="text-center py-10 text-sm text-gray-400">Cargando...</p>
          ) : assignments.length === 0 ? (
            <div className="text-center py-10">
              <Dumbbell size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Este miembro no tiene rutinas asignadas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{a.routine?.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {a.routine?.goal && <span className="text-xs text-gray-400">🎯 {a.routine.goal}</span>}
                        {a.routine?.difficulty && <span className="text-xs text-gray-400">{DIFFICULTY_LABELS[a.routine.difficulty]}</span>}
                        {a.routine?.exercises?.length > 0 && <span className="text-xs text-gray-400">💪 {a.routine.exercises.length} ejercicios</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", ROUTINE_STATUS_COLOR[a.status])}>
                        {ROUTINE_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        Desde {new Date(a.assigned_at).toLocaleDateString("es-MX")}
                        {a.ends_at && ` hasta ${new Date(a.ends_at).toLocaleDateString("es-MX")}`}
                      </p>
                    </div>
                  </div>
                  {a.note && <p className="text-xs text-gray-400 italic mt-1.5">{a.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  active:    "bg-green-100 text-green-700",
  inactive:  "bg-gray-100 text-gray-600",
  suspended: "bg-red-100 text-red-700",
  frozen:    "bg-blue-100 text-blue-700",
};

const STATUS_LABELS = {
  active:    "Activo",
  inactive:  "Inactivo",
  suspended: "Suspendido",
  frozen:    "Congelado",
};

function buildExportRows(members) {
  return members.map((m) => ({
    Código:       m.member_code,
    Nombre:       `${m.first_name} ${m.last_name}`,
    Email:        m.email ?? "",
    Teléfono:     m.phone ?? "",
    "Fecha ingreso": new Date(m.joined_at).toLocaleDateString("es-MX"),
    Estado:       STATUS_LABELS[m.status] ?? m.status,
  }));
}

export default function MembersList() {
  const queryClient = useQueryClient();
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [modal, setModal]         = useState(null);
  const [routinesModal, setRoutinesModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["members", page, search],
    queryFn: () => memberService.getAll({ page, limit: 15, search: search || undefined }),
  });

  const { data: allData } = useQuery({
    queryKey: ["members-all-export", search],
    queryFn: () => memberService.getAll({ page: 1, limit: 1000, search: search || undefined }),
    enabled: false,
  });

  const deleteMutation = useMutation({
    mutationFn: memberService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Miembro eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el miembro"),
  });

  const handleDelete = (member) => {
    if (confirm(`¿Eliminar a ${member.first_name} ${member.last_name}?`)) {
      deleteMutation.mutate(member.id);
    }
  };

  async function fetchAllForExport() {
    const res = await memberService.getAll({ page: 1, limit: 1000, search: search || undefined });
    return res.data ?? [];
  }

  async function handleExportCSV() {
    const rows = buildExportRows(await fetchAllForExport());
    exportCSV(rows, "miembros");
  }

  async function handleExportExcel() {
    const rows = buildExportRows(await fetchAllForExport());
    exportExcel(rows, null, "miembros");
  }

  const members = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Miembros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? "—"} miembros en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onExportCSV={handleExportCSV} onExportExcel={handleExportExcel} />
          <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ mode: "create" })}>
            <Plus size={16} />
            Nuevo miembro
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o cédula..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCircle size={48} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No se encontraron miembros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left">Código</th>
                  <th className="text-left">Miembro</th>
                  <th className="text-left">Teléfono</th>
                  <th className="text-left">Ingreso</th>
                  <th className="text-left">Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg">
                        {m.member_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-gray-400">{m.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(m.joined_at).toLocaleDateString("es")}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[m.status])}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setRoutinesModal(m)}
                          title="Ver rutinas"
                          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Dumbbell size={14} />
                        </button>
                        <button
                          onClick={() => setModal({ mode: "edit", member: m })}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <MemberModal
          mode={modal.mode}
          member={modal.member}
          onClose={() => setModal(null)}
        />
      )}
      {routinesModal && (
        <MemberRoutinesModal member={routinesModal} onClose={() => setRoutinesModal(null)} />
      )}
    </div>
  );
}
