import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The 插件检测 settings section: scope picker + layer toggles + run button,
 * live findings list with severity badges and per-finding actions (repair /
 * rollback / copy prompt), and the run history. All writes confirm first —
 * the panel shows a two-step confirm before sending any mutation.
 * @module dsh-plugin-healthcheck/client/HealthcheckSection
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HealthcheckApi } from "./api.js";
import css from './healthcheck.module.css';
const SEVERITY_CLASS = {
    error: css.badgeError,
    warn: css.badgeWarn,
    info: css.badgeInfo,
};
const LAYERS = ['l0', 'l1', 'l2', 'malware'];
/**
 * Render the healthcheck section.
 * @param props - locale copy and the close affordance.
 */
export function HealthcheckSection(props) {
    const { t } = props;
    const apiRef = useRef(null);
    if (apiRef.current === null)
        apiRef.current = new HealthcheckApi();
    const api = apiRef.current;
    const [plugins, setPlugins] = useState([]);
    const [scopePlugin, setScopePlugin] = useState('');
    const [layers, setLayers] = useState({ l0: true, l1: true, l2: true, malware: true });
    const [running, setRunning] = useState(false);
    const [runId, setRunId] = useState('');
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [notice, setNotice] = useState('');
    const [confirming, setConfirming] = useState(null);
    const pollTimer = useRef(null);
    useEffect(() => {
        void api.inventory().then((envelope) => {
            if (envelope.ok)
                setPlugins(envelope.value);
        });
        void api.history().then((envelope) => {
            if (envelope.ok)
                setHistory(envelope.value);
        });
        return () => {
            if (pollTimer.current !== null)
                clearInterval(pollTimer.current);
        };
    }, [api]);
    const stopPolling = useCallback(() => {
        if (pollTimer.current !== null) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
    }, []);
    const start = useCallback(() => {
        if (running)
            return;
        setRunning(true);
        setNotice('');
        setStatus({ stage: 'l0', finished: false, findings: [] });
        const requested = LAYERS.filter((layer) => layers[layer]);
        if (requested.length === 0) {
            setRunning(false);
            setNotice(t('layerL0'));
            return;
        }
        void api.run({ plugin: scopePlugin === '' ? undefined : scopePlugin, layers: requested }).then((envelope) => {
            if (!envelope.ok) {
                setRunning(false);
                setNotice(`${t('applyFailed')}: ${envelope.error.message}`);
                return;
            }
            setRunId(envelope.value.runId);
            pollTimer.current = setInterval(() => {
                void api.status(envelope.value.runId).then((snapshot) => {
                    if (!snapshot.ok) {
                        stopPolling();
                        setRunning(false);
                        setNotice(`${t('applyFailed')}: ${snapshot.error.message}`);
                        return;
                    }
                    setStatus(snapshot.value);
                    if (snapshot.value.finished) {
                        stopPolling();
                        setRunning(false);
                        void api.history().then((h) => { if (h.ok)
                            setHistory(h.value); });
                    }
                });
            }, 800);
        });
    }, [running, layers, scopePlugin, api, t, stopPolling]);
    const toggleLayer = (layer) => {
        setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    };
    const flash = (text) => {
        setNotice(text);
        setTimeout(() => setNotice(''), 6000);
    };
    const requestRepair = (finding) => {
        setConfirming({ kind: 'repair', payload: finding });
    };
    const requestRollback = (finding) => {
        setConfirming({ kind: 'rollback', payload: finding });
    };
    const confirmAndApply = () => {
        if (confirming === null)
            return;
        if (confirming.kind === 'repair') {
            const finding = confirming.payload;
            setConfirming(null);
            if (finding.repair === undefined)
                return;
            void api.repair(finding.repair, true).then((envelope) => {
                flash(envelope.ok ? `${t('applySuccess')}: ${envelope.value.message}` : `${t('applyFailed')}: ${envelope.error.message}`);
            });
        }
        else {
            const finding = confirming.payload;
            setConfirming(null);
            const pluginId = finding.rollbackId ?? finding.plugin ?? '';
            if (pluginId === '')
                return;
            void api.rollback(pluginId, true).then((envelope) => {
                flash(envelope.ok ? `${t('applySuccess')}: ${envelope.value.message}` : `${t('applyFailed')}: ${envelope.error.message}`);
            });
        }
    };
    const copyPrompt = (finding) => {
        if (finding.prompt === undefined)
            return;
        void navigator.clipboard.writeText(finding.prompt).then(() => {
            flash(t('promptCopied'));
        }, () => {
            flash(`${t('applyFailed')}: clipboard`);
        });
    };
    const stageText = () => {
        if (status === null || status.finished)
            return t('done');
        if (status.stage === 'l0')
            return t('stageL0');
        if (status.stage === 'l1')
            return t('stageL1');
        if (status.stage === 'malware')
            return t('stageMalware');
        return t('stageL2');
    };
    const findings = status?.findings ?? [];
    return (_jsxs("div", { className: css.root, children: [_jsx("p", { className: css.description, children: t('description') }), _jsx("p", { className: css.ironRule, children: t('ironRule') }), _jsx("p", { className: css.ironRule, children: t('malwareIronRule') }), _jsxs("div", { className: css.controls, children: [_jsxs("select", { className: css.scope, value: scopePlugin, onChange: (event) => { setScopePlugin(event.target.value); }, "aria-label": t('scopePlugin'), children: [_jsx("option", { value: "", children: t('scopeAll') }), plugins.map((row) => (_jsxs("option", { value: row.name, children: [row.disabled ? `[${t('disabledBadge')}] ` : '', row.name] }, row.name)))] }), _jsx("div", { className: css.layers, role: "group", "aria-label": "layers", children: LAYERS.map((layer) => (_jsxs("label", { className: css.layerLabel, children: [_jsx("input", { type: "checkbox", checked: layers[layer], onChange: () => { toggleLayer(layer); } }), t(`layer${layer.toUpperCase()}`)] }, layer))) }), _jsx("button", { type: "button", className: css.runButton, onClick: start, disabled: running, children: running ? t('running') : t('start') })] }), running || status !== null
                ? (_jsxs("div", { className: css.stageRow, children: [_jsx("span", { className: css.stageText, children: running ? stageText() : t('done') }), status?.smoke !== undefined
                            ? (_jsx("span", { className: status.smoke.ok ? css.smokeOk : css.smokeBad, children: status.smoke.ok ? t('smokePassed') : t('smokeFailed') }))
                            : null] }))
                : null, notice !== ''
                ? _jsx("p", { className: css.notice, children: notice })
                : null, confirming !== null
                ? (_jsxs("div", { className: css.confirmBox, role: "alertdialog", children: [_jsx("p", { children: confirming.kind === 'repair' ? t('repairConfirm') : t('rollbackConfirm') }), _jsxs("div", { className: css.confirmActions, children: [_jsx("button", { type: "button", className: css.confirmYes, onClick: confirmAndApply, children: t('repair') }), _jsx("button", { type: "button", className: css.confirmNo, onClick: () => { setConfirming(null); }, children: "\u53D6\u6D88" })] })] }))
                : null, _jsx("h3", { className: css.heading, children: t('findings') }), findings.length === 0
                ? _jsx("p", { className: css.empty, children: t('noFindings') })
                : (_jsx("ul", { className: css.findings, children: findings.map((finding, index) => (_jsxs("li", { className: css.finding, children: [_jsxs("div", { className: css.findingHead, children: [_jsx("span", { className: SEVERITY_CLASS[finding.severity] ?? css.badgeInfo, children: t(finding.severity) }), _jsx("span", { className: css.findingCode, children: finding.code }), finding.plugin !== undefined
                                        ? _jsx("span", { className: css.findingPlugin, children: finding.plugin })
                                        : null] }), _jsx("p", { className: css.findingMessage, children: finding.message }), finding.evidence !== undefined && finding.evidence.length > 0
                                ? (_jsxs("details", { className: css.evidence, children: [_jsx("summary", { children: t('evidence') }), _jsx("ul", { children: finding.evidence.map((line, i) => _jsx("li", { children: line }, i)) })] }))
                                : null, _jsxs("div", { className: css.actions, children: [finding.fixKind === 'auto' && finding.repair !== undefined && finding.repair.kind !== 'none'
                                        ? (_jsx("button", { type: "button", className: css.actionButton, onClick: () => { requestRepair(finding); }, children: t('repair') }))
                                        : null, finding.fixKind === 'rollback'
                                        ? (_jsx("button", { type: "button", className: css.actionButton, onClick: () => { requestRollback(finding); }, children: t('rollback') }))
                                        : null, finding.prompt !== undefined
                                        ? (_jsx("button", { type: "button", className: css.actionButton, onClick: () => { copyPrompt(finding); }, children: t('copyPrompt') }))
                                        : null] })] }, `${finding.code}-${index}`))) })), _jsx("h3", { className: css.heading, children: t('history') }), history.length === 0
                ? _jsx("p", { className: css.empty, children: t('historyEmpty') })
                : (_jsx("ul", { className: css.historyList, children: history.map((record) => (_jsxs("li", { className: css.historyItem, children: [_jsx("span", { className: SEVERITY_CLASS[record.worst] ?? css.badgeInfo, children: t(record.worst) }), _jsx("span", { className: css.historyTime, children: new Date(record.at).toLocaleString() }), _jsxs("span", { className: css.historyCounts, children: [record.errors, "E / ", record.warnings, "W"] }), record.summary.length > 0
                                ? _jsx("span", { className: css.historySummary, children: record.summary[0] })
                                : null] }, record.id))) }))] }));
}
