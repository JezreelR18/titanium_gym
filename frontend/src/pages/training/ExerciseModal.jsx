import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trainingService } from "../../services/trainingService";
import { X } from "lucide-react";
import toast from "react-hot-toast";

const DIFFICULTY_LABELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };

export default function ExerciseModal({ mode, exercise, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: muscleGroups = [] } = useQuery({
    queryKey: ["muscle-groups"],
    queryFn: trainingService.getMuscleGroups,
  });

  useEffect(() => {
    if (mode === "edit" && exercise) {
      reset({
        name: exercise.name,
        description: exercise.description ?? "",
        muscle_group_id: exercise.muscle_group?.id ?? "",
        difficulty: exercise.difficulty ?? "",
        video_url: exercise.video_url ?? "",
        is_active: exercise.is_active,
      });
    } else {
      reset({ is_active: true });
    }
  }, [mode, exercise]);

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = {
        name: raw.name,
        description: raw.description || null,
        muscle_group_id: raw.muscle_group_id || null,
        difficulty: raw.difficulty || null,
        video_url: raw.video_url || null,
        ...(mode === "edit" && { is_active: raw.is_active === true || raw.is_active === "true" }),
      };
      return mode === "create"
        ? trainingService.createExercise(data)
        : trainingService.updateExercise(exercise.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast.success(mode === "create" ? "¡Ejercicio creado!" : "¡Ejercicio actualizado!");
      onClose();
    },
    onError: (err) => {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map((e) => e.msg).join("; ") : d ?? "Ocurrió un error");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nuevo ejercicio" : "Editar ejercicio"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...register("name", { required: "Requerido" })} className="input" placeholder="Press de banca" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Grupo muscular</label>
              <select {...register("muscle_group_id")} className="input">
                <option value="">Sin grupo</option>
                {muscleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dificultad</label>
              <select {...register("difficulty")} className="input">
                <option value="">Sin especificar</option>
                {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea {...register("description")} rows={2} className="input resize-none" placeholder="Descripción del ejercicio..." />
          </div>
          <div>
            <label className="label">URL de video</label>
            <input {...register("video_url")} className="input" placeholder="https://youtube.com/..." />
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("is_active")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Ejercicio activo</span>
            </label>
          )}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear ejercicio" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
