import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingService } from "../../services/trainingService";
import { memberService } from "../../services/memberService";
import { useAuth } from "../../context/AuthContext";
import { Plus, Pencil, Dumbbell, Search, X, ChevronDown, ChevronUp, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import ExerciseModal from "./ExerciseModal";
import RoutineModal from "./RoutineModal";

const DIFFICULTY_LABELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };
const DIFFICULTY_COLOR  = { beginner: "bg-green-100 text-green-700", intermediate: "bg-yellow-100 text-yellow-700", advanced: "bg-red-100 text-red-700" };
const DAYS = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };

const ROUTINE_STATUS_LABEL = { active: "Activa", completed: "Completada", paused: "Pausada", cancelled: "Cancelada" };
const ROUTINE_STATUS_COLOR = { active: "bg-green-100 text-green-700", completed: "bg-gray-100 text-gray-600", paused: "bg-yellow-100 text-yellow-700", cancelled: "bg-red-100 text-red-700" };

// ── Exercises Tab ──────────────────────────────────────────────
function ExercisesTab() {
  const [modal, setModal] = useState(null);
  const [filterGroup, setFilterGroup] = useState("");

  const { data: exercises = [], isLoading } = useQuery({ queryKey: ["exercises"], queryFn: trainingService.getExercises });
  const { data: muscleGroups = [] } = useQuery({ queryKey: ["muscle-groups"], queryFn: trainingService.getMuscleGroups });

  const filtered = filterGroup ? exercises.filter((e) => e.muscle_group?.id === filterGroup) : exercises;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="input w-48">
          <option value="">Todos los grupos</option>
          {muscleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button className="btn-primary flex items-center gap-2 ml-auto" onClick={() => setModal({ mode: "create" })}>
          <Plus size={16} /> Nuevo ejercicio
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay ejercicios. ¡Agrega el primero!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ex) => (
            <div key={ex.id} className={clsx("card flex items-start justify-between gap-3", !ex.is_active && "opacity-50")}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{ex.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ex.muscle_group?.name ?? "Sin grupo"}</p>
                {ex.difficulty && (
                  <span className={clsx("inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium", DIFFICULTY_COLOR[ex.difficulty])}>
                    {DIFFICULTY_LABELS[ex.difficulty]}
                  </span>
                )}
                {ex.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ex.description}</p>}
              </div>
              <button onClick={() => setModal({ mode: "edit", exercise: ex })}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && <ExerciseModal mode={modal.mode} exercise={modal.exercise} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Routines Tab ───────────────────────────────────────────────
function RoutinesTab() {
  const [modal, setModal]           = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [showAssign, setShowAssign] = useState(null);
  const [showMembers, setShowMembers] = useState(null);

  const { data: routines = [], isLoading } = useQuery({ queryKey: ["routines"], queryFn: trainingService.getRoutines });

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({ mode: "create" })}>
          <Plus size={16} /> Nueva rutina
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay rutinas creadas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{r.name}</h3>
                    {r.is_template && <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-xs rounded-full font-medium">Plantilla</span>}
                    {r.difficulty && (
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", DIFFICULTY_COLOR[r.difficulty])}>
                        {DIFFICULTY_LABELS[r.difficulty]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1 flex-wrap">
                    {r.goal && <span>🎯 {r.goal}</span>}
                    {r.duration_weeks && <span>📅 {r.duration_weeks} semanas</span>}
                    {r.days_per_week && <span>🗓 {r.days_per_week} días/semana</span>}
                    <span>💪 {r.exercises?.length ?? 0} ejercicios</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowMembers(r)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1">
                    <Users size={13} /> Asignados
                  </button>
                  <button onClick={() => setShowAssign(r)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors">
                    Asignar
                  </button>
                  <button onClick={() => setModal({ mode: "edit", routine: r })}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    {expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {expanded === r.id && r.exercises?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[...r.exercises]
                      .sort((a, b) => (a.day_of_week ?? 99) - (b.day_of_week ?? 99) || a.order_index - b.order_index)
                      .map((re) => (
                        <div key={re.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          {re.day_of_week != null && (
                            <span className="text-xs bg-brand-100 text-brand-700 font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                              {DAYS[re.day_of_week]}
                            </span>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{re.exercise?.name}</p>
                            <p className="text-xs text-gray-400">
                              {[re.sets && `${re.sets} series`, re.reps && `${re.reps} reps`, re.rest_seconds && `${re.rest_seconds}s`].filter(Boolean).join(" · ")}
                            </p>
                            {re.notes && <p className="text-xs text-gray-400 italic">{re.notes}</p>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && <RoutineModal mode={modal.mode} routine={modal.routine} onClose={() => setModal(null)} />}
      {showAssign && <AssignRoutineModal routine={showAssign} onClose={() => setShowAssign(null)} />}
      {showMembers && <RoutineMembersModal routine={showMembers} onClose={() => setShowMembers(null)} />}
    </div>
  );
}

// ── Routine members modal ──────────────────────────────────────
function RoutineMembersModal({ routine, onClose }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["routine-members", routine.id],
    queryFn: () => trainingService.getRoutineMembers(routine.id),
  });

  const STATUS_LABEL = { active: "Activa", completed: "Completada", paused: "Pausada", cancelled: "Cancelada" };
  const STATUS_COLOR = { active: "bg-green-100 text-green-700", completed: "bg-gray-100 text-gray-500", paused: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700" };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">Miembros asignados</h2>
            <p className="text-xs text-gray-400 mt-0.5">{routine.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <p className="text-center py-10 text-sm text-gray-400">Cargando...</p>
          ) : assignments.length === 0 ? (
            <div className="text-center py-10">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Ningún miembro tiene esta rutina asignada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.assignment_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700 shrink-0">
                      {a.first_name[0]}{a.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.first_name} {a.last_name}</p>
                      <p className="text-xs text-brand-600 font-mono">{a.member_code}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLOR[a.status])}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.assigned_at).toLocaleDateString("es-MX")}
                      {a.ends_at && ` → ${new Date(a.ends_at).toLocaleDateString("es-MX")}`}
                    </p>
                  </div>
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

// ── Assign routine modal ───────────────────────────────────────
function AssignRoutineModal({ routine, onClose }) {
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberResults, setMemberResults] = useState([]);
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");

  const { data: memberData } = useQuery({
    queryKey: ["members-search-training", memberSearch],
    queryFn: () => memberService.getAll({ search: memberSearch, limit: 8 }),
    enabled: memberSearch.trim().length > 1,
  });

  useState(() => { if (memberData?.data) setMemberResults(memberData.data); }, [memberData]);

  const mutation = useMutation({
    mutationFn: () => trainingService.assignRoutine({
      member_id: selectedMember.id,
      routine_id: routine.id,
      ends_at: endsAt || null,
      note: note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-routines"] });
      toast.success("¡Rutina asignada!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al asignar"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Asignar rutina</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-brand-50 rounded-xl px-3 py-2 text-sm">
            <p className="font-semibold text-brand-800">{routine.name}</p>
            {routine.goal && <p className="text-xs text-brand-600">{routine.goal}</p>}
          </div>

          <div>
            <label className="label">Miembro *</label>
            {selectedMember ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-sm">{selectedMember.first_name} {selectedMember.last_name}</p>
                  <p className="text-xs font-mono text-brand-600">{selectedMember.member_code}</p>
                </div>
                <button onClick={() => { setSelectedMember(null); setMemberSearch(""); }} className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={memberSearch} onChange={(e) => { setMemberSearch(e.target.value); if (memberData?.data) setMemberResults(memberData.data); }}
                    className="input pl-9" placeholder="Buscar miembro..." />
                </div>
                {memberResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {memberResults.map((m) => (
                      <button key={m.id} type="button" onClick={() => { setSelectedMember(m); setMemberSearch(""); setMemberResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors">
                        <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-xs font-mono text-brand-600">{m.member_code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Fecha de fin (opcional)</label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input" />
          </div>

          <div>
            <label className="label">Nota</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input resize-none" />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={() => { if (!selectedMember) { toast.error("Selecciona un miembro"); return; } mutation.mutate(); }}
              disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Asignando..." : "Asignar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Muscle Groups Tab ──────────────────────────────────────────
function MuscleGroupsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = ["propietario", "administrador"].includes(user?.role?.name);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState("");
  const [editDesc, setEditDesc]   = useState("");
  const [newName, setNewName]     = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [creating, setCreating]   = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["muscle-groups"],
    queryFn: trainingService.getMuscleGroups,
  });

  const createMutation = useMutation({
    mutationFn: () => trainingService.createMuscleGroup({ name: newName.trim(), description: newDesc.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] });
      toast.success("¡Grupo muscular creado!");
      setNewName(""); setNewDesc(""); setCreating(false);
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: (id) => trainingService.updateMuscleGroup(id, { name: editName.trim(), description: editDesc.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] });
      toast.success("Grupo actualizado");
      setEditingId(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: trainingService.deleteMuscleGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] });
      toast.success("Grupo eliminado");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "No se puede eliminar"),
  });

  const startEdit = (g) => { setEditingId(g.id); setEditName(g.name); setEditDesc(g.description ?? ""); };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{groups.length} grupos musculares</p>
        {canManage && (
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo grupo
          </button>
        )}
      </div>

      {canManage && creating && (
        <div className="card mb-4 border-brand-200">
          <p className="text-sm font-semibold mb-3 text-gray-800">Nuevo grupo muscular</p>
          <div className="space-y-3">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              className="input" placeholder="Nombre (Ej: Pecho, Espalda, Piernas...)" />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              className="input" placeholder="Descripción (opcional)" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending} className="btn-primary text-sm">
                {createMutation.isPending ? "Guardando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-10">
          <Dumbbell size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay grupos musculares aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) =>
            editingId === g.id ? (
              <div key={g.id} className="card border-brand-300 space-y-2">
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="input" />
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="input" placeholder="Descripción (opcional)" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">Cancelar</button>
                  <button onClick={() => updateMutation.mutate(g.id)}
                    disabled={!editName.trim() || updateMutation.isPending} className="btn-primary text-sm">
                    {updateMutation.isPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={g.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div>
                  <p className="font-medium text-gray-800">{g.name}</p>
                  {g.description && <p className="text-xs text-gray-400 mt-0.5">{g.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(g)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => confirm(`¿Eliminar "${g.name}"?`) && deleteMutation.mutate(g.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function TrainingPage() {
  const [tab, setTab] = useState("routines");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrenamientos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ejercicios, rutinas y asignaciones</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "routines",       label: "Rutinas" },
          { key: "exercises",      label: "Ejercicios" },
          { key: "muscle-groups",  label: "Grupos musculares" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "routines"      && <RoutinesTab />}
        {tab === "exercises"     && <ExercisesTab />}
        {tab === "muscle-groups" && <MuscleGroupsTab />}
      </div>
    </div>
  );
}
