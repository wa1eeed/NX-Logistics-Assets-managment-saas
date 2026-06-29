import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transactional email via Resend. Gracefully disabled in dev when
 * RESEND_API_KEY is not set (logs instead of sending).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('RESEND_API_KEY');
  }

  async send(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('MAIL_FROM') ?? 'NX-LAM <no-reply@nx-lam.local>';
    if (!apiKey) {
      this.logger.warn(`[email disabled] to=${to} subject="${subject}"`);
      return { sent: false };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) {
        this.logger.error(`Resend failed: ${res.status} ${await res.text()}`);
        return { sent: false };
      }
      return { sent: true };
    } catch (err) {
      this.logger.error(`Resend error: ${(err as Error).message}`);
      return { sent: false };
    }
  }
}
