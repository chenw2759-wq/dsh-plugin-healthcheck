window.__ModuleLoader__.load({
	id: "dsh-plugin-healthcheck",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** Transport failure (fetch threw or the response was not JSON). */
		const TRANSPORT_ERROR = {
			code: "internal",
			message: "healthcheck route unavailable"
		};
		/** POST one JSON payload and decode the envelope; never throws. */
		async function post(path, payload) {
			let response;
			try {
				response = await fetch(path, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
			try {
				const envelope = await response.json();
				if (typeof envelope !== "object" || envelope === null) return {
					ok: false,
					error: TRANSPORT_ERROR
				};
				const record = envelope;
				if (record.ok === true) return {
					ok: true,
					value: record.value
				};
				return {
					ok: false,
					error: record.error ?? TRANSPORT_ERROR
				};
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
		}
		/** GET one JSON envelope. */
		async function get(path) {
			let response;
			try {
				response = await fetch(path);
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
			try {
				const envelope = await response.json();
				if (typeof envelope !== "object" || envelope === null) return {
					ok: false,
					error: TRANSPORT_ERROR
				};
				const record = envelope;
				if (record.ok === true) return {
					ok: true,
					value: record.value
				};
				return {
					ok: false,
					error: record.error ?? TRANSPORT_ERROR
				};
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
		}
		/** Typed healthcheck operations over the wire. */
		var HealthcheckApi = class {
			/** List installed plugins for the scope picker. */
			inventory() {
				return get("/healthcheck/inventory");
			}
			/** Start a check run; returns its runId. */
			run(payload) {
				return post("/healthcheck/run", payload);
			}
			/** Poll one run's live state. */
			status(runId) {
				return get(`/healthcheck/status?runId=${encodeURIComponent(runId)}`);
			}
			/** Apply one deterministic repair (the panel confirms first). */
			repair(repair, confirmed) {
				return post("/healthcheck/repair", {
					repair,
					confirmed
				});
			}
			/** Write a disabled row into the home patch (the panel confirms first). */
			rollback(pluginId, confirmed) {
				return post("/healthcheck/rollback", {
					pluginId,
					confirmed
				});
			}
			/** Remove the healthcheck rollback rows for one plugin. */
			async undoRollback(pluginId) {
				let response;
				try {
					response = await fetch(`/healthcheck/rollback?pluginId=${encodeURIComponent(pluginId)}`, { method: "DELETE" });
				} catch {
					return {
						ok: false,
						error: TRANSPORT_ERROR
					};
				}
				try {
					const envelope = await response.json();
					if (typeof envelope !== "object" || envelope === null) return {
						ok: false,
						error: TRANSPORT_ERROR
					};
					const record = envelope;
					if (record.ok === true) return {
						ok: true,
						value: record.value
					};
					return {
						ok: false,
						error: record.error ?? TRANSPORT_ERROR
					};
				} catch {
					return {
						ok: false,
						error: TRANSPORT_ERROR
					};
				}
			}
			/** Read the persisted run history. */
			history() {
				return get("/healthcheck/history");
			}
		};
		//#endregion
		//#region \0dsh-css:M:\dsh\plugins\dsh-plugin-healthcheck\src\client\healthcheck.module.css.mjs
		const css = ".oAZuYa_root{color:var(--ds-text-primary,#1f2328);flex-direction:column;gap:10px;padding:4px 0 16px;font-size:13px;display:flex}.oAZuYa_description{color:var(--ds-text-secondary,#59636e);margin:0;line-height:1.5}.oAZuYa_ironRule{background:var(--ds-bg-warning-subtle,#fff8c5);color:var(--ds-text-warning,#7d4e00);border-radius:6px;margin:0;padding:6px 10px;font-size:12px}.oAZuYa_controls{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.oAZuYa_scope{border:1px solid var(--ds-border-default,#d1d9e0);background:var(--ds-bg-input,#fff);min-width:180px;color:inherit;border-radius:6px;padding:6px 8px}.oAZuYa_layers{gap:12px;display:flex}.oAZuYa_layerLabel{cursor:pointer;align-items:center;gap:5px;display:inline-flex}.oAZuYa_runButton{background:var(--ds-bg-accent,#0969da);color:#fff;cursor:pointer;border:none;border-radius:6px;padding:6px 16px}.oAZuYa_runButton:disabled{opacity:.6;cursor:default}.oAZuYa_stageRow{align-items:center;gap:10px;display:flex}.oAZuYa_stageText{color:var(--ds-text-secondary,#59636e);font-size:12px}.oAZuYa_smokeOk{color:var(--ds-text-success,#1a7f37);font-weight:600}.oAZuYa_smokeBad{color:var(--ds-text-danger,#d1242f);font-weight:600}.oAZuYa_notice{background:var(--ds-bg-info-subtle,#ddf4ff);color:var(--ds-text-info,#0969da);border-radius:6px;margin:0;padding:6px 10px;font-size:12px}.oAZuYa_confirmBox{border:1px solid var(--ds-border-warning,#d4a72c);background:var(--ds-bg-warning-subtle,#fff8c5);border-radius:6px;padding:10px}.oAZuYa_confirmBox p{margin:0 0 8px}.oAZuYa_confirmActions{gap:8px;display:flex}.oAZuYa_confirmYes{background:var(--ds-bg-danger,#d1242f);color:#fff;cursor:pointer;border:none;border-radius:6px;padding:5px 14px}.oAZuYa_confirmNo{border:1px solid var(--ds-border-default,#d1d9e0);color:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:5px 14px}.oAZuYa_heading{margin:10px 0 0;font-size:13px;font-weight:600}.oAZuYa_empty{color:var(--ds-text-success,#1a7f37);margin:4px 0}.oAZuYa_findings{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.oAZuYa_finding{border:1px solid var(--ds-border-default,#d1d9e0);border-radius:6px;padding:8px 10px}.oAZuYa_findingHead{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.oAZuYa_badgeError{background:var(--ds-bg-danger-emphasis,#d1242f);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px}.oAZuYa_badgeWarn{background:var(--ds-bg-warning-emphasis,#d4a72c);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px}.oAZuYa_badgeInfo{background:var(--ds-bg-info-emphasis,#0969da);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px}.oAZuYa_findingCode{font-family:var(--ds-font-mono,ui-monospace, monospace);color:var(--ds-text-secondary,#59636e);font-size:12px}.oAZuYa_findingPlugin{color:var(--ds-text-secondary,#59636e);font-size:12px}.oAZuYa_findingMessage{margin:6px 0 0;line-height:1.5}.oAZuYa_evidence{margin-top:6px;font-size:12px}.oAZuYa_evidence summary{cursor:pointer;color:var(--ds-text-secondary,#59636e)}.oAZuYa_evidence ul{font-family:var(--ds-font-mono,ui-monospace, monospace);word-break:break-all;margin:4px 0 0;padding-left:18px}.oAZuYa_actions{flex-wrap:wrap;gap:8px;margin-top:8px;display:flex}.oAZuYa_actionButton{border:1px solid var(--ds-border-default,#d1d9e0);color:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 12px;font-size:12px}.oAZuYa_actionButton:hover{border-color:var(--ds-border-accent,#0969da);color:var(--ds-text-accent,#0969da)}.oAZuYa_historyList{flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;display:flex}.oAZuYa_historyItem{color:var(--ds-text-secondary,#59636e);flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.oAZuYa_historyTime{min-width:140px}.oAZuYa_historyCounts{font-family:var(--ds-font-mono,ui-monospace, monospace)}.oAZuYa_historySummary{text-overflow:ellipsis;white-space:nowrap;max-width:100%;overflow:hidden}body[data-ds-dark-theme] .oAZuYa_runButton{background:var(--ds-bg-accent,#4493f8)}";
		const tagId = "dsh-plugin-healthcheck/healthcheck.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-healthcheck";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var healthcheck_module_css_default = {
			"actionButton": "oAZuYa_actionButton",
			"actions": "oAZuYa_actions",
			"badgeError": "oAZuYa_badgeError",
			"badgeInfo": "oAZuYa_badgeInfo",
			"badgeWarn": "oAZuYa_badgeWarn",
			"confirmActions": "oAZuYa_confirmActions",
			"confirmBox": "oAZuYa_confirmBox",
			"confirmNo": "oAZuYa_confirmNo",
			"confirmYes": "oAZuYa_confirmYes",
			"controls": "oAZuYa_controls",
			"description": "oAZuYa_description",
			"empty": "oAZuYa_empty",
			"evidence": "oAZuYa_evidence",
			"finding": "oAZuYa_finding",
			"findingCode": "oAZuYa_findingCode",
			"findingHead": "oAZuYa_findingHead",
			"findingMessage": "oAZuYa_findingMessage",
			"findingPlugin": "oAZuYa_findingPlugin",
			"findings": "oAZuYa_findings",
			"heading": "oAZuYa_heading",
			"historyCounts": "oAZuYa_historyCounts",
			"historyItem": "oAZuYa_historyItem",
			"historyList": "oAZuYa_historyList",
			"historySummary": "oAZuYa_historySummary",
			"historyTime": "oAZuYa_historyTime",
			"ironRule": "oAZuYa_ironRule",
			"layerLabel": "oAZuYa_layerLabel",
			"layers": "oAZuYa_layers",
			"notice": "oAZuYa_notice",
			"root": "oAZuYa_root",
			"runButton": "oAZuYa_runButton",
			"scope": "oAZuYa_scope",
			"smokeBad": "oAZuYa_smokeBad",
			"smokeOk": "oAZuYa_smokeOk",
			"stageRow": "oAZuYa_stageRow",
			"stageText": "oAZuYa_stageText"
		};
		//#endregion
		//#region src/client/HealthcheckSection.tsx
		/**
		* The 插件检测 settings section: scope picker + layer toggles + run button,
		* live findings list with severity badges and per-finding actions (repair /
		* rollback / copy prompt), and the run history. All writes confirm first —
		* the panel shows a two-step confirm before sending any mutation.
		* @module dsh-plugin-healthcheck/client/HealthcheckSection
		*/
		const SEVERITY_CLASS = {
			error: healthcheck_module_css_default.badgeError,
			warn: healthcheck_module_css_default.badgeWarn,
			info: healthcheck_module_css_default.badgeInfo
		};
		const LAYERS = [
			"l0",
			"l1",
			"l2",
			"malware"
		];
		/**
		* Render the healthcheck section.
		* @param props - locale copy and the close affordance.
		*/
		function HealthcheckSection(props) {
			const { t } = props;
			const apiRef = (0, react.useRef)(null);
			if (apiRef.current === null) apiRef.current = new HealthcheckApi();
			const api = apiRef.current;
			const [plugins, setPlugins] = (0, react.useState)([]);
			const [scopePlugin, setScopePlugin] = (0, react.useState)("");
			const [layers, setLayers] = (0, react.useState)({
				l0: true,
				l1: true,
				l2: true,
				malware: true
			});
			const [running, setRunning] = (0, react.useState)(false);
			const [runId, setRunId] = (0, react.useState)("");
			const [status, setStatus] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [notice, setNotice] = (0, react.useState)("");
			const [confirming, setConfirming] = (0, react.useState)(null);
			const pollTimer = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				api.inventory().then((envelope) => {
					if (envelope.ok) setPlugins(envelope.value);
				});
				api.history().then((envelope) => {
					if (envelope.ok) setHistory(envelope.value);
				});
				return () => {
					if (pollTimer.current !== null) clearInterval(pollTimer.current);
				};
			}, [api]);
			const stopPolling = (0, react.useCallback)(() => {
				if (pollTimer.current !== null) {
					clearInterval(pollTimer.current);
					pollTimer.current = null;
				}
			}, []);
			const start = (0, react.useCallback)(() => {
				if (running) return;
				setRunning(true);
				setNotice("");
				setStatus({
					stage: "l0",
					finished: false,
					findings: []
				});
				const requested = LAYERS.filter((layer) => layers[layer]);
				if (requested.length === 0) {
					setRunning(false);
					setNotice(t("layerL0"));
					return;
				}
				api.run({
					plugin: scopePlugin === "" ? void 0 : scopePlugin,
					layers: requested
				}).then((envelope) => {
					if (!envelope.ok) {
						setRunning(false);
						setNotice(`${t("applyFailed")}: ${envelope.error.message}`);
						return;
					}
					setRunId(envelope.value.runId);
					pollTimer.current = setInterval(() => {
						api.status(envelope.value.runId).then((snapshot) => {
							if (!snapshot.ok) {
								stopPolling();
								setRunning(false);
								setNotice(`${t("applyFailed")}: ${snapshot.error.message}`);
								return;
							}
							setStatus(snapshot.value);
							if (snapshot.value.finished) {
								stopPolling();
								setRunning(false);
								api.history().then((h) => {
									if (h.ok) setHistory(h.value);
								});
							}
						});
					}, 800);
				});
			}, [
				running,
				layers,
				scopePlugin,
				api,
				t,
				stopPolling
			]);
			const toggleLayer = (layer) => {
				setLayers((prev) => ({
					...prev,
					[layer]: !prev[layer]
				}));
			};
			const flash = (text) => {
				setNotice(text);
				setTimeout(() => setNotice(""), 6e3);
			};
			const requestRepair = (finding) => {
				setConfirming({
					kind: "repair",
					payload: finding
				});
			};
			const requestRollback = (finding) => {
				setConfirming({
					kind: "rollback",
					payload: finding
				});
			};
			const confirmAndApply = () => {
				if (confirming === null) return;
				if (confirming.kind === "repair") {
					const finding = confirming.payload;
					setConfirming(null);
					if (finding.repair === void 0) return;
					api.repair(finding.repair, true).then((envelope) => {
						flash(envelope.ok ? `${t("applySuccess")}: ${envelope.value.message}` : `${t("applyFailed")}: ${envelope.error.message}`);
					});
				} else {
					const finding = confirming.payload;
					setConfirming(null);
					const pluginId = finding.rollbackId ?? finding.plugin ?? "";
					if (pluginId === "") return;
					api.rollback(pluginId, true).then((envelope) => {
						flash(envelope.ok ? `${t("applySuccess")}: ${envelope.value.message}` : `${t("applyFailed")}: ${envelope.error.message}`);
					});
				}
			};
			const copyPrompt = (finding) => {
				if (finding.prompt === void 0) return;
				navigator.clipboard.writeText(finding.prompt).then(() => {
					flash(t("promptCopied"));
				}, () => {
					flash(`${t("applyFailed")}: clipboard`);
				});
			};
			const stageText = () => {
				if (status === null || status.finished) return t("done");
				if (status.stage === "l0") return t("stageL0");
				if (status.stage === "l1") return t("stageL1");
				if (status.stage === "malware") return t("stageMalware");
				return t("stageL2");
			};
			const findings = status?.findings ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: healthcheck_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.description,
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.ironRule,
						children: t("ironRule")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.ironRule,
						children: t("malwareIronRule")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: healthcheck_module_css_default.controls,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: healthcheck_module_css_default.scope,
								value: scopePlugin,
								onChange: (event) => {
									setScopePlugin(event.target.value);
								},
								"aria-label": t("scopePlugin"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("scopeAll")
								}), plugins.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: row.name,
									children: [row.disabled ? `[${t("disabledBadge")}] ` : "", row.name]
								}, row.name))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: healthcheck_module_css_default.layers,
								role: "group",
								"aria-label": "layers",
								children: LAYERS.map((layer) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: healthcheck_module_css_default.layerLabel,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: layers[layer],
										onChange: () => {
											toggleLayer(layer);
										}
									}), t(`layer${layer.toUpperCase()}`)]
								}, layer))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: healthcheck_module_css_default.runButton,
								onClick: start,
								disabled: running,
								children: running ? t("running") : t("start")
							})
						]
					}),
					running || status !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: healthcheck_module_css_default.stageRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: healthcheck_module_css_default.stageText,
							children: running ? stageText() : t("done")
						}), status?.smoke !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: status.smoke.ok ? healthcheck_module_css_default.smokeOk : healthcheck_module_css_default.smokeBad,
							children: status.smoke.ok ? t("smokePassed") : t("smokeFailed")
						}) : null]
					}) : null,
					notice !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.notice,
						children: notice
					}) : null,
					confirming !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: healthcheck_module_css_default.confirmBox,
						role: "alertdialog",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: confirming.kind === "repair" ? t("repairConfirm") : t("rollbackConfirm") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: healthcheck_module_css_default.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: healthcheck_module_css_default.confirmYes,
								onClick: confirmAndApply,
								children: t("repair")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: healthcheck_module_css_default.confirmNo,
								onClick: () => {
									setConfirming(null);
								},
								children: "取消"
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: healthcheck_module_css_default.heading,
						children: t("findings")
					}),
					findings.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.empty,
						children: t("noFindings")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: healthcheck_module_css_default.findings,
						children: findings.map((finding, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: healthcheck_module_css_default.finding,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: healthcheck_module_css_default.findingHead,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SEVERITY_CLASS[finding.severity] ?? healthcheck_module_css_default.badgeInfo,
											children: t(finding.severity)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: healthcheck_module_css_default.findingCode,
											children: finding.code
										}),
										finding.plugin !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: healthcheck_module_css_default.findingPlugin,
											children: finding.plugin
										}) : null
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: healthcheck_module_css_default.findingMessage,
									children: finding.message
								}),
								finding.evidence !== void 0 && finding.evidence.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: healthcheck_module_css_default.evidence,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("evidence") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: finding.evidence.map((line, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: line }, i)) })]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: healthcheck_module_css_default.actions,
									children: [
										finding.fixKind === "auto" && finding.repair !== void 0 && finding.repair.kind !== "none" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: healthcheck_module_css_default.actionButton,
											onClick: () => {
												requestRepair(finding);
											},
											children: t("repair")
										}) : null,
										finding.fixKind === "rollback" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: healthcheck_module_css_default.actionButton,
											onClick: () => {
												requestRollback(finding);
											},
											children: t("rollback")
										}) : null,
										finding.prompt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: healthcheck_module_css_default.actionButton,
											onClick: () => {
												copyPrompt(finding);
											},
											children: t("copyPrompt")
										}) : null
									]
								})
							]
						}, `${finding.code}-${index}`))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: healthcheck_module_css_default.heading,
						children: t("history")
					}),
					history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: healthcheck_module_css_default.empty,
						children: t("historyEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: healthcheck_module_css_default.historyList,
						children: history.map((record) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: healthcheck_module_css_default.historyItem,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SEVERITY_CLASS[record.worst] ?? healthcheck_module_css_default.badgeInfo,
									children: t(record.worst)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: healthcheck_module_css_default.historyTime,
									children: new Date(record.at).toLocaleString()
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: healthcheck_module_css_default.historyCounts,
									children: [
										record.errors,
										"E / ",
										record.warnings,
										"W"
									]
								}),
								record.summary.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: healthcheck_module_css_default.historySummary,
									children: record.summary[0]
								}) : null
							]
						}, record.id))
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "plugin-healthcheck";
		const zh = {
			nav: "插件检测",
			description: "安装新插件后先检测：静态检查 + 配置组合 + 隔离试跑，发现问题自动修复或回滚（不改 harness 源码）。",
			scopeAll: "全部插件",
			scopePlugin: "指定插件",
			layerL0: "L0 静态检查",
			layerL1: "L1 配置组合",
			layerL2: "L2 隔离试跑",
			layerMalware: "木马扫描",
			start: "开始检测",
			running: "检测中…",
			stageL0: "静态检查：files 白名单 / 依赖声明 / 高危副本 / 依赖解析 / Windows 命令 / lockfile / 禁用插件",
			stageL1: "配置组合：bundle + profile + home 补丁层",
			stageL2: "隔离试跑：子进程完整 boot（约 10~60 秒）",
			stageMalware: "木马扫描：纯静态隔离（绝不执行插件代码）",
			done: "完成",
			error: "错误",
			warn: "警告",
			info: "信息",
			none: "无问题",
			findings: "检测结果",
			noFindings: "未发现问题 — 插件可以安全使用",
			evidence: "证据",
			repair: "一键修复",
			rollback: "自动回滚",
			rollbackConfirm: "将写入 home 层补丁禁用该插件（热重载生效，无需重启）。确认执行？",
			repairConfirm: "将执行确定修复（改插件代码/配置层，绝不改 harness）。确认执行？",
			undoRollback: "撤销回滚",
			copyPrompt: "复制提示词",
			promptCopied: "提示词已复制 — 开一个新会话粘贴给 agent 修复",
			applySuccess: "已应用",
			applyFailed: "执行失败",
			history: "检测历史",
			historyEmpty: "暂无记录",
			plugin: "插件",
			smokePassed: "试跑通过 — 全部插件激活",
			smokeFailed: "试跑失败 — 新插件会导致后端无法启动",
			busy: "已有检测在运行，请稍候",
			ironRule: "铁律：修复只改插件代码与配置层，严禁修改 harness 源码",
			malwareIronRule: "木马扫描为纯静态隔离执行：只读文件、绝不 import/运行插件代码；可疑插件先禁用隔离再人工复核",
			disabledBadge: "已禁用"
		};
		const en = {
			nav: "Plugin healthcheck",
			description: "Check newly installed plugins before they break the backend: static checks + config composition + isolated smoke boot. Fixes never touch harness source.",
			scopeAll: "All plugins",
			scopePlugin: "One plugin",
			layerL0: "L0 static",
			layerL1: "L1 config",
			layerL2: "L2 smoke boot",
			layerMalware: "Malware scan",
			start: "Run check",
			running: "Checking…",
			stageL0: "Static: files whitelist / dep spec / risky copies / resolvability / Windows commands / lockfile / disabled plugins",
			stageL1: "Config composition: bundle + profile + home patch layers",
			stageL2: "Isolated smoke boot: full boot in a subprocess (~10–60s)",
			stageMalware: "Malware scan: pure static, isolated — plugin code is never executed",
			done: "Done",
			error: "Error",
			warn: "Warning",
			info: "Info",
			none: "All clear",
			findings: "Findings",
			noFindings: "No issues found — the plugin is safe to use",
			evidence: "Evidence",
			repair: "Repair",
			rollback: "Roll back",
			rollbackConfirm: "Write a disabled row into the home patch (hot-reloads, no restart). Confirm?",
			repairConfirm: "Apply the deterministic fix (plugin code / config layer only, never harness). Confirm?",
			undoRollback: "Undo rollback",
			copyPrompt: "Copy prompt",
			promptCopied: "Prompt copied — paste it into a new session for the agent to repair",
			applySuccess: "Applied",
			applyFailed: "Failed",
			history: "History",
			historyEmpty: "No records yet",
			plugin: "Plugin",
			smokePassed: "Smoke passed — every plugin activated",
			smokeFailed: "Smoke failed — the new plugin would break backend startup",
			busy: "A check is already running",
			ironRule: "Iron rule: repairs touch plugin code and config layers only — never harness source",
			malwareIronRule: "Malware scan is pure-static and isolated: files are only read, plugin code is never executed; quarantine suspicious plugins first, then review",
			disabledBadge: "Disabled"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services. */
		const inject = ["slots", "locale"];
		/**
		* Apply the browser half: dictionaries, then one settings.section entry.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-plugin-healthcheck: dictionaries");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "plugin-healthcheck",
				order: 80,
				label: () => ctx.locale.bind(NS)("nav"),
				locale: NS
			}, HealthcheckSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map