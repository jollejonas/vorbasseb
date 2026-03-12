"use client";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PrintConfirmDialog({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-2">Glemt at trykke &quot;Tilføj&quot;?</h3>
        <p className="text-sm text-gray-600 mb-5">
          Du har skrevet tekst i tryk-designeren, men ikke tilføjet den endnu.
          Vil du fortsætte og miste teksten, eller gå tilbage og tilføje den?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-secondary text-white font-semibold text-sm py-2 rounded-xl hover:bg-secondary-dark transition"
          >
            Fortsæt uden tryk
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50 transition"
          >
            Gå tilbage
          </button>
        </div>
      </div>
    </div>
  );
}
