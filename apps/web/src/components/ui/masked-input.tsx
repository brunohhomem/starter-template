'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Field } from './field';
import { Input } from './input';

type MaskedInputProps<T extends FieldValues> = {
  id: string;
  name: FieldPath<T>;
  label: string;
  control: Control<T>;
  error?: string;
  autoComplete: string;
  format: (value: string) => string;
};

export function MaskedInput<T extends FieldValues>({
  id,
  name,
  label,
  control,
  error,
  autoComplete,
  format,
}: MaskedInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Field id={id} label={label} error={error}>
          <Input
            id={id}
            inputMode="numeric"
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            name={field.name}
            ref={field.ref}
            value={typeof field.value === 'string' ? field.value : ''}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(format(event.target.value))}
          />
        </Field>
      )}
    />
  );
}
