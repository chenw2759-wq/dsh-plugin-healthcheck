/**
 * /healthcheck/* route layer: JSON envelope for the panel. Read paths are
 * unrestricted (they only report); every write path (repair / rollback)
 * requires `confirmed: true` in the payload — the panel shows the confirm
 * dialog BEFORE sending, and the route double-checks.
 * @module dsh-plugin-healthcheck/host/routes
 */
import { failEnvelope, okEnvelope } from "../core/types.js";
import { listBuiltinBundles, listProfilePlugins, resolveHome } from "./env.js";
import { applyRepair, rollbackPlugin, undoRollback } from "./repair.js";
import { getHistory, getRun, startRun } from "./service.js";
const BAD_REQUEST = { code: 'bad-request', message: 'malformed request' };
/** Read a JSON request body into an unknown value; null when unparseable. */
async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        chunks.push(buffer);
        total += buffer.length;
        if (total > 1 << 20)
            return null;
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text === '')
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function field(payload, key) {
    if (typeof payload !== 'object' || payload === null)
        return undefined;
    return payload[key];
}
function stringField(payload, key) {
    const value = field(payload, key);
    return typeof value === 'string' && value !== '' ? value : null;
}
function stringArrayField(payload, key) {
    const value = field(payload, key);
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        return null;
    return value;
}
function json(res, envelope, status = 200) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(envelope));
}
/** Register the /healthcheck routes on the shared webserver. */
export function registerHealthcheckRoutes(ctx) {
    const handler = async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const pathname = url.pathname;
        if (pathname === '/healthcheck/inventory' && req.method === 'GET') {
            const home = resolveHome();
            const profileRows = listProfilePlugins('web', home);
            const builtinRows = listBuiltinBundles(home);
            const userNames = new Set(profileRows.map((row) => row.name));
            const builtin = builtinRows.filter((row) => !userNames.has(row.name));
            json(res, okEnvelope({
                profile: profileRows.map((row) => ({
                    name: row.name,
                    spec: row.spec,
                    bundle: row.bundle,
                    builtin: false,
                    disabled: row.disabled === true,
                    disabledBy: row.disabledBy ?? [],
                })),
                builtin: builtin.map((row) => ({
                    name: row.name,
                    spec: 'builtin',
                    bundle: true,
                    builtin: true,
                    disabled: false,
                    disabledBy: [],
                })),
                counts: { profile: profileRows.length, builtin: builtin.length, total: profileRows.length + builtin.length },
            }));
            return;
        }
        if (pathname === '/healthcheck/run' && req.method === 'POST') {
            const payload = await readJsonBody(req);
            if (payload === null) {
                json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
                return;
            }
            const layers = stringArrayField(payload, 'layers');
            if (layers === null) {
                json(res, failEnvelope(BAD_REQUEST.code, 'layers must be a string array'), 400);
                return;
            }
            const validLayers = new Set(['l0', 'l1', 'l2', 'malware']);
            if (layers.some((layer) => !validLayers.has(layer))) {
                json(res, failEnvelope(BAD_REQUEST.code, `layers must be one of ${[...validLayers].join('/')}`), 400);
                return;
            }
            const runId = startRun({
                profile: stringField(payload, 'profile') ?? 'web',
                plugin: stringField(payload, 'plugin') ?? undefined,
                layers: layers.length > 0 ? layers : undefined,
            });
            json(res, okEnvelope({ runId }));
            return;
        }
        if (pathname === '/healthcheck/status' && req.method === 'GET') {
            const runId = url.searchParams.get('runId');
            if (runId === null) {
                json(res, failEnvelope(BAD_REQUEST.code, 'runId query is required'), 400);
                return;
            }
            const state = getRun(runId);
            if (state === undefined) {
                json(res, failEnvelope('run-unknown', 'run id not found (finished runs are pruned)'), 404);
                return;
            }
            json(res, okEnvelope({
                stage: state.stage,
                finished: state.finished,
                findings: state.findings,
                smoke: state.smoke,
                error: state.error,
            }));
            return;
        }
        if (pathname === '/healthcheck/repair' && req.method === 'POST') {
            const payload = await readJsonBody(req);
            if (payload === null) {
                json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
                return;
            }
            const action = field(payload, 'repair');
            if (typeof action !== 'object' || action === null || typeof action.kind !== 'string') {
                json(res, failEnvelope(BAD_REQUEST.code, 'repair action is required'), 400);
                return;
            }
            const confirmed = field(payload, 'confirmed') === true;
            if (!confirmed) {
                json(res, failEnvelope('confirm-required', '修复必须先在界面确认（confirmed: true）'), 400);
                return;
            }
            try {
                json(res, okEnvelope(applyRepair(action, resolveHome())));
            }
            catch (error) {
                json(res, failEnvelope('repair-failed', error instanceof Error ? error.message : String(error)), 409);
            }
            return;
        }
        if (pathname === '/healthcheck/rollback' && req.method === 'POST') {
            const payload = await readJsonBody(req);
            if (payload === null) {
                json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
                return;
            }
            const pluginId = stringField(payload, 'pluginId');
            if (pluginId === null) {
                json(res, failEnvelope(BAD_REQUEST.code, 'pluginId is required'), 400);
                return;
            }
            const confirmed = field(payload, 'confirmed') === true;
            if (!confirmed) {
                json(res, failEnvelope('confirm-required', '回滚必须先在界面确认（confirmed: true）'), 400);
                return;
            }
            try {
                json(res, okEnvelope(rollbackPlugin(pluginId, resolveHome())));
            }
            catch (error) {
                json(res, failEnvelope('rollback-failed', error instanceof Error ? error.message : String(error)), 409);
            }
            return;
        }
        if (pathname === '/healthcheck/rollback' && req.method === 'DELETE') {
            const pluginId = url.searchParams.get('pluginId');
            if (pluginId === null) {
                json(res, failEnvelope(BAD_REQUEST.code, 'pluginId query is required'), 400);
                return;
            }
            try {
                json(res, okEnvelope(undoRollback(pluginId, resolveHome())));
            }
            catch (error) {
                json(res, failEnvelope('rollback-failed', error instanceof Error ? error.message : String(error)), 409);
            }
            return;
        }
        if (pathname === '/healthcheck/history' && req.method === 'GET') {
            json(res, okEnvelope(getHistory()));
            return;
        }
        res.writeHead(404);
        res.end();
    };
    return ctx.webServer.register({ kind: 'prefix', path: '/healthcheck', handler });
}
