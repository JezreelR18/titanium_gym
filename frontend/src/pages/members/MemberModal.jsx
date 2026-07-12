import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memberService } from "../../services/memberService";
import { X, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const FIELDS = [
  { name: "first_name", label: "Nombre",               required: true },
  { name: "last_name",  label: "Apellido",              required: true },
  { name: "email",      label: "Correo",                type: "email" },
  { name: "phone",      label: "Teléfono" },
  { name: "id_number",  label: "CURP" },
  { name: "occupation", label: "Ocupación" },
  { name: "birth_date", label: "Fecha de nacimiento",   type: "date" },
  { name: "address",    label: "Dirección",             wide: true },
];

const BLANK_CONTACT = { full_name: "", phone: "", email: "", relationship: "" };

export default function MemberModal({ mode, member, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const [pendingContacts, setPendingContacts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContact, setNewContact] = useState(BLANK_CONTACT);
  const [contactErrors, setContactErrors] = useState({});

  const { data: fullMember } = useQuery({
    queryKey: ["member-detail", member?.id],
    queryFn: () => memberService.getById(member.id),
    enabled: mode === "edit" && !!member?.id,
  });

  useEffect(() => {
    if (mode === "edit" && fullMember) {
      reset(fullMember);
      setContacts(fullMember.emergency_contacts ?? []);
    } else if (mode === "create") {
      reset({});
      setPendingContacts([]);
    }
    setShowContactForm(false);
    setNewContact(BLANK_CONTACT);
    setContactErrors({});
  }, [mode, fullMember]);

  function toApiData(raw) {
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === "" ? null : v])
    );
  }

  function extractError(err) {
    const detail = err.response?.data?.detail;
    if (!detail) return "Ocurrió un error";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((e) => e.msg).join("; ");
    return "Ocurrió un error";
  }

  const mutation = useMutation({
    mutationFn: async (raw) => {
      const data = toApiData(raw);
      if (mode === "create") {
        return memberService.create({ ...data, emergency_contacts: pendingContacts });
      }
      return memberService.update(member.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", member?.id] });
      toast.success(mode === "create" ? "¡Miembro creado!" : "¡Miembro actualizado!");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const addContactMutation = useMutation({
    mutationFn: (data) => memberService.addEmergencyContact(member.id, data),
    onSuccess: (created) => {
      setContacts((prev) => [...prev, created]);
      setNewContact(BLANK_CONTACT);
      setShowContactForm(false);
      setContactErrors({});
    },
    onError: (err) => toast.error(extractError(err) || "Error al agregar contacto"),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId) => memberService.deleteEmergencyContact(member.id, contactId),
    onSuccess: (_, contactId) => {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    },
    onError: (err) => toast.error(extractError(err) || "Error al eliminar contacto"),
  });

  function validateContact() {
    const errs = {};
    if (!newContact.full_name.trim()) errs.full_name = "Nombre requerido";
    if (!newContact.phone.trim()) errs.phone = "Teléfono requerido";
    setContactErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAddContact() {
    if (!validateContact()) return;
    const data = {
      full_name: newContact.full_name.trim(),
      phone: newContact.phone.trim(),
      email: newContact.email.trim() || null,
      relationship: newContact.relationship.trim() || null,
    };
    if (mode === "edit") {
      addContactMutation.mutate(data);
    } else {
      setPendingContacts((prev) => [...prev, data]);
      setNewContact(BLANK_CONTACT);
      setShowContactForm(false);
      setContactErrors({});
    }
  }

  const displayedContacts = mode === "edit" ? contacts : pendingContacts;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nuevo miembro" : "Editar miembro"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6">
          {mode === "edit" && member?.member_code && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
              <span className="text-xs text-brand-600 font-medium">Código de miembro</span>
              <span className="font-mono font-bold text-brand-800 text-sm tracking-wider">{member.member_code}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(({ name, label, type = "text", required, wide }) => (
              <div key={name} className={wide ? "col-span-2" : ""}>
                <label className="label">{label}{required && " *"}</label>
                <input
                  type={type}
                  {...register(name, { required: required ? `${label} es requerido` : false })}
                  className="input"
                />
                {errors[name] && (
                  <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>
                )}
              </div>
            ))}

            <div>
              <label className="label">Género</label>
              <select {...register("gender")} className="input">
                <option value="">Seleccionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
                <option value="prefer_not_to_say">Prefiero no decir</option>
              </select>
            </div>

            {mode === "edit" && (
              <div>
                <label className="label">Estado</label>
                <select {...register("status")} className="input">
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                  <option value="frozen">Congelado</option>
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="label">Nota</label>
              <textarea {...register("note")} rows={2} className="input resize-none" />
            </div>
          </div>

          {/* Emergency contacts */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Contactos de emergencia</h3>
              {!showContactForm && (
                <button
                  type="button"
                  onClick={() => setShowContactForm(true)}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus size={14} /> Agregar
                </button>
              )}
            </div>

            {displayedContacts.length > 0 && (
              <div className="space-y-2 mb-3">
                {displayedContacts.map((c, i) => (
                  <div key={c.id ?? i} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{c.full_name}</p>
                      <p className="text-gray-500 text-xs">
                        {c.phone}{c.relationship ? ` · ${c.relationship}` : ""}
                      </p>
                      {c.email && <p className="text-gray-400 text-xs">{c.email}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        mode === "edit"
                          ? deleteContactMutation.mutate(c.id)
                          : setPendingContacts((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {displayedContacts.length === 0 && !showContactForm && (
              <p className="text-xs text-gray-400 mb-2">Sin contactos de emergencia.</p>
            )}

            {showContactForm && (
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Nombre completo *</label>
                    <input
                      type="text"
                      value={newContact.full_name}
                      onChange={(e) => setNewContact((p) => ({ ...p, full_name: e.target.value }))}
                      className="input"
                      placeholder="Ej. María García"
                    />
                    {contactErrors.full_name && (
                      <p className="text-xs text-red-500 mt-1">{contactErrors.full_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Teléfono *</label>
                    <input
                      type="text"
                      value={newContact.phone}
                      onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                      className="input"
                      placeholder="555-0000"
                    />
                    {contactErrors.phone && (
                      <p className="text-xs text-red-500 mt-1">{contactErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Parentesco</label>
                    <input
                      type="text"
                      value={newContact.relationship}
                      onChange={(e) => setNewContact((p) => ({ ...p, relationship: e.target.value }))}
                      className="input"
                      placeholder="Madre, Esposo..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Correo (opcional)</label>
                    <input
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                      className="input"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowContactForm(false);
                      setNewContact(BLANK_CONTACT);
                      setContactErrors({});
                    }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={addContactMutation.isPending}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    {addContactMutation.isPending ? "Guardando..." : "Agregar contacto"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending
                ? "Guardando..."
                : mode === "create"
                ? "Crear miembro"
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
