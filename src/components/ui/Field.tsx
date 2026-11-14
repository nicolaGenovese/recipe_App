"use client";

import type { ReactNode } from "react";

interface BaseProps {
  label: string;
  name: string;
  hint?: ReactNode;
  wide?: boolean;
  id?: string;
}

/** Label, control and hint in the shared form-field layout. */
export function FieldShell({ label, htmlFor, hint, wide, children }: { label: string; htmlFor: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={"form-field" + (wide ? " span-2" : "")}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

type InputProps = BaseProps & {
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: number;
  max?: number;
  list?: string;
  disabled?: boolean;
};

export function TextField({ label, name, hint, wide, id, value, onChange, type = "text", placeholder, required, step, min, max, list, disabled }: InputProps) {
  const fieldId = id ?? "field-" + name;
  return (
    <FieldShell label={label} htmlFor={fieldId} hint={hint} wide={wide}>
      <input
        id={fieldId} name={name} type={type} value={value} placeholder={placeholder} required={required} list={list} disabled={disabled}
        step={step} min={type === "number" ? (min ?? 0) : undefined} max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, name, hint, wide, id, value, onChange, placeholder }: BaseProps & { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <FieldShell label={label} htmlFor={id ?? "field-" + name} hint={hint} wide={wide}>
      <textarea id={id ?? "field-" + name} name={name} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function SelectField({ label, name, hint, wide, id, value, onChange, options }: BaseProps & { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <FieldShell label={label} htmlFor={id ?? "field-" + name} hint={hint} wide={wide}>
      <select id={id ?? "field-" + name} name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </FieldShell>
  );
}

/** A checkbox styled as a pill; the "checked" class mirrors its state for the CSS. */
export function CheckPill({ checked, onChange, children, id, className = "" }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; id?: string; className?: string }) {
  return (
    <label className={"form-check " + className + (checked ? " checked" : "")}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}

export function Datalist({ id, values }: { id: string; values: string[] }) {
  return <datalist id={id}>{values.map((value) => <option key={value} value={value} />)}</datalist>;
}
