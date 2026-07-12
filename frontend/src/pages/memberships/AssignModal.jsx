import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membershipService } from "../../services/membershipService";
import { memberService } from "../../services/memberService";
import { X, Search } from "lucide-react";
import toast from "react-hot-toast";

function fmt(n) {
  return Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 });
}

export default function AssignModal({ onClose }) {
  const queryClient = useQueryClient();

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberResults, setMemberResults] = useState([]);
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountPct, setDiscountPct] = useState("0");
  const [autoRenew, setAutoRenew] = useState(false);
  const [note, setNote] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => membershipService.getPlans({ active_only: true }),
  });

  const { data: memberData } = useQuery({
    queryKey: ["members-search-assign", memberSearch],
    queryFn: () => memberService.getAll({ search: memberSearch, limit: 8 }),
    enabled: memberSearch.trim().length > 1,
  });

  useEffect(() => {
    if (memberData?.data) setMemberResults(memberData.data);
    else setMemberResults([]);
  }, [memberData]);

  const selectedPlan = plans.find((p) => p.id === planId);
  const discount = Number(discountPct) || 0;
  const finalPrice = selectedPlan ? selectedPlan.price * (1 - discount / 100) : null;

  const mutation = useMutation({
    mutationFn: () =>
      membershipService.assign({
        member_id: selectedMember.id,
        plan_id: planId,
        start_date: startDate,
        discount_pct: discount,
        auto_renew: autoRenew,
        note: note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      toast.success("¡Membresía asignada!");
      onClose();
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map((e) => e.msg).join("; ") : detail ?? "Ocurrió un error");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMember) { toast.error("Selecciona un miembro"); return; }
    if (!planId) { toast.error("Selecciona un plan"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Asignar membresía</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Member search */}
          <div>
            <label className="label">Miembro *</label>
            {selectedMember ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-sm text-gray-800">{selectedMember.first_name} {selectedMember.last_name}</p>
                  <p className="text-xs text-brand-600 font-mono">{selectedMember.member_code}</p>
                </div>
                <button type="button" onClick={() => { setSelectedMember(null); setMemberSearch(""); }} className="text-xs text-gray-400 hover:text-red-500">
                  Cambiar
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="input pl-9"
                    placeholder="Buscar por nombre o código..."
                  />
                </div>
                {memberResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelectedMember(m); setMemberSearch(""); setMemberResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-brand-600 font-mono">{m.member_code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan */}
          <div>
            <label className="label">Plan *</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="input">
              <option value="">Seleccionar plan...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.duration_days} días — ${fmt(p.price)} {p.currency}
                </option>
              ))}
            </select>
          </div>

          {/* Plan details */}
          {selectedPlan && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              {selectedPlan.description && <p className="text-gray-600">{selectedPlan.description}</p>}
              <div className="flex gap-4 text-xs text-gray-500 pt-1">
                {selectedPlan.includes_personal_training && <span>✓ Entrenamiento personal</span>}
                {selectedPlan.includes_locker && <span>✓ Casillero</span>}
                {selectedPlan.max_classes_per_week && <span>✓ Hasta {selectedPlan.max_classes_per_week} clases/semana</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de inicio *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Descuento (%)</label>
              <input
                type="number" min="0" max="100" step="0.01"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {selectedPlan && (
            <div className="flex items-center justify-between text-sm bg-brand-50 rounded-xl px-4 py-3">
              <span className="text-gray-600">Precio final</span>
              <span className="font-bold text-brand-700 text-base">${fmt(finalPrice)} {selectedPlan.currency}</span>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-gray-700">Renovación automática</span>
          </label>

          <div>
            <label className="label">Nota</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input resize-none" />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Asignando..." : "Asignar membresía"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
