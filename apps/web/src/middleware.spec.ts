// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('middleware', () => {
  it('Usuário logado que abre /login permanece no /login', () => {
    const req = new NextRequest('http://localhost:3100/login', {
      headers: { cookie: 'access_token=x' },
    });
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('Usuário logado que abre /register permanece no /register', () => {
    const req = new NextRequest('http://localhost:3100/register', {
      headers: { cookie: 'access_token=x' },
    });
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('/app sem cookie redireciona para /login com next param', () => {
    const req = new NextRequest('http://localhost:3100/app/agenda');
    const res = middleware(req);
    expect(res.headers.get('location')).toBe('http://localhost:3100/login?next=%2Fapp%2Fagenda');
  });

  it('/app com cookie passa sem redirecionar', () => {
    const req = new NextRequest('http://localhost:3100/app/agenda', {
      headers: { cookie: 'access_token=x' },
    });
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
