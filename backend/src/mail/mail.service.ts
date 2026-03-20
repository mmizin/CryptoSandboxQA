import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private mailFrom(): string {
    return (
      this.config.get<string>('MAIL_FROM') ?? 'CryptoSandboxQA <noreply@cryptosandbox.local>'
    );
  }

  private smtpHost(): string {
    return (
      this.config.get<string>('SMTP_HOST')?.trim() || process.env.SMTP_HOST?.trim() || ''
    );
  }

  /** Same behavior as legacy password reset: log full body when SMTP is not configured. */
  private async deliver(to: string, subject: string, text: string): Promise<void> {
    const host = this.smtpHost();
    const port = Number(
      this.config.get<string>('SMTP_PORT') ?? process.env.SMTP_PORT ?? '587',
    );

    if (!host) {
      this.logger.log(`[no SMTP_HOST — email was not sent] To: ${to}\nSubject: ${subject}\n${text}`);
      return;
    }

    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from: this.mailFrom(),
      to,
      subject,
      text,
    });
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    const text = `Your password reset code is: ${code}

Enter this code on the reset password page. It expires in 30 minutes.

If you did not request a reset, you can ignore this message.`;
    await this.deliver(to, 'Your password reset code', text);
  }

  async sendWelcomeEmail(to: string, displayName?: string | null): Promise<void> {
    try {
      const name = displayName?.trim() ? displayName.trim() : 'there';
      const text = `Hi ${name},

Welcome to CryptoSandboxQA. Your account was created successfully.

You can sign in with your email and password.

If you did not create this account, you can ignore this message.`;
      await this.deliver(to, 'Welcome to CryptoSandboxQA', text);
    } catch (e) {
      this.logger.error(`Welcome email failed for ${to}`, e);
    }
  }

  async sendOrderStatusEmail(
    to: string,
    params: {
      status: 'open' | 'filled' | 'cancelled';
      orderId: string;
      symbol: string;
      side: string;
      quantity: string;
      filledQuantity: string;
      price: string;
    },
  ): Promise<void> {
    try {
      const label =
        params.status === 'open'
          ? 'OPEN'
          : params.status === 'filled'
            ? 'FILLED'
            : 'CANCELED';
      const subject =
        params.status === 'open'
          ? `Order opened — ${params.symbol}`
          : params.status === 'filled'
            ? `Order filled — ${params.symbol}`
            : `Order canceled — ${params.symbol}`;
      const text = `Your order is now ${label}.

Order ID: ${params.orderId}
Market: ${params.symbol}
Side: ${params.side.toUpperCase()}
Quantity: ${params.quantity}
Filled: ${params.filledQuantity}
Price: ${params.price}

This is an automated message from CryptoSandboxQA.`;
      await this.deliver(to, subject, text);
    } catch (e) {
      this.logger.error(`Order ${params.status} email failed for ${to}`, e);
    }
  }

  async sendDepositFiatEmail(
    to: string,
    params: { depositId: string; fiatCurrency: string; amount: string },
  ): Promise<void> {
    try {
      const text = `Your fiat deposit is complete.

Deposit ID: ${params.depositId}
Currency: ${params.fiatCurrency}
Amount: ${params.amount}

This is an automated message from CryptoSandboxQA.`;
      await this.deliver(to, `Deposit received — ${params.fiatCurrency}`, text);
    } catch (e) {
      this.logger.error(`Fiat deposit email failed for ${to}`, e);
    }
  }

  async sendDepositCryptoEmail(
    to: string,
    params: { depositId: string; symbol: string; amount: string },
  ): Promise<void> {
    try {
      const text = `Your crypto deposit is complete.

Deposit ID: ${params.depositId}
Asset: ${params.symbol}
Amount: ${params.amount}

This is an automated message from CryptoSandboxQA.`;
      await this.deliver(to, `Deposit received — ${params.symbol}`, text);
    } catch (e) {
      this.logger.error(`Crypto deposit email failed for ${to}`, e);
    }
  }
}
