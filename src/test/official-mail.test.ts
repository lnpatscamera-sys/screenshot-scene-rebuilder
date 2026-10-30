import { describe, expect, it } from "vitest";
import { OUTLOOK_APP_PROTOCOL, mailtoUrl, webmailUrl } from "@/lib/official-mail";

describe("official mail launcher", () => {
  it("launches the Outlook program installed on the officer's computer", () => {
    expect(OUTLOOK_APP_PROTOCOL).toBe("outlook:");
  });

  it("falls back to the computer's default mail program, carrying the official address", () => {
    expect(mailtoUrl("p.cole@lnpats.net")).toBe("mailto:p.cole%40lnpats.net");
    expect(mailtoUrl("  ")).toBe("mailto:");
    expect(mailtoUrl(null)).toBe("mailto:");
  });

  it("never sends officers to the Microsoft web mailbox", () => {
    expect(OUTLOOK_APP_PROTOCOL).not.toContain("outlook.office.com");
    expect(mailtoUrl("a.b@lnpats.net")).not.toContain("outlook.office.com");
  });

  it("keeps the browser webmail address blank until ICT confirms the real one", () => {
    expect(webmailUrl()).toBe("");
  });
});
