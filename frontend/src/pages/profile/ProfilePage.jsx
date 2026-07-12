import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext";
import { userService } from "../../services/userService";
import { User, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";

// ── Password strength helper ───────────────────────────────────
function validatePassword(v) {
  if (v.length < 8)                          return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(v))                      return "Debe tener al menos una mayúscula";
  if (!/[a-z]/.test(v))                      return "Debe tener al menos una minúscula";
  if (!/\d/.test(v))                         return "Debe tener al menos un número";
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(v))
    return "Debe tener al menos un carácter especial (!@#$%...)";
  return true;
}

// ── Personal info section ──────────────────────────────────────
function PersonalInfoForm({ user, updateUser, hasPermission }) {
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm({
    defaultValues: {
      first_name: user.first_name,
      last_name:  user.last_name,
      phone:      user.phone ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => userService.updateMe(data),
    onSuccess: (updated) => {
      // Merge permissions from current user into updated response
      updateUser({ ...updated, permissions: user.permissions ?? [] });
      reset({ first_name: updated.first_name, last_name: updated.last_name, phone: updated.phone ?? "" });
      toast.success("Perfil actualizado");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al actualizar"),
  });

  return (
    <form onSubmit={handleSubmit(mutation.mutate)} className="card space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
          <User size={18} className="text-brand-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Información personal</h2>
          <p className="text-xs text-gray-500">Nombre y contacto</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre *</label>
          <input
            {...register("first_name", { required: "Requerido" })}
            className="input"
          />
          {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
        </div>
        <div>
          <label className="label">Apellido *</label>
          <input
            {...register("last_name", { required: "Requerido" })}
            className="input"
          />
          {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Teléfono</label>
        <input {...register("phone")} className="input" placeholder="+52 55 0000 0000" />
      </div>

      {/* Read-only fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center gap-1.5">
            Correo electrónico
            {!hasPermission("users.edit_sensitive") && (
              <span className="text-xs text-gray-400 font-normal">(solo admin)</span>
            )}
          </label>
          <input value={user.email} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            Nombre de usuario
            {!hasPermission("users.edit_sensitive") && (
              <span className="text-xs text-gray-400 font-normal">(solo admin)</span>
            )}
          </label>
          <input value={user.username ?? "—"} readOnly className="input bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={!isDirty || mutation.isPending}
          className="btn-primary disabled:opacity-50"
        >
          {mutation.isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

// ── Change password section ────────────────────────────────────
function ChangePasswordForm({ userId }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const newPass = watch("new_password", "");

  const mutation = useMutation({
    mutationFn: (data) => userService.changePassword(userId, {
      current_password: data.current_password,
      new_password: data.new_password,
    }),
    onSuccess: () => {
      reset();
      toast.success("Contraseña actualizada correctamente");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al cambiar contraseña"),
  });

  // Password strength indicators
  const checks = [
    { label: "8 caracteres mínimo",    ok: newPass.length >= 8 },
    { label: "Una mayúscula",           ok: /[A-Z]/.test(newPass) },
    { label: "Una minúscula",           ok: /[a-z]/.test(newPass) },
    { label: "Un número",              ok: /\d/.test(newPass) },
    { label: "Un carácter especial",   ok: /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(newPass) },
  ];

  return (
    <form onSubmit={handleSubmit(mutation.mutate)} className="card space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Lock size={18} className="text-orange-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Cambiar contraseña</h2>
          <p className="text-xs text-gray-500">Se cerrará la sesión después del cambio</p>
        </div>
      </div>

      <div>
        <label className="label">Contraseña actual *</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            {...register("current_password", { required: "Requerido" })}
            className="input pr-10"
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.current_password && <p className="text-xs text-red-500 mt-1">{errors.current_password.message}</p>}
      </div>

      <div>
        <label className="label">Nueva contraseña *</label>
        <div className="relative">
          <input
            type={showNew ? "text" : "password"}
            {...register("new_password", { required: "Requerido", validate: validatePassword })}
            className="input pr-10"
            placeholder="Ej. MiClave@2024"
          />
          <button type="button" onClick={() => setShowNew(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.new_password && <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>}

        {/* Strength checklist */}
        {newPass.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {checks.map((c) => (
              <div key={c.label} className={clsx("flex items-center gap-1.5 text-xs", c.ok ? "text-green-600" : "text-gray-400")}>
                <CheckCircle size={12} className={c.ok ? "text-green-500" : "text-gray-300"} />
                {c.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">Confirmar contraseña *</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            {...register("confirm_password", {
              required: "Requerido",
              validate: (v) => v === newPass || "Las contraseñas no coinciden",
            })}
            className="input pr-10"
          />
          <button type="button" onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
      </div>

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mutation.isPending} className="btn-primary disabled:opacity-50">
          {mutation.isPending ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser, hasPermission } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user.role?.name} · {user.email}
        </p>
      </div>

      <PersonalInfoForm user={user} updateUser={updateUser} hasPermission={hasPermission} />
      <ChangePasswordForm userId={user.id} />
    </div>
  );
}
