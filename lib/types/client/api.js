/**
 * Browser client for the host /healthcheck/* routes: typed JSON envelope
 * calls. Same-origin relative fetch (the page and the routes share the
 * webserver), mirroring the aionui-panel api discipline.
 * @module dsh-plugin-healthcheck/client/api
 */
/** Transport failure (fetch threw or the response was not JSON). */
const TRANSPORT_ERROR = { code: 'internal', message: 'healthcheck route unavailable' };
/** POST one JSON payload and decode the envelope; never throws. */
async function post(path, payload) {
    let response;
    try {
        response = await fetch(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
    try {
        const envelope = await response.json();
        if (typeof envelope !== 'object' || envelope === null)
            return { ok: false, error: TRANSPORT_ERROR };
        const record = envelope;
        if (record.ok === true)
            return { ok: true, value: record.value };
        return { ok: false, error: record.error ?? TRANSPORT_ERROR };
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
}
/** GET one JSON envelope. */
async function get(path) {
    let response;
    try {
        response = await fetch(path);
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
    try {
        const envelope = await response.json();
        if (typeof envelope !== 'object' || envelope === null)
            return { ok: false, error: TRANSPORT_ERROR };
        const record = envelope;
        if (record.ok === true)
            return { ok: true, value: record.value };
        return { ok: false, error: record.error ?? TRANSPORT_ERROR };
    }
    catch {
        return { ok: false, error: TRANSPORT_ERROR };
    }
}
/** Typed healthcheck operations over the wire. */
export class HealthcheckApi {
    /** List installed plugins for the scope picker. */
    inventory() {
        return get('/healthcheck/inventory');
    }
    /** Start a check run; returns its runId. */
    run(payload) {
        return post('/healthcheck/run', payload);
    }
    /** Poll one run's live state. */
    status(runId) {
        return get(`/healthcheck/status?runId=${encodeURIComponent(runId)}`);
    }
    /** Apply one deterministic repair (the panel confirms first). */
    repair(repair, confirmed) {
        return post('/healthcheck/repair', { repair, confirmed });
    }
    /** Write a disabled row into the home patch (the panel confirms first). */
    rollback(pluginId, confirmed) {
        return post('/healthcheck/rollback', { pluginId, confirmed });
    }
    /** Remove the healthcheck rollback rows for one plugin. */
    async undoRollback(pluginId) {
        let response;
        try {
            response = await fetch(`/healthcheck/rollback?pluginId=${encodeURIComponent(pluginId)}`, { method: 'DELETE' });
        }
        catch {
            return { ok: false, error: TRANSPORT_ERROR };
        }
        try {
            const envelope = await response.json();
            if (typeof envelope !== 'object' || envelope === null)
                return { ok: false, error: TRANSPORT_ERROR };
            const record = envelope;
            if (record.ok === true)
                return { ok: true, value: record.value };
            return { ok: false, error: record.error ?? TRANSPORT_ERROR };
        }
        catch {
            return { ok: false, error: TRANSPORT_ERROR };
        }
    }
    /** Read the persisted run history. */
    history() {
        return get('/healthcheck/history');
    }
}
