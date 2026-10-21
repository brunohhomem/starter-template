import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Role } from '@starter/shared';

function RoleProbe() {
  return createElement('p', null, Role.admin);
}

describe('Role', () => {
  it('importa o contrato compartilhado', () => {
    render(createElement(RoleProbe));
    expect(screen.getByText(Role.admin)).toBeTruthy();
  });
});
