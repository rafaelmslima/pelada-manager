import { describe, expect, it } from "vitest";
import { formatBillingType, formatDate, formatPosition, formatRating, initials, whatsappLink } from "./format";

describe("format helpers", () => {
  it("formats domain labels", () => {
    expect(formatPosition("defesa")).toBe("Defesa");
    expect(formatBillingType("mensalista")).toBe("Mensalista");
  });

  it("formats numbers and dates for pt-BR UI", () => {
    expect(formatRating(3)).toBe("3");
    expect(formatRating(3.4)).toBe("3.4");
    expect(formatDate("2026-05-17")).toBe("17/05/2026");
  });

  it("builds display initials and WhatsApp links", () => {
    expect(initials("Rafael Silva")).toBe("RS");
    expect(whatsappLink("11 99999-9999")).toBe("https://wa.me/5511999999999");
  });
});
