import { Phone } from "lucide-react";

/** Parties of 7+ are phone-only (CLAUDE.md §6) — never booked in the console. */
export function LargePartyNotice({ phone }: { phone: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <Phone className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">Parties of 7 or more are phone-only.</p>
        <p className="mt-0.5">
          Please call the restaurant to arrange a large party
          {phone ? (
            <>
              {" "}
              at{" "}
              <a
                href={`tel:${phone}`}
                className="font-mono font-medium underline"
              >
                {phone}
              </a>
            </>
          ) : null}
          .
        </p>
      </div>
    </div>
  );
}
