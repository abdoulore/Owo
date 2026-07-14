import { useCurrency } from "../lib/currency";

// The $ / ₦ display toggle for cream-background screens (Activity). Home has its own
// version styled for the coral balance card, but both drive the same shared preference.
export function CurrencyToggle() {
  const { naira, setNaira } = useCurrency();
  return (
    <div className="flex rounded-full bg-sand p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => setNaira(false)}
        className={`rounded-full px-2.5 py-1 ${naira ? "text-muted" : "bg-accent text-white"}`}
      >
        $
      </button>
      <button
        type="button"
        onClick={() => setNaira(true)}
        className={`rounded-full px-2.5 py-1 ${naira ? "bg-accent text-white" : "text-muted"}`}
      >
        ₦
      </button>
    </div>
  );
}
