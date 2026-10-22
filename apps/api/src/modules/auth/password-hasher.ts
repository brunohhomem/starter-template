import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordHasher {
  constructor(private readonly rounds: number = 12) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async dummyVerify(): Promise<void> {
    // Use a dummy hash to spend the same CPU time as a real verification
    // This prevents timing attacks that could reveal if a user exists
    const dummyHash = await bcrypt.hash('dummy', this.rounds);
    await bcrypt.compare('dummy', dummyHash);
  }
}
