import { Injectable, Inject, Optional, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Logger } from 'nestjs-pino';
import { z } from '@starter/shared/zod';
import type { Env } from '../../config/env.schema';
import { ENV } from '../../config/app-config.module';
import { MailService } from './mail.service';
import { renderEmail, formatExpiresInLabel } from './templates/render-email';
import { UnrecoverableError } from 'bullmq';
import { QUEUE_PREFIX } from '../../common/tokens/queue-prefix.token';

const payloadSchema = z.object({
  to: z.string().email(),
  token: z.string(),
  expiresAt: z.string(),
});

type MailPayload = z.infer<typeof payloadSchema>;

type EmailTemplateConfig = {
  link: string;
  templateKey: 'emailConfirmation' | 'passwordReset' | 'invite';
  expiresInLabel: string;
};

@Injectable()
export class MailProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<MailPayload, void, string> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailService: MailService,
    private readonly logger: Logger,
    @Optional() @Inject(QUEUE_PREFIX) private readonly queuePrefix: string = '',
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = new IORedis({
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
      password: this.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<MailPayload, void, string>(
      'mail',
      async (job: Job<MailPayload, void, string>) => {
        await this.processJob(job);
      },
      {
        connection,
        prefix: this.queuePrefix || 'bull',
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job: Job<MailPayload, void, string> | undefined, err: Error) => {
      if (job) {
        this.logger.warn(
          { jobId: job.id, jobName: job.name, err: err.message },
          'Job de e-mail falhou',
        );
      }
    });

    await this.worker.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async processJob(job: Job<MailPayload, void, string>): Promise<void> {
    const payload = this.validatePayload(job.data);
    const config = this.resolveTemplateConfig(job.name, payload.token);
    const { subject, html, text } = await renderEmail(config.templateKey, {
      appName: this.env.APP_NAME,
      link: config.link,
      expiresInLabel: config.expiresInLabel,
    });
    await this.sendEmail(payload.to, subject, html, text);
  }

  private validatePayload(data: unknown): MailPayload {
    const parseResult = payloadSchema.safeParse(data);
    if (!parseResult.success) {
      throw new UnrecoverableError('Invalid job payload');
    }
    return parseResult.data;
  }

  private resolveTemplateConfig(jobName: string, token: string): EmailTemplateConfig {
    const baseUrl = this.env.WEB_ORIGIN.replace(/\/$/, '');
    switch (jobName) {
      case 'send-email-confirmation':
        return {
          link: `${baseUrl}/confirm-email?token=${token}`,
          templateKey: 'emailConfirmation',
          expiresInLabel: formatExpiresInLabel(this.env.EMAIL_CONFIRM_TTL_HOURS, 'hours'),
        };
      case 'send-password-reset':
        return {
          link: `${baseUrl}/reset-password?token=${token}`,
          templateKey: 'passwordReset',
          expiresInLabel: formatExpiresInLabel(this.env.PASSWORD_RESET_TTL_MINUTES, 'minutes'),
        };
      case 'send-invite':
        return {
          link: `${baseUrl}/accept-invite?token=${token}`,
          templateKey: 'invite',
          expiresInLabel: formatExpiresInLabel(this.env.INVITE_TTL_DAYS, 'days'),
        };
      default:
        throw new UnrecoverableError(`Unknown job type: ${jobName}`);
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      await this.mailService.sendNow({
        from: this.env.MAIL_FROM,
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      const err = error as { status?: number; statusCode?: number; message?: string };
      const status = err.status ?? err.statusCode;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw new UnrecoverableError(`Mail transport error: ${err.message ?? 'Unknown error'}`);
      }
      throw error;
    }
  }
}
