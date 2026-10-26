function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function formatCpf(value: string): string {
  const digits = digitsOnly(value, 11);
  const partA = digits.slice(0, 3);
  const partB = digits.slice(3, 6);
  const partC = digits.slice(6, 9);
  const partD = digits.slice(9, 11);

  if (digits.length <= 3) return partA;
  if (digits.length <= 6) return `${partA}.${partB}`;
  if (digits.length <= 9) return `${partA}.${partB}.${partC}`;
  return `${partA}.${partB}.${partC}-${partD}`;
}

export function formatPhone(value: string): string {
  const digits = digitsOnly(value, 11);
  const area = digits.slice(0, 2);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${area}`;
  if (digits.length <= 6) return `(${area}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${area}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${area}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
