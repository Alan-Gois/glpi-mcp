// ============================================================
// GLPI MCP Server — GLPI REST API Client
// ============================================================

import {
  GlpiConfig,
  GlpiSession,
  GlpiTicket,
  GlpiFollowup,
  GlpiSearchResult,
  GlpiForm,
  GlpiFormQuestion,
  GlpiFormSection,
} from "../types.js";

/** Maximum number of session retry attempts */
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30_000;

interface GlpiV11Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class GlpiClient {
  private config: GlpiConfig;
  private session: GlpiSession | GlpiV11Session | null = null;
  private baseUrl: string;
  private isV11: boolean;

  constructor(config: GlpiConfig) {
    this.config = config;
    this.isV11 = (this.config.apiVersion ?? 10) >= 11;

    // Normalize base URL — remove trailing slash
    const cleanUrl = config.url.replace(/\/+$/, "");

    if (this.isV11) {
      this.baseUrl = cleanUrl.includes("/api.php")
        ? cleanUrl
        : `${cleanUrl}/api.php`;
    } else {
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
    if (this.isV11) {
      await this.initV11Session();
    } else {
      await this.initLegacySession();
    }
  }

  private async initV11Session(): Promise<void> {
    if (
      !this.config.username ||
      !this.config.password ||
      !this.config.oauthClientId ||
      !this.config.oauthSecret
    ) {
      throw new Error(
        "GLPI v11 authentication requires GLPI_USERNAME, GLPI_PASSWORD, GLPI_OAUTH_CLIENT_ID, and GLPI_OAUTH_CLIENT_SECRET"
      );
    }

    const credentials = Buffer.from(
      `${this.config.oauthClientId}:${this.config.oauthSecret}`
    ).toString("base64");
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    };
    if (this.config.appToken) {
      headers["App-Token"] = this.config.appToken;
    }

    const body = new URLSearchParams({
      grant_type: "password",
      username: this.config.username,
      password: this.config.password,
      scope: "api",
    });

    const response = await this.fetchWithTimeout(`${this.baseUrl}/token`, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GLPI v11 auth failed (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    this.session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s buffer
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
        "GLPI legacy authentication requires either GLPI_USER_TOKEN or GLPI_USERNAME + GLPI_PASSWORD"
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
    return this.isV11
      ? (this.session as GlpiV11Session).accessToken
      : (this.session as GlpiSession).sessionToken;
  }

  /** Kill the current session */
  async killSession(): Promise<void> {
    if (!this.session) return;
    try {
      if (this.isV11) {
        // v11 uses /killSession, but it requires a POST with refresh_token
        // For simplicity, we just clear the local session. Re-auth will occur on next call.
      } else {
        const headers = this.buildHeaders((this.session as GlpiSession).sessionToken);
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

  private _resolveItemPath(itemtype: string, id?: number, subItemtype?: string): string {
    if (!this.isV11) {
      const encodedType = encodeURIComponent(itemtype);
      let path = `/${encodedType}`;
      if (id) path += `/${id}`;
      if (subItemtype) path += `/${encodeURIComponent(subItemtype)}`;
      return path;
    }

    // GLPI 11 Path Resolution
    const V11_PREFIX_MAP: Record<string, string> = {
      Ticket: "Assistance",
      Change: "Assistance",
      Problem: "Assistance",
      Default: "Assets", // Default for hardware, software, etc.
    };
    
    // Handle special cases
    if (itemtype.startsWith("Glpi\\")) { // Native Forms, etc.
      return `/${itemtype.replace(/\\/g, "/")}${id ? `/${id}` : ""}`;
    }

    const mainType = itemtype.split("/")[0];
    const prefix = V11_PREFIX_MAP[mainType] || V11_PREFIX_MAP.Default;

    let path = `/${prefix}/${itemtype}`;
    if (id) path += `/${id}`;
    if (subItemtype) path += `/${subItemtype}`; // Sub-items can be complex (e.g., Timeline/Followup)

    return path;
  }

  private buildHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.isV11) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      headers["Session-Token"] = token;
    }
    if (this.config.appToken) {
      headers["App-Token"] = this.config.appToken;
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

        // Handle 204 No Content
        if (response.status === 204) {
          return {} as T;
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

  // ----------------------------------------------------------
  // Item Operations (CRUD)
  // ----------------------------------------------------------

  /** Get a single item by type and ID */
  async getItem<T = Record<string, unknown>>(
    itemtype: string,
    id: number,
    params?: Record<string, string>
  ): Promise<T> {
    const path = this._resolveItemPath(itemtype, id);
    return this.request<T>("GET", path, undefined, params);
  }

  /** Get all items of a type with optional query params */
  async getItems<T = Record<string, unknown>[]>(
    itemtype: string,
    params?: Record<string, string>
  ): Promise<T> {
    const path = this._resolveItemPath(itemtype);
    return this.request<T>("GET", path, undefined, params);
  }

  /** Get sub-items (e.g. followups of a ticket) */
  async getSubItems<T = Record<string, unknown>[]>(
    itemtype: string,
    id: number,
    subItemtype: string,
    params?: Record<string, string>
  ): Promise<T> {
    const path = this._resolveItemPath(itemtype, id, subItemtype);
    return this.request<T>("GET", path, undefined, params);
  }

  /** Create a new item */
  async createItem<T = Record<string, unknown>>(
    itemtype: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const path = this._resolveItemPath(itemtype);
    const payload = this.isV11 ? data : { input: data };
    return this.request<T>("POST", path, payload);
  }

  /** Update an existing item */
  async updateItem<T = Record<string, unknown>>(
    itemtype: string,
    id: number,
    data: Record<string, unknown>
  ): Promise<T> {
    const path = this._resolveItemPath(itemtype, id);
    const payload = this.isV11 ? data : { input: data };
    return this.request<T>("PUT", path, payload);
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
    const path = this.isV11 ? this._resolveItemPath(itemtype) : `/search/${itemtype}`;
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
      sort: this.isV11 ? "date_mod" : "15", // 15 is date_mod in legacy
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
    });
  }

  /** Get followups for a ticket */
  async getTicketFollowups(ticketId: number): Promise<GlpiFollowup[]> {
    const subItemType = this.isV11 ? "Timeline/Followup" : "ITILFollowup";
    return this.getSubItems<GlpiFollowup[]>(
      "Ticket",
      ticketId,
      subItemType
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
    const itemType = this.isV11 ? `Ticket/${ticketId}/Followup` : "ITILFollowup";
    const payload: Record<string, unknown> = {
      content,
      is_private: isPrivate ? 1 : 0,
    };
    if (!this.isV11) {
      payload.items_id = ticketId;
      payload.itemtype = "Ticket";
    }

    return this.createItem<{ id: number; message: string }>(itemType, payload);
  }

  /** Add a solution to a ticket */
  async addSolution(
    ticketId: number,
    content: string,
    solutiontypes_id?: number
  ): Promise<{ id: number; message: string }> {
    const itemType = this.isV11 ? "TicketSolution" : "ITILSolution";
    const payload: Record<string, unknown> = {
      content,
    };
    if (this.isV11) {
      payload.itemtype = "Ticket";
      payload.items_id = ticketId;
    } else {
      payload.items_id = ticketId;
      payload.itemtype = "Ticket";
    }
    if (solutiontypes_id) payload.solutiontypes_id = solutiontypes_id;

    return this.createItem<{ id: number; message: string }>(
      itemType,
      payload
    );
  }

  /** Update a ticket's fields */
  async updateTicket(
    id: number,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.updateItem<Record<string, unknown>>("Ticket", id, data);
  }

  /** Add a task to a ticket */
  async addTask(
    ticketId: number,
    content: string,
    options?: {
      is_private?: boolean;
      state?: number;        // 0=Info, 1=To do, 2=Done
      actiontime?: number;   // Duration in seconds
      users_id_tech?: number;
      groups_id_tech?: number;
      begin?: string;        // Plan start: "YYYY-MM-DD HH:MM:SS"
      end?: string;          // Plan end: "YYYY-MM-DD HH:MM:SS"
    }
  ): Promise<{ id: number; message: string }> {
    const itemType = this.isV11 ? `Ticket/${ticketId}/Task` : "TicketTask";
    const payload: Record<string, unknown> = {
      content,
      is_private: options?.is_private ? 1 : 0,
      state: options?.state ?? 1,
    };
    if (!this.isV11) {
      payload.tickets_id = ticketId;
    }
    if (options?.actiontime) payload.actiontime = options.actiontime;
    if (options?.users_id_tech) payload.users_id_tech = options.users_id_tech;
    if (options?.groups_id_tech) payload.groups_id_tech = options.groups_id_tech;
    if (options?.begin) payload.begin = options.begin;
    if (options?.end) payload.end = options.end;

    return this.createItem<{ id: number; message: string }>(
      itemType,
      payload
    );
  }

  /** Get tasks for a ticket */
  async getTicketTasks(
    ticketId: number
  ): Promise<Array<Record<string, unknown>>> {
    const subItemType = this.isV11 ? "Task" : "TicketTask";
    return this.getSubItems<Array<Record<string, unknown>>>(
      "Ticket",
      ticketId,
      subItemType
    );
  }

  /** Create a change request */
  async createChange(data: {
    name: string;
    content: string;
    priority?: number;
    urgency?: number;
    impact?: number;
    entities_id?: number;
  }): Promise<{ id: number; message: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      content: data.content,
      priority: data.priority ?? 3,
      urgency: data.urgency ?? 3,
      impact: data.impact ?? 3,
    };
    if (data.entities_id) payload.entities_id = data.entities_id;

    return this.createItem<{ id: number; message: string }>("Change", payload);
  }

  /** Create a problem */
  async createProblem(data: {
    name: string;
    content: string;
    priority?: number;
    urgency?: number;
    impact?: number;
    entities_id?: number;
  }): Promise<{ id: number; message: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      content: data.content,
      priority: data.priority ?? 3,
      urgency: data.urgency ?? 3,
      impact: data.impact ?? 3,
    };
    if (data.entities_id) payload.entities_id = data.entities_id;

    return this.createItem<{ id: number; message: string }>("Problem", payload);
  }

  // ----------------------------------------------------------
  // Validation Operations
  // ----------------------------------------------------------

  /** Request validation for a ticket */
  async createValidation(
    ticketId: number,
    validatorId: number,
    comment?: string
  ): Promise<{ id: number; message: string }> {
    const itemType = this.isV11 ? "TicketValidation" : "TicketValidation"; // Same for both
    const payload: Record<string, unknown> = {
      items_id: ticketId,
      itemtype: "Ticket",
      users_id_validate: validatorId,
    };
    if (this.isV11) {
      delete payload.itemtype; // Not needed in v11 payload
    }
    if (comment) payload.comment_submission = comment;

    return this.createItem<{ id: number; message: string }>(
      itemType,
      payload
    );
  }

  /** Update an existing validation (Approve/Refuse) */
  async updateValidation(
    validationId: number,
    status: number, // 2-Approve, 3-Refuse
    comment?: string
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      status,
    };
    if (comment) payload.comment_validation = comment;

    return this.updateItem<Record<string, unknown>>(
      "TicketValidation",
      validationId,
      payload
    );
  }

  /** Get all validations for a specific ticket */
  async getValidations(
    ticketId: number
  ): Promise<Array<Record<string, unknown>>> {
    return this.getSubItems<Array<Record<string, unknown>>>(
      "Ticket",
      ticketId,
      "TicketValidation"
    );
  }

  // ----------------------------------------------------------
  // Native Form Operations (GLPI 11+)
  // ----------------------------------------------------------

  /** List active forms in the service catalog */
  async listForms(params?: Record<string, string>): Promise<GlpiForm[]> {
    if (!this.isV11) {
      console.warn("listForms is only available for GLPI 11+.");
      return [];
    }
    const defaultParams = {
      is_active: "1",
      range: "0-50",
      ...params,
    };
    return this.getItems<GlpiForm[]>("Glpi\\Form\\Form", defaultParams);
  }

  /** Get full details of a form including sections and questions */
  async getFormDetails(formId: number): Promise<{
    form: GlpiForm;
    sections: GlpiFormSection[];
    questions: GlpiFormQuestion[];
  }> {
    if (!this.isV11) {
      throw new Error("getFormDetails is only available for GLPI 11+.");
    }
    const form = await this.getItem<GlpiForm>("Glpi\\Form\\Form", formId);

    const questions = await this.getItems<GlpiFormQuestion[]>("Glpi\\Form\\Question", {
      is_active: "1",
      range: "0-200", // Get all questions for the form
      "criteria[0][field]": "forms_id",
      "criteria[0][searchtype]": "equals",
      "criteria[0][value]": String(formId),
    });

    const sections = await this.getItems<GlpiFormSection[]>("Glpi\\Form\\Section", {
      is_active: "1",
      range: "0-100",
      "criteria[0][field]": "forms_id",
      "criteria[0][searchtype]": "equals",
      "criteria[0][value]": String(formId),
    });

    return {
      form,
      sections: sections || [],
      questions: questions || [],
    };
  }

  /** Submit answers for a native form (GLPI 11+) */
  async submitForm(formId: number, answers: Array<{ questions_id: number; value: unknown }>): Promise<{ id: number; message: string }> {
    if (!this.isV11) {
      throw new Error("submitForm is only available for GLPI 11+.");
    }
    const payload = {
      forms_id: formId,
      _answers: answers
    };

    return this.createItem<{ id: number; message: string }>("Glpi\\Form\\AnswersSet", payload);
  }
}
