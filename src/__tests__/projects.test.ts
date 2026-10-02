import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GlpiClient } from '../services/glpi-client';
import { buildTaskTree, mergeExpanded, registerProjectTools, toGlpiFields } from '../tools/projects';

describe('project helpers', () => {
    it('maps tool params to GLPI columns', () => {
        expect(toGlpiFields(
            { name: 'P', parent_id: 3, state_id: 5, auto_percent_done: true, planned_duration_hours: 1.5, ignored: 'x' },
            { name: 'name', parent_id: 'projects_id', state_id: 'projectstates_id', auto_percent_done: 'auto_percent_done' }
        )).toEqual({ name: 'P', projects_id: 3, projectstates_id: 5, auto_percent_done: 1, planned_duration: 5400 });
    });

    it('keeps ids and adds names of dropdown fields', () => {
        expect(mergeExpanded(
            [{ id: 1, name: 'A', projectstates_id: 5, users_id_tech: 2, percent_done: 10 }],
            [{ id: 1, name: 'A', projectstates_id: 'Em Andamento', users_id_tech: 'joao', percent_done: 10 }]
        )).toEqual([{
            id: 1, name: 'A', projectstates_id: 5, projectstates_id_name: 'Em Andamento',
            users_id_tech: 2, users_id_tech_name: 'joao', percent_done: 10,
        }]);
    });

    it('nests subtasks under their parent', () => {
        const tree = buildTaskTree([
            { id: 1, projecttasks_id: 0 }, { id: 2, projecttasks_id: 1 }, { id: 3, projecttasks_id: 2 }, { id: 4, projecttasks_id: 99 },
        ]);
        expect(tree.map((t) => t.id)).toEqual([1, 4]);
        expect((tree[0] as any).subtasks[0].id).toBe(2);
        expect((tree[0] as any).subtasks[0].subtasks[0].id).toBe(3);
    });
});

describe('project tools', () => {
    let tools: Record<string, Function>;
    let client: jest.Mocked<GlpiClient>;

    beforeEach(() => {
        tools = {};
        const server = {
            registerTool: jest.fn((name: string, _c: unknown, cb: Function) => { tools[name] = cb; }),
        } as unknown as McpServer;
        client = {
            addItems: jest.fn().mockResolvedValue({ id: 77, message: 'ok' }),
            updateItems: jest.fn().mockResolvedValue([{ 77: true }]),
            listItems: jest.fn(),
            getItem: jest.fn(),
            getSubItems: jest.fn(),
        } as unknown as jest.Mocked<GlpiClient>;
        registerProjectTools(server, client);
    });

    it('registers the project tools', () => {
        expect(Object.keys(tools).sort()).toEqual([
            'glpi_project_create', 'glpi_project_get', 'glpi_project_list', 'glpi_project_states_list',
            'glpi_project_task_create', 'glpi_project_task_list', 'glpi_project_task_update',
            'glpi_project_team_add', 'glpi_project_update',
        ]);
    });

    it('creates a subproject with GLPI column names', async () => {
        const result = await tools.glpi_project_create({ name: 'Sub', parent_id: 10, manager_user_id: 4, show_on_global_gantt: true });
        expect(client.addItems).toHaveBeenCalledWith('Project', { name: 'Sub', projects_id: 10, users_id: 4, show_on_global_gantt: 1 });
        expect(result.content[0].text).toContain('"id": 77');
    });

    it('creates a subtask with duration in seconds', async () => {
        await tools.glpi_project_task_create({ project_id: 10, name: 'T', parent_task_id: 3, planned_duration_hours: 2 });
        expect(client.addItems).toHaveBeenCalledWith('ProjectTask', {
            name: 'T', projects_id: 10, projecttasks_id: 3, planned_duration: 7200,
        });
    });

    it('refuses an update without fields', async () => {
        const result = await tools.glpi_project_update({ id: 5 });
        expect(result.isError).toBe(true);
        expect(client.updateItems).not.toHaveBeenCalled();
    });

    it('adds a group to a task team', async () => {
        await tools.glpi_project_team_add({ target: 'task', target_id: 9, member_type: 'Group', member_id: 2 });
        expect(client.addItems).toHaveBeenCalledWith('ProjectTaskTeam', { projecttasks_id: 9, itemtype: 'Group', items_id: 2 });
    });

    it('filters the project list by parent client-side', async () => {
        client.listItems.mockImplementation(async (_t: string, q?: Record<string, string>) => ({
            items: q?.expand_dropdowns === 'false'
                ? [{ id: 1, name: 'A', projects_id: 0 }, { id: 2, name: 'B', projects_id: 1 }]
                : [{ id: 1, name: 'A', projects_id: 0 }, { id: 2, name: 'B', projects_id: 'A' }],
            range: { start: 0, end: 1, total: 2 },
        }));

        const result = await tools.glpi_project_list({ parent_id: 1, is_deleted: false, start: 0, limit: 100 });

        const body = JSON.parse(result.content[0].text);
        expect(body.projects).toEqual([{ id: 2, name: 'B', projects_id: 1, projects_id_name: 'A' }]);
    });
});
