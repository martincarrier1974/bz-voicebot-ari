"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const labelBase = "text-sm font-semibold text-slate-800";
const helpBase = "text-xs text-slate-500";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <p className={labelBase}>{label}</p>
        {hint ? <p className={helpBase}>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function TextInput({
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
  inputMode,
}: {
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  type?: React.InputHTMLAttributes<HTMLInputElement>["type"];
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      required={required}
      type={type}
      inputMode={inputMode}
      className={inputBase}
    />
  );
}

export function TextArea({
  name,
  defaultValue,
  rows = 4,
  placeholder,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <textarea
      name={name}
      rows={rows}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      required={required}
      className={`${inputBase} resize-y`}
    />
  );
}

export function Checkbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-4 focus:ring-sky-500/15"
      />
      <span className="leading-5">{label}</span>
    </label>
  );
}

export function Select({
  name,
  defaultValue,
  options,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className={inputBase}
    >
      <option value="">Sélectionner</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SaveButton({ label = "Enregistrer" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-sky-400"
    >
      {pending ? "Enregistrement..." : label}
    </button>
  );
}

export function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Suppression..." : "Supprimer"}
    </button>
  );
}
