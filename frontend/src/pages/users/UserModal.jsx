import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../services/userService";
import { X, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "active",    label: "Activo" },
  { value: "inactive",  label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
];

export default function UserModal({ mode, user, onClose }) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-list"],
    queryFn: userService.getRoles,
  });

  useEffect(() => {
    if (mode === "edit" && user) {
      reset({
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username ?? "",
        email: user.email,
        phone: user.phone ?? "",
        role_id: user.role.id,
        status: user.status,
      });
    } else {
      reset({ status: "active" });
    }
  }, [mode, user]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const clean = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
      );
      if (mode === "create") return userService.create(clean);
      const { email, password, ...updateData } = clean;
      return userService.update(user.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(mode === "create" ? "¡Usuario creado!" : "¡Usuario actualizado!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Ocurrió un error"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                {...register("first_name", { required: "Requerido" })}
                className="input"
                placeholder="Juan"
              />
              {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
            </div>

            <div>
              <label className="label">Apellido *</label>
              <input
                {...register("last_name", { required: "Requerido" })}
                className="input"
                placeholder="Pérez"
              />
              {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Correo electrónico *</label>
            <input
              type="email"
              {...register("email", { required: "Requerido" })}
              className="input"
              placeholder="juan@ejemplo.com"
              disabled={mode === "edit"}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Nombre de usuario <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              {...register("username", {
                pattern: {
                  value: /^[a-zA-Z0-9._-]+$/,
                  message: "Solo letras, números, puntos, guiones y guiones bajos",
                },
              })}
              className="input"
              placeholder="juanperez"
            />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
            <p className="text-xs text-gray-400 mt-1">Permite iniciar sesión sin usar el correo.</p>
          </div>

          {mode === "create" && (
            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password", {
                    required: "Requerido",
                    validate: (v) => {
                      if (v.length < 8) return "Mínimo 8 caracteres";
                      if (!/[A-Z]/.test(v)) return "Debe tener al menos una mayúscula";
                      if (!/[a-z]/.test(v)) return "Debe tener al menos una minúscula";
                      if (!/\d/.test(v)) return "Debe tener al menos un número";
                      if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(v))
                        return "Debe tener al menos un carácter especial (!@#$%...)";
                      return true;
                    },
                  })}
                  className="input pr-10"
                  placeholder="Ej. MiClave@2024"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input {...register("phone")} className="input" placeholder="+505 8888 0000" />
            </div>

            <div>
              <label className="label">Rol *</label>
              <select
                {...register("role_id", { required: "Requerido" })}
                className="input"
              >
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {errors.role_id && <p className="text-xs text-red-500 mt-1">{errors.role_id.message}</p>}
            </div>
          </div>

          {mode === "edit" && (
            <div>
              <label className="label">Estado</label>
              <select {...register("status")} className="input">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear usuario" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
