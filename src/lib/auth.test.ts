import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  otp: vi.fn(),
  verify: vi.fn(),
  login: vi.fn(),
  update: vi.fn(),
  domains: vi.fn(),
}));
vi.mock("./supabase", () => ({
  userError: (message: string) =>
    Object.assign(new Error(message), { name: "UserError" }),
  supabase: {
    from: () => ({ select: () => ({ eq: mock.domains }) }),
    auth: {
      signInWithOtp: mock.otp,
      verifyOtp: mock.verify,
      signInWithPassword: mock.login,
      updateUser: mock.update,
    },
  },
}));
import {
  authDestination,
  passwordSchema,
  savePassword,
  sendEmailCode,
  signInWithPassword,
  verifyEmailCode,
} from "./auth";
beforeEach(() => {
  vi.resetAllMocks();
  mock.domains.mockResolvedValue({
    data: [{ domain: "campus.example.edu" }],
    error: null,
  });
  mock.otp.mockResolvedValue({ error: null });
  mock.verify.mockResolvedValue({
    data: { session: { user: { id: "existing-student" } } },
    error: null,
  });
  mock.login.mockResolvedValue({
    data: { session: { user: { id: "existing-student" } } },
    error: null,
  });
  mock.update.mockResolvedValue({ error: null });
});
describe("password authentication migration", () => {
  it("only signup requests may create an account", async () => {
    await sendEmailCode("Student@campus.example.edu", "challenge", "signup");
    expect(mock.otp.mock.calls[0][0].options.shouldCreateUser).toBe(true);
    await sendEmailCode("Student@campus.example.edu", "challenge", "recovery");
    expect(mock.otp.mock.calls[1][0]).toEqual({
      email: "student@campus.example.edu",
      options: { captchaToken: "challenge", shouldCreateUser: false },
    });
  });
  it("does not expose a missing recovery account or create one", async () => {
    mock.otp.mockResolvedValue({ error: { code: "user_not_found" } });
    await expect(
      sendEmailCode("absent@campus.example.edu", "challenge", "recovery"),
    ).resolves.toBe("absent@campus.example.edu");
    expect(mock.otp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
  });
  it("requires CAPTCHA and approved domains before sending codes", async () => {
    await expect(
      sendEmailCode("student@campus.example.edu", "", "signup"),
    ).rejects.toThrow("security check");
    await expect(
      sendEmailCode("student@gmail.com", "challenge", "signup"),
    ).rejects.toThrow("approved");
    expect(mock.otp).not.toHaveBeenCalled();
  });
  it("password sign-in uses CAPTCHA and preserves exact password characters", async () => {
    await signInWithPassword(
      " Student@campus.example.edu ",
      "  My passphrase!  ",
      "challenge",
    );
    expect(mock.login).toHaveBeenCalledWith({
      email: "student@campus.example.edu",
      password: "  My passphrase!  ",
      options: { captchaToken: "challenge" },
    });
    expect(mock.otp).not.toHaveBeenCalled();
  });
  it("verifies an email OTP before any password update", async () => {
    await expect(
      verifyEmailCode("student@campus.example.edu", "bad-code"),
    ).rejects.toThrow();
    expect(mock.verify).not.toHaveBeenCalled();
    await verifyEmailCode("student@campus.example.edu", "12345678");
    expect(mock.verify).toHaveBeenCalledWith({
      email: "student@campus.example.edu",
      token: "12345678",
      type: "email",
    });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("rejects short and mismatched passwords before calling Auth", async () => {
    expect(
      passwordSchema.safeParse({ password: "short", confirmation: "short" })
        .success,
    ).toBe(false);
    await expect(
      savePassword({
        password: "A long passphrase!",
        confirmation: "Another password",
      }),
    ).rejects.toThrow("match");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("changes only the current Auth credential, preserving account IDs and roles", async () => {
    await savePassword(
      { password: "A long passphrase!", confirmation: "A long passphrase!" },
      "123456",
    );
    expect(mock.update).toHaveBeenCalledWith({
      password: "A long passphrase!",
      nonce: "123456",
    });
    expect(mock.otp).not.toHaveBeenCalled();
  });
  it("does not report success when password update is rejected", async () => {
    mock.update.mockResolvedValue({
      error: { code: "reauthentication_needed" },
    });
    await expect(
      savePassword({
        password: "A long passphrase!",
        confirmation: "A long passphrase!",
      }),
    ).rejects.toEqual({ code: "reauthentication_needed" });
  });
  it("restores existing sessions to their destination and routes new students to onboarding", () => {
    expect(authDestination("signin", true, "/admin")).toBe("/admin");
    expect(authDestination("signin", false, "/dashboard")).toBe("/onboarding");
    expect(authDestination("signup", false, "/dashboard")).toBe(
      "/password?next=%2Fonboarding",
    );
    expect(authDestination("recovery", true, "/dashboard")).toBe(
      "/password?next=%2Fdashboard",
    );
  });
});
