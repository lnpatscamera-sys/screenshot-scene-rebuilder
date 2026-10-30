/**
 * Official LNPATS mail opens in the Outlook desktop program installed on the
 * officer's own computer. The @lnpats.net mailboxes are hosted by the service
 * provider ICT subscribed to, so the Microsoft web-mailbox address is never
 * used here — it cannot sign those accounts in.
 *
 * A web page cannot open a program directly. It asks the computer to do it
 * through a registered "protocol":
 *   outlook:  -> the Outlook desktop program
 *   mailto:   -> whatever mail program the computer has set as its default
 */

/** Asks Windows to start the Outlook desktop program. */
export const OUTLOOK_APP_PROTOCOL = "outlook:";

/**
 * Universal handoff: opens the mail program this computer has set as default.
 * Supplying an address starts a new message to that address.
 */
export function mailtoUrl(email?: string | null) {
  const address = email?.trim();
  return address ? `mailto:${encodeURIComponent(address)}` : "mailto:";
}

/**
 * Opens Outlook on this computer. If Outlook is not installed or not
 * registered, the address is handed to the computer's default mail program
 * instead, so the button never silently does nothing.
 */
export function openOutlookApp(email?: string | null) {
  const launch = document.createElement("a");
  launch.href = OUTLOOK_APP_PROTOCOL;
  launch.rel = "noopener";
  launch.style.display = "none";
  document.body.appendChild(launch);
  launch.click();
  launch.remove();

  // When the handoff works, the browser loses focus and the page becomes
  // hidden. Still visible after a moment means nothing started, so fall back.
  window.setTimeout(() => {
    if (document.visibilityState === "visible") window.location.href = mailtoUrl(email);
  }, 1200);
}

/**
 * The web address where ICT can read the @lnpats.net mailbox in a browser.
 * Left blank until ICT confirms the real address — the ERP must not guess one.
 */
export const WEBMAIL_URL = "";

export function webmailUrl() {
  return WEBMAIL_URL;
}
