import { createTransport } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export type SendMail = (mail: Mail) => Promise<void>;

/**
 * Plain SMTP, so any provider works (the Simply mailbox, Brevo, Resend …).
 * Without SMTP_HOST the mail is only written to the log – handy locally, but parents get nothing.
 */
export function smtpMailer(env: NodeJS.ProcessEnv = process.env): SendMail {
  const host = env.SMTP_HOST;
  const from = env.MAIL_FROM ?? 'Lobbi Junior <noreply@lobbi.dk>';
  if (!host)
    return async (m) => {
      console.log(`[mail – ikke sendt, SMTP_HOST mangler] til ${m.to}: ${m.subject}\n${m.text}`);
    };
  const port = Number(env.SMTP_PORT ?? 587);
  const t = createTransport({
    host,
    port,
    secure: port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
  });
  return async (m) => {
    await t.sendMail({ from, ...m });
  };
}
