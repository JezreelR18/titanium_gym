import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { membershipService } from "../../services/membershipService";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export default function PlanModal({ mode, plan, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (mode === "edit" && plan) {
      reset({
        name: plan.name,
        description: plan.description ?? "",
        duration_days: plan.duration_days,
        price: plan.price,
        currency: plan.currency ?? "MXN",
        max_classes_per_week: plan.max_classes_per_week ?? "",
        includes_personal_training: plan.includes_personal_training,
        includes_locker: plan.includes_locker,
        is_active: plan.is_active,
        note: plan.note ?? "",
      });
    } else {
      reset({ currency: "MXN", includes_personal_training: false, includes_locker: false });
    }
  }, [mode, plan]);

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = {
        ...raw,
        duration_days: Number(raw.duration_days),
        price: Number(raw.price),
        max_classes_per_week: raw.max_classes_per_week ? Number(raw.max_classes_per_week) : null,
        description: raw.description || null,
        note: raw.note || null,
        includes_personal_training: Boolean(raw.includes_personal_training),
        includes_locker: Boolean(raw.includes_locker),
      };
      return mode === "create"
        ? membershipService.createPlan(data)
        : membershipService.updatePlan(plan.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
      toast.success(mode === "create" ? "¡Plan creado!" : "¡Plan actualizado!");
      onClose();
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map((e) => e.msg).join("; ") : detail ?? "Ocurrió un error");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nuevo plan" : "Editar plan"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...register("name", { required: "Requerido" })} className="input" placeholder="Mensual básico" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Descripción</label>
            <textarea {...register("description")} rows={2} className="input resize-none" placeholder="Acceso completo al gimnasio..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Duración (días) *</label>
              <input
                type="number" min="1"
                {...register("duration_days", { required: "Requerido", min: { value: 1, message: "Mínimo 1 día" } })}
                className="input"
                placeholder="30"
              />
              {errors.duration_days && <p className="text-xs text-red-500 mt-1">{errors.duration_days.message}</p>}
            </div>

            <div>
              <label className="label">Precio *</label>
              <input
                type="number" min="0" step="0.01"
                {...register("price", { required: "Requerido", min: { value: 0, message: "Debe ser positivo" } })}
                className="input"
                placeholder="500.00"
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="label">Moneda</label>
              <select {...register("currency")} className="input">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label className="label">Clases por semana</label>
              <input
                type="number" min="0"
                {...register("max_classes_per_week")}
                className="input"
                placeholder="Sin límite"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("includes_personal_training")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Incluye entrenamiento personal</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("includes_locker")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Incluye casillero</span>
            </label>
            {mode === "edit" && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" {...register("is_active")} className="w-4 h-4 accent-brand-600" />
                <span className="text-sm text-gray-700">Plan activo</span>
              </label>
            )}
          </div>

          <div>
            <label className="label">Nota</label>
            <textarea {...register("note")} rows={2} className="input resize-none" />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear plan" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
