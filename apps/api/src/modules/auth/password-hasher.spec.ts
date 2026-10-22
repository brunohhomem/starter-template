import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  let passwordHasher: PasswordHasher;

  beforeEach(() => {
    passwordHasher = new PasswordHasher(12);
  });

  it('gera hash válido para senha', async () => {
    const password = 'MinhaSenh@123';
    const hash = await passwordHasher.hash(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifica senha correta retorna true', async () => {
    const password = 'MinhaSenh@123';
    const hash = await passwordHasher.hash(password);

    const isValid = await passwordHasher.verify(password, hash);

    expect(isValid).toBe(true);
  });

  it('verifica senha incorreta retorna false', async () => {
    const password = 'MinhaSenh@123';
    const wrongPassword = 'SenhaErrad@123';
    const hash = await passwordHasher.hash(password);

    const isValid = await passwordHasher.verify(wrongPassword, hash);

    expect(isValid).toBe(false);
  });

  it('hashes diferentes para mesma senha (salt aleatório)', async () => {
    const password = 'MinhaSenh@123';
    const hash1 = await passwordHasher.hash(password);
    const hash2 = await passwordHasher.hash(password);

    expect(hash1).not.toBe(hash2);
    expect(await passwordHasher.verify(password, hash1)).toBe(true);
    expect(await passwordHasher.verify(password, hash2)).toBe(true);
  });

  it('dummyVerify executa sem erro (previne timing attack)', async () => {
    await expect(passwordHasher.dummyVerify()).resolves.toBeUndefined();
  });

  it('usa rounds configurado', async () => {
    const fastHasher = new PasswordHasher(4);
    const slowHasher = new PasswordHasher(12);

    const password = 'Teste@123';

    const startFast = Date.now();
    await fastHasher.hash(password);
    const fastTime = Date.now() - startFast;

    const startSlow = Date.now();
    await slowHasher.hash(password);
    const slowTime = Date.now() - startSlow;

    expect(slowTime).toBeGreaterThan(fastTime);
  });
});
