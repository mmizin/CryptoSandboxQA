import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    const from =
      this.config.get<string>('MAIL_FROM') ?? 'CryptoSandboxQA <noreply@cryptosandbox.local>';
    const text = `Your password reset code is: ${code}

Enter this code on the reset password page. It expires in 30 minutes.

If you did not request a reset, you can ignore this message.`;

    const host =
      this.config.get<string>('SMTP_HOST')?.trim() || process.env.SMTP_HOST?.trim() || '';
    const port = Number(
      this.config.get<string>('SMTP_PORT') ?? process.env.SMTP_PORT ?? '587',
    );

    if (!host) {
      this.logger.log(`[no SMTP_HOST — code was not emailed] To: ${to}\n${text}`);
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
      from,
      to,
      subject: 'Your password reset code',
      text,
    });
  }
}
