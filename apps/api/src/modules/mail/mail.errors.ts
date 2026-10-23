export class UnrecoverableMailError extends Error {
  public readonly unrecoverable = true;

  constructor(message: string) {
    super(message);
    this.name = 'UnrecoverableMailError';
  }
}
