import { IMeliClient, MeliQuestionDTO, MeliClaimDTO } from "../../application/interfaces/IMeliClient.js";
import { ITenantRepository } from "../../application/interfaces/ITenantRepository.js";
import { Item } from "../../domain/entities/Item.js";

const API_BASE = "https://api.mercadolibre.com";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export class MeliApiClient implements IMeliClient {
  private refreshPromises: Map<string, Promise<string>> = new Map();

  constructor(private readonly tenantRepo: ITenantRepository) {}

  private async getValidToken(sellerId: string): Promise<string> {
    const tenant = await this.tenantRepo.findBySellerId(sellerId);
    if (!tenant) {
      throw new Error(`No se encontró cuenta para el vendedor ${sellerId}. Conectá la cuenta vía OAuth.`);
    }

    if (!tenant.isTokenExpiringSoon(10 * 60 * 1000)) {
      return tenant.accessToken;
    }

    // Mutex de refresco por sellerId
    if (!this.refreshPromises.has(sellerId)) {
      const promise = this.refreshTokens(tenant.refreshToken)
        .then(async (tokens) => {
          tenant.updateTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
          await this.tenantRepo.save(tenant);
          return tokens.access_token;
        })
        .finally(() => {
          this.refreshPromises.delete(sellerId);
        });

      this.refreshPromises.set(sellerId, promise);
    }

    return this.refreshPromises.get(sellerId)!;
  }

  private async meliFetch<T = any>(sellerId: string, pathname: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getValidToken(sellerId);
    const res = await fetch(`${API_BASE}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`MELI API ${res.status} en ${pathname}: ${errText}`);
      (err as any).status = res.status;
      throw err;
    }

    return res.json() as Promise<T>;
  }

  public async getQuestion(sellerId: string, questionId: string): Promise<MeliQuestionDTO> {
    return this.meliFetch<MeliQuestionDTO>(sellerId, `/questions/${questionId}`);
  }

  public async getItem(sellerId: string, itemId: string): Promise<Item> {
    const [itemData, descriptionData] = await Promise.all([
      this.meliFetch<any>(sellerId, `/items/${itemId}`),
      this.meliFetch<any>(sellerId, `/items/${itemId}/description`).catch(() => ({ plain_text: "" })),
    ]);

    return new Item({
      id: itemData.id,
      sellerId: String(itemData.seller_id || sellerId),
      title: itemData.title,
      price: itemData.price,
      currencyId: itemData.currency_id,
      availableQuantity: itemData.available_quantity,
      condition: itemData.condition,
      attributes: itemData.attributes || [],
      descriptionText: descriptionData.plain_text || "",
      permalink: itemData.permalink,
      cachedAt: Date.now(),
    });
  }

  public async postAnswer(sellerId: string, questionId: string, text: string): Promise<void> {
    await this.meliFetch(sellerId, "/answers", {
      method: "POST",
      body: JSON.stringify({ question_id: Number(questionId), text }),
    });
  }

  public async getReceivedQuestions(sellerId: string): Promise<MeliQuestionDTO[]> {
    const data = await this.meliFetch<{ questions: MeliQuestionDTO[] }>(
      sellerId,
      "/my/received_questions/search?api_version=4"
    );
    return data.questions || [];
  }

  public async getSellerProfile(
    sellerId: string,
    accessToken?: string
  ): Promise<{ id: number; nickname: string; email?: string; permalink?: string }> {
    const token = accessToken || (await this.getValidToken(sellerId));
    const res = await fetch(`${API_BASE}/users/${sellerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // Si falla, retornar nickname por defecto sin romper el flujo
      return { id: Number(sellerId), nickname: `Vendedor_${sellerId}` };
    }

    const data = await res.json();
    return {
      id: data.id,
      nickname: data.nickname || `Vendedor_${sellerId}`,
      email: data.email,
      permalink: data.permalink,
    };
  }

  public async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ML_CLIENT_ID || "",
      client_secret: process.env.ML_CLIENT_SECRET || "",
      code,
      redirect_uri: process.env.ML_REDIRECT_URI || "",
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error intercambiando code OAuth: ${res.status} ${errText}`);
    }

    return res.json();
  }

  public async getClaim(sellerId: string, claimId: string): Promise<MeliClaimDTO> {
    return this.meliFetch<MeliClaimDTO>(sellerId, `/post-purchase/v1/claims/${claimId}`);
  }

  public async refreshTokens(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID || "",
      client_secret: process.env.ML_CLIENT_SECRET || "",
      refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error refrescando token de MELI: ${res.status} ${errText}`);
    }

    return res.json();
  }
}
