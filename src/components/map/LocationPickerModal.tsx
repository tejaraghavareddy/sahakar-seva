import InteractiveMapPicker, { type PickedLocation } from "./InteractiveMapPicker";
import { MapPin, X } from "lucide-react";

interface LocationPickerModalProps {
  open: boolean;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

export default function LocationPickerModal({
  open,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: LocationPickerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <MapPin className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Pick service location
              </h2>
              <p className="text-[11px] text-slate-500">
                Detecting your GPS position… drag the pin to adjust, or search a landmark
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <InteractiveMapPicker
            initialLat={initialLat}
            initialLng={initialLng}
            onPick={onConfirm}
            height="280px"
          />
        </div>
      </div>
    </div>
  );
}
