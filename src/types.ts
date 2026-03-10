// ============================================================
// GLPI MCP Server — Type Definitions
// ============================================================

/** Configuration for connecting to a GLPI instance */
export interface GlpiConfig {
  /** Base URL of the GLPI instance (e.g. https://glpi.example.com) */
  url: string;
  /** API version to use (10 for legacy REST, 11 for HLAPI) */
  apiVersion: number;
  /** App-Token for API client identification (optional in some setups) */
  appToken?: string;
  /** User token for authentication (v10 legacy) */
  userToken?: string;
  /** Username for authentication (v10 legacy) */
  username?: string;
  /** Password for authentication (v10 legacy) */
  password?: string;
  /** OAuth2 Client ID for GLPI 11 HLAPI */
  oauthClientId?: string;
  /** OAuth2 Client Secret for GLPI 11 HLAPI */
  oauthSecret?: string;
}

/** Active session state */
export interface GlpiSession {
  sessionToken: string;
  expiresAt?: number;
}

/** GLPI Ticket status codes */
export enum TicketStatus {
  NEW = 1,
  ASSIGNED = 2,
  PLANNED = 3,
  WAITING = 4,
  SOLVED = 5,
  CLOSED = 6,
}

/** Human-readable status labels */
export const TICKET_STATUS_LABELS: Record<number, string> = {
  [TicketStatus.NEW]: "Novo",
  [TicketStatus.ASSIGNED]: "Atribuído",
  [TicketStatus.PLANNED]: "Planejado",
  [TicketStatus.WAITING]: "Aguardando",
  [TicketStatus.SOLVED]: "Solucionado",
  [TicketStatus.CLOSED]: "Fechado",
};

/** GLPI Ticket priority codes */
export enum TicketPriority {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
  CRITICAL = 6,
}

export const TICKET_PRIORITY_LABELS: Record<number, string> = {
  [TicketPriority.VERY_LOW]: "Muito Baixa",
  [TicketPriority.LOW]: "Baixa",
  [TicketPriority.MEDIUM]: "Média",
  [TicketPriority.HIGH]: "Alta",
  [TicketPriority.VERY_HIGH]: "Muito Alta",
  [TicketPriority.CRITICAL]: "Crítica",
};

/** GLPI Ticket type */
export enum TicketType {
  INCIDENT = 1,
  REQUEST = 2,
}

export const TICKET_TYPE_LABELS: Record<number, string> = {
  [TicketType.INCIDENT]: "Incidente",
  [TicketType.REQUEST]: "Requisição",
};

/** Raw ticket data from GLPI API */
export interface GlpiTicket {
  id: number;
  name: string;
  content: string;
  status: number;
  priority: number;
  type: number;
  date_creation: string;
  date_mod: string;
  solvedate: string | null;
  closedate: string | null;
  entities_id: number;
  users_id_recipient: number;
  users_id_lastupdater: number;
  urgency: number;
  impact: number;
  itilcategories_id: number;
  [key: string]: unknown;
}

/** Raw followup data from GLPI API */
export interface GlpiFollowup {
  id: number;
  items_id: number;
  itemtype: string;
  content: string;
  date_creation: string;
  date_mod: string;
  users_id: number;
  is_private: number;
  [key: string]: unknown;
}

/** GLPI search result structure */
export interface GlpiSearchResult {
  totalcount: number;
  count: number;
  sort: number;
  order: string;
  data: Array<Record<string, unknown>>;
  content_range: string;
}

/** Error response from GLPI API */
export interface GlpiApiError {
  error: string;
  message: string;
}

/** Status name to code mapping for user-friendly input */
export const STATUS_NAME_MAP: Record<string, number> = {
  new: TicketStatus.NEW,
  assigned: TicketStatus.ASSIGNED,
  planned: TicketStatus.PLANNED,
  waiting: TicketStatus.WAITING,
  solved: TicketStatus.SOLVED,
  closed: TicketStatus.CLOSED,
};

/** Priority name to code mapping */
export const PRIORITY_NAME_MAP: Record<string, number> = {
  very_low: TicketPriority.VERY_LOW,
  low: TicketPriority.LOW,
  medium: TicketPriority.MEDIUM,
  high: TicketPriority.HIGH,
  very_high: TicketPriority.VERY_HIGH,
  critical: TicketPriority.CRITICAL,
};
