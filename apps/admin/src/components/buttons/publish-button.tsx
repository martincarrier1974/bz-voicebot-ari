import { publishRuntimeConfigAction } from "@/app/actions";

export function PublishButton({
  label = "Publier",
  variant = "solid",
  size = "md",
}: {
  label?: string;
  variant?: "solid" | "outline";
  size?: "sm" | "md";
}) {
  const base = "inline-flex items-center justify-center rounded-xl font-semibold transition focus:outline-none focus:ring-4 focus:ring-sky-500/20";
  const variantClass =
    variant === "outline"
      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
      : "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400";
  const sizeClass = size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm";

  return (
    <form action={publishRuntimeConfigAction}>
      <button type="submit" className={`${base} ${variantClass} ${sizeClass}`}>
        {label}
      </button>
    </form>
  );
}
