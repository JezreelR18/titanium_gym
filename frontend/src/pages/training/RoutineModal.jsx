import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trainingService } from "../../services/trainingService";
import { X, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

const DIFFICULTY_LABELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };
const DAYS = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };
const BLANK_EX = { exercise_id: "", sets: "", reps: "", rest_seconds: "", day_of_week: "", notes: "" };

export default function RoutineModal({ mode, routine, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [pendingExercises, setPendingExercises] = useState([]);
  const [showExForm, setShowExForm] = useState(false);
  const [newEx, setNewEx] = useState(BLANK_EX);

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: trainingService.getExercises,
  });

  useEffect(() => {
    if (mode === "edit" && routine) {
      reset({
        name: routine.name,
        description: routine.description ?? "",
        goal: routine.goal ?? "",
        duration_weeks: routine.duration_weeks ?? "",
        days_per_week: routine.days_per_week ?? "",
        difficulty: routine.difficulty ?? "",
        is_template: routine.is_template,
        note: routine.note ?? "",
      });
      setPendingExercises(routine.exercises ?? []);
    } else {
      reset({ is_template: false });
      setPendingExercises([]);
    }
    setShowExForm(false);
    setNewEx(BLANK_EX);
  }, [mode, routine]);

  const mutation = useMutation({
    mutationFn: async (raw) => {
      const data = {
        name: raw.name,
        description: raw.description || null,
        goal: raw.goal || null,
        duration_weeks: raw.duration_weeks ? Number(raw.duration_weeks) : null,
        days_per_week: raw.days_per_week ? Number(raw.days_per_week) : null,
        difficulty: raw.difficulty || null,
        is_template: raw.is_template === true || raw.is_template === "true",
        note: raw.note || null,
      };
      if (mode === "create") {
        const created = await trainingService.createRoutine(data);
        for (const ex of pendingExercises) {
          await trainingService.addExerciseToRoutine(created.id, {
            exercise_id: ex.exercise_id ?? ex.exercise?.id,
            sets: ex.sets || null,
            reps: ex.reps || null,
            rest_seconds: ex.rest_seconds || null,
            day_of_week: ex.day_of_week != null && ex.day_of_week !== "" ? Number(ex.day_of_week) : null,
            notes: ex.notes || null,
            order_index: ex.order_index ?? 0,
          });
        }
        return created;
      } else {
        return trainingService.updateRoutine(routine.id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success(mode === "create" ? "¡Rutina creada!" : "¡Rutina actualizada!");
      onClose();
    },
    onError: (err) => {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map((e) => e.msg).join("; ") : d ?? "Ocurrió un error");
    },
  });

  const addExToRoutineMutation = useMutation({
    mutationFn: (exData) => trainingService.addExerciseToRoutine(routine.id, exData),
    onSuccess: (created) => {
      setPendingExercises((prev) => [...prev, created]);
      setNewEx(BLANK_EX);
      setShowExForm(false);
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
    onError: (err) => toast.error("Error al agregar ejercicio"),
  });

  const removeExMutation = useMutation({
    mutationFn: (reId) => trainingService.removeExerciseFromRoutine(reId),
    onSuccess: (_, reId) => {
      setPendingExercises((prev) => prev.filter((e) => e.id !== reId));
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });

  function handleAddExercise() {
    if (!newEx.exercise_id) { toast.error("Selecciona un ejercicio"); return; }
    const exData = {
      exercise_id: newEx.exercise_id,
      sets: newEx.sets ? Number(newEx.sets) : null,
      reps: newEx.reps ? Number(newEx.reps) : null,
      rest_seconds: newEx.rest_seconds ? Number(newEx.rest_seconds) : null,
      day_of_week: newEx.day_of_week !== "" && newEx.day_of_week != null ? Number(newEx.day_of_week) : null,
      notes: newEx.notes || null,
      order_index: pendingExercises.length,
    };
    if (mode === "edit") {
      addExToRoutineMutation.mutate(exData);
    } else {
      const exObj = exercises.find((e) => e.id === newEx.exercise_id);
      setPendingExercises((prev) => [...prev, { ...exData, exercise: exObj, _temp: true }]);
      setNewEx(BLANK_EX);
      setShowExForm(false);
    }
  }

  function removeExercise(item) {
    if (item.id && !item._temp) {
      removeExMutation.mutate(item.id);
    } else {
      setPendingExercises((prev) => prev.filter((e) => e !== item));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nueva rutina" : "Editar rutina"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div>
              <label className="label">Nombre *</label>
              <input {...register("name", { required: "Requerido" })} className="input" placeholder="Rutina de fuerza 3x/semana" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Objetivo</label>
                <input {...register("goal")} className="input" placeholder="Ganar masa muscular..." />
              </div>
              <div>
                <label className="label">Dificultad</label>
                <select {...register("difficulty")} className="input">
                  <option value="">Sin especificar</option>
                  {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Duración (semanas)</label>
                <input type="number" min="1" {...register("duration_weeks")} className="input" placeholder="8" />
              </div>
              <div>
                <label className="label">Días por semana</label>
                <input type="number" min="1" max="7" {...register("days_per_week")} className="input" placeholder="3" />
              </div>
            </div>

            <div>
              <label className="label">Descripción</label>
              <textarea {...register("description")} rows={2} className="input resize-none" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("is_template")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Guardar como plantilla reutilizable</span>
            </label>

            {/* Exercises */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Ejercicios ({pendingExercises.length})</h3>
                {!showExForm && (
                  <button type="button" onClick={() => setShowExForm(true)}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                    <Plus size={14} /> Agregar
                  </button>
                )}
              </div>

              {pendingExercises.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pendingExercises.map((item, i) => {
                    const exName = item.exercise?.name ?? exercises.find((e) => e.id === item.exercise_id)?.name ?? "—";
                    const details = [
                      item.sets && `${item.sets} series`,
                      item.reps && `${item.reps} reps`,
                      item.rest_seconds && `${item.rest_seconds}s descanso`,
                    ].filter(Boolean).join(" · ");
                    return (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{exName}</p>
                          <p className="text-xs text-gray-400">
                            {item.day_of_week != null ? `${DAYS[item.day_of_week]} · ` : ""}{details || "Sin detalle"}
                          </p>

                        </div>
                        <button type="button" onClick={() => removeExercise(item)}
                          className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors ml-2">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingExercises.length === 0 && !showExForm && (
                <p className="text-xs text-gray-400 mb-2">Sin ejercicios añadidos aún.</p>
              )}

              {showExForm && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                  <div>
                    <label className="label">Ejercicio *</label>
                    <select value={newEx.exercise_id} onChange={(e) => setNewEx((p) => ({ ...p, exercise_id: e.target.value }))} className="input">
                      <option value="">Seleccionar...</option>
                      {exercises.filter((e) => e.is_active).map((e) => (
                        <option key={e.id} value={e.id}>{e.name}{e.muscle_group ? ` (${e.muscle_group.name})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Series</label>
                      <input type="number" min="1" value={newEx.sets} onChange={(e) => setNewEx((p) => ({ ...p, sets: e.target.value }))} className="input" placeholder="3" />
                    </div>
                    <div>
                      <label className="label">Reps</label>
                      <input type="number" min="1" value={newEx.reps} onChange={(e) => setNewEx((p) => ({ ...p, reps: e.target.value }))} className="input" placeholder="12" />
                    </div>
                    <div>
                      <label className="label">Descanso (seg)</label>
                      <input type="number" min="0" value={newEx.rest_seconds} onChange={(e) => setNewEx((p) => ({ ...p, rest_seconds: e.target.value }))} className="input" placeholder="60" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Día</label>
                      <select value={newEx.day_of_week} onChange={(e) => setNewEx((p) => ({ ...p, day_of_week: e.target.value }))} className="input">
                        <option value="">Sin día fijo</option>
                        {Object.entries(DAYS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Notas</label>
                      <input value={newEx.notes} onChange={(e) => setNewEx((p) => ({ ...p, notes: e.target.value }))} className="input" placeholder="Opcional..." />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setShowExForm(false); setNewEx(BLANK_EX); }} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
                    <button type="button" onClick={handleAddExercise} disabled={addExToRoutineMutation.isPending} className="btn-primary text-xs py-1.5 px-3">
                      {addExToRoutineMutation.isPending ? "Guardando..." : "Agregar ejercicio"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear rutina" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
