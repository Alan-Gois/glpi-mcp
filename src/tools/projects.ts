// ============================================================
// Tools: GLPI project management (Project, ProjectTask, teams, states)
// glpi_project_list, glpi_project_get, glpi_project_create, glpi_project_update,
// glpi_project_task_list, glpi_project_task_create, glpi_project_task_update,
// glpi_project_team_add, glpi_project_states_list
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GlpiClient } from "../services/glpi-client.js";
import { flattenParams } from "../services/query.js";
import { errorResult, IdSchema, jsonResult } from "./_shared.js";

type Row = Record<string, unknown>;

/** Max rows fetched when a filter has to be applied client-side */
const SCAN_LIMIT = 1000;

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/, "Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]");

const PercentSchema = z.number().int().min(0).max(100);

/** Fields shared by projects and tasks: tool name → GLPI column */
const COMMON_FIELDS = {
  name: "name",
  content: "content",
  comment: "comment",
  state_id: "projectstates_id",
  percent_done: "percent_done",
  auto_percent_done: "auto_percent_done",
  plan_start_date: "plan_start_date",
  plan_end_date: "plan_end_date",
  real_start_date: "real_start_date",
  real_end_date: "real_end_date",
  entities_id: "entities_id",
  is_recursive: "is_recursive",
} as const;

const PROJECT_FIELDS = {
  ...COMMON_FIELDS,
  code: "code",
  type_id: "projecttypes_id",
  parent_id: "projects_id",
  manager_user_id: "users_id",
  manager_group_id: "groups_id",
  priority: "priority",
  show_on_global_gantt: "show_on_global_gantt",
} as const;

const TASK_FIELDS = {
  ...COMMON_FIELDS,
  project_id: "projects_id",
  parent_task_id: "projecttasks_id",
  type_id: "projecttasktypes_id",
  is_milestone: "is_milestone",
} as const;

const commonInput = {
  content: z.string().optional().describe("Description (HTML allowed)."),
  comment: z.string().optional(),
  state_id: z.number().int().min(0).optional().describe("ProjectState id (see glpi_project_states_list)."),
  percent_done: PercentSchema.optional(),
  auto_percent_done: z.boolean().optional().describe("Compute % done from the tasks."),
  plan_start_date: DateSchema.optional(),
  plan_end_date: DateSchema.optional(),
  real_start_date: DateSchema.optional(),
  real_end_date: DateSchema.optional(),
  entities_id: z.number().int().min(0).optional(),
  is_recursive: z.boolean().optional(),
};

const projectInput = {
  ...commonInput,
  code: z.string().optional(),
  type_id: z.number().int().min(0).optional().describe("ProjectType id."),
  parent_id: z.number().int().min(0).optional().describe("Parent project id (0 = top level)."),
  manager_user_id: z.number().int().min(0).optional(),
  manager_group_id: z.number().int().min(0).optional(),
  priority: z.number().int().min(1).max(6).optional().describe("1 very low … 5 very high, 6 major."),
  show_on_global_gantt: z.boolean().optional(),
};

const taskInput = {
  ...commonInput,
  parent_task_id: z.number().int().min(0).optional().describe("Parent task id (0 = no parent)."),
  type_id: z.number().int().min(0).optional().describe("ProjectTaskType id."),
  planned_duration_hours: z.number().min(0).optional().describe("Planned duration in hours."),
  is_milestone: z.boolean().optional(),
};

/** Map tool params to GLPI columns (booleans → 0/1, hours → seconds) */
export function toGlpiFields(params: Record<string, unknown>, map: Record<string, string>): Row {
  const out: Row = {};
  for (const [key, column] of Object.entries(map)) {
    const value = params[key];
    if (value === undefined) continue;
    out[column] = typeof value === "boolean" ? (value ? 1 : 0) : value;
  }
  if (typeof params.planned_duration_hours === "number") {
    out.planned_duration = Math.round(params.planned_duration_hours * 3600);
  }
  return out;
}

/**
 * Merge raw rows (ids) with expanded rows (names): a dropdown field keeps its id and gains `<field>_name`.
 * Both lists must come from the same query (same order).
 */
export function mergeExpanded(raw: Row[], expanded: Row[]): Row[] {
  return raw.map((row, i) => {
    const exp = expanded[i] ?? {};
    const out: Row = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value;
      if (key.endsWith("_id") || key.includes("_id_")) {
        if (exp[key] !== undefined && exp[key] !== value) out[`${key}_name`] = exp[key];
      }
    }
    return out;
  });
}

/** Build a task tree from a flat list using projecttasks_id */
export function buildTaskTree(tasks: Row[]): Row[] {
  const byId = new Map<number, Row & { subtasks: Row[] }>();
  for (const t of tasks) byId.set(Number(t.id), { ...t, subtasks: [] });
  const roots: Row[] = [];
  for (const t of byId.values()) {
    const parent = byId.get(Number(t.projecttasks_id));
    if (parent) parent.subtasks.push(t);
    else roots.push(t);
  }
  return roots;
}

const SUMMARY_FIELDS = [
  "id", "name", "code", "projects_id", "projects_id_name", "projectstates_id", "projectstates_id_name",
  "users_id", "users_id_name", "groups_id_name", "priority", "percent_done", "plan_start_date", "plan_end_date",
  "real_start_date", "real_end_date", "projecttasks_id", "projecttasks_id_name", "planned_duration", "is_milestone",
];

const summarize = (row: Row): Row =>
  Object.fromEntries(SUMMARY_FIELDS.filter((f) => row[f] !== undefined && row[f] !== null).map((f) => [f, row[f]]));

async function listMerged(client: GlpiClient, itemtype: string, params: Record<string, unknown>): Promise<{ rows: Row[]; total: number }> {
  const base = { ...params, sort: "id", order: "ASC", get_hateoas: false };
  const [raw, exp] = await Promise.all([
    client.listItems(itemtype, flattenParams({ ...base, expand_dropdowns: false })),
    client.listItems(itemtype, flattenParams({ ...base, expand_dropdowns: true })),
  ]);
  return { rows: mergeExpanded(raw.items, exp.items), total: raw.range?.total ?? raw.items.length };
}

async function subMerged(client: GlpiClient, itemtype: string, id: number, sub: string): Promise<Row[]> {
  const q = { range: `0-${SCAN_LIMIT - 1}`, sort: "id", order: "ASC", get_hateoas: "false" };
  const [raw, exp] = await Promise.all([
    client.getSubItems<Row[]>(itemtype, id, sub, { ...q, expand_dropdowns: "false" }),
    client.getSubItems<Row[]>(itemtype, id, sub, { ...q, expand_dropdowns: "true" }),
  ]);
  return mergeExpanded(Array.isArray(raw) ? raw : [], Array.isArray(exp) ? exp : []);
}

async function getMerged(client: GlpiClient, itemtype: string, id: number): Promise<Row> {
  const [raw, exp] = await Promise.all([
    client.getItem<Row>(itemtype, id, { expand_dropdowns: "false", get_hateoas: "false" }),
    client.getItem<Row>(itemtype, id, { expand_dropdowns: "true", get_hateoas: "false" }),
  ]);
  return mergeExpanded([raw], [exp])[0];
}

const firstId = (result: unknown): unknown =>
  Array.isArray(result) ? (result[0] as Row | undefined)?.id : (result as Row | undefined)?.id;

export function registerProjectTools(server: McpServer, client: GlpiClient): void {
  server.registerTool(
    "glpi_project_list",
    {
      title: "List GLPI Projects",
      description:
        "List projects with state, parent, manager and progress. Filters: name (contains), state_id, parent_id " +
        "(0 = top-level projects only).",
      inputSchema: {
        name: z.string().optional().describe("Text contained in the project name."),
        state_id: z.number().int().min(0).optional(),
        parent_id: z.number().int().min(0).optional(),
        is_deleted: z.boolean().default(false).describe("true to list projects in the trash."),
        start: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(500).default(100),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const filtered = params.state_id !== undefined || params.parent_id !== undefined;
        const { rows, total } = await listMerged(client, "Project", {
          range: filtered ? `0-${SCAN_LIMIT - 1}` : `${params.start}-${params.start + params.limit - 1}`,
          is_deleted: params.is_deleted,
          searchText: params.name ? { name: params.name } : undefined,
        });
        let list = rows;
        if (params.state_id !== undefined) list = list.filter((r) => Number(r.projectstates_id) === params.state_id);
        if (params.parent_id !== undefined) list = list.filter((r) => Number(r.projects_id) === params.parent_id);
        if (filtered) list = list.slice(params.start, params.start + params.limit);
        return jsonResult({
          total: filtered ? undefined : total,
          count: list.length,
          projects: list.map(summarize),
        });
      } catch (err) {
        return errorResult("Error listing projects", err);
      }
    }
  );

  server.registerTool(
    "glpi_project_get",
    {
      title: "Get GLPI Project",
      description: "Get a project with its subprojects, task tree (with task teams) and project team.",
      inputSchema: { id: IdSchema.describe("Project id.") },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        const [project, tasks, team, children, taskTeams] = await Promise.all([
          getMerged(client, "Project", id),
          subMerged(client, "Project", id, "ProjectTask"),
          subMerged(client, "Project", id, "ProjectTeam"),
          listMerged(client, "Project", { range: `0-${SCAN_LIMIT - 1}` }),
          listMerged(client, "ProjectTaskTeam", { range: `0-${SCAN_LIMIT - 1}` }),
        ]);
        const taskIds = new Set(tasks.map((t) => Number(t.id)));
        const membersByTask = new Map<number, Row[]>();
        for (const m of taskTeams.rows) {
          const taskId = Number(m.projecttasks_id);
          if (!taskIds.has(taskId)) continue;
          membersByTask.set(taskId, [...(membersByTask.get(taskId) ?? []), { itemtype: m.itemtype, id: m.items_id, name: m.items_id_name }]);
        }
        const taskRows = tasks.map((t) => ({ ...summarize(t), team: membersByTask.get(Number(t.id)) ?? [] }));
        return jsonResult({
          project: { ...summarize(project), content: project.content, comment: project.comment, is_deleted: project.is_deleted },
          subprojects: children.rows.filter((p) => Number(p.projects_id) === id).map(summarize),
          team: team.map((m) => ({ itemtype: m.itemtype, id: m.items_id, name: m.items_id_name })),
          tasks: buildTaskTree(taskRows),
        });
      } catch (err) {
        return errorResult(`Error getting project ${id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_project_create",
    {
      title: "Create GLPI Project",
      description: "Create a project or a subproject (parent_id). Returns the new id.",
      inputSchema: { name: z.string().min(1), ...projectInput },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (params) => {
      try {
        const result = await client.addItems("Project", toGlpiFields(params, PROJECT_FIELDS));
        return jsonResult({ id: firstId(result), result }, "Project created:");
      } catch (err) {
        return errorResult("Error creating project", err);
      }
    }
  );

  server.registerTool(
    "glpi_project_update",
    {
      title: "Update GLPI Project",
      description: "Update fields of a project (state, dates, progress, parent, manager...).",
      inputSchema: { id: IdSchema, name: z.string().min(1).optional(), ...projectInput },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (params) => {
      try {
        const fields = toGlpiFields(params, PROJECT_FIELDS);
        if (Object.keys(fields).length === 0) return errorResult("Nothing to update", "no fields given");
        return jsonResult(await client.updateItems("Project", [{ id: params.id, ...fields }]), `Project ${params.id} updated:`);
      } catch (err) {
        return errorResult(`Error updating project ${params.id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_project_task_list",
    {
      title: "List GLPI Project Tasks",
      description: "List the tasks of a project as a tree (subtasks nested), with state and progress.",
      inputSchema: {
        project_id: IdSchema,
        flat: z.boolean().default(false).describe("true for a flat list instead of a tree."),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const tasks = (await subMerged(client, "Project", params.project_id, "ProjectTask")).map(summarize);
        return jsonResult({ count: tasks.length, tasks: params.flat ? tasks : buildTaskTree(tasks) });
      } catch (err) {
        return errorResult(`Error listing tasks of project ${params.project_id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_project_task_create",
    {
      title: "Create GLPI Project Task",
      description: "Create a task in a project, optionally as a subtask (parent_task_id). Returns the new id.",
      inputSchema: { project_id: IdSchema, name: z.string().min(1), ...taskInput },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (params) => {
      try {
        const result = await client.addItems("ProjectTask", toGlpiFields(params, TASK_FIELDS));
        return jsonResult({ id: firstId(result), result }, "Project task created:");
      } catch (err) {
        return errorResult("Error creating project task", err);
      }
    }
  );

  server.registerTool(
    "glpi_project_task_update",
    {
      title: "Update GLPI Project Task",
      description: "Update a project task (state, progress, dates, duration, parent...).",
      inputSchema: { id: IdSchema, name: z.string().min(1).optional(), project_id: IdSchema.optional(), ...taskInput },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (params) => {
      try {
        const fields = toGlpiFields(params, TASK_FIELDS);
        if (Object.keys(fields).length === 0) return errorResult("Nothing to update", "no fields given");
        return jsonResult(await client.updateItems("ProjectTask", [{ id: params.id, ...fields }]), `Task ${params.id} updated:`);
      } catch (err) {
        return errorResult(`Error updating project task ${params.id}`, err);
      }
    }
  );

  server.registerTool(
    "glpi_project_team_add",
    {
      title: "Add GLPI Project Team Member",
      description: "Add a user, group, supplier or contact to the team of a project or of a project task.",
      inputSchema: {
        target: z.enum(["project", "task"]),
        target_id: IdSchema.describe("Project id or task id."),
        member_type: z.enum(["User", "Group", "Supplier", "Contact"]),
        member_id: IdSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (params) => {
      try {
        const [itemtype, fk] = params.target === "project" ? ["ProjectTeam", "projects_id"] : ["ProjectTaskTeam", "projecttasks_id"];
        const result = await client.addItems(itemtype, {
          [fk]: params.target_id,
          itemtype: params.member_type,
          items_id: params.member_id,
        });
        return jsonResult(result, `${params.member_type} ${params.member_id} added to ${params.target} ${params.target_id}:`);
      } catch (err) {
        return errorResult("Error adding team member", err);
      }
    }
  );

  server.registerTool(
    "glpi_project_states_list",
    {
      title: "List GLPI Project States and Types",
      description: "List project states (with is_finished) and, optionally, project and task types.",
      inputSchema: { include_types: z.boolean().default(false) },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const q = flattenParams({ range: "0-999", get_hateoas: false });
        const pick = (rows: Row[], f: string[]) => rows.map((r) => Object.fromEntries(f.map((k) => [k, r[k]])));
        const states = await client.listItems("ProjectState", q);
        const out: Row = { states: pick(states.items, ["id", "name", "color", "is_finished"]) };
        if (params.include_types) {
          const [pt, tt] = await Promise.all([client.listItems("ProjectType", q), client.listItems("ProjectTaskType", q)]);
          out.project_types = pick(pt.items, ["id", "name"]);
          out.task_types = pick(tt.items, ["id", "name"]);
        }
        return jsonResult(out);
      } catch (err) {
        return errorResult("Error listing project states", err);
      }
    }
  );
}
