import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AlertItem } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { EmailService } from './email.service';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

/**
 * Periodic alerts digest. Self-contained scheduler (no extra deps) that emails a
 * summary of live alerts to users who can read KPIs. Gracefully disabled when
 * Resend is not configured — it logs instead of scheduling.
 */
@Injectable()
export class AlertsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly alerts: AlertsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (!this.email.enabled) {
      this.logger.log('Alerts digest scheduler idle — RESEND_API_KEY not set (use POST /alerts/digest/run to preview).');
      return;
    }
    const interval = Number(this.config.get<string>('ALERTS_DIGEST_INTERVAL_MS')) || DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => void this.runDigest(), interval);
    this.logger.log(`Alerts digest scheduler started (every ${Math.round(interval / 3600000)}h).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Compute alerts, resolve recipients and send the digest. Returns a run summary. */
  async runDigest(): Promise<{ alerts: number; recipients: number; sent: number }> {
    const view = await this.alerts.compute();
    if (!view.items.length) {
      this.logger.log('Alerts digest: nothing to report.');
      return { alerts: 0, recipients: 0, sent: 0 };
    }

    const recipients = await this.resolveRecipients();
    const subject = `NX-LAM alerts — ${view.counts.danger} critical, ${view.counts.warning} warning`;
    const html = this.renderHtml(view.items, view.counts);

    let sent = 0;
    for (const to of recipients) {
      const res = await this.email.send(to, subject, html);
      if (res.sent) sent += 1;
    }
    this.logger.log(`Alerts digest: ${view.items.length} alerts → ${recipients.length} recipients (${sent} sent).`);
    return { alerts: view.items.length, recipients: recipients.length, sent };
  }

  /** Config override (ALERTS_DIGEST_TO) else active users who can read KPIs. */
  private async resolveRecipients(): Promise<string[]> {
    const override = this.config.get<string>('ALERTS_DIGEST_TO');
    if (override?.trim()) {
      return override.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { permissions: { some: { permission: { key: 'kpis.read' } } } } } },
      },
      select: { email: true },
    });
    return users.map((u) => u.email);
  }

  private renderHtml(items: AlertItem[], counts: { total: number; danger: number; warning: number }): string {
    const rows = items
      .map((i) => {
        const color = i.severity === 'danger' ? '#dc2626' : '#d97706';
        const when = i.date ? new Date(i.date).toISOString().slice(0, 10) : '—';
        const days = i.daysRemaining == null ? '' : ` (${i.daysRemaining}d)`;
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${color};font-weight:600">${i.kind}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.title}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${i.reference}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${when}${days}</td>
        </tr>`;
      })
      .join('');
    return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px">NX-LAM alerts digest</h2>
      <p style="color:#666;margin:0 0 16px">${counts.total} alerts — <b style="color:#dc2626">${counts.danger} critical</b>, <b style="color:#d97706">${counts.warning} warning</b>.</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead><tr style="text-align:start;color:#888">
          <th style="padding:6px 10px;text-align:start">Type</th>
          <th style="padding:6px 10px;text-align:start">Detail</th>
          <th style="padding:6px 10px;text-align:start">Reference</th>
          <th style="padding:6px 10px;text-align:start">Date</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
}
