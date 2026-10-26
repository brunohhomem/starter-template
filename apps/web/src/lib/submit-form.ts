import type { FormEvent } from 'react';

export function onFormSubmit(submit: (event: FormEvent<HTMLFormElement>) => Promise<void>) {
  return (event: FormEvent<HTMLFormElement>) => {
    void submit(event);
  };
}
