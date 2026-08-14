import { createRequire } from "node:module";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
//#region src/core/types.ts
/** Build an ok envelope. */
function okEnvelope(value) {
	return {
		ok: true,
		value
	};
}
/** Build a failure envelope. */
function failEnvelope(code, message) {
	return {
		ok: false,
		error: {
			code,
			message
		}
	};
}
//#endregion
//#region src/host/env.ts
/**
* Host environment resolution: harness home, profile directory, plugin
* inventory, and the harness install anchor. Pure path logic — no writes.
* @module dsh-plugin-healthcheck/host/env
*/
/** Packages whose duplicate presence in the profile tree breaks module identity. */
const HIGH_RISK_PACKAGES = [
	"cordis",
	"cosmokit",
	"dsh-tools",
	"schemastery",
	"dsh-credentials",
	"dsh-home-paths"
];
/** Resolve the harness home exactly as the dsh launcher does. */
function resolveHome() {
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
/**
* Locate the harness install root (M:\dsh\node_modules). Resolution goes
* through the maintained flat fallback `$DSH_HOME/profiles/node_modules`
* FIRST — that directory is healed by the launcher to point at the real
* installation, and consulting it before any profile-local node_modules
* makes the answer immune to the very duplicate-copy state this plugin
* detects (a copy inside web/node_modules would otherwise hijack the root).
* Falls back to module resolution of dsh-app-boot.
*/
function resolveInstallRoot(home = resolveHome()) {
	const fallbackCandidate = join(home, "profiles", "node_modules", "@deepseek-ai", "dsh", "package.json");
	try {
		if (existsSync(fallbackCandidate)) return resolve(dirname(realpathSync(fallbackCandidate)), "..", "..");
	} catch {}
	return resolve(dirname(createRequire(import.meta.url).resolve("@deepseek-ai/dsh-app-boot/package.json")), "..", "..");
}
/** The dsh app's package.json (install anchor for loadProfile). */
function resolveInstallAnchor() {
	return join(resolveInstallRoot(), "@deepseek-ai", "dsh", "package.json");
}
/** The web profile directory. */
function resolveProfileDir(name, home = resolveHome()) {
	return join(home, "profiles", name);
}
/** The home-level patch file (highest-priority user layer). */
function resolveHomePatch(home = resolveHome()) {
	return join(home, "cordis.patch.yml");
}
/**
* Read the profile manifest and resolve every plugin dependency row.
* Missing installs are reported with installedDir = ''.
*/
function listProfilePlugins(profile, home = resolveHome()) {
	const dir = resolveProfileDir(profile, home);
	const manifestPath = join(dir, "package.json");
	if (!existsSync(manifestPath)) return [];
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	const bundles = new Set(manifest.dsh?.profile?.bundles ?? []);
	const disabledRows = collectDisabledRows(profile, home);
	const rows = [];
	for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
		const installedDir = realInstalledDir(join(dir, "node_modules", name));
		const row = {
			name,
			spec,
			bundle: bundles.has(name),
			installedDir
		};
		if (spec.startsWith("file:") || spec.startsWith("link:")) row.sourceDir = spec.slice(spec.indexOf(":") + 1);
		else row.range = spec;
		const rowIds = collectPluginRowIds(row, dir);
		const by = [];
		for (const id of rowIds) {
			const layers = disabledRows.get(id);
			if (layers !== void 0) by.push(...layers);
		}
		if (by.length > 0) {
			row.disabled = true;
			row.disabledBy = [...new Set(by)];
		}
		rows.push(row);
	}
	return rows;
}
/**
* Collect the loader row ids one plugin inserts through its bundle patch
* (its cordis.patch.yml `insert` rows). Falls back to the package name.
*/
function collectPluginRowIds(row, profileDir) {
	const ids = /* @__PURE__ */ new Set();
	ids.add(row.name);
	const roots = [row.sourceDir, row.installedDir].filter((root) => root !== void 0 && root !== "");
	for (const root of roots) {
		const patchPath = join(root, "cordis.patch.yml");
		if (!existsSync(patchPath)) continue;
		let text;
		try {
			text = readFileSync(patchPath, "utf8");
		} catch {
			continue;
		}
		for (const match of text.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)) ids.add(match[1]);
	}
	return [...ids];
}
/**
* Collect disabled:true row ids from the home patch and the profile patch.
* Returns a map of row id → list of disabling layers.
*/
function collectDisabledRows(profile, home = resolveHome()) {
	const result = /* @__PURE__ */ new Map();
	const readLayer = (path, label) => {
		if (!existsSync(path)) return;
		let text;
		try {
			text = readFileSync(path, "utf8");
		} catch {
			return;
		}
		const lines = text.split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const match = /^\s*-\s+id:\s*(\S+)\s*$/.exec(lines[i]);
			if (match === null) continue;
			const ahead = lines.slice(i + 1, i + 4).join("\n");
			if (/disabled:\s*true/.test(ahead)) {
				const id = match[1];
				const layers = result.get(id) ?? [];
				layers.push(label);
				result.set(id, layers);
			}
		}
	};
	readLayer(resolveHomePatch(home), "home");
	readLayer(join(resolveProfileDir(profile, home), "cordis.patch.yml"), "profile");
	return result;
}
/** Realpath an installed package dir; '' when absent or unreadable. */
function realInstalledDir(path) {
	try {
		return realpathSync(path);
	} catch {
		return "";
	}
}
//#endregion
//#region node_modules/.pnpm/js-yaml@4.3.1/node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;
	function isNothing(subject) {
		return typeof subject === "undefined" || subject === null;
	}
	function isObject(subject) {
		return typeof subject === "object" && subject !== null;
	}
	function toArray(sequence) {
		if (Array.isArray(sequence)) return sequence;
		else if (isNothing(sequence)) return [];
		return [sequence];
	}
	function extend(target, source) {
		if (source) {
			const sourceKeys = Object.keys(source);
			for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
				const key = sourceKeys[index];
				target[key] = source[key];
			}
		}
		return target;
	}
	function repeat(string, count) {
		let result = "";
		for (let cycle = 0; cycle < count; cycle += 1) result += string;
		return result;
	}
	function isNegativeZero(number) {
		return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
	}
	common.isNothing = isNothing;
	common.isObject = isObject;
	common.toArray = toArray;
	common.repeat = repeat;
	common.isNegativeZero = isNegativeZero;
	common.extend = extend;
	return common;
}
var exception;
var hasRequiredException;
function requireException() {
	if (hasRequiredException) return exception;
	hasRequiredException = 1;
	function formatError(exception2, compact) {
		let where = "";
		const message = exception2.reason || "(unknown reason)";
		if (!exception2.mark) return message;
		if (exception2.mark.name) where += "in \"" + exception2.mark.name + "\" ";
		where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
		if (!compact && exception2.mark.snippet) where += "\n\n" + exception2.mark.snippet;
		return message + " " + where;
	}
	function YAMLException2(reason, mark) {
		Error.call(this);
		this.name = "YAMLException";
		this.reason = reason;
		this.mark = mark;
		this.message = formatError(this, false);
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		else this.stack = (/* @__PURE__ */ new Error()).stack || "";
	}
	YAMLException2.prototype = Object.create(Error.prototype);
	YAMLException2.prototype.constructor = YAMLException2;
	YAMLException2.prototype.toString = function toString(compact) {
		return this.name + ": " + formatError(this, compact);
	};
	exception = YAMLException2;
	return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
	if (hasRequiredSnippet) return snippet;
	hasRequiredSnippet = 1;
	const common2 = requireCommon();
	function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
		let head = "";
		let tail = "";
		const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
		if (position - lineStart > maxHalfLength) {
			head = " ... ";
			lineStart = position - maxHalfLength + head.length;
		}
		if (lineEnd - position > maxHalfLength) {
			tail = " ...";
			lineEnd = position + maxHalfLength - tail.length;
		}
		return {
			str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
			pos: position - lineStart + head.length
		};
	}
	function padStart(string, max) {
		return common2.repeat(" ", max - string.length) + string;
	}
	function makeSnippet(mark, options) {
		options = Object.create(options || null);
		if (!mark.buffer) return null;
		if (!options.maxLength) options.maxLength = 79;
		if (typeof options.indent !== "number") options.indent = 1;
		if (typeof options.linesBefore !== "number") options.linesBefore = 3;
		if (typeof options.linesAfter !== "number") options.linesAfter = 2;
		const re = /\r?\n|\r|\0/g;
		const lineStarts = [0];
		const lineEnds = [];
		let match;
		let foundLineNo = -1;
		while (match = re.exec(mark.buffer)) {
			lineEnds.push(match.index);
			lineStarts.push(match.index + match[0].length);
			if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
		}
		if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
		let result = "";
		const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
		const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
		for (let i = 1; i <= options.linesBefore; i++) {
			if (foundLineNo - i < 0) break;
			const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
			result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
		}
		const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
		result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
		for (let i = 1; i <= options.linesAfter; i++) {
			if (foundLineNo + i >= lineEnds.length) break;
			const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
			result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
		}
		return result.replace(/\n$/, "");
	}
	snippet = makeSnippet;
	return snippet;
}
var type;
var hasRequiredType;
function requireType() {
	if (hasRequiredType) return type;
	hasRequiredType = 1;
	const YAMLException2 = requireException();
	const TYPE_CONSTRUCTOR_OPTIONS = [
		"kind",
		"multi",
		"resolve",
		"construct",
		"instanceOf",
		"predicate",
		"represent",
		"representName",
		"defaultStyle",
		"styleAliases"
	];
	const YAML_NODE_KINDS = [
		"scalar",
		"sequence",
		"mapping"
	];
	function compileStyleAliases(map2) {
		const result = {};
		if (map2 !== null) Object.keys(map2).forEach(function(style) {
			map2[style].forEach(function(alias) {
				result[String(alias)] = style;
			});
		});
		return result;
	}
	function Type2(tag, options) {
		options = options || {};
		Object.keys(options).forEach(function(name) {
			if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException2("Unknown option \"" + name + "\" is met in definition of \"" + tag + "\" YAML type.");
		});
		this.options = options;
		this.tag = tag;
		this.kind = options["kind"] || null;
		this.resolve = options["resolve"] || function() {
			return true;
		};
		this.construct = options["construct"] || function(data) {
			return data;
		};
		this.instanceOf = options["instanceOf"] || null;
		this.predicate = options["predicate"] || null;
		this.represent = options["represent"] || null;
		this.representName = options["representName"] || null;
		this.defaultStyle = options["defaultStyle"] || null;
		this.multi = options["multi"] || false;
		this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
		if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException2("Unknown kind \"" + this.kind + "\" is specified for \"" + tag + "\" YAML type.");
	}
	type = Type2;
	return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
	if (hasRequiredSchema) return schema;
	hasRequiredSchema = 1;
	const YAMLException2 = requireException();
	const Type2 = requireType();
	function compileList(schema2, name) {
		const result = [];
		schema2[name].forEach(function(currentType) {
			let newIndex = result.length;
			result.forEach(function(previousType, previousIndex) {
				if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
			});
			result[newIndex] = currentType;
		});
		return result;
	}
	function compileMap() {
		const result = {
			scalar: {},
			sequence: {},
			mapping: {},
			fallback: {},
			multi: {
				scalar: [],
				sequence: [],
				mapping: [],
				fallback: []
			}
		};
		function collectType(type2) {
			if (type2.multi) {
				result.multi[type2.kind].push(type2);
				result.multi["fallback"].push(type2);
			} else result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
		}
		for (let index = 0, length = arguments.length; index < length; index += 1) arguments[index].forEach(collectType);
		return result;
	}
	function Schema2(definition) {
		return this.extend(definition);
	}
	Schema2.prototype.extend = function extend(definition) {
		let implicit = [];
		let explicit = [];
		if (definition instanceof Type2) explicit.push(definition);
		else if (Array.isArray(definition)) explicit = explicit.concat(definition);
		else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
			if (definition.implicit) implicit = implicit.concat(definition.implicit);
			if (definition.explicit) explicit = explicit.concat(definition.explicit);
		} else throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
		implicit.forEach(function(type2) {
			if (!(type2 instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
			if (type2.loadKind && type2.loadKind !== "scalar") throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
			if (type2.multi) throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
		});
		explicit.forEach(function(type2) {
			if (!(type2 instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
		});
		const result = Object.create(Schema2.prototype);
		result.implicit = (this.implicit || []).concat(implicit);
		result.explicit = (this.explicit || []).concat(explicit);
		result.compiledImplicit = compileList(result, "implicit");
		result.compiledExplicit = compileList(result, "explicit");
		result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
		return result;
	};
	schema = Schema2;
	return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
	if (hasRequiredStr) return str;
	hasRequiredStr = 1;
	str = new (requireType())("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: function(data) {
			return data !== null ? data : "";
		}
	});
	return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
	if (hasRequiredSeq) return seq;
	hasRequiredSeq = 1;
	seq = new (requireType())("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: function(data) {
			return data !== null ? data : [];
		}
	});
	return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
	if (hasRequiredMap) return map;
	hasRequiredMap = 1;
	map = new (requireType())("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: function(data) {
			return data !== null ? data : {};
		}
	});
	return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
	if (hasRequiredFailsafe) return failsafe;
	hasRequiredFailsafe = 1;
	failsafe = new (requireSchema())({ explicit: [
		requireStr(),
		requireSeq(),
		requireMap()
	] });
	return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
	if (hasRequired_null) return _null;
	hasRequired_null = 1;
	const Type2 = requireType();
	function resolveYamlNull(data) {
		if (data === null) return true;
		const max = data.length;
		return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
	}
	function constructYamlNull() {
		return null;
	}
	function isNull(object) {
		return object === null;
	}
	_null = new Type2("tag:yaml.org,2002:null", {
		kind: "scalar",
		resolve: resolveYamlNull,
		construct: constructYamlNull,
		predicate: isNull,
		represent: {
			canonical: function() {
				return "~";
			},
			lowercase: function() {
				return "null";
			},
			uppercase: function() {
				return "NULL";
			},
			camelcase: function() {
				return "Null";
			},
			empty: function() {
				return "";
			}
		},
		defaultStyle: "lowercase"
	});
	return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
	if (hasRequiredBool) return bool;
	hasRequiredBool = 1;
	const Type2 = requireType();
	function resolveYamlBoolean(data) {
		if (data === null) return false;
		const max = data.length;
		return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
	}
	function constructYamlBoolean(data) {
		return data === "true" || data === "True" || data === "TRUE";
	}
	function isBoolean(object) {
		return Object.prototype.toString.call(object) === "[object Boolean]";
	}
	bool = new Type2("tag:yaml.org,2002:bool", {
		kind: "scalar",
		resolve: resolveYamlBoolean,
		construct: constructYamlBoolean,
		predicate: isBoolean,
		represent: {
			lowercase: function(object) {
				return object ? "true" : "false";
			},
			uppercase: function(object) {
				return object ? "TRUE" : "FALSE";
			},
			camelcase: function(object) {
				return object ? "True" : "False";
			}
		},
		defaultStyle: "lowercase"
	});
	return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
	if (hasRequiredInt) return int;
	hasRequiredInt = 1;
	const common2 = requireCommon();
	const Type2 = requireType();
	function isHexCode(c) {
		return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
	}
	function isOctCode(c) {
		return c >= 48 && c <= 55;
	}
	function isDecCode(c) {
		return c >= 48 && c <= 57;
	}
	function resolveYamlInteger(data) {
		if (data === null) return false;
		const max = data.length;
		let index = 0;
		let hasDigits = false;
		if (!max) return false;
		let ch = data[index];
		if (ch === "-" || ch === "+") ch = data[++index];
		if (ch === "0") {
			if (index + 1 === max) return true;
			ch = data[++index];
			if (ch === "b") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch !== "0" && ch !== "1") return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
			if (ch === "x") {
				index++;
				for (; index < max; index++) {
					if (!isHexCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
			if (ch === "o") {
				index++;
				for (; index < max; index++) {
					if (!isOctCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
		}
		for (; index < max; index++) {
			if (!isDecCode(data.charCodeAt(index))) return false;
			hasDigits = true;
		}
		if (!hasDigits) return false;
		return isFinite(parseYamlInteger(data));
	}
	function parseYamlInteger(data) {
		let value = data;
		let sign = 1;
		let ch = value[0];
		if (ch === "-" || ch === "+") {
			if (ch === "-") sign = -1;
			value = value.slice(1);
			ch = value[0];
		}
		if (value === "0") return 0;
		if (ch === "0") {
			if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
			if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
			if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
		}
		return sign * parseInt(value, 10);
	}
	function constructYamlInteger(data) {
		return parseYamlInteger(data);
	}
	function isInteger(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common2.isNegativeZero(object);
	}
	int = new Type2("tag:yaml.org,2002:int", {
		kind: "scalar",
		resolve: resolveYamlInteger,
		construct: constructYamlInteger,
		predicate: isInteger,
		represent: {
			binary: function(obj) {
				return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
			},
			octal: function(obj) {
				return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
			},
			decimal: function(obj) {
				return obj.toString(10);
			},
			hexadecimal: function(obj) {
				return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
			}
		},
		defaultStyle: "decimal",
		styleAliases: {
			binary: [2, "bin"],
			octal: [8, "oct"],
			decimal: [10, "dec"],
			hexadecimal: [16, "hex"]
		}
	});
	return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
	if (hasRequiredFloat) return float;
	hasRequiredFloat = 1;
	const common2 = requireCommon();
	const Type2 = requireType();
	const YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	const YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	function resolveYamlFloat(data) {
		if (data === null) return false;
		if (!YAML_FLOAT_PATTERN.test(data)) return false;
		if (isFinite(parseFloat(data, 10))) return true;
		return YAML_FLOAT_SPECIAL_PATTERN.test(data);
	}
	function constructYamlFloat(data) {
		let value = data.toLowerCase();
		const sign = value[0] === "-" ? -1 : 1;
		if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
		if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
		else if (value === ".nan") return NaN;
		return sign * parseFloat(value, 10);
	}
	const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
	function representYamlFloat(object, style) {
		if (isNaN(object)) switch (style) {
			case "lowercase": return ".nan";
			case "uppercase": return ".NAN";
			case "camelcase": return ".NaN";
		}
		else if (Number.POSITIVE_INFINITY === object) switch (style) {
			case "lowercase": return ".inf";
			case "uppercase": return ".INF";
			case "camelcase": return ".Inf";
		}
		else if (Number.NEGATIVE_INFINITY === object) switch (style) {
			case "lowercase": return "-.inf";
			case "uppercase": return "-.INF";
			case "camelcase": return "-.Inf";
		}
		else if (common2.isNegativeZero(object)) return "-0.0";
		const res = object.toString(10);
		return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
	}
	function isFloat(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
	}
	float = new Type2("tag:yaml.org,2002:float", {
		kind: "scalar",
		resolve: resolveYamlFloat,
		construct: constructYamlFloat,
		predicate: isFloat,
		represent: representYamlFloat,
		defaultStyle: "lowercase"
	});
	return float;
}
var json$1;
var hasRequiredJson;
function requireJson() {
	if (hasRequiredJson) return json$1;
	hasRequiredJson = 1;
	json$1 = requireFailsafe().extend({ implicit: [
		require_null(),
		requireBool(),
		requireInt(),
		requireFloat()
	] });
	return json$1;
}
var core;
var hasRequiredCore;
function requireCore() {
	if (hasRequiredCore) return core;
	hasRequiredCore = 1;
	core = requireJson();
	return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
	if (hasRequiredTimestamp) return timestamp;
	hasRequiredTimestamp = 1;
	const Type2 = requireType();
	const YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
	const YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
	function resolveYamlTimestamp(data) {
		if (data === null) return false;
		if (YAML_DATE_REGEXP.exec(data) !== null) return true;
		if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
		return false;
	}
	function constructYamlTimestamp(data) {
		let fraction = 0;
		let delta = null;
		let match = YAML_DATE_REGEXP.exec(data);
		if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
		if (match === null) throw new Error("Date resolve error");
		const year = +match[1];
		const month = +match[2] - 1;
		const day = +match[3];
		if (!match[4]) return new Date(Date.UTC(year, month, day));
		const hour = +match[4];
		const minute = +match[5];
		const second = +match[6];
		if (match[7]) {
			fraction = match[7].slice(0, 3);
			while (fraction.length < 3) fraction += "0";
			fraction = +fraction;
		}
		if (match[9]) {
			const tzHour = +match[10];
			const tzMinute = +(match[11] || 0);
			delta = (tzHour * 60 + tzMinute) * 6e4;
			if (match[9] === "-") delta = -delta;
		}
		const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
		if (delta) date.setTime(date.getTime() - delta);
		return date;
	}
	function representYamlTimestamp(object) {
		return object.toISOString();
	}
	timestamp = new Type2("tag:yaml.org,2002:timestamp", {
		kind: "scalar",
		resolve: resolveYamlTimestamp,
		construct: constructYamlTimestamp,
		instanceOf: Date,
		represent: representYamlTimestamp
	});
	return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
	if (hasRequiredMerge) return merge;
	hasRequiredMerge = 1;
	const Type2 = requireType();
	function resolveYamlMerge(data) {
		return data === "<<" || data === null;
	}
	merge = new Type2("tag:yaml.org,2002:merge", {
		kind: "scalar",
		resolve: resolveYamlMerge
	});
	return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
	if (hasRequiredBinary) return binary;
	hasRequiredBinary = 1;
	const Type2 = requireType();
	const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
	function resolveYamlBinary(data) {
		if (data === null) return false;
		let bitlen = 0;
		const max = data.length;
		const map2 = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			const code = map2.indexOf(data.charAt(idx));
			if (code > 64) continue;
			if (code < 0) return false;
			bitlen += 6;
		}
		return bitlen % 8 === 0;
	}
	function constructYamlBinary(data) {
		const input = data.replace(/[\r\n=]/g, "");
		const max = input.length;
		const map2 = BASE64_MAP;
		let bits = 0;
		const result = [];
		for (let idx = 0; idx < max; idx++) {
			if (idx % 4 === 0 && idx) {
				result.push(bits >> 16 & 255);
				result.push(bits >> 8 & 255);
				result.push(bits & 255);
			}
			bits = bits << 6 | map2.indexOf(input.charAt(idx));
		}
		const tailbits = max % 4 * 6;
		if (tailbits === 0) {
			result.push(bits >> 16 & 255);
			result.push(bits >> 8 & 255);
			result.push(bits & 255);
		} else if (tailbits === 18) {
			result.push(bits >> 10 & 255);
			result.push(bits >> 2 & 255);
		} else if (tailbits === 12) result.push(bits >> 4 & 255);
		return new Uint8Array(result);
	}
	function representYamlBinary(object) {
		let result = "";
		let bits = 0;
		const max = object.length;
		const map2 = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			if (idx % 3 === 0 && idx) {
				result += map2[bits >> 18 & 63];
				result += map2[bits >> 12 & 63];
				result += map2[bits >> 6 & 63];
				result += map2[bits & 63];
			}
			bits = (bits << 8) + object[idx];
		}
		const tail = max % 3;
		if (tail === 0) {
			result += map2[bits >> 18 & 63];
			result += map2[bits >> 12 & 63];
			result += map2[bits >> 6 & 63];
			result += map2[bits & 63];
		} else if (tail === 2) {
			result += map2[bits >> 10 & 63];
			result += map2[bits >> 4 & 63];
			result += map2[bits << 2 & 63];
			result += map2[64];
		} else if (tail === 1) {
			result += map2[bits >> 2 & 63];
			result += map2[bits << 4 & 63];
			result += map2[64];
			result += map2[64];
		}
		return result;
	}
	function isBinary(obj) {
		return Object.prototype.toString.call(obj) === "[object Uint8Array]";
	}
	binary = new Type2("tag:yaml.org,2002:binary", {
		kind: "scalar",
		resolve: resolveYamlBinary,
		construct: constructYamlBinary,
		predicate: isBinary,
		represent: representYamlBinary
	});
	return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
	if (hasRequiredOmap) return omap;
	hasRequiredOmap = 1;
	const Type2 = requireType();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const _toString = Object.prototype.toString;
	function resolveYamlOmap(data) {
		if (data === null) return true;
		const objectKeys = {};
		const object = data;
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			let pairHasKey = false;
			if (_toString.call(pair) !== "[object Object]") return false;
			let pairKey;
			for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) if (!pairHasKey) pairHasKey = true;
			else return false;
			if (!pairHasKey) return false;
			if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
			Object.defineProperty(objectKeys, pairKey, { value: true });
		}
		return true;
	}
	function constructYamlOmap(data) {
		return data !== null ? data : [];
	}
	omap = new Type2("tag:yaml.org,2002:omap", {
		kind: "sequence",
		resolve: resolveYamlOmap,
		construct: constructYamlOmap
	});
	return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
	if (hasRequiredPairs) return pairs;
	hasRequiredPairs = 1;
	const Type2 = requireType();
	const _toString = Object.prototype.toString;
	function resolveYamlPairs(data) {
		if (data === null) return true;
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			if (_toString.call(pair) !== "[object Object]") return false;
			const keys = Object.keys(pair);
			if (keys.length !== 1) return false;
			result[index] = [keys[0], pair[keys[0]]];
		}
		return true;
	}
	function constructYamlPairs(data) {
		if (data === null) return [];
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			const keys = Object.keys(pair);
			result[index] = [keys[0], pair[keys[0]]];
		}
		return result;
	}
	pairs = new Type2("tag:yaml.org,2002:pairs", {
		kind: "sequence",
		resolve: resolveYamlPairs,
		construct: constructYamlPairs
	});
	return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
	if (hasRequiredSet) return set;
	hasRequiredSet = 1;
	const Type2 = requireType();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	function resolveYamlSet(data) {
		if (data === null) return true;
		const object = data;
		for (const key in object) if (_hasOwnProperty.call(object, key)) {
			if (object[key] !== null) return false;
		}
		return true;
	}
	function constructYamlSet(data) {
		return data !== null ? data : {};
	}
	set = new Type2("tag:yaml.org,2002:set", {
		kind: "mapping",
		resolve: resolveYamlSet,
		construct: constructYamlSet
	});
	return set;
}
var _default;
var hasRequired_default;
function require_default() {
	if (hasRequired_default) return _default;
	hasRequired_default = 1;
	_default = requireCore().extend({
		implicit: [requireTimestamp(), requireMerge()],
		explicit: [
			requireBinary(),
			requireOmap(),
			requirePairs(),
			requireSet()
		]
	});
	return _default;
}
var hasRequiredLoader;
function requireLoader() {
	if (hasRequiredLoader) return loader;
	hasRequiredLoader = 1;
	const common2 = requireCommon();
	const YAMLException2 = requireException();
	const makeSnippet = requireSnippet();
	const DEFAULT_SCHEMA2 = require_default();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const CONTEXT_FLOW_IN = 1;
	const CONTEXT_FLOW_OUT = 2;
	const CONTEXT_BLOCK_IN = 3;
	const CONTEXT_BLOCK_OUT = 4;
	const CHOMPING_CLIP = 1;
	const CHOMPING_STRIP = 2;
	const CHOMPING_KEEP = 3;
	const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
	const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
	const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
	const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
	function _class(obj) {
		return Object.prototype.toString.call(obj);
	}
	function isEol(c) {
		return c === 10 || c === 13;
	}
	function isWhiteSpace(c) {
		return c === 9 || c === 32;
	}
	function isWsOrEol(c) {
		return c === 9 || c === 32 || c === 10 || c === 13;
	}
	function isFlowIndicator(c) {
		return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
	}
	function fromHexCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		const lc = c | 32;
		if (lc >= 97 && lc <= 102) return lc - 97 + 10;
		return -1;
	}
	function escapedHexLen(c) {
		if (c === 120) return 2;
		if (c === 117) return 4;
		if (c === 85) return 8;
		return 0;
	}
	function fromDecimalCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		return -1;
	}
	function simpleEscapeSequence(c) {
		switch (c) {
			case 48: return "\0";
			case 97: return "\x07";
			case 98: return "\b";
			case 116: return "	";
			case 9: return "	";
			case 110: return "\n";
			case 118: return "\v";
			case 102: return "\f";
			case 114: return "\r";
			case 101: return "\x1B";
			case 32: return " ";
			case 34: return "\"";
			case 47: return "/";
			case 92: return "\\";
			case 78: return "";
			case 95: return "\xA0";
			case 76: return "\u2028";
			case 80: return "\u2029";
			default: return "";
		}
	}
	function charFromCodepoint(c) {
		if (c <= 65535) return String.fromCharCode(c);
		return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
	}
	function setProperty(object, key, value) {
		if (key === "__proto__") Object.defineProperty(object, key, {
			configurable: true,
			enumerable: true,
			writable: true,
			value
		});
		else object[key] = value;
	}
	const simpleEscapeCheck = new Array(256);
	const simpleEscapeMap = new Array(256);
	for (let i = 0; i < 256; i++) {
		simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
		simpleEscapeMap[i] = simpleEscapeSequence(i);
	}
	function State(input, options) {
		this.input = input;
		this.filename = options["filename"] || null;
		this.schema = options["schema"] || DEFAULT_SCHEMA2;
		this.onWarning = options["onWarning"] || null;
		this.legacy = options["legacy"] || false;
		this.json = options["json"] || false;
		this.listener = options["listener"] || null;
		this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
		this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
		this.implicitTypes = this.schema.compiledImplicit;
		this.typeMap = this.schema.compiledTypeMap;
		this.length = input.length;
		this.position = 0;
		this.line = 0;
		this.lineStart = 0;
		this.lineIndent = 0;
		this.depth = 0;
		this.totalMergeKeys = 0;
		this.firstTabInLine = -1;
		this.documents = [];
		this.anchorMapTransactions = [];
	}
	function generateError(state, message) {
		const mark = {
			name: state.filename,
			buffer: state.input.slice(0, -1),
			position: state.position,
			line: state.line,
			column: state.position - state.lineStart
		};
		mark.snippet = makeSnippet(mark);
		return new YAMLException2(message, mark);
	}
	function throwError(state, message) {
		throw generateError(state, message);
	}
	function throwWarning(state, message) {
		if (state.onWarning) state.onWarning.call(null, generateError(state, message));
	}
	function storeAnchor(state, name, value) {
		const transactions = state.anchorMapTransactions;
		if (transactions.length !== 0) {
			const transaction = transactions[transactions.length - 1];
			if (!_hasOwnProperty.call(transaction, name)) transaction[name] = {
				existed: _hasOwnProperty.call(state.anchorMap, name),
				value: state.anchorMap[name]
			};
		}
		state.anchorMap[name] = value;
	}
	function beginAnchorTransaction(state) {
		state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
	}
	function commitAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const transactions = state.anchorMapTransactions;
		if (transactions.length === 0) return;
		const parent = transactions[transactions.length - 1];
		const names = Object.keys(transaction);
		for (let index = 0, length = names.length; index < length; index += 1) {
			const name = names[index];
			if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
		}
	}
	function rollbackAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const names = Object.keys(transaction);
		for (let index = names.length - 1; index >= 0; index -= 1) {
			const entry = transaction[names[index]];
			if (entry.existed) state.anchorMap[names[index]] = entry.value;
			else delete state.anchorMap[names[index]];
		}
	}
	function snapshotState(state) {
		return {
			position: state.position,
			line: state.line,
			lineStart: state.lineStart,
			lineIndent: state.lineIndent,
			firstTabInLine: state.firstTabInLine,
			tag: state.tag,
			anchor: state.anchor,
			kind: state.kind,
			result: state.result
		};
	}
	function restoreState(state, snapshot) {
		state.position = snapshot.position;
		state.line = snapshot.line;
		state.lineStart = snapshot.lineStart;
		state.lineIndent = snapshot.lineIndent;
		state.firstTabInLine = snapshot.firstTabInLine;
		state.tag = snapshot.tag;
		state.anchor = snapshot.anchor;
		state.kind = snapshot.kind;
		state.result = snapshot.result;
	}
	const directiveHandlers = {
		YAML: function handleYamlDirective(state, name, args) {
			if (state.version !== null) throwError(state, "duplication of %YAML directive");
			if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
			const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
			if (match === null) throwError(state, "ill-formed argument of the YAML directive");
			const major = parseInt(match[1], 10);
			const minor = parseInt(match[2], 10);
			if (major !== 1) throwError(state, "unacceptable YAML version of the document");
			state.version = args[0];
			state.checkLineBreaks = minor < 2;
			if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
		},
		TAG: function handleTagDirective(state, name, args) {
			let prefix;
			if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
			const handle = args[0];
			prefix = args[1];
			if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
			if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, "there is a previously declared suffix for \"" + handle + "\" tag handle");
			if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
			try {
				prefix = decodeURIComponent(prefix);
			} catch (err) {
				throwError(state, "tag prefix is malformed: " + prefix);
			}
			state.tagMap[handle] = prefix;
		}
	};
	function captureSegment(state, start, end, checkJson) {
		if (start < end) {
			const _result = state.input.slice(start, end);
			if (checkJson) for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
				const _character = _result.charCodeAt(_position);
				if (!(_character === 9 || _character >= 32 && _character <= 1114111)) throwError(state, "expected valid JSON character");
			}
			else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
			state.result += _result;
		}
	}
	function mergeMappings(state, destination, source, overridableKeys) {
		if (!common2.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
		const sourceKeys = Object.keys(source);
		for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
			const key = sourceKeys[index];
			if (state.maxTotalMergeKeys !== -1 && ++state.totalMergeKeys > state.maxTotalMergeKeys) throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
			if (!_hasOwnProperty.call(destination, key)) {
				setProperty(destination, key, source[key]);
				overridableKeys[key] = true;
			}
		}
	}
	function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
		if (Array.isArray(keyNode)) {
			keyNode = Array.prototype.slice.call(keyNode);
			for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
				if (Array.isArray(keyNode[index])) throwError(state, "nested arrays are not supported inside keys");
				if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") keyNode[index] = "[object Object]";
			}
		}
		if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
		keyNode = String(keyNode);
		if (_result === null) _result = {};
		if (keyTag === "tag:yaml.org,2002:merge") if (Array.isArray(valueNode)) for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) mergeMappings(state, _result, valueNode[index], overridableKeys);
		else mergeMappings(state, _result, valueNode, overridableKeys);
		else {
			if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
				state.line = startLine || state.line;
				state.lineStart = startLineStart || state.lineStart;
				state.position = startPos || state.position;
				throwError(state, "duplicated mapping key");
			}
			setProperty(_result, keyNode, valueNode);
			delete overridableKeys[keyNode];
		}
		return _result;
	}
	function readLineBreak(state) {
		const ch = state.input.charCodeAt(state.position);
		if (ch === 10) state.position++;
		else if (ch === 13) {
			state.position++;
			if (state.input.charCodeAt(state.position) === 10) state.position++;
		} else throwError(state, "a line break is expected");
		state.line += 1;
		state.lineStart = state.position;
		state.firstTabInLine = -1;
	}
	function skipSeparationSpace(state, allowComments, checkIndent) {
		let lineBreaks = 0;
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			while (isWhiteSpace(ch)) {
				if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
				ch = state.input.charCodeAt(++state.position);
			}
			if (allowComments && ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 10 && ch !== 13 && ch !== 0);
			if (isEol(ch)) {
				readLineBreak(state);
				ch = state.input.charCodeAt(state.position);
				lineBreaks++;
				state.lineIndent = 0;
				while (ch === 32) {
					state.lineIndent++;
					ch = state.input.charCodeAt(++state.position);
				}
			} else break;
		}
		if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
		return lineBreaks;
	}
	function testDocumentSeparator(state) {
		let _position = state.position;
		let ch = state.input.charCodeAt(_position);
		if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
			_position += 3;
			ch = state.input.charCodeAt(_position);
			if (ch === 0 || isWsOrEol(ch)) return true;
		}
		return false;
	}
	function writeFoldedLines(state, count) {
		if (count === 1) state.result += " ";
		else if (count > 1) state.result += common2.repeat("\n", count - 1);
	}
	function readPlainScalar(state, nodeIndent, withinFlowCollection) {
		let captureStart;
		let captureEnd;
		let hasPendingContent;
		let _line;
		let _lineStart;
		let _lineIndent;
		const _kind = state.kind;
		const _result = state.result;
		let ch = state.input.charCodeAt(state.position);
		if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
		if (ch === 63 || ch === 45) {
			const following = state.input.charCodeAt(state.position + 1);
			if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) return false;
		}
		state.kind = "scalar";
		state.result = "";
		captureStart = captureEnd = state.position;
		hasPendingContent = false;
		while (ch !== 0) {
			if (ch === 58) {
				const following = state.input.charCodeAt(state.position + 1);
				if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) break;
			} else if (ch === 35) {
				if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
			} else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) break;
			else if (isEol(ch)) {
				_line = state.line;
				_lineStart = state.lineStart;
				_lineIndent = state.lineIndent;
				skipSeparationSpace(state, false, -1);
				if (state.lineIndent >= nodeIndent) {
					hasPendingContent = true;
					ch = state.input.charCodeAt(state.position);
					continue;
				} else {
					state.position = captureEnd;
					state.line = _line;
					state.lineStart = _lineStart;
					state.lineIndent = _lineIndent;
					break;
				}
			}
			if (hasPendingContent) {
				captureSegment(state, captureStart, captureEnd, false);
				writeFoldedLines(state, state.line - _line);
				captureStart = captureEnd = state.position;
				hasPendingContent = false;
			}
			if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
			ch = state.input.charCodeAt(++state.position);
		}
		captureSegment(state, captureStart, captureEnd, false);
		if (state.result) return true;
		state.kind = _kind;
		state.result = _result;
		return false;
	}
	function readSingleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 39) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (ch === 39) {
				captureStart = state.position;
				state.position++;
				captureEnd = state.position;
			} else return true;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a single quoted scalar");
	}
	function readDoubleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 34) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
			captureSegment(state, captureStart, state.position, true);
			state.position++;
			return true;
		} else if (ch === 92) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
			else if (ch < 256 && simpleEscapeCheck[ch]) {
				state.result += simpleEscapeMap[ch];
				state.position++;
			} else if ((tmp = escapedHexLen(ch)) > 0) {
				let hexLength = tmp;
				let hexResult = 0;
				for (; hexLength > 0; hexLength--) {
					ch = state.input.charCodeAt(++state.position);
					if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
					else throwError(state, "expected hexadecimal character");
				}
				state.result += charFromCodepoint(hexResult);
				state.position++;
			} else throwError(state, "unknown escape sequence");
			captureStart = captureEnd = state.position;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a double quoted scalar");
	}
	function readFlowCollection(state, nodeIndent) {
		let readNext = true;
		let _line;
		let _lineStart;
		let _pos;
		const _tag = state.tag;
		let _result;
		const _anchor = state.anchor;
		let terminator;
		let isPair;
		let isExplicitPair;
		let isMapping;
		const overridableKeys = /* @__PURE__ */ Object.create(null);
		let keyNode;
		let keyTag;
		let valueNode;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 91) {
			terminator = 93;
			isMapping = false;
			_result = [];
		} else if (ch === 123) {
			terminator = 125;
			isMapping = true;
			_result = {};
		} else return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		ch = state.input.charCodeAt(++state.position);
		while (ch !== 0) {
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === terminator) {
				state.position++;
				state.tag = _tag;
				state.anchor = _anchor;
				state.kind = isMapping ? "mapping" : "sequence";
				state.result = _result;
				return true;
			} else if (!readNext) throwError(state, "missed comma between flow collection entries");
			else if (ch === 44) throwError(state, "expected the node content, but found ','");
			keyTag = keyNode = valueNode = null;
			isPair = isExplicitPair = false;
			if (ch === 63) {
				if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
					isPair = isExplicitPair = true;
					state.position++;
					skipSeparationSpace(state, true, nodeIndent);
				}
			}
			_line = state.line;
			_lineStart = state.lineStart;
			_pos = state.position;
			composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
			keyTag = state.tag;
			keyNode = state.result;
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if ((isExplicitPair || state.line === _line) && ch === 58) {
				isPair = true;
				ch = state.input.charCodeAt(++state.position);
				skipSeparationSpace(state, true, nodeIndent);
				composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
				valueNode = state.result;
			}
			if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
			else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
			else _result.push(keyNode);
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === 44) {
				readNext = true;
				ch = state.input.charCodeAt(++state.position);
			} else readNext = false;
		}
		throwError(state, "unexpected end of the stream within a flow collection");
	}
	function readBlockScalar(state, nodeIndent) {
		let folding;
		let chomping = CHOMPING_CLIP;
		let didReadContent = false;
		let detectedIndent = false;
		let textIndent = nodeIndent;
		let emptyLines = 0;
		let atMoreIndented = false;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 124) folding = false;
		else if (ch === 62) folding = true;
		else return false;
		state.kind = "scalar";
		state.result = "";
		while (ch !== 0) {
			ch = state.input.charCodeAt(++state.position);
			if (ch === 43 || ch === 45) if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
			else throwError(state, "repeat of a chomping mode identifier");
			else if ((tmp = fromDecimalCode(ch)) >= 0) if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
			else if (!detectedIndent) {
				textIndent = nodeIndent + tmp - 1;
				detectedIndent = true;
			} else throwError(state, "repeat of an indentation width identifier");
			else break;
		}
		if (isWhiteSpace(ch)) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (isWhiteSpace(ch));
			if (ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (!isEol(ch) && ch !== 0);
		}
		while (ch !== 0) {
			readLineBreak(state);
			state.lineIndent = 0;
			ch = state.input.charCodeAt(state.position);
			while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
				state.lineIndent++;
				ch = state.input.charCodeAt(++state.position);
			}
			if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
			if (isEol(ch)) {
				emptyLines++;
				continue;
			}
			if (!detectedIndent && textIndent === 0) throwError(state, "missing indentation for block scalar");
			if (state.lineIndent < textIndent) {
				if (chomping === CHOMPING_KEEP) state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
				else if (chomping === CHOMPING_CLIP) {
					if (didReadContent) state.result += "\n";
				}
				break;
			}
			if (folding) if (isWhiteSpace(ch)) {
				atMoreIndented = true;
				state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			} else if (atMoreIndented) {
				atMoreIndented = false;
				state.result += common2.repeat("\n", emptyLines + 1);
			} else if (emptyLines === 0) {
				if (didReadContent) state.result += " ";
			} else state.result += common2.repeat("\n", emptyLines);
			else state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			didReadContent = true;
			detectedIndent = true;
			emptyLines = 0;
			const captureStart = state.position;
			while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
			captureSegment(state, captureStart, state.position, false);
		}
		return true;
	}
	function readBlockSequence(state, nodeIndent) {
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = [];
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			if (ch !== 45) break;
			if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
			detected = true;
			state.position++;
			if (skipSeparationSpace(state, true, -1)) {
				if (state.lineIndent <= nodeIndent) {
					_result.push(null);
					ch = state.input.charCodeAt(state.position);
					continue;
				}
			}
			const _line = state.line;
			composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
			_result.push(state.result);
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "sequence";
			state.result = _result;
			return true;
		}
		return false;
	}
	function readBlockMapping(state, nodeIndent, flowIndent) {
		let allowCompact;
		let _keyLine;
		let _keyLineStart;
		let _keyPos;
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = {};
		const overridableKeys = /* @__PURE__ */ Object.create(null);
		let keyTag = null;
		let keyNode = null;
		let valueNode = null;
		let atExplicitKey = false;
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (!atExplicitKey && state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			const following = state.input.charCodeAt(state.position + 1);
			const _line = state.line;
			if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
				if (ch === 63) {
					if (atExplicitKey) {
						storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
						keyTag = keyNode = valueNode = null;
					}
					detected = true;
					atExplicitKey = true;
					allowCompact = true;
				} else if (atExplicitKey) {
					atExplicitKey = false;
					allowCompact = true;
				} else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
				state.position += 1;
				ch = following;
			} else {
				_keyLine = state.line;
				_keyLineStart = state.lineStart;
				_keyPos = state.position;
				if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
				if (state.line === _line) {
					ch = state.input.charCodeAt(state.position);
					while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
					if (ch === 58) {
						ch = state.input.charCodeAt(++state.position);
						if (!isWsOrEol(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
						if (atExplicitKey) {
							storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
							keyTag = keyNode = valueNode = null;
						}
						detected = true;
						atExplicitKey = false;
						allowCompact = false;
						keyTag = state.tag;
						keyNode = state.result;
					} else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
					else {
						state.tag = _tag;
						state.anchor = _anchor;
						return true;
					}
				} else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
				else {
					state.tag = _tag;
					state.anchor = _anchor;
					return true;
				}
			}
			if (state.line === _line || state.lineIndent > nodeIndent) {
				if (atExplicitKey) {
					_keyLine = state.line;
					_keyLineStart = state.lineStart;
					_keyPos = state.position;
				}
				if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) if (atExplicitKey) keyNode = state.result;
				else valueNode = state.result;
				if (!atExplicitKey) {
					storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
					keyTag = keyNode = valueNode = null;
				}
				skipSeparationSpace(state, true, -1);
				ch = state.input.charCodeAt(state.position);
			}
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "mapping";
			state.result = _result;
		}
		return detected;
	}
	function readTagProperty(state) {
		let isVerbatim = false;
		let isNamed = false;
		let tagHandle;
		let tagName;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 33) return false;
		if (state.tag !== null) throwError(state, "duplication of a tag property");
		ch = state.input.charCodeAt(++state.position);
		if (ch === 60) {
			isVerbatim = true;
			ch = state.input.charCodeAt(++state.position);
		} else if (ch === 33) {
			isNamed = true;
			tagHandle = "!!";
			ch = state.input.charCodeAt(++state.position);
		} else tagHandle = "!";
		let _position = state.position;
		if (isVerbatim) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 0 && ch !== 62);
			if (state.position < state.length) {
				tagName = state.input.slice(_position, state.position);
				ch = state.input.charCodeAt(++state.position);
			} else throwError(state, "unexpected end of the stream within a verbatim tag");
		} else {
			while (ch !== 0 && !isWsOrEol(ch)) {
				if (ch === 33) if (!isNamed) {
					tagHandle = state.input.slice(_position - 1, state.position + 1);
					if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
					isNamed = true;
					_position = state.position + 1;
				} else throwError(state, "tag suffix cannot contain exclamation marks");
				ch = state.input.charCodeAt(++state.position);
			}
			tagName = state.input.slice(_position, state.position);
			if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
		}
		if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
		try {
			tagName = decodeURIComponent(tagName);
		} catch (err) {
			throwError(state, "tag name is malformed: " + tagName);
		}
		if (isVerbatim) state.tag = tagName;
		else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
		else if (tagHandle === "!") state.tag = "!" + tagName;
		else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
		else throwError(state, "undeclared tag handle \"" + tagHandle + "\"");
		return true;
	}
	function readAnchorProperty(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 38) return false;
		if (state.anchor !== null) throwError(state, "duplication of an anchor property");
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
		state.anchor = state.input.slice(_position, state.position);
		return true;
	}
	function readAlias(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 42) return false;
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
		const alias = state.input.slice(_position, state.position);
		if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, "unidentified alias \"" + alias + "\"");
		state.result = state.anchorMap[alias];
		skipSeparationSpace(state, true, -1);
		return true;
	}
	function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
		const fallbackState = snapshotState(state);
		beginAnchorTransaction(state);
		restoreState(state, propertyStart);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
			commitAnchorTransaction(state);
			return true;
		}
		rollbackAnchorTransaction(state);
		restoreState(state, fallbackState);
		return false;
	}
	function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
		let allowBlockScalars;
		let allowBlockCollections;
		let indentStatus = 1;
		let atNewLine = false;
		let hasContent = false;
		let propertyStart = null;
		let type2;
		let flowIndent;
		let blockIndent;
		if (state.depth >= state.maxDepth) throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
		state.depth += 1;
		if (state.listener !== null) state.listener("open", state);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
		if (allowToSeek) {
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			}
		}
		if (indentStatus === 1) while (true) {
			const ch = state.input.charCodeAt(state.position);
			const propertyState = snapshotState(state);
			if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) break;
			if (!readTagProperty(state) && !readAnchorProperty(state)) break;
			if (propertyStart === null) propertyStart = propertyState;
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				allowBlockCollections = allowBlockStyles;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			} else allowBlockCollections = false;
		}
		if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
		if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
			if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
			else flowIndent = parentIndent + 1;
			blockIndent = state.position - state.lineStart;
			if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
			else {
				const ch = state.input.charCodeAt(state.position);
				if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) hasContent = true;
				else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
				else if (readAlias(state)) {
					hasContent = true;
					if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
				} else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
					hasContent = true;
					if (state.tag === null) state.tag = "?";
				}
				if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
			}
			else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
		}
		if (state.tag === null) {
			if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
		} else if (state.tag === "?") {
			if (state.result !== null && state.kind !== "scalar") throwError(state, "unacceptable node kind for !<?> tag; it should be \"scalar\", not \"" + state.kind + "\"");
			for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
				type2 = state.implicitTypes[typeIndex];
				if (type2.resolve(state.result)) {
					state.result = type2.construct(state.result);
					state.tag = type2.tag;
					if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
					break;
				}
			}
		} else if (state.tag !== "!") {
			if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type2 = state.typeMap[state.kind || "fallback"][state.tag];
			else {
				type2 = null;
				const typeList = state.typeMap.multi[state.kind || "fallback"];
				for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
					type2 = typeList[typeIndex];
					break;
				}
			}
			if (!type2) throwError(state, "unknown tag !<" + state.tag + ">");
			if (state.result !== null && type2.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + "> tag; it should be \"" + type2.kind + "\", not \"" + state.kind + "\"");
			if (!type2.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
			else {
				state.result = type2.construct(state.result, state.tag);
				if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
			}
		}
		if (state.listener !== null) state.listener("close", state);
		state.depth -= 1;
		return state.tag !== null || state.anchor !== null || hasContent;
	}
	function readDocument(state) {
		const documentStart = state.position;
		let hasDirectives = false;
		let ch;
		state.version = null;
		state.checkLineBreaks = state.legacy;
		state.tagMap = /* @__PURE__ */ Object.create(null);
		state.anchorMap = /* @__PURE__ */ Object.create(null);
		while ((ch = state.input.charCodeAt(state.position)) !== 0) {
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if (state.lineIndent > 0 || ch !== 37) break;
			hasDirectives = true;
			ch = state.input.charCodeAt(++state.position);
			let _position = state.position;
			while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
			const directiveName = state.input.slice(_position, state.position);
			const directiveArgs = [];
			if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
			while (ch !== 0) {
				while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
				if (ch === 35) {
					do
						ch = state.input.charCodeAt(++state.position);
					while (ch !== 0 && !isEol(ch));
					break;
				}
				if (isEol(ch)) break;
				_position = state.position;
				while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
				directiveArgs.push(state.input.slice(_position, state.position));
			}
			if (ch !== 0) readLineBreak(state);
			if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
			else throwWarning(state, "unknown document directive \"" + directiveName + "\"");
		}
		skipSeparationSpace(state, true, -1);
		if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
			state.position += 3;
			skipSeparationSpace(state, true, -1);
		} else if (hasDirectives) throwError(state, "directives end mark is expected");
		composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
		skipSeparationSpace(state, true, -1);
		if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
		state.documents.push(state.result);
		if (state.position === state.lineStart && testDocumentSeparator(state)) {
			if (state.input.charCodeAt(state.position) === 46) {
				state.position += 3;
				skipSeparationSpace(state, true, -1);
			}
			return;
		}
		if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
	}
	function loadDocuments(input, options) {
		input = String(input);
		options = options || {};
		if (input.length !== 0) {
			if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
			if (input.charCodeAt(0) === 65279) input = input.slice(1);
		}
		const state = new State(input, options);
		const nullpos = input.indexOf("\0");
		if (nullpos !== -1) {
			state.position = nullpos;
			throwError(state, "null byte is not allowed in input");
		}
		state.input += "\0";
		while (state.input.charCodeAt(state.position) === 32) {
			state.lineIndent += 1;
			state.position += 1;
		}
		while (state.position < state.length - 1) readDocument(state);
		return state.documents;
	}
	function loadAll2(input, iterator, options) {
		if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
			options = iterator;
			iterator = null;
		}
		const documents = loadDocuments(input, options);
		if (typeof iterator !== "function") return documents;
		for (let index = 0, length = documents.length; index < length; index += 1) iterator(documents[index]);
	}
	function load2(input, options) {
		const documents = loadDocuments(input, options);
		if (documents.length === 0) return;
		else if (documents.length === 1) return documents[0];
		throw new YAMLException2("expected a single document in the stream, but found more");
	}
	loader.loadAll = loadAll2;
	loader.load = load2;
	return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
	if (hasRequiredDumper) return dumper;
	hasRequiredDumper = 1;
	const common2 = requireCommon();
	const YAMLException2 = requireException();
	const DEFAULT_SCHEMA2 = require_default();
	const _toString = Object.prototype.toString;
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const CHAR_BOM = 65279;
	const CHAR_TAB = 9;
	const CHAR_LINE_FEED = 10;
	const CHAR_CARRIAGE_RETURN = 13;
	const CHAR_SPACE = 32;
	const CHAR_EXCLAMATION = 33;
	const CHAR_DOUBLE_QUOTE = 34;
	const CHAR_SHARP = 35;
	const CHAR_PERCENT = 37;
	const CHAR_AMPERSAND = 38;
	const CHAR_SINGLE_QUOTE = 39;
	const CHAR_ASTERISK = 42;
	const CHAR_COMMA = 44;
	const CHAR_MINUS = 45;
	const CHAR_COLON = 58;
	const CHAR_EQUALS = 61;
	const CHAR_GREATER_THAN = 62;
	const CHAR_QUESTION = 63;
	const CHAR_COMMERCIAL_AT = 64;
	const CHAR_LEFT_SQUARE_BRACKET = 91;
	const CHAR_RIGHT_SQUARE_BRACKET = 93;
	const CHAR_GRAVE_ACCENT = 96;
	const CHAR_LEFT_CURLY_BRACKET = 123;
	const CHAR_VERTICAL_LINE = 124;
	const CHAR_RIGHT_CURLY_BRACKET = 125;
	const ESCAPE_SEQUENCES = {};
	ESCAPE_SEQUENCES[0] = "\\0";
	ESCAPE_SEQUENCES[7] = "\\a";
	ESCAPE_SEQUENCES[8] = "\\b";
	ESCAPE_SEQUENCES[9] = "\\t";
	ESCAPE_SEQUENCES[10] = "\\n";
	ESCAPE_SEQUENCES[11] = "\\v";
	ESCAPE_SEQUENCES[12] = "\\f";
	ESCAPE_SEQUENCES[13] = "\\r";
	ESCAPE_SEQUENCES[27] = "\\e";
	ESCAPE_SEQUENCES[34] = "\\\"";
	ESCAPE_SEQUENCES[92] = "\\\\";
	ESCAPE_SEQUENCES[133] = "\\N";
	ESCAPE_SEQUENCES[160] = "\\_";
	ESCAPE_SEQUENCES[8232] = "\\L";
	ESCAPE_SEQUENCES[8233] = "\\P";
	const DEPRECATED_BOOLEANS_SYNTAX = [
		"y",
		"Y",
		"yes",
		"Yes",
		"YES",
		"on",
		"On",
		"ON",
		"n",
		"N",
		"no",
		"No",
		"NO",
		"off",
		"Off",
		"OFF"
	];
	const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
	function compileStyleMap(schema2, map2) {
		if (map2 === null) return {};
		const result = {};
		const keys = Object.keys(map2);
		for (let index = 0, length = keys.length; index < length; index += 1) {
			let tag = keys[index];
			let style = String(map2[tag]);
			if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
			const type2 = schema2.compiledTypeMap["fallback"][tag];
			if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) style = type2.styleAliases[style];
			result[tag] = style;
		}
		return result;
	}
	function encodeHex(character) {
		let handle;
		let length;
		const string = character.toString(16).toUpperCase();
		if (character <= 255) {
			handle = "x";
			length = 2;
		} else if (character <= 65535) {
			handle = "u";
			length = 4;
		} else if (character <= 4294967295) {
			handle = "U";
			length = 8;
		} else throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
		return "\\" + handle + common2.repeat("0", length - string.length) + string;
	}
	const QUOTING_TYPE_SINGLE = 1;
	const QUOTING_TYPE_DOUBLE = 2;
	function State(options) {
		this.schema = options["schema"] || DEFAULT_SCHEMA2;
		this.indent = Math.max(1, options["indent"] || 2);
		this.noArrayIndent = options["noArrayIndent"] || false;
		this.skipInvalid = options["skipInvalid"] || false;
		this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
		this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
		this.sortKeys = options["sortKeys"] || false;
		this.lineWidth = options["lineWidth"] || 80;
		this.noRefs = options["noRefs"] || false;
		this.noCompatMode = options["noCompatMode"] || false;
		this.condenseFlow = options["condenseFlow"] || false;
		this.quotingType = options["quotingType"] === "\"" ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
		this.forceQuotes = options["forceQuotes"] || false;
		this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
		this.implicitTypes = this.schema.compiledImplicit;
		this.explicitTypes = this.schema.compiledExplicit;
		this.tag = null;
		this.result = "";
		this.duplicates = [];
		this.usedDuplicates = null;
	}
	function indentString(string, spaces) {
		const ind = common2.repeat(" ", spaces);
		let position = 0;
		let result = "";
		const length = string.length;
		while (position < length) {
			let line;
			const next = string.indexOf("\n", position);
			if (next === -1) {
				line = string.slice(position);
				position = length;
			} else {
				line = string.slice(position, next + 1);
				position = next + 1;
			}
			if (line.length && line !== "\n") result += ind;
			result += line;
		}
		return result;
	}
	function generateNextLine(state, level) {
		return "\n" + common2.repeat(" ", state.indent * level);
	}
	function testImplicitResolving(state, str2) {
		for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) if (state.implicitTypes[index].resolve(str2)) return true;
		return false;
	}
	function isWhitespace(c) {
		return c === CHAR_SPACE || c === CHAR_TAB;
	}
	function isPrintable(c) {
		return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
	}
	function isNsCharOrWhitespace(c) {
		return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
	}
	function isPlainSafe(c, prev, inblock) {
		const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
		const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
		return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
	}
	function isPlainSafeFirst(c) {
		return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
	}
	function isPlainSafeLast(c) {
		return !isWhitespace(c) && c !== CHAR_COLON;
	}
	function codePointAt(string, pos) {
		const first = string.charCodeAt(pos);
		let second;
		if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
			second = string.charCodeAt(pos + 1);
			if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
		}
		return first;
	}
	function needIndentIndicator(string) {
		return /^\n* /.test(string);
	}
	const STYLE_PLAIN = 1;
	const STYLE_SINGLE = 2;
	const STYLE_LITERAL = 3;
	const STYLE_FOLDED = 4;
	const STYLE_DOUBLE = 5;
	function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
		let i;
		let char = 0;
		let prevChar = null;
		let hasLineBreak = false;
		let hasFoldableLine = false;
		const shouldTrackWidth = lineWidth !== -1;
		let previousLineBreak = -1;
		let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
		if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			if (!isPrintable(char)) return STYLE_DOUBLE;
			plain = plain && isPlainSafe(char, prevChar, inblock);
			prevChar = char;
		}
		else {
			for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
				char = codePointAt(string, i);
				if (char === CHAR_LINE_FEED) {
					hasLineBreak = true;
					if (shouldTrackWidth) {
						hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
						previousLineBreak = i;
					}
				} else if (!isPrintable(char)) return STYLE_DOUBLE;
				plain = plain && isPlainSafe(char, prevChar, inblock);
				prevChar = char;
			}
			hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
		}
		if (!hasLineBreak && !hasFoldableLine) {
			if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
			return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
		}
		if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
		if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
		return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
	}
	function writeScalar(state, string, level, iskey, inblock) {
		state.dump = (function() {
			if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"\"" : "''";
			if (!state.noCompatMode) {
				if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"" + string + "\"" : "'" + string + "'";
			}
			const indent = state.indent * Math.max(1, level);
			const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
			const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
			function testAmbiguity(string2) {
				return testImplicitResolving(state, string2);
			}
			switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
				case STYLE_PLAIN: return string;
				case STYLE_SINGLE: return "'" + string.replace(/'/g, "''") + "'";
				case STYLE_LITERAL: return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
				case STYLE_FOLDED: return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
				case STYLE_DOUBLE: return "\"" + escapeString(string) + "\"";
				default: throw new YAMLException2("impossible error: invalid scalar style");
			}
		})();
	}
	function blockHeader(string, indentPerLevel) {
		const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
		const clip = string[string.length - 1] === "\n";
		return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
	}
	function dropEndingNewline(string) {
		return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
	}
	function foldString(string, width) {
		const lineRe = /(\n+)([^\n]*)/g;
		let result = (function() {
			let nextLF = string.indexOf("\n");
			nextLF = nextLF !== -1 ? nextLF : string.length;
			lineRe.lastIndex = nextLF;
			return foldLine(string.slice(0, nextLF), width);
		})();
		let prevMoreIndented = string[0] === "\n" || string[0] === " ";
		let moreIndented;
		let match;
		while (match = lineRe.exec(string)) {
			const prefix = match[1];
			const line = match[2];
			moreIndented = line[0] === " ";
			result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
			prevMoreIndented = moreIndented;
		}
		return result;
	}
	function foldLine(line, width) {
		if (line === "" || line[0] === " ") return line;
		const breakRe = / [^ ]/g;
		let match;
		let start = 0;
		let end;
		let curr = 0;
		let next = 0;
		let result = "";
		while (match = breakRe.exec(line)) {
			next = match.index;
			if (next - start > width) {
				end = curr > start ? curr : next;
				result += "\n" + line.slice(start, end);
				start = end + 1;
			}
			curr = next;
		}
		result += "\n";
		if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
		else result += line.slice(start);
		return result.slice(1);
	}
	function escapeString(string) {
		let result = "";
		let char = 0;
		for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			const escapeSeq = ESCAPE_SEQUENCES[char];
			if (!escapeSeq && isPrintable(char)) {
				result += string[i];
				if (char >= 65536) result += string[i + 1];
			} else result += escapeSeq || encodeHex(char);
		}
		return result;
	}
	function writeFlowSequence(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
				if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = "[" + _result + "]";
	}
	function writeBlockSequence(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
				if (!compact || _result !== "") _result += generateNextLine(state, level);
				if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
				else _result += "- ";
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = _result || "[]";
	}
	function writeFlowMapping(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (_result !== "") pairBuffer += ", ";
			if (state.condenseFlow) pairBuffer += "\"";
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level, objectKey, false, false)) continue;
			if (state.dump.length > 1024) pairBuffer += "? ";
			pairBuffer += state.dump + (state.condenseFlow ? "\"" : "") + ":" + (state.condenseFlow ? "" : " ");
			if (!writeNode(state, level, objectValue, false, false)) continue;
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = "{" + _result + "}";
	}
	function writeBlockMapping(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		if (state.sortKeys === true) objectKeyList.sort();
		else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
		else if (state.sortKeys) throw new YAMLException2("sortKeys must be a boolean or a function");
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
			const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
			if (explicitPair) if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
			else pairBuffer += "? ";
			pairBuffer += state.dump;
			if (explicitPair) pairBuffer += generateNextLine(state, level);
			if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
			if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
			else pairBuffer += ": ";
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = _result || "{}";
	}
	function detectType(state, object, explicit) {
		const typeList = explicit ? state.explicitTypes : state.implicitTypes;
		for (let index = 0, length = typeList.length; index < length; index += 1) {
			const type2 = typeList[index];
			if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
				if (explicit) if (type2.multi && type2.representName) state.tag = type2.representName(object);
				else state.tag = type2.tag;
				else state.tag = "?";
				if (type2.represent) {
					const style = state.styleMap[type2.tag] || type2.defaultStyle;
					let _result;
					if (_toString.call(type2.represent) === "[object Function]") _result = type2.represent(object, style);
					else if (_hasOwnProperty.call(type2.represent, style)) _result = type2.represent[style](object, style);
					else throw new YAMLException2("!<" + type2.tag + "> tag resolver accepts not \"" + style + "\" style");
					state.dump = _result;
				}
				return true;
			}
		}
		return false;
	}
	function writeNode(state, level, object, block, compact, iskey, isblockseq) {
		state.tag = null;
		state.dump = object;
		if (!detectType(state, object, false)) detectType(state, object, true);
		const type2 = _toString.call(state.dump);
		const inblock = block;
		if (block) block = state.flowLevel < 0 || state.flowLevel > level;
		const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
		let duplicateIndex;
		let duplicate;
		if (objectOrArray) {
			duplicateIndex = state.duplicates.indexOf(object);
			duplicate = duplicateIndex !== -1;
		}
		if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
		if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
		else {
			if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
			if (type2 === "[object Object]") if (block && Object.keys(state.dump).length !== 0) {
				writeBlockMapping(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowMapping(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type2 === "[object Array]") if (block && state.dump.length !== 0) {
				if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
				else writeBlockSequence(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowSequence(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type2 === "[object String]") {
				if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
			} else if (type2 === "[object Undefined]") return false;
			else {
				if (state.skipInvalid) return false;
				throw new YAMLException2("unacceptable kind of an object to dump " + type2);
			}
			if (state.tag !== null && state.tag !== "?") {
				let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
				if (state.tag[0] === "!") tagStr = "!" + tagStr;
				else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
				else tagStr = "!<" + tagStr + ">";
				state.dump = tagStr + " " + state.dump;
			}
		}
		return true;
	}
	function getDuplicateReferences(object, state) {
		const objects = [];
		const duplicatesIndexes = [];
		inspectNode(object, objects, duplicatesIndexes);
		const length = duplicatesIndexes.length;
		for (let index = 0; index < length; index += 1) state.duplicates.push(objects[duplicatesIndexes[index]]);
		state.usedDuplicates = new Array(length);
	}
	function inspectNode(object, objects, duplicatesIndexes) {
		if (object !== null && typeof object === "object") {
			const index = objects.indexOf(object);
			if (index !== -1) {
				if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
			} else {
				objects.push(object);
				if (Array.isArray(object)) for (let i = 0, length = object.length; i < length; i += 1) inspectNode(object[i], objects, duplicatesIndexes);
				else {
					const objectKeyList = Object.keys(object);
					for (let i = 0, length = objectKeyList.length; i < length; i += 1) inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
				}
			}
		}
	}
	function dump2(input, options) {
		options = options || {};
		const state = new State(options);
		if (!state.noRefs) getDuplicateReferences(input, state);
		let value = input;
		if (state.replacer) value = state.replacer.call({ "": value }, "", value);
		if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
		return "";
	}
	dumper.dump = dump2;
	return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
	if (hasRequiredJsYaml) return jsYaml;
	hasRequiredJsYaml = 1;
	const loader2 = requireLoader();
	const dumper2 = requireDumper();
	function renamed(from, to) {
		return function() {
			throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
		};
	}
	jsYaml.Type = requireType();
	jsYaml.Schema = requireSchema();
	jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
	jsYaml.JSON_SCHEMA = requireJson();
	jsYaml.CORE_SCHEMA = requireCore();
	jsYaml.DEFAULT_SCHEMA = require_default();
	jsYaml.load = loader2.load;
	jsYaml.loadAll = loader2.loadAll;
	jsYaml.dump = dumper2.dump;
	jsYaml.YAMLException = requireException();
	jsYaml.types = {
		binary: requireBinary(),
		float: requireFloat(),
		map: requireMap(),
		null: require_null(),
		pairs: requirePairs(),
		set: requireSet(),
		timestamp: requireTimestamp(),
		bool: requireBool(),
		int: requireInt(),
		merge: requireMerge(),
		omap: requireOmap(),
		seq: requireSeq(),
		str: requireStr()
	};
	jsYaml.safeLoad = renamed("safeLoad", "load");
	jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
	jsYaml.safeDump = renamed("safeDump", "dump");
	return jsYaml;
}
const yaml = /* @__PURE__ */ getDefaultExportFromCjs(requireJsYaml());
const { Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump } = yaml;
//#endregion
//#region src/host/repair.ts
/**
* Repair executor + auto-rollback — the ONLY code in this plugin allowed to
* write files.
*
* 铁律（HARD RULE）：修复执行器严禁修改 harness 源码（安装目录
* M:\dsh\node_modules 及任何 @deepseek-ai 安装本体），只允许修改：
*   1. 插件自己的代码（~/.dsh/plugins/**）
*   2. 配置层（~/.dsh/profiles/**、~/.dsh/cordis.patch.yml）
* 每个写路径在执行前经 assertSafeTarget 门禁，realpath 后必须落在 home 内
* 且不在安装根内，否则拒绝。
* @module dsh-plugin-healthcheck/host/repair
*/
/**
* The write gate. Canonicalizes the target and refuses anything outside the
* harness home or inside the harness install root. This is the safety
* boundary between "repairing a plugin" and "modifying harness source".
*/
function assertSafeTarget(path, home = resolveHome()) {
	if (typeof path !== "string" || path === "") throw repairError("bad-target", "empty repair path");
	const installRoot = resolveInstallRoot();
	let canonical = "";
	let probe = resolve(path);
	try {
		while (true) try {
			canonical = resolve(realpathSync(probe));
			break;
		} catch {
			const parent = dirname(probe);
			if (parent === probe) throw new Error("unresolvable");
			probe = parent;
		}
		const tail = resolve(path).slice(probe.length).replace(/^[/\\]/, "");
		canonical = tail === "" ? canonical : join(canonical, tail);
	} catch {
		throw repairError("bad-target", `path does not resolve on disk: ${path}`);
	}
	const normalizedHome = resolve(home).toLowerCase();
	const normalizedInstall = resolve(installRoot).toLowerCase();
	if (canonical.toLowerCase().startsWith(normalizedInstall)) throw repairError("forbidden-harness", `铁律：禁止修改 harness 源码/安装本体：${path}`);
	if (!canonical.toLowerCase().startsWith(normalizedHome)) throw repairError("outside-home", `refusing to write outside the harness home: ${path}`);
	return canonical;
}
function repairError(code, message) {
	const error = /* @__PURE__ */ new Error(`[${code}] ${message}`);
	error.code = code;
	return error;
}
/** Execute one deterministic repair action under the safety gate. */
function applyRepair(action, home = resolveHome()) {
	switch (action.kind) {
		case "files-whitelist":
			if (action.path === void 0) return {
				action: "files-whitelist",
				applied: false,
				message: "missing target path"
			};
			return repairFilesWhitelist$1(action.path, home);
		case "remove-copies":
			if (action.path === void 0) return {
				action: "remove-copies",
				applied: false,
				message: "missing target path"
			};
			return repairRemoveCopies(action.path, home);
		case "none": return {
			action: "none",
			applied: false,
			message: action.description
		};
		default: return {
			action: action.kind,
			applied: false,
			message: "unknown action kind"
		};
	}
}
/** Rewrite a plugin package.json files field to lib/*.js (with backup). */
function repairFilesWhitelist$1(path, home) {
	const target = assertSafeTarget(path, home);
	const raw = readFileSync(target, "utf8");
	const manifest = JSON.parse(raw);
	if (!Array.isArray(manifest.files)) return {
		action: "files-whitelist",
		applied: false,
		message: `${target} 没有 files 字段`
	};
	const next = manifest.files.map((f) => /^lib\/[^*/]+\.[a-z]+$/.test(f) ? "lib/*.js" : f);
	const deduped = [...new Set(next)];
	if (JSON.stringify(deduped) === JSON.stringify(manifest.files)) return {
		action: "files-whitelist",
		applied: false,
		message: `${target} 的 files 无需修改`
	};
	renameSync(target, `${target}.bak-${Date.now()}`);
	manifest.files = deduped;
	writeFileSync(target, JSON.stringify(manifest, void 0, 2) + "\n", "utf8");
	return {
		action: "files-whitelist",
		applied: true,
		message: `已把 ${target} 的 files 白名单改为通配（原文件备份为 .bak-*）：${deduped.join(", ")}`
	};
}
/** Delete a dangerous harness copy (only when it is still a real dir). */
function repairRemoveCopies(path, home) {
	const target = assertSafeTarget(path, home);
	let stat;
	try {
		stat = lstatSync(target);
	} catch {
		return {
			action: "remove-copies",
			applied: false,
			message: `${target} 已不存在`
		};
	}
	if (stat.isSymbolicLink()) return {
		action: "remove-copies",
		applied: false,
		message: `${target} 现在是软链（健康状态），无需删除`
	};
	rmSync(target, {
		recursive: true,
		force: true
	});
	return {
		action: "remove-copies",
		applied: true,
		message: `已删除危险副本 ${target}（插件将从共享层软链解析）`
	};
}
/**
* Auto-rollback: append `- id: <id>\n  disabled: true` to the home patch
* (HMR hot-applies it in the running backend within seconds). Idempotent:
* an existing disabled row for the id is left untouched. Validated by parsing
* the result with the include plugin's schema before replacing the file.
*/
function rollbackPlugin(pluginId, home = resolveHome()) {
	const target = assertSafeTarget(resolveHomePatch(home), home);
	const content = readFileSync(target, "utf8");
	if (hasDisabledRow(content, pluginId)) return {
		action: "write-patch",
		applied: false,
		message: `${pluginId} 已在 home 层禁用，无需重复写入`
	};
	const block = `# healthcheck auto-rollback ${(/* @__PURE__ */ new Date()).toISOString()}\n- id: ${pluginId}\n  disabled: true\n`;
	let appended;
	if (/\[\s*\]\s*$/.test(content)) appended = content.replace(/\[\s*\]\s*$/, block + "\n");
	else if (/\s*\]\s*$/.test(content)) {
		let parsed;
		try {
			parsed = yaml.load(content, { schema: entryListSchema });
		} catch {
			parsed = void 0;
		}
		if (!Array.isArray(parsed)) return {
			action: "write-patch",
			applied: false,
			message: `回滚写入失败：无法解析 ${target} 的顶层列表（未改动任何文件）`
		};
		parsed.push({
			id: pluginId,
			disabled: true
		});
		appended = yaml.dump(parsed, {
			schema: entryListSchema,
			noRefs: true
		}) + "\n";
	} else appended = content.replace(/\s*$/, "") + "\n\n" + block;
	try {
		yaml.load(appended, { schema: entryListSchema });
	} catch (error) {
		return {
			action: "write-patch",
			applied: false,
			message: `回滚写入校验失败（未改动任何文件）：${error instanceof Error ? error.message : String(error)}`
		};
	}
	renameSync(target, `${target}.bak-${Date.now()}`);
	writeFileSync(target, appended, "utf8");
	return {
		action: "write-patch",
		applied: true,
		message: `已在 ${target} 禁用 ${pluginId} — 运行中的后端将热重载生效（无需重启）`
	};
}
/** Undo a healthcheck rollback: remove the auto-rollback rows for one id. */
function undoRollback(pluginId, home = resolveHome()) {
	const target = assertSafeTarget(resolveHomePatch(home), home);
	const content = readFileSync(target, "utf8");
	const marker = /^# healthcheck auto-rollback .*$\n- id: [^\n]+\n  disabled: true\n/gm;
	let removed = 0;
	const next = content.replace(marker, (block) => {
		if (!block.includes(`- id: ${pluginId}\n`)) return block;
		removed += 1;
		return "";
	});
	if (removed === 0) return {
		action: "write-patch",
		applied: false,
		message: `${pluginId} 没有可撤销的 healthcheck 回滚记录`
	};
	renameSync(target, `${target}.bak-${Date.now()}`);
	writeFileSync(target, next.replace(/\n{3,}/g, "\n\n"), "utf8");
	return {
		action: "write-patch",
		applied: true,
		message: `已撤销 ${pluginId} 的回滚（${removed} 行）— 热重载生效`
	};
}
/** Whether the patch text already carries a disabled row for the id. */
function hasDisabledRow(content, pluginId) {
	const rows = content.split("\n");
	for (let i = 0; i < rows.length; i++) if (rows[i].trim() === `- id: ${pluginId}`) {
		const ahead = rows.slice(i + 1, i + 4).join("\n");
		if (/disabled:\s*true/.test(ahead)) return true;
	}
	return false;
}
/** Persist the run history (last N records). */
function appendHistory(record, home = resolveHome(), keep = 20) {
	const dir = join(home, "storages", "healthcheck");
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "history.json");
	let list = [];
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8"));
		if (Array.isArray(parsed)) list = parsed;
	} catch {}
	list.unshift(record);
	writeFileSync(file, JSON.stringify(list.slice(0, keep), void 0, 2) + "\n", "utf8");
}
/** Read the persisted run history. */
function readHistory(home = resolveHome()) {
	const file = join(home, "storages", "healthcheck", "history.json");
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
//#endregion
//#region src/host/checkers.ts
/**
* L0 static checkers — file-system level, no loading, no boot.
* Each checker is a pure function over (home, profileDir, pluginRow) that
* returns structured findings. Every finding carries a deterministic repair
* action or a prepared prompt (see core/types).
* @module dsh-plugin-healthcheck/host/checkers
*/
/** The repair prompt header shared by every LLM-guided fix. */
const PROMPT_HEADER = `你是 DSH 插件的修复助手。铁律（违反即失败）：
1. 严禁修改 harness 源码层（M:\\dsh\\node_modules、GitHub deepseek-harness）；
2. 只允许修改插件代码与配置层（~/.dsh/plugins/**、~/.dsh/profiles/**、~/.dsh/cordis.patch.yml）；
3. 修完用「插件检测」重新验证，确认无 error 才算完成。`;
/** Build the plugin source package.json repair action. */
function repairFilesWhitelist(packageJsonPath) {
	return {
		kind: "files-whitelist",
		path: packageJsonPath,
		description: `把 ${packageJsonPath} 的 files 白名单改为 lib/*.js 通配（含代码分割 chunk）`
	};
}
/** Read a plugin's package.json from its source dir ('' = unreadable). */
function readPluginManifest(row) {
	const root = row.sourceDir ?? row.installedDir;
	if (root === "") return null;
	try {
		return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	} catch {
		return null;
	}
}
/**
* C1 — files 白名单完整性（防 dsh-pet 复发）。
* 多入口构建 + 固定文件名白名单 → 带哈希 chunk 被过滤 → ERR_MODULE_NOT_FOUND。
*/
function checkFilesWhitelist(ctx, row) {
	const manifest = readPluginManifest(row);
	if (manifest === null) return [];
	const files = manifest.files;
	if (!Array.isArray(files) || files.length === 0) return [];
	const root = row.sourceDir ?? row.installedDir;
	const libDir = join(root, "lib");
	if (!existsSync(libDir)) return [];
	const findings = [];
	const fixed = files.filter((f) => typeof f === "string" && /^lib\/[^*/]+\.[a-z]+$/.test(f));
	const hasGlob = files.some((f) => typeof f === "string" && f.includes("*"));
	if (fixed.length > 0 && !hasGlob) {
		const missing = missingLocalImports(libDir, files);
		if (missing.length > 0) findings.push({
			layer: "l0",
			code: "files-missing-chunk",
			severity: "error",
			plugin: row.name,
			message: `${row.name} 的 files 白名单漏掉了代码分割 chunk：${missing.join(", ")} — 安装时会被 pnpm 打包过滤，启动报 ERR_MODULE_NOT_FOUND`,
			evidence: missing.map((f) => join(libDir, f)),
			fixKind: "auto",
			repair: row.sourceDir !== void 0 ? repairFilesWhitelist(join(root, "package.json")) : void 0,
			prompt: row.sourceDir === void 0 ? `${PROMPT_HEADER}\n\n问题：${row.name}（registry 安装）的 files 白名单是固定文件名，漏掉了 ${missing.join(", ")}。\n修复：向该插件上游提交 PR 把 files 改为 ["lib/*.js", ...]。` : void 0
		});
		else findings.push({
			layer: "l0",
			code: "files-fixed-entries",
			severity: "warn",
			plugin: row.name,
			message: `${row.name} 的 files 用固定文件名（${fixed.join(", ")}）— 多入口构建一旦产生代码分割 chunk 就会复发 dsh-pet 式错误`,
			evidence: fixed.map((f) => join(root, f)),
			fixKind: "auto",
			repair: row.sourceDir !== void 0 ? repairFilesWhitelist(join(root, "package.json")) : void 0
		});
	}
	return findings;
}
/** Collect local imports (./x.js, ./sub/y.js) in lib/ that are not covered by `files`. */
function missingLocalImports(libDir, files) {
	const missing = [];
	const covered = (rel) => files.some((f) => typeof f !== "string" || f === "lib" || f === "lib/" || f.startsWith("lib/*.js") || f === `lib/${rel}`);
	const jsFiles = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name.endsWith(".js")) jsFiles.push(p);
		}
	};
	walk(libDir);
	for (const file of jsFiles) {
		const content = readFileSync(file, "utf8");
		for (const match of content.matchAll(/(?:from\s+|import\s*\()\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
			const rel = match[1].replace(/^\.\//, "");
			if (covered(rel)) continue;
			if (!existsSync(resolve(dirname(file), match[1])) && !missing.includes(rel)) missing.push(rel);
		}
	}
	return missing;
}
/**
* C2 — 依赖声明审计（防 link:/file: 坑）。
*/
function checkDependencySpec(ctx, row) {
	const findings = [];
	const manifest = readPluginManifest(row);
	if (manifest === null) return findings;
	const deps = Object.keys(manifest.dependencies ?? {});
	const peers = Object.keys(manifest.peerDependencies ?? {});
	if (row.spec.startsWith("link:") && deps.length > 0) findings.push({
		layer: "l0",
		code: "link-deps",
		severity: "error",
		plugin: row.name,
		message: `${row.name} 是 link: 依赖且声明运行时依赖（${deps.join(", ")}）— Node 从源码目录解析依赖、绕过 profile 的 node_modules，会报 ERR_MODULE_NOT_FOUND`,
		evidence: [`specifier: ${row.spec}`, `dependencies: ${deps.join(", ")}`],
		fixKind: "auto",
		repair: {
			kind: "none",
			description: "需要 pnpm remove + add file:（见 prompt）"
		},
		prompt: `${PROMPT_HEADER}\n\n问题：${row.name} 登记为 link: 但有运行时依赖。\n修复：\n  cd ~/.dsh/profiles/web\n  pnpm remove ${row.name}\n  pnpm add "file:C:/Users/cysja/.dsh/plugins/${basename(row.sourceDir ?? row.name)}"\n注意：直接改 package.json 再 pnpm install 不生效（lockfile 残留 link:），必须 remove + add。`
	});
	if (row.spec.startsWith("file:") && peers.some((p) => HIGH_RISK_PACKAGES.some((h) => p === `@deepseek-ai/${h}`))) findings.push({
		layer: "l0",
		code: "file-peer-copies",
		severity: "warn",
		plugin: row.name,
		message: `${row.name} 的 peer 依赖包含 harness 核心包 — file: 安装会强制装出嵌套副本（autoInstallPeers:false 拦不住），引发模块双实例`,
		evidence: peers.filter((p) => HIGH_RISK_PACKAGES.some((h) => p === `@deepseek-ai/${h}`)),
		fixKind: "prompt",
		prompt: `${PROMPT_HEADER}\n\n问题：${row.name} 的 peerDependencies 引用了 harness 核心包（cordis/dsh-tools/schemastery/…），file: 安装会把它们装成独立副本，导致 Symbol/类身份错位（Cannot read properties of undefined (reading 'prepare')）。\n修复方向：\n1. 首选：插件改用 link:，依赖从共享层解析；\n2. 或保留 file:，但每次安装后删除副本：rm -rf ~/.dsh/profiles/web/node_modules/@deepseek-ai/{cordis,cosmokit,dsh-credentials,dsh-home-paths,dsh-tools,schemastery}`
	});
	return findings;
}
/**
* C3 — 高危副本检测（防模块双实例）。
*/
function checkHighRiskCopies(ctx, _row) {
	const findings = [];
	const scopeDir = join(ctx.profileDir, "node_modules", "@deepseek-ai");
	if (!existsSync(scopeDir)) return findings;
	for (const pkg of HIGH_RISK_PACKAGES) {
		const path = join(scopeDir, pkg);
		try {
			if (!lstatSync(path).isSymbolicLink()) findings.push({
				layer: "l0",
				code: "harness-copy",
				severity: "error",
				plugin: `@deepseek-ai/${pkg}`,
				message: `检测到 harness 核心包独立副本 @deepseek-ai/${pkg}（真实目录，非软链）— 与安装本体形成模块双实例，Symbol/类身份错位会导致工具取不到（prepare undefined）`,
				evidence: [path],
				fixKind: "auto",
				repair: {
					kind: "remove-copies",
					path,
					description: `删除危险副本 ${path}（插件将从共享层 ~/.dsh/profiles/node_modules 软链解析）`
				}
			});
		} catch {}
	}
	return findings;
}
/**
* C4 — 依赖可解析性（防 ERR_MODULE_NOT_FOUND）。
*/
function checkDependencyResolvability(ctx, row) {
	const manifest = readPluginManifest(row);
	if (manifest === null) return [];
	const root = row.installedDir !== "" ? row.installedDir : row.sourceDir ?? "";
	if (root === "") return [];
	const findings = [];
	const specs = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})];
	for (const spec of specs) {
		let resolvable = false;
		try {
			execFileSync(process.execPath, [
				"--input-type=module",
				"-e",
				`console.log(import.meta.resolve(${JSON.stringify(spec)}))`
			], {
				cwd: root,
				stdio: "pipe",
				timeout: 1e4,
				encoding: "utf8"
			});
			resolvable = true;
		} catch {
			resolvable = false;
		}
		if (!resolvable) findings.push({
			layer: "l0",
			code: "dep-unresolvable",
			severity: "error",
			plugin: row.name,
			message: `${row.name} 的依赖 ${spec} 无法从 ${root} 解析 — 启动时 ERR_MODULE_NOT_FOUND`,
			evidence: [`spec: ${spec}`, `anchor: ${root}`],
			fixKind: "prompt",
			prompt: `${PROMPT_HEADER}\n\n问题：${row.name} import "${spec}" 无法从 ${root} 解析。\n判断：\n- 若插件是 link: → 在插件源码目录 pnpm install 装依赖，或改成 file: 依赖；\n- 若依赖是 harness 提供的（@deepseek-ai/*）→ 检查 ~/.dsh/profiles/node_modules 软链与版本；\n- 若是 peer 缺失 → 确认共享层已有该包，再决定 link: 或 file:。`
		});
	}
	return findings;
}
/**
* C5 — Windows 命令可用性（防 dsh-skin CLI not found 复发）。
* 扫描插件对 execFile/spawn 的裸命令引用，验证注册表 PATH 中能找到真 .exe。
*/
function checkWindowsCommands(ctx, row) {
	if (process.platform !== "win32") return [];
	const root = row.sourceDir ?? row.installedDir;
	if (root === "") return [];
	const findings = [];
	const commands = collectCommandRefs(root);
	for (const command of commands) {
		if (/[\\/]/.test(command) || command.endsWith(".exe")) continue;
		let found = false;
		try {
			found = execFileSync("where.exe", [command], {
				encoding: "utf8",
				timeout: 1e4
			}).split(/\r?\n/).some((line) => line.trim().toLowerCase().endsWith(".exe"));
		} catch {
			found = false;
		}
		if (!found) findings.push({
			layer: "l0",
			code: "command-not-found",
			severity: "warn",
			plugin: row.name,
			message: `${row.name} 引用的外部命令 ${command} 在注册表 PATH 中找不到真 .exe — 后端进程（PowerShell 启动）执行时会 ENOENT`,
			evidence: [`command: ${command}`, "check: where.exe 在注册表 PATH（HKCU/HKLM）中的 .exe"],
			fixKind: "prompt",
			prompt: `${PROMPT_HEADER}\n\n问题：${row.name} 调用外部命令 ${command}，Windows 后端进程找不到。\n注意三点（本次事故总结）：\n1. Node execFile(shell:false) 只认真实 .exe，不认 .cmd/.bat/shebang 脚本 → 需要编译 .exe 垫片（gcc + C 源码转发参数）；\n2. 垫片必须放在注册表 PATH（如 C:\\Users\\cysja\\AppData\\Roaming\\npm），Git Bash 的 ~/.local/bin 对 PowerShell 启动的后端无效；\n3. 脚本内路径用 os.homedir() + __dirname 推导，禁止硬编码。`
		});
	}
	return findings;
}
/** Collect bare command names referenced by execFile/spawn in a plugin tree. */
function collectCommandRefs(root) {
	const found = /* @__PURE__ */ new Set();
	const scan = (dir, depth) => {
		if (depth > 4 || !existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (![
					"node_modules",
					".git",
					"dist"
				].includes(entry.name)) scan(path, depth + 1);
				continue;
			}
			if (!/\.(js|mjs|cjs|ts|yml|yaml|json)$/.test(entry.name)) continue;
			let content;
			try {
				content = readFileSync(path, "utf8");
			} catch {
				continue;
			}
			for (const match of content.matchAll(/(?:execFile|execFileSync|spawn)\s*\(\s*["']([^"']+)["']/g)) found.add(match[1]);
		}
	};
	scan(root, 0);
	return [...found];
}
/**
* C6 — lockfile 一致性（防"改 specifier 不重解析"）。
*/
function checkLockfileConsistency(ctx, row) {
	const findings = [];
	if (!row.spec.startsWith("file:") && !row.spec.startsWith("link:")) return findings;
	const lockPath = join(ctx.profileDir, "pnpm-lock.yaml");
	if (!existsSync(lockPath)) return findings;
	const lock = readFileSync(lockPath, "utf8");
	const expected = row.spec.startsWith("file:") ? "file:" : "link:";
	const actual = new RegExp(`\\n\\s{2}${escapeRegExp(row.name)}:\\n(?:[\\s\\S]{0,200}?)\\n\\s{4}version: (file|link):`).exec(lock)?.[1];
	if (actual !== void 0 && actual !== expected) findings.push({
		layer: "l0",
		code: "lockfile-stale",
		severity: "error",
		plugin: row.name,
		message: `${row.name} 的 package.json specifier 是 ${expected} 但 lockfile 仍记录 ${actual} — pnpm 没有重解析，改 specifier 不会生效`,
		evidence: [`specifier: ${row.spec}`, `lockfile version: ${actual}:...`],
		fixKind: "prompt",
		prompt: `${PROMPT_HEADER}\n\n问题：${row.name} 改过依赖类型（link:/file:）但 pnpm-lock.yaml 没重解析。\n修复（必须 remove + add，直接改 package.json 无效）：\n  cd ~/.dsh/profiles/web\n  pnpm remove ${row.name}\n  pnpm add "${row.spec}"\n  grep -A2 '${row.name}:' pnpm-lock.yaml   # 确认 version: 前缀已变`
	});
	return findings;
}
/** Escape a literal for a RegExp. */
function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* C7 — 禁用插件状态识别。被禁用的插件有两种情形：
* 1. 二分排查遗留（如本次事故的 context-lens / dsh-memory）——已知有问题，
*    应继续排查根因或移除，而不是带着 disabled 行长期运行；
* 2. dsh-skin 管理的皮肤互斥（ui-skin-*）——正常机制，不告警。
* 检查器只对第 1 类给出 warn：被禁用的插件仍在 profile 依赖里，占用磁盘、
* 参与 install 的 peer 副本安装，且它的问题本身未被修复。
*/
function checkDisabledPlugins(ctx, row) {
	if (row.disabled !== true) return [];
	if (row.name.includes("ui-skin")) return [];
	const layers = (row.disabledBy ?? []).join("、");
	return [{
		layer: "l0",
		code: "plugin-disabled",
		severity: "warn",
		plugin: row.name,
		message: `${row.name} 已被禁用（${layers}）但仍登记在 profile 依赖中 — 禁用是压制症状而非修复；该插件仍会参与 pnpm install（peer 副本）并占用空间，建议排查根因后修复启用，或彻底移除`,
		evidence: [
			`disabled by: ${layers}`,
			`specifier: ${row.spec}`,
			`installed: ${row.installedDir !== "" ? row.installedDir : "(not installed)"}`
		],
		fixKind: "prompt",
		prompt: `${PROMPT_HEADER}\n\n问题：${row.name} 因事故被禁用（${layers}），但根因未修复。\n排查方向：\n1. 先跑「插件检测」全量扫描该插件，看 L0 各项是否已修复（依赖可解析/副本/harness 身份等）；\n2. 若根因已修复：从 ~/.dsh/cordis.patch.yml 删除该 disabled 行（或 dsh healthcheck rollback --undo），重启后端验证；\n3. 若根因无法修复：从 profile 彻底移除 —— cd ~/.dsh/profiles/web && pnpm remove ${row.name}，并删除插件目录；\n4. 不要长期保留 disabled 行 —— 被禁用的插件仍随 pnpm install 装出 peer 副本，是持续的隐患源。`
	}];
}
/** All L0 checkers in run order. */
const L0_CHECKERS = [
	checkFilesWhitelist,
	checkDependencySpec,
	checkHighRiskCopies,
	checkDependencyResolvability,
	checkWindowsCommands,
	checkLockfileConsistency,
	checkDisabledPlugins
];
/** Global L0 checks (profile-wide, not per plugin). */
function checkGlobalL0(ctx, rows) {
	const findings = [];
	findings.push(...checkHighRiskCopies(ctx, rows[0] ?? {
		name: "",
		spec: "",
		bundle: false,
		installedDir: ""
	}));
	if (!existsSync(resolveHomePatch(ctx.home))) findings.push({
		layer: "l0",
		code: "home-patch-missing",
		severity: "warn",
		message: `home 层补丁 ${resolveHomePatch(ctx.home)} 不存在 — 自动回滚将无法写入`,
		fixKind: "none"
	});
	return findings;
}
//#endregion
//#region src/host/malware.ts
/**
* C8 木马检查器 —— 纯静态、隔离扫描。
*
* 隔离原则（IRON RULE）：扫描器绝不执行插件代码 —— 不 import、不 require、
* 不 spawn 插件脚本、不运行 package.json 的 install/postinstall 脚本，只
* readFileSync 读取文本并按恶意模式库做正则匹配。可疑插件给出「隔离处置」
* （写 disabled 行 + 建议移除），执行前仍需面板确认。
*
* 模式库覆盖 7 类恶意行为（全部来自真实恶意 npm 包的手法制式）：
*   M1 下载并执行、M2 凭据窃取、M3 外联回传、M4 混淆后门、
*   M5 持久化、M6 破坏性操作、M7 环境变量劫持。
* 每个命中 = 文件 + 行号 + 命中片段（脱敏截断），按可疑度评分分级。
* @module dsh-plugin-healthcheck/host/malware
*/
/** Malware pattern families, strongest first. */
const FAMILIES = [
	{
		id: "M1",
		label: "下载并执行",
		weight: 2,
		description: "从网络下载内容并立即执行（curl|wget 管道 shell、Invoke-Expression 等）",
		patterns: [
			/(curl|wget|Invoke-WebRequest|iwr)\b[^;\n]*(?:\|\s*(?:ba)?sh|&&?\s*(?:ba)?sh|Out-String\s*\|\s*iex)/i,
			/Invoke-Expression|iex\s*\(/i,
			/DownloadString\s*\(/,
			/fetch\s*\([^)]*\)\.then\s*\([^)]*eval|eval\s*\(\s*.*fetch/i
		]
	},
	{
		id: "M2",
		label: "凭据窃取",
		weight: 2,
		description: "读取 SSH/凭据/密钥文件（代码读取调用 + 敏感路径组合，避免 UI 文案误报）",
		patterns: [
			/(?:readFileSync|readFile|createReadStream|accessSync|statSync|readdirSync|copyFileSync)\s*\([^)]*\.ssh[/\\]|id_rsa/i,
			/(?:readFileSync|readFile|createReadStream)\s*\([^)]*credentials(?:\.ya?ml|\.json)?|\.aws[/\\]credentials/i,
			/(?:password|passwd|secret|token|api[_-]?key)\s*[=:]\s*["'][^"']{8,}["']/i
		]
	},
	{
		id: "M3",
		label: "外联回传",
		weight: 2,
		description: "硬编码公网主机并上传数据（可疑域名/IP；本机回环与普通 https API 不算）",
		patterns: [
			/https?:\/\/(?!(?:127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3})\b[^"'\s]*/i,
			/https?:\/\/[a-z0-9.-]+\.(?:xyz|top|tk|ml|ga|cf|pw|club|online|site|rest|icu|work|click)\b/i,
			/net\.createConnection|net\.connect\s*\(\s*(?!(?:['"]127\.|['"]localhost))['"]?\d{1,3}\./i
		]
	},
	{
		id: "M4",
		label: "混淆后门",
		weight: 2,
		description: "动态代码执行（eval/Function 构造器 + base64/hex 大块）",
		patterns: [
			/\beval\s*\(/i,
			/new\s+Function\s*\(\s*(?!["']return\b)/i,
			/fromCharCode\s*\(\s*0x/i,
			/atob\s*\(\s*["'][A-Za-z0-9+/=]{200,}["']|Buffer\.from\s*\(\s*["'][A-Za-z0-9+/=]{200,}/i,
			/\bhex\b.*decode/i
		]
	},
	{
		id: "M5",
		label: "持久化",
		weight: 2,
		description: "开机自启/计划任务/注册表 Run 键写入",
		patterns: [
			/schtasks|Register-ScheduledTask|New-ScheduledTask/i,
			/HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/i,
			/Startup\s*[=:.]|\bstartup\s*\(\)/i,
			/['"](?:Start Menu|Startup)['"][^;]{0,80}/i,
			/\.plist\b.*LaunchAgents|LaunchDaemons/i
		]
	},
	{
		id: "M6",
		label: "破坏性操作",
		weight: 2,
		description: "递归删除 home/profile/工作区或覆盖关键文件",
		patterns: [
			/rm\s+-rf\s+(?:\/|~\s*$|~[/\\])/i,
			/removeSync\s*\(\s*["']~|rmdirSync\s*\(\s*["']~|rimraf\s*\(\s*["']~/i,
			/del\s+(?:\/f\s+\/q\s+)?%USERPROFILE%|Remove-Item\s+-Recurse\s+-Force\s+\$env:USERPROFILE/i,
			/unlinkSync\s*\(\s*join\s*\(\s*homedir/i
		]
	},
	{
		id: "M7",
		label: "环境劫持",
		weight: 1,
		description: "篡改 PATH/代理/NPM 配置等关键环境（常见供应链攻击入口）",
		patterns: [
			/process\.env\.(?:PATH|HTTPS?_PROXY|npm_config_registry|NODE_OPTIONS)\s*=/i,
			/npm\s+config\s+set\s+(?:registry|proxy)/i,
			/\$env:(?:Path|HTTPS?_PROXY)\s*=/i
		]
	}
];
/** File extensions the scanner reads. */
const SCAN_EXT = /\.(js|mjs|cjs|ts|tsx|sh|bat|cmd|ps1|py|json|ya?ml)$/i;
/** Directories never scanned. */
const SKIP_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"lib/types",
	".dsh",
	"tests",
	"test",
	"__tests__",
	"fixtures"
]);
/** Sensitive values redacted from evidence snippets. */
const REDACT = [
	/(AKIA|ASIA)[A-Z0-9]{16}/g,
	/gh[pousr]_[A-Za-z0-9]{36,}/g,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{0,200}/g,
	/(password|passwd|secret|token|apikey|api_key)\s*[=:]\s*["'][^"']{4,}["']/gi
];
/** Redact sensitive fragments from an evidence snippet. */
function redact(text) {
	let out = text;
	for (const pattern of REDACT) out = out.replace(pattern, "[REDACTED]");
	return out.length > 160 ? `${out.slice(0, 160)}…` : out;
}
/** Relative path from the plugin root. */
function relativeTo(root, file) {
	return file.startsWith(root) ? file.slice(root.length).replace(/^[/\\]/, "") : file;
}
/** Scan one file for all families, returning hits. */
function scanFile(root, file) {
	const hits = [];
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch {
		return hits;
	}
	const generated = /\/\/# sourceMappingURL=/m.test(content);
	const lines = content.split(/\r?\n/);
	for (const family of FAMILIES) {
		if (generated && family.id === "M4") continue;
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			for (const pattern of family.patterns) {
				pattern.lastIndex = 0;
				if (pattern.test(line)) {
					hits.push({
						family: family.id,
						label: family.label,
						file: relativeTo(root, file),
						line: index + 1,
						snippet: redact(line.trim()),
						weight: family.weight
					});
					break;
				}
			}
		}
	}
	return hits;
}
/** Walk the plugin tree collecting scannable files (read-only, never executes). */
function collectFiles(root) {
	const files = [];
	const walk = (dir, depth) => {
		if (depth > 6) return;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) walk(path, depth + 1);
				continue;
			}
			if (SCAN_EXT.test(entry.name)) files.push(path);
		}
	};
	walk(root, 0);
	return files;
}
/**
* C8 — scan one plugin for malware signatures. Pure static: reads files only,
* never imports or executes plugin code (the isolation contract).
*/
function scanPluginForMalware(root, pluginName) {
	if (root === "") return [];
	const findings = [];
	const hits = [];
	for (const file of collectFiles(root)) hits.push(...scanFile(root, file));
	if (hits.length === 0) return [];
	const strongFamilies = new Set(hits.filter((hit) => hit.weight === 2).map((hit) => hit.family));
	const hasNetwork = strongFamilies.has("M3");
	const dangerous = strongFamilies.has("M1") || strongFamilies.has("M6") || strongFamilies.has("M2") && hasNetwork;
	const score = Math.min(10, hits.reduce((sum, hit) => sum + hit.weight, 0));
	const severity = dangerous ? "error" : "warn";
	findings.push({
		layer: "malware",
		code: "malware-scan",
		severity,
		plugin: pluginName,
		message: `${pluginName} 木马扫描命中 ${hits.length} 处可疑模式（可疑度 ${score}/10）：${[...new Set(hits.map((h) => `${h.family} ${h.label}`))].join("、")} — 扫描为纯静态隔离执行，未运行任何插件代码${dangerous ? "" : "；单一命中多为合法用途（如 ssh 插件读 .ssh），请按证据人工复核"}`,
		evidence: hits.slice(0, 12).map((hit) => `${hit.file}:${hit.line} [${hit.family}] ${hit.snippet}`),
		fixKind: "prompt",
		prompt: buildIsolationPrompt(pluginName, hits, dangerous)
	});
	return findings;
}
/** The isolation/disposal prompt for a suspicious plugin. */
function buildIsolationPrompt(pluginName, hits, dangerous) {
	const families = [...new Set(hits.map((hit) => `${hit.family} ${hit.label}`))].join("、");
	const evidence = hits.slice(0, 10).map((hit) => `${hit.file}:${hit.line} [${hit.family}] ${hit.snippet}`).join("\n");
	const verdict = dangerous ? "强组合命中（下载执行/破坏性操作/凭据+外联），建议立即隔离。" : "单一签名命中，可能是合法用途（如 ssh 插件读取 ~/.ssh）；请按证据人工复核后再决定是否隔离。";
	return `你是 DSH 插件的安全处置助手。铁律：只允许修改插件代码与配置层（~/.dsh/plugins/**、~/.dsh/profiles/**、~/.dsh/cordis.patch.yml），严禁修改 harness 源码；不要执行该插件的任何脚本或模块。

【木马扫描结果】插件 ${pluginName} 命中 ${hits.length} 处可疑模式（${families}）。${verdict}

【证据】
${evidence}

【隔离处置步骤】
1. 立即隔离：在 ~/.dsh/cordis.patch.yml 追加 disabled 行（- id: <该插件的 loader 行 id>\n  disabled: true），运行中的后端会热重载生效；
2. 保留证据：把扫描结果与插件目录打包留档，勿删除证据；
3. 人工复核：打开证据文件对应行，判断是否误报（如插件合法地读取自身配置文件）；若确认为恶意代码，从 ~/.dsh/profiles/web 移除该依赖并删除插件目录；
4. 复检：处置完成后重新运行「插件检测」确认无新告警。

【注意】本扫描为静态签名匹配，可能误报；命中的公开源码插件请同时核对上游仓库源码是否一致（供应链投毒常在发布包内注入代码）。`;
}
//#endregion
//#region src/host/verify.ts
/**
* L1 config-composition check — reuses the base's own patch algorithm
* (composeEntries + applyEntryPatches) so the check can never drift from what
* boot mounts, and L2 isolated smoke boot — a subprocess that boots the full
* profile tree exactly like the real backend (webserver port offset to avoid
* conflict) and reports activation through assertEntriesActivated.
* @module dsh-plugin-healthcheck/host/verify
*/
/** The L1 finding factory. */
function l1Finding(code, severity, message, evidence = []) {
	return {
		layer: "l1",
		code,
		severity,
		message,
		evidence,
		fixKind: "prompt"
	};
}
/**
* L1 — compose the profile's patch layers through the base algorithm and
* audit the result: parse failures, row-id conflicts, and disable targets
* that no longer exist.
*/
async function checkConfigComposition(profile, home) {
	const { loadProfile, composeEntries, loadOptionalPatches } = await import("@deepseek-ai/dsh-app-boot");
	const findings = [];
	let composed;
	try {
		const loaded = loadProfile("dsh-healthcheck", profile, resolveInstallAnchor(), home);
		const bundlePatches = loaded.layers.flatMap((layer) => layer.patches);
		const profilePatches = loaded.patches;
		const homePatches = loadOptionalPatches("dsh-healthcheck", resolveHomePatch(home)) ?? [];
		const warns = [];
		composed = composeEntries([
			bundlePatches,
			profilePatches,
			homePatches
		], (message) => warns.push(message));
		for (const warn of warns) findings.push(l1Finding("patch-skipped", "warn", warn));
	} catch (error) {
		findings.push(l1Finding("config-compose-failed", "error", `配置树组合失败：${error instanceof Error ? error.message : String(error)}`));
		return findings;
	}
	const ids = /* @__PURE__ */ new Map();
	for (const row of composed) if (typeof row.id === "string") ids.set(row.id, (ids.get(row.id) ?? 0) + 1);
	for (const [id, count] of ids) if (count > 1) findings.push(l1Finding("duplicate-row-id", "error", `组合配置中行 id "${id}" 出现 ${count} 次 — 后加载的层会静默覆盖先加载的层`, [`id: ${id}`]));
	findings.push(l1Finding("config-compose-ok", "info", `配置树组合成功：${composed.length} 行（bundle 层 ${findings.length > 0 ? "有告警" : "无告警"}）`));
	return findings;
}
/**
* Resolve the runner entry. In the built profile copy it is lib/runner.js
* beside the bundled host module; under vitest the source module resolves
* it to lib/runner.js relative to the package root.
*/
function resolveRunnerPath() {
	const candidates = [fileURLToPath(new URL("./runner.js", import.meta.url)), fileURLToPath(new URL("../../lib/runner.js", import.meta.url))];
	for (const candidate of candidates) if (existsSync(candidate)) return candidate;
	return candidates[0];
}
/** Default smoke timeout (ms) — generous for cold boots with many bundles. */
const SMOKE_TIMEOUT_MS = 9e4;
/**
* L2 — boot the whole profile tree in an isolated subprocess. The overlay
* offsets the webserver port to 0 (OS-assigned) so the smoke boot never
* fights the running backend for the real port. Success = every enabled
* entry activated (assertEntriesActivated inside the runner).
*/
function runSmokeBoot(profile, home, timeoutMs = SMOKE_TIMEOUT_MS) {
	const overlayPath = writeSmokeOverlay(home, profile);
	const runnerPath = resolveRunnerPath();
	const started = Date.now();
	return new Promise((resolvePromise) => {
		const child = spawn(process.execPath, [
			runnerPath,
			profile,
			home,
			overlayPath
		], {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (ok, stage, error) => {
			if (settled) return;
			settled = true;
			cleanupSmokeOverlay(home, profile);
			resolvePromise({
				ok,
				durationMs: Date.now() - started,
				stage,
				error
			});
		};
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => finish(false, "spawn", error.message));
		child.on("exit", (code) => {
			if (code === 0) finish(true);
			else {
				const detail = stderr.trim() || stdout.trim();
				finish(false, `exit ${String(code)}`, detail.slice(-4e3));
			}
		});
		setTimeout(() => {
			if (!settled) {
				try {
					child.kill();
				} catch {}
				finish(false, "timeout", `smoke boot exceeded ${timeoutMs}ms (hang risk — a plugin init never settled)`);
			}
		}, timeoutMs);
	});
}
/** Write a temp overlay that offsets the webserver port to 0. */
function writeSmokeOverlay(home, profile) {
	const path = join(home, "profiles", profile, `.healthcheck-overlay-${process.pid}.yml`);
	writeFileSync(path, `# healthcheck smoke overlay — port 0 lets the smoke boot bind an
# OS-assigned port, so it never conflicts with the running backend.
- id: webserver
  config:
    host: 127.0.0.1
    port: 0
`, "utf8");
	return path;
}
/** Remove the smoke overlay file (best effort). */
function cleanupSmokeOverlay(home, profile) {
	const path = join(home, "profiles", profile, `.healthcheck-overlay-${process.pid}.yml`);
	try {
		unlinkSync(path);
	} catch {}
}
//#endregion
//#region src/host/service.ts
/**
* The check-run service: orchestrates L0 (six checkers, per plugin + global),
* L1 (config composition) and L2 (isolated smoke boot) into one run with
* progress, and persists the history record.
* @module dsh-plugin-healthcheck/host/service
*/
/** In-flight runs keyed by runId. */
const runs = /* @__PURE__ */ new Map();
/** Kick off a run in the background and return its id. */
function startRun(request) {
	const home = resolveHome();
	const profile = request.profile ?? "web";
	const layers = request.layers ?? [
		"l0",
		"l1",
		"l2",
		"malware"
	];
	const runId = randomUUID();
	const state = {
		runId,
		profile,
		home,
		stage: "l0",
		layers,
		findings: [],
		startedAt: (/* @__PURE__ */ new Date()).toISOString(),
		finished: false
	};
	runs.set(runId, state);
	executeRun(state, request.plugin);
	return runId;
}
/** Read one run state (undefined once pruned). */
function getRun(runId) {
	return runs.get(runId);
}
/** Read persisted history. */
function getHistory() {
	return readHistory(resolveHome());
}
/** Prune finished runs older than an hour. */
function pruneRuns() {
	const cutoff = Date.now() - 36e5;
	for (const [id, state] of runs) if (state.finished && Date.parse(state.startedAt) < cutoff) runs.delete(id);
}
/** Execute one run through its layers, then persist the history. */
async function executeRun(state, pluginFilter) {
	try {
		const rows = listProfilePlugins(state.profile, state.home);
		const scoped = pluginFilter !== void 0 ? rows.filter((row) => row.name === pluginFilter) : rows;
		if (state.layers.includes("l0")) {
			state.stage = "l0";
			const ctx = {
				home: state.home,
				profileDir: join(state.home, "profiles", state.profile),
				profile: state.profile
			};
			const perPlugin = L0_CHECKERS.filter((checker) => checker !== checkHighRiskCopies);
			for (const row of scoped) for (const checker of perPlugin) state.findings.push(...checker(ctx, row));
			state.findings.push(...checkGlobalL0(ctx, rows));
		}
		if (state.layers.includes("malware")) {
			state.stage = "malware";
			for (const row of scoped) {
				if (row.name === "dsh-plugin-healthcheck") continue;
				const scanRoot = row.sourceDir ?? (row.installedDir !== "" ? row.installedDir : "");
				state.findings.push(...scanPluginForMalware(scanRoot, row.name));
			}
		}
		if (state.layers.includes("l1")) {
			state.stage = "l1";
			state.findings.push(...await checkConfigComposition(state.profile, state.home));
		}
		if (state.layers.includes("l2")) {
			state.stage = "l2";
			state.smoke = await runSmokeBoot(state.profile, state.home);
			if (!state.smoke.ok) state.findings.push({
				layer: "l2",
				code: "smoke-failed",
				severity: "error",
				message: `隔离试跑失败（${state.smoke.stage ?? "unknown"}）：新插件会导致后端无法启动`,
				evidence: state.smoke.error !== void 0 ? [state.smoke.error] : [],
				fixKind: "rollback",
				rollbackId: pluginFilter
			});
		}
		state.stage = "done";
		state.finished = true;
		appendHistory(buildHistoryRecord(state), state.home);
		pruneRuns();
	} catch (error) {
		state.stage = "done";
		state.finished = true;
		state.error = error instanceof Error ? error.message : String(error);
		appendHistory(buildHistoryRecord(state), state.home);
	}
}
/** Fold one run state into a persisted history record. */
function buildHistoryRecord(state) {
	const errors = state.findings.filter((f) => f.severity === "error");
	const warnings = state.findings.filter((f) => f.severity === "warn");
	return {
		id: state.runId,
		at: state.startedAt,
		profile: state.profile,
		layers: state.layers,
		worst: errors.length > 0 ? "error" : warnings.length > 0 ? "warn" : state.findings.length > 0 ? "info" : "none",
		errors: errors.length,
		warnings: warnings.length,
		smoke: state.smoke,
		summary: state.findings.slice(0, 10).map((f) => f.message)
	};
}
//#endregion
//#region src/host/routes.ts
const BAD_REQUEST = {
	code: "bad-request",
	message: "malformed request"
};
/** Read a JSON request body into an unknown value; null when unparseable. */
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		chunks.push(buffer);
		total += buffer.length;
		if (total > 1 << 20) return null;
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
function field(payload, key) {
	if (typeof payload !== "object" || payload === null) return void 0;
	return payload[key];
}
function stringField(payload, key) {
	const value = field(payload, key);
	return typeof value === "string" && value !== "" ? value : null;
}
function stringArrayField(payload, key) {
	const value = field(payload, key);
	if (value === void 0) return [];
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
	return value;
}
function json(res, envelope, status = 200) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(envelope));
}
/** Register the /healthcheck routes on the shared webserver. */
function registerHealthcheckRoutes(ctx) {
	const handler = async (req, res) => {
		const url = new URL(req.url ?? "/", "http://x");
		const pathname = url.pathname;
		if (pathname === "/healthcheck/inventory" && req.method === "GET") {
			json(res, okEnvelope(listProfilePlugins("web", resolveHome()).map((row) => ({
				name: row.name,
				spec: row.spec,
				bundle: row.bundle,
				disabled: row.disabled === true,
				disabledBy: row.disabledBy ?? []
			}))));
			return;
		}
		if (pathname === "/healthcheck/run" && req.method === "POST") {
			const payload = await readJsonBody(req);
			if (payload === null) {
				json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
				return;
			}
			const layers = stringArrayField(payload, "layers");
			if (layers === null) {
				json(res, failEnvelope(BAD_REQUEST.code, "layers must be a string array"), 400);
				return;
			}
			const validLayers = /* @__PURE__ */ new Set([
				"l0",
				"l1",
				"l2",
				"malware"
			]);
			if (layers.some((layer) => !validLayers.has(layer))) {
				json(res, failEnvelope(BAD_REQUEST.code, `layers must be one of ${[...validLayers].join("/")}`), 400);
				return;
			}
			json(res, okEnvelope({ runId: startRun({
				profile: stringField(payload, "profile") ?? "web",
				plugin: stringField(payload, "plugin") ?? void 0,
				layers: layers.length > 0 ? layers : void 0
			}) }));
			return;
		}
		if (pathname === "/healthcheck/status" && req.method === "GET") {
			const runId = url.searchParams.get("runId");
			if (runId === null) {
				json(res, failEnvelope(BAD_REQUEST.code, "runId query is required"), 400);
				return;
			}
			const state = getRun(runId);
			if (state === void 0) {
				json(res, failEnvelope("run-unknown", "run id not found (finished runs are pruned)"), 404);
				return;
			}
			json(res, okEnvelope({
				stage: state.stage,
				finished: state.finished,
				findings: state.findings,
				smoke: state.smoke,
				error: state.error
			}));
			return;
		}
		if (pathname === "/healthcheck/repair" && req.method === "POST") {
			const payload = await readJsonBody(req);
			if (payload === null) {
				json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
				return;
			}
			const action = field(payload, "repair");
			if (typeof action !== "object" || action === null || typeof action.kind !== "string") {
				json(res, failEnvelope(BAD_REQUEST.code, "repair action is required"), 400);
				return;
			}
			if (!(field(payload, "confirmed") === true)) {
				json(res, failEnvelope("confirm-required", "修复必须先在界面确认（confirmed: true）"), 400);
				return;
			}
			try {
				json(res, okEnvelope(applyRepair(action, resolveHome())));
			} catch (error) {
				json(res, failEnvelope("repair-failed", error instanceof Error ? error.message : String(error)), 409);
			}
			return;
		}
		if (pathname === "/healthcheck/rollback" && req.method === "POST") {
			const payload = await readJsonBody(req);
			if (payload === null) {
				json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400);
				return;
			}
			const pluginId = stringField(payload, "pluginId");
			if (pluginId === null) {
				json(res, failEnvelope(BAD_REQUEST.code, "pluginId is required"), 400);
				return;
			}
			if (!(field(payload, "confirmed") === true)) {
				json(res, failEnvelope("confirm-required", "回滚必须先在界面确认（confirmed: true）"), 400);
				return;
			}
			try {
				json(res, okEnvelope(rollbackPlugin(pluginId, resolveHome())));
			} catch (error) {
				json(res, failEnvelope("rollback-failed", error instanceof Error ? error.message : String(error)), 409);
			}
			return;
		}
		if (pathname === "/healthcheck/rollback" && req.method === "DELETE") {
			const pluginId = url.searchParams.get("pluginId");
			if (pluginId === null) {
				json(res, failEnvelope(BAD_REQUEST.code, "pluginId query is required"), 400);
				return;
			}
			try {
				json(res, okEnvelope(undoRollback(pluginId, resolveHome())));
			} catch (error) {
				json(res, failEnvelope("rollback-failed", error instanceof Error ? error.message : String(error)), 409);
			}
			return;
		}
		if (pathname === "/healthcheck/history" && req.method === "GET") {
			json(res, okEnvelope(getHistory()));
			return;
		}
		res.writeHead(404);
		res.end();
	};
	return ctx.webServer.register({
		kind: "prefix",
		path: "/healthcheck",
		handler
	});
}
//#endregion
//#region src/index.ts
/** Required services: the route registry and the prompt band. */
const inject = ["webServer", "systemPrompt"];
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 230;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
const HEALTHCHECK_GUIDANCE = "本机已安装 dsh-plugin-healthcheck 插件（DSH 插件健康检查）：设置面板（左下角设置）内有「插件检测」向导 — L0 静态检查（files 白名单/依赖声明/高危副本/依赖可解析/Windows 命令/lockfile 一致性）+ L1 配置组合检查 + L2 隔离试跑（子进程完整 boot 验证新插件不会导致后端启动失败）。能力：检测可调用工具（node 解析/注册表 PATH/进程检查等）；发现即给出修复 — 确定性修复自动执行（改 files/删副本，应用前弹确认）、试跑失败自动回滚（写 ~/.dsh/cordis.patch.yml 的 disabled 行，HMR 热生效无需重启）、复杂问题打包预制提示词交给 agent 修复。铁律：修复只允许改插件代码与配置层，严禁修改 harness 源码（M:\\dsh\\node_modules）。用户提到「插件检测 / 健康检查 / 插件检测向导」时即指本插件，请据此协作。";
/**
* Mount the check-run routes and the prompt announcement.
* @param ctx - context carrying webServer and systemPrompt.
*/
function apply(ctx) {
	ctx.effect(() => registerHealthcheckRoutes(ctx), "dsh-plugin-healthcheck: /healthcheck routes");
	ctx.effect(() => ctx.systemPrompt.section({
		name: "plugin:healthcheck",
		order: SECTION_ORDER,
		text: HEALTHCHECK_GUIDANCE
	}), "dsh-plugin-healthcheck: prompt section");
}
//#endregion
export { HEALTHCHECK_GUIDANCE, apply, inject };
