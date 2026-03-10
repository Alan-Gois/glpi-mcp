// ============================================================
// GLPI MCP Server — GLPI REST API Client (v10 Legacy API)
// ============================================================

import {
  GlpiConfig,
  GlpiSession,
  GlpiTicket,
  GlpiFollowup,
  GlpiSearchResult,
} from "../types.js";

/** Maximum number of session retry attempts */
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30_000;

export class GlpiClient {
  private config: GlpiConfig;
  private session: GlpiSession | null = null;
  private baseUrl: string;

  constructor(config: GlpiConfig) {
    this.config = config;
    // Normalize base URL — remove trailing slash
    const cleanUrl = config.url.replace(/\/+$/, "");

    if (this.config.apiVersion === 11) {
      // HLAPI uses /api (or specific route mapped in the server like /api.php)
      if (cleanUrl.includes("/api.php") || cleanUrl.endsWith("/api")) {
        this.baseUrl = cleanUrl;
      } else {
        this.baseUrl = `${cleanUrl}/api.php`;
      }
    } else {
      // Legacy REST uses /apirest.php
      this.baseUrl = cleanUrl.includes("/apirest.php")
        ? cleanUrl
        : `${cleanUrl}/apirest.php`;
    }
  }

  // ----------------------------------------------------------
  // Authentication
  // ----------------------------------------------------------

  /** Initialize a session with the GLPI API */
  async initSession(): Promise<void> {
    if (this.config.apiVersion === 11) {
      await this.initOAuthSession();
    } else {
      await this.initLegacySession();
    }
  }

  private async initOAuthSession(): Promise<void> {
    const url = `${this.baseUrl}/token`;

    const body = new URLSearchParams();

    if (this.config.username && this.config.password) {
      body.append("grant_type", "password");
      body.append("username", this.config.username);
      body.append("password", this.config.password);
      body.append("scope", "api");
    } else {
      body.append("grant_type", "client_credentials");
    }

    body.append("client_id", this.config.oauthClientId || "");
    body.append("client_secret", this.config.oauthSecret || "");

    const credentials = Buffer.from(
      `${this.config.oauthClientId}:${this.config.oauthSecret}`
    ).toString("base64");

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GLPI OAuth2 failed (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as { access_token: string; expires_in?: number };
    this.session = {
      sessionToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 30 * 60 * 1000),
    };
  }

  private async initLegacySession(): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.appToken) {
      headers["App-Token"] = this.config.appToken;
    }

    if (this.config.userToken) {
      headers["Authorization"] = `user_token ${this.config.userToken}`;
    } else if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    } else {
      throw new Error(
        "GLPI authentication requires either GLPI_USER_TOKEN or GLPI_USERNAME + GLPI_PASSWORD"
      );
    }

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/initSession`,
      { method: "GET", headers }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GLPI initSession failed (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as { session_token: string };
    this.session = {
      sessionToken: data.session_token,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min conservative TTL
    };
  }

  /** Ensure we have a valid session, re-init if needed */
  private async ensureSession(): Promise<string> {
    if (
      !this.session ||
      (this.session.expiresAt && Date.now() > this.session.expiresAt)
    ) {
      await this.initSession();
    }
    return this.session!.sessionToken;
  }

  /** Kill the current session */
  async killSession(): Promise<void> {
    if (!this.session) return;
    try {
      if (this.config.apiVersion === 10) {
        const headers = this.buildHeaders(this.session.sessionToken);
        await this.fetchWithTimeout(`${this.baseUrl}/killSession`, {
          method: "GET",
          headers,
        });
      }
    } catch {
      // Ignore errors on kill
    }
    this.session = null;
  }

  // ----------------------------------------------------------
  // Core HTTP helpers
  // ----------------------------------------------------------

  private buildHeaders(sessionToken: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.config.apiVersion === 11) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    } else {
      headers["Session-Token"] = sessionToken;
      if (this.config.appToken) {
        headers["App-Token"] = this.config.appToken;
      }
    }
    return headers;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Execute an authenticated API request with auto-retry on session expiry */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const token = await this.ensureSession();
        const headers = this.buildHeaders(token);

        let url = `${this.baseUrl}${path}`;
        if (queryParams) {
          const qs = new URLSearchParams(queryParams).toString();
          url += `?${qs}`;
        }

        const init: RequestInit = { method, headers };
        if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
          init.body = JSON.stringify(body);
          (init.headers as Record<string, string>)["Content-Type"] = "application/json";
        }

        const response = await this.fetchWithTimeout(url, init);

        // Session expired — force re-init and retry
        if (response.status === 401) {
          this.session = null;
          lastError = new Error("Session expired");
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `GLPI API error ${response.status} on ${method} ${path}: ${errorBody}`
          );
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES && lastError.message.includes("Session expired")) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error("Unexpected error in GLPI request");
  }

  private resolvePath(itemtype: string, id?: number): string {
    if (this.config.apiVersion === 10) {
      return id ? `/${itemtype}/${id}` : `/${itemtype}`;
    }

    // GLPI 11 HLAPI Routing
    let prefix = "";
    if (["Ticket", "Problem", "Change", "RecurringTicket"].includes(itemtype)) {
      prefix = "/Assistance";
    } else if (
      [
        "Computer",
        "Monitor",
        "NetworkEquipment",
        "Peripheral",
        "Phone",
        "Printer",
        "Software",
        "SoftwareLicense",
        "Certificate",
        "Unmanaged",
        "Appliance",
      ].includes(itemtype)
    ) {
      prefix = "/Assets";
    }

    const path = `${prefix}/${itemtype}`;
    return id ? `${path}/${id}` : path;
  }

  private resolveSubitemPath(
    itemtype: string,
    id: number,
    subItemtype: string,
    subItemId?: number
  ): string {
    if (this.config.apiVersion === 10) {
      return subItemId
        ? `/${itemtype}/${id}/${subItemtype}/${subItemId}`
        : `/${itemtype}/${id}/${subItemtype}`;
    }

    // GLPI 11 HLAPI Subitem Routing
    const basePath = this.resolvePath(itemtype, id);
    let subPath = subItemtype;

    if (itemtype === "Ticket" && (subItemtype === "ITILFollowup" || subItemtype === "Followup")) {
      subPath = "Timeline/Followup";
    }

    return subItemId ? `${basePath}/${subPath}/${subItemId}` : `${basePath}/${subPath}`;
  }

  // ----------------------------------------------------------
  // Item Operations (CRUD)
  // ----------------------------------------------------------

  /** Get a single item by type and ID */
  async getItem<T = Record<string, unknown>>(
    itemtype: string,
    id: number,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("GET", this.resolvePath(itemtype, id), undefined, params);
  }

  /** Get all items of a type with optional query params */
  async getItems<T = Record<string, unknown>[]>(
    itemtype: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("GET", this.resolvePath(itemtype), undefined, params);
  }

  /** Get sub-items (e.g. followups of a ticket) */
  async getSubItems<T = Record<string, unknown>[]>(
    itemtype: string,
    id: number,
    subItemtype: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(
      "GET",
      this.resolveSubitemPath(itemtype, id, subItemtype),
      undefined,
      params
    );
  }

  /** Create a new item */
  async createItem<T = Record<string, unknown>>(
    itemtype: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const body = this.config.apiVersion === 11 ? data : { input: data };
    return this.request<T>("POST", this.resolvePath(itemtype), body);
  }

  /** Update an existing item */
  async updateItem<T = Record<string, unknown>>(
    itemtype: string,
    id: number,
    data: Record<string, unknown>
  ): Promise<T> {
    const body = this.config.apiVersion === 11 ? data : { input: data };
    return this.request<T>("PUT", this.resolvePath(itemtype, id), body);
  }

  /** Create a sub-item (e.g. followup for a ticket) */
  async createSubItem<T = Record<string, unknown>>(
    itemtype: string,
    id: number,
    subItemtype: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const body = this.config.apiVersion === 11 ? data : { input: data };
    return this.request<T>(
      "POST",
      this.resolveSubitemPath(itemtype, id, subItemtype),
      body
    );
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  /** Execute a search query on an itemtype */
  async search(
    itemtype: string,
    criteria: Array<{
      field: number;
      searchtype: string;
      value: string;
      link?: string;
    }>,
    params?: Record<string, string>
  ): Promise<GlpiSearchResult> {
    const queryParams: Record<string, string> = { ...params };

    // Encode criteria as query parameters
    criteria.forEach((c, i) => {
      queryParams[`criteria[${i}][field]`] = String(c.field);
      queryParams[`criteria[${i}][searchtype]`] = c.searchtype;
      queryParams[`criteria[${i}][value]`] = c.value;
      if (c.link && i > 0) {
        queryParams[`criteria[${i}][link]`] = c.link;
      }
    });

    const path = this.config.apiVersion === 11
      ? this.resolvePath(itemtype) // In HLAPI searching is often on the resource itself
      : `/search/${itemtype}`;

    return this.request<GlpiSearchResult>(
      "GET",
      path,
      undefined,
      queryParams
    );
  }

  // ----------------------------------------------------------
  // Convenience Methods
  // ----------------------------------------------------------

  /** List tickets with optional status filter */
  async listTickets(
    statusFilter?: number,
    limit: number = 25
  ): Promise<GlpiTicket[]> {
    const params: Record<string, string> = {
      range: `0-${limit - 1}`,
      order: "DESC",
      sort: "date_mod",
      expand_dropdowns: "true",
    };

    if (statusFilter !== undefined) {
      // Use search API for filtered results
      const result = await this.search(
        "Ticket",
        [{ field: 12, searchtype: "equals", value: String(statusFilter) }],
        { range: `0-${limit - 1}`, forcedisplay: "1,2,12,15,7,3" }
      );
      return (result.data ?? []) as unknown as GlpiTicket[];
    }

    // All non-closed tickets
    return this.getItems<GlpiTicket[]>("Ticket", params);
  }

  /** Get a ticket with full details */
  async getTicket(id: number): Promise<GlpiTicket> {
    return this.getItem<GlpiTicket>("Ticket", id, {
      expand_dropdowns: "true",
      with_logs: "false",
    });
  }

  /** Get followups for a ticket */
  async getTicketFollowups(ticketId: number): Promise<GlpiFollowup[]> {
    return this.getSubItems<GlpiFollowup[]>(
      "Ticket",
      ticketId,
      "ITILFollowup"
    );
  }

  /** Create a ticket */
  async createTicket(data: {
    name: string;
    content: string;
    type?: number;
    priority?: number;
    urgency?: number;
    itilcategories_id?: number;
    entities_id?: number;
  }): Promise<{ id: number; message: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      content: data.content,
      type: data.type ?? 1, // Incident by default
      priority: data.priority ?? 3, // Medium by default
      urgency: data.urgency ?? 3,
    };

    if (data.itilcategories_id) payload.itilcategories_id = data.itilcategories_id;
    if (data.entities_id) payload.entities_id = data.entities_id;

    const result = await this.createItem<{ id: number; message: string }>(
      "Ticket",
      payload
    );
    return result;
  }

  /** Add a followup to a ticket */
  async addFollowup(
    ticketId: number,
    content: string,
    isPrivate: boolean = false
  ): Promise<{ id: number; message: string }> {
    const payload = {
      content,
      is_private: isPrivate ? 1 : 0,
    };

    if (this.config.apiVersion === 11) {
      return this.createSubItem<{ id: number; message: string }>(
        "Ticket",
        ticketId,
        "Followup",
        payload
      );
    }

    return this.createItem<{ id: number; message: string }>("ITILFollowup", {
      ...payload,
      items_id: ticketId,
      itemtype: "Ticket",
    });
  }
}
