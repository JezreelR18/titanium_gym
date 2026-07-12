import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../../services/inventoryService";
import { X } from "lucide-react";
import toast from "react-hot-toast";

const UNIT_OPTIONS = [
  { value: "unidad",  label: "Unidad" },
  { value: "bote",    label: "Bote" },
  { value: "bolsa",   label: "Bolsa" },
  { value: "scoop",   label: "Scoop / Porción" },
  { value: "caja",    label: "Caja" },
  { value: "par",     label: "Par" },
  { value: "litro",   label: "Litro" },
  { value: "gramo",   label: "Gramo" },
  { value: "onza",    label: "Onza" },
];

export default function ProductModal({ mode, product, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: inventoryService.getCategories,
  });

  useEffect(() => {
    if (mode === "edit" && product) {
      reset({
        name: product.name,
        description: product.description ?? "",
        sku: product.sku ?? "",
        unit: product.unit,
        location: product.location ?? "",
        price: product.price,
        min_stock_alert: product.min_stock_alert,
        category_id: product.category?.id ?? "",
        note: product.note ?? "",
        is_active: product.is_active,
      });
    } else {
      reset({ unit: "unidad", min_stock_alert: 5, is_active: true });
    }
  }, [mode, product]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        category_id: data.category_id || null,
        sku: data.sku || null,
        description: data.description || null,
        location: data.location || null,
        note: data.note || null,
        price: parseFloat(data.price),
        min_stock_alert: parseInt(data.min_stock_alert),
      };
      return mode === "create"
        ? inventoryService.createProduct(payload)
        : inventoryService.updateProduct(product.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      toast.success(mode === "create" ? "¡Producto creado!" : "¡Producto actualizado!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Ocurrió un error"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nuevo producto" : "Editar producto"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Nombre del producto *</label>
            <input
              {...register("name", { required: "Requerido" })}
              className="input"
              placeholder="Ej: Creatina Monohidratada, Botella de agua..."
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select {...register("category_id")} className="input">
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Unidad de venta *</label>
              <select {...register("unit", { required: "Requerido" })} className="input">
                {UNIT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Precio de venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("price", { required: "Requerido", min: { value: 0, message: "Debe ser >= 0" } })}
                  className="input pl-6"
                  placeholder="0.00"
                />
              </div>
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="label">SKU / Código</label>
              <input
                {...register("sku")}
                className="input"
                placeholder="Ej: CREAT-500"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="label">Ubicación física</label>
            <input
              {...register("location")}
              list="location-suggestions"
              className="input"
              placeholder="Ej: Refrigerador, Estante Suplementos, Vitrina Figuras..."
            />
            <datalist id="location-suggestions">
              <option value="Refrigerador" />
              <option value="Estante Suplementos" />
              <option value="Vitrina Figuras 3D" />
              <option value="Dulcería" />
              <option value="Bodega" />
              <option value="Mostrador" />
            </datalist>
            <p className="text-xs text-gray-400 mt-1">¿Dónde está físicamente este producto en el gym?</p>
          </div>

          {/* Min stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Stock mínimo para alerta</label>
              <input
                type="number"
                min="0"
                {...register("min_stock_alert")}
                className="input"
                placeholder="5"
              />
              <p className="text-xs text-gray-400 mt-1">Se marcará en rojo cuando llegue a este nivel</p>
            </div>

            {mode === "edit" && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" {...register("is_active")} />
                    <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors" />
                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Producto activo</span>
                </label>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="label">Descripción</label>
            <textarea
              {...register("description")}
              rows={2}
              className="input resize-none"
              placeholder="Ej: Creatina monohidratada 500g, sabor neutro. Presentación bote..."
            />
          </div>

          {/* Note */}
          <div>
            <label className="label">Nota interna</label>
            <input
              {...register("note")}
              className="input"
              placeholder="Notas para el equipo (proveedor, observaciones...)"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
