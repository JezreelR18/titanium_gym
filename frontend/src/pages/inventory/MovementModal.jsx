import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../../services/inventoryService";
import { X, PackagePlus, PackageMinus, RefreshCw, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

const MOVEMENT_TYPES = [
  {
    value: "purchase",
    label: "Compra / Entrada",
    description: "Ingreso de mercancía nueva",
    icon: PackagePlus,
    color: "border-green-400 bg-green-50 text-green-700",
    activeColor: "ring-2 ring-green-500 border-green-500 bg-green-50",
  },
  {
    value: "adjustment",
    label: "Ajuste de inventario",
    description: "Corrección manual del stock (positivo o negativo)",
    icon: RefreshCw,
    color: "border-amber-400 bg-amber-50 text-amber-700",
    activeColor: "ring-2 ring-amber-500 border-amber-500 bg-amber-50",
  },
  {
    value: "return",
    label: "Devolución",
    description: "Producto devuelto por cliente",
    icon: RotateCcw,
    color: "border-blue-400 bg-blue-50 text-blue-700",
    activeColor: "ring-2 ring-blue-500 border-blue-500 bg-blue-50",
  },
];

export default function MovementModal({ product, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: { type: "purchase", quantity: 1 },
  });

  const selectedType = watch("type");
  const isAdjustment = selectedType === "adjustment";

  useEffect(() => { reset({ type: "purchase", quantity: 1 }); }, [product]);

  const mutation = useMutation({
    mutationFn: (data) =>
      inventoryService.addMovement(product.id, {
        type: data.type,
        quantity: parseInt(data.quantity),
        unit_price: data.unit_price ? parseFloat(data.unit_price) : null,
        reference: data.reference || null,
        note: data.note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      toast.success("Movimiento registrado");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Ocurrió un error"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">Registrar movimiento</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {product.name}
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Stock actual: {product.stock} {product.unit}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-5">
          {/* Type selector */}
          <div>
            <label className="label">Tipo de movimiento *</label>
            <div className="space-y-2">
              {MOVEMENT_TYPES.map(({ value, label, description, icon: Icon, color, activeColor }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedType === value ? activeColor : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={value}
                    {...register("type", { required: true })}
                    className="sr-only"
                  />
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedType === value ? color.split(" ").slice(1).join(" ") : "bg-gray-100 text-gray-500"
                  }`}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="label">
              {isAdjustment ? "Cantidad (negativo para reducir)" : "Cantidad"} *
            </label>
            <input
              type="number"
              {...register("quantity", {
                required: "Requerido",
                validate: (v) => parseInt(v) !== 0 || "No puede ser cero",
              })}
              className="input"
              placeholder={isAdjustment ? "Ej: -3 para reducir, 5 para agregar" : "Ej: 10"}
            />
            {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
          </div>

          {/* Unit price (for purchases) */}
          {selectedType === "purchase" && (
            <div>
              <label className="label">Costo unitario (opcional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("unit_price")}
                  className="input pl-6"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Precio de compra al proveedor</p>
            </div>
          )}

          {/* Reference */}
          <div>
            <label className="label">Referencia / N° Factura</label>
            <input
              {...register("reference")}
              className="input"
              placeholder="Ej: FAC-001, PROV-2024..."
            />
          </div>

          {/* Note */}
          <div>
            <label className="label">Nota</label>
            <textarea
              {...register("note")}
              rows={2}
              className="input resize-none"
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : "Registrar movimiento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
