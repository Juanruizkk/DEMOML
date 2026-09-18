import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaWhatsAppClient } from "../infrastructure/whatsapp/MetaWhatsAppClient.js";

describe("MetaWhatsAppClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "",
    } as Response);
    process.env.META_WA_PHONE_NUMBER_ID = "DEFAULT_PHONE_ID";
    process.env.META_WA_ACCESS_TOKEN = "DEFAULT_TOKEN";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.META_WA_PHONE_NUMBER_ID;
    delete process.env.META_WA_ACCESS_TOKEN;
  });

  it("uses env credentials when no override provided", async () => {
    const client = new MetaWhatsAppClient();
    await client.sendTextMessage({ to: "+5491100000000", text: "hola" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("DEFAULT_PHONE_ID");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer DEFAULT_TOKEN");
  });

  it("uses BYO credentials when override provided", async () => {
    const client = new MetaWhatsAppClient();
    await client.sendTextMessage({
      to: "+5491100000000",
      text: "hola BYO",
      credentials: { phoneNumberId: "BYO_PHONE_ID", accessToken: "BYO_TOKEN" },
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("BYO_PHONE_ID");
    expect(url).not.toContain("DEFAULT_PHONE_ID");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer BYO_TOKEN");
  });

  it("skips send and warns when not configured (no env vars)", async () => {
    delete process.env.META_WA_PHONE_NUMBER_ID;
    delete process.env.META_WA_ACCESS_TOKEN;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = new MetaWhatsAppClient();
    await client.sendTextMessage({ to: "+5491100000000", text: "test" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("sends interactive buttons with correct payload structure", async () => {
    const client = new MetaWhatsAppClient();
    await client.sendInteractiveButtons({
      to: "+5491100000000",
      bodyText: "¿Aprobás?",
      buttons: [{ id: "approve_123", title: "✅ Aprobar" }],
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.type).toBe("interactive");
    expect(body.interactive.action.buttons[0].reply.id).toBe("approve_123");
  });
});
