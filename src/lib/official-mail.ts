/**
 * Official LNPATS mail opens in the classic Outlook web app (OWA).
 * `outlook.office.com/owa/` is the classic client; `outlook.office.com/mail/` is the new Outlook.
 */
export const CLASSIC_OUTLOOK_BASE = "https://outlook.office.com/owa/";

export function outlookUrl(email?: string | null) {
  return email ? `${CLASSIC_OUTLOOK_BASE}?login_hint=${encodeURIComponent(email)}` : CLASSIC_OUTLOOK_BASE;
}
