"use client";

type Props = {
  open: boolean;
  deadline: string | null | undefined;
  onConfirm: () => void;
  onCancel: () => void;
};

export function GroupOrderConfirmDialog({ open, deadline, onConfirm, onCancel }: Props) {
  if (!open) return null;

  const deadlineFormatted = deadline
    ? new Date(deadline).toLocaleString("da-DK", {
        timeZone: "Europe/Copenhagen",
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-600 text-xl">📦</span>
          <h3 className="font-semibold text-gray-900">Samlebestilling</h3>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          Dette produkt indgår i en <strong>samlebestilling</strong>. Din betaling
          gennemføres straks, men ordren behandles og sendes først efter deadline.
        </p>
        {deadlineFormatted && (
          <p className="text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
            Deadline: {deadlineFormatted}
          </p>
        )}
        <p className="text-sm text-gray-600 mb-5">
          Vil du lægge produktet i kurven og acceptere disse betingelser?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-primary hover:bg-primary-dark text-secondary font-semibold text-sm py-2.5 rounded-xl transition"
          >
            Ja, jeg accepterer
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50 transition"
          >
            Annuller
          </button>
        </div>
      </div>
    </div>
  );
}
