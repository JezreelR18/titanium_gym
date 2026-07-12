import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import clsx from "clsx";

/**
 * Dropdown export button.
 * Props:
 *   onExportCSV   — function called when CSV is selected
 *   onExportExcel — function called when Excel is selected
 *   disabled      — disable both options (e.g. while loading)
 *   label         — button label (default "Exportar")
 */
export default function ExportButton({ onExportCSV, onExportExcel, disabled, label = "Exportar" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
          "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Download size={15} />
        {label}
        <ChevronDown size={13} className={clsx("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
          <button
            onClick={() => pick(onExportCSV)}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText size={15} className="text-green-600" />
            CSV (.csv)
          </button>
          <button
            onClick={() => pick(onExportExcel)}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
