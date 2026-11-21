import { describe, it, expect } from "vitest";
import { listingSchema, listingPayload, profileSchema } from "./validation";
import { contactLinks, safeReturnPath } from "./utils";
const base = {
  type: "SALE",
  title: "Calculators for students",
  description: "Working scientific calculator with cover included.",
  category: "calculators",
  condition: "USED",
  amount: 2000,
  deposit: "",
  need_type: "BUY",
  preferred_meetup_spot: "Cafeteria",
};
describe("listing validation", () => {
  it("rejects negative prices and short descriptions", () => {
    expect(listingSchema.safeParse({ ...base, amount: -1 }).success).toBe(
      false,
    );
    expect(
      listingSchema.safeParse({ ...base, description: "short" }).success,
    ).toBe(false);
  });
  it("writes mutually exclusive sale/rental/request values", () => {
    for (const type of ["SALE", "RENT", "REQUEST"]) {
      const v = listingSchema.parse({ ...base, type });
      const p = listingPayload(v, []);
      expect(
        [p.price, p.rental_rate_daily, p.offered_budget].filter(
          (n) => n !== null,
        ),
      ).toEqual([2000]);
      expect(p.condition === null).toBe(type === "REQUEST");
    }
  });
});
describe("private contact", () => {
  it("requires international phone format", () => {
    const p = {
      full_name: "Student One",
      department: "BSCS",
      registration_number: "FA24-001",
      graduation_year: 2028,
      phone_number: "03001234567",
    };
    expect(profileSchema.safeParse(p).success).toBe(false);
    expect(
      profileSchema.safeParse({ ...p, phone_number: "+923001234567" }).success,
    ).toBe(true);
  });
  it("encodes listing title without adding URL parameters", () => {
    const u = new URL(
      contactLinks("+923001234567", "Book & phone? #test").whatsapp,
    );
    expect(u.pathname).toBe("/923001234567");
    expect([...u.searchParams.keys()]).toEqual(["text"]);
    expect(u.searchParams.get("text")).toContain("Book & phone? #test");
  });
});

it("rejects external, backslash and nested auth redirect targets", () => {
  for (const path of [
    "//attacker.example",
    "/\\attacker.example",
    "https://attacker.example",
    "/signin",
    "/%5cattacker.example",
  ]) {
    expect(safeReturnPath(path)).toBe("/dashboard");
  }
  expect(safeReturnPath("/saved")).toBe("/saved");
  expect(safeReturnPath("/listing/30000000-0000-0000-0000-000000000001")).toBe(
    "/listing/30000000-0000-0000-0000-000000000001",
  );
});
