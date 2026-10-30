import { describe, expect, it } from "vitest";
import { outlookUrl } from "@/lib/official-mail";

describe("official mail launcher", () => {
  it("opens the classic Outlook web app, not the new Outlook", () => {
    expect(outlookUrl("p.cole@lnpats.net")).toBe(
      "https://outlook.office.com/owa/?login_hint=p.cole%40lnpats.net",
    );
  });

  it("never points at the new Outlook /mail/ address", () => {
    expect(outlookUrl("a.b@lnpats.net")).not.toContain("outlook.office.com/mail");
    expect(outlookUrl(null)).toBe("https://outlook.office.com/owa/");
  });
});
