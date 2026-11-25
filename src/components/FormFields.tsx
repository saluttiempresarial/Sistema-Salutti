// src/components/FormFields.tsx
//
// InputField / SelectField / TextAreaField / CheckboxField genéricos.
// O README menciona que esses componentes já existem no projeto — se for
// o caso, IGNORE este arquivo e apenas ajuste os imports em
// `LicitacaoFormModal.tsx` para apontar para os seus.

import React from 'react';

const baseFieldClass =
  'w-full rounded-md border border-charcoal-3/20 bg-white px-3 py-2 font-body text-sm text-ink placeholder:text-ink-aux focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20';

interface FieldWrapperProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, required, hint, error, children }: FieldWrapperProps) {
  return (
    <label className="block font-body text-sm">
      <span className="mb-1 block font-medium text-ink">
        {label} {required && <span className="text-brass">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

interface InputFieldProps extends FieldWrapperProps {
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InputField({ type = 'text', value, onChange, placeholder, ...wrapper }: InputFieldProps) {
  return (
    <FieldWrapper {...wrapper}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={baseFieldClass}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends FieldWrapperProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({ value, onChange, options, placeholder, ...wrapper }: SelectFieldProps) {
  return (
    <FieldWrapper {...wrapper}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={baseFieldClass}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

interface TextAreaFieldProps extends FieldWrapperProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function TextAreaField({ value, onChange, rows = 4, placeholder, ...wrapper }: TextAreaFieldProps) {
  return (
    <FieldWrapper {...wrapper}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseFieldClass} resize-none`}
      />
    </FieldWrapper>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function CheckboxField({ label, checked, onChange, hint }: CheckboxFieldProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 font-body text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-charcoal-3/30 text-forest focus:ring-forest/30"
      />
      <span>
        <span className={checked ? 'text-ink line-through decoration-ink-soft/40' : 'text-ink'}>{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}
