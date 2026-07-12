import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Banknote } from "lucide-react";
import toast from "react-hot-toast";
import { salesService } from "../../services/salesService";

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

const METHOD_LABELS = {
  cash:          "Efectivo",
  card:          "Tarjeta",
  bank_transfer: "Transferencia bancaria",
  credit:        "Crédito",
  qr_code:       "QR / Digital",
};

export default function PayDebtModal({ debt, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { amount: fmt(debt.remaining_amount) },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: salesService.getPaymentMethods,
  });

  const mutation = useMutation({
    mutationFn: (data) => salesService.payDebt(debt.id, {
      payment_method_id: data.payment_method_id,
      amount: parseFloat(data.amount),
      reference_code: data.reference_code || null,
      note: data.note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-debts"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("¡Abono registrado!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al registrar abono"),
  });

  const amount = parseFloat(watch("amount")) || 0;
  const remaining = parseFloat(debt.remaining_amount);
  const afterPayment = Math.max(remaining - amount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Banknote size={18} className="text-green-600" />
            <h2 className="text-base font-semibold">Registrar abono</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Debt summary */}
        <div className="mx-6 mt-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Concepto</span>
            <span className="font-medium">{debt.concept}</span>
          </div>
          {debt.member_name && (
            <div className="flex justify-between">
              <span className="text-gray-500">Miembro</span>
              <span className="font-medium">{debt.member_name}</span>
            </div>
          )}
          {debt.sale_number && (
            <div className="flex justify-between">
              <span className="text-gray-500">Venta</span>
              <span className="font-medium">{debt.sale_number}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="text-gray-500">Deuda restante</span>
            <span className="font-bold text-red-600">${fmt(debt.remaining_amount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Método de pago *</label>
            <select {...register("payment_method_id", { required: "Requerido" })} className="input">
              <option value="">Seleccionar...</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{METHOD_LABELS[m.name] ?? m.name}</option>
              ))}
            </select>
            {errors.payment_method_id && <p className="text-xs text-red-500 mt-1">{errors.payment_method_id.message}</p>}
          </div>

          <div>
            <label className="label">Monto a abonar *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...register("amount", {
                  required: "Requerido",
                  min: { value: 0.01, message: "Debe ser mayor a 0" },
                  max: { value: remaining, message: `No puede superar $${fmt(remaining)}` },
                })}
                className="input pl-7"
              />
            </div>
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            {amount > 0 && (
              <p className={`text-xs mt-1 ${afterPayment === 0 ? "text-green-600 font-medium" : "text-gray-500"}`}>
                {afterPayment === 0 ? "✓ Saldo saldado completamente" : `Quedará pendiente: $${fmt(afterPayment)}`}
              </p>
            )}
          </div>

          <div>
            <label className="label">Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input {...register("reference_code")} className="input" placeholder="Número de transferencia, voucher..." />
          </div>

          <div>
            <label className="label">Nota <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input {...register("note")} className="input" placeholder="Observaciones..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Registrando..." : "Registrar abono"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
