window.__ModuleLoader__.load({ id: "dsh-trace-waterfall", factory(require) {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

var SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
var CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
function isWhitespace(c) {
  return c === " " || c === "\n" || c === "\r" || c === "	";
}
function isHex(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
var PartialArguments = class _PartialArguments {
  /** The view of a call with no arguments available. */
  static EMPTY = _PartialArguments.fromObject({});
  /**
   * View finished argument text without scanning it until a reader asks.
   * @param text - the complete argument JSON text.
   * @returns a sealed view.
   */
  static fromText(text) {
    const view = new _PartialArguments();
    view.append(text);
    view.sealed = true;
    return view;
  }
  /**
   * View an already parsed argument payload, such as a PTC dispatch object.
   * @param value - the parsed argument value.
   * @returns a sealed view; a non-object payload has no fields.
   */
  static fromObject(value) {
    const view = new _PartialArguments();
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    view.sealed = true;
    return view;
  }
  /**
   * The source: text so far or a parsed object, plus whether it can still grow.
   * These are the only enumerable fields, so two views over the same source
   * compare equal structurally however far each has been read.
   */
  chunks = [];
  object;
  sealed = false;
  // Scan progress, located fields, and remembered reads are caches over the source.
  #ends = [];
  #size = 0;
  #consumed = 0;
  #mode = "root";
  #escape = false;
  #keyStart = 0;
  #keyEscaped = false;
  #key = "";
  #current = null;
  #nestedEnds = [];
  #nestedInString = false;
  #invalidAt;
  #invalidValue = false;
  #entries = /* @__PURE__ */ new Map();
  #order = [];
  #reads = /* @__PURE__ */ new Map();
  /** Whether this view rejects further appends; does not scan text or register reads. */
  get isSealed() {
    return this.sealed;
  }
  /** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
  get invalid() {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }
  /**
   * Retain streamed argument text without scanning or comparing observed answers.
   * @param fragment - the text following every fragment appended before.
   */
  append(fragment) {
    if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0) return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }
  /**
   * Reconcile a streamed prefix with authoritative complete text without joining the fragments.
   * @param text - the final argument text, which replaces missing or conflicting deltas.
   * @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
   */
  settle(text) {
    if (this.object !== void 0 || text.length !== this.#size) return _PartialArguments.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset)) return _PartialArguments.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }
  /**
   * Compare observed answers and advance their publication baseline. Unread views remain unscanned.
   * @returns whether any observed answer changed since its first read or the preceding refresh.
   */
  refresh() {
    if (this.#reads.size === 0) return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
    }
    if (this.sealed) this.#reads.clear();
    return changed;
  }
  refreshRead(read) {
    const now = read.answer();
    if (Object.is(now, read.last)) return false;
    read.last = now;
    return true;
  }
  /**
   * Check whether no further fields can arrive.
   * @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
   */
  closed() {
    return this.remember("closed", "", () => this.closedNow());
  }
  /**
   * List discovered fields in first-appearance order.
   * @returns top-level keys seen so far, in first-appearance order.
   */
  keys() {
    return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
  }
  /**
   * Check whether a top-level field has appeared.
   * @param key - argument name.
   * @returns whether the field has appeared (a string opened or another value began).
   */
  has(key) {
    return this.remember("has", key, () => this.hasNow(key));
  }
  /**
   * Check whether a field's closing delimiter has arrived, without validating its contents.
   * @param key - argument name.
   * @returns whether its delimiter arrived and no content reader has reported an error for this value.
   */
  complete(key) {
    return this.remember("complete", key, () => this.completeNow(key));
  }
  /**
   * Read string length without materializing its text.
   * @param key - argument name.
   * @param options - change granularity for a streaming string.
   * @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
   */
  stringLength(key, options) {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(
      `length:${step}:${offset}`,
      key,
      () => this.lengthNow(key),
      (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step)
    );
  }
  /**
   * Check a string against a decoded UTF-16 length limit without materializing it.
   * @param key - argument name.
   * @param maxLength - decoded UTF-16 limit, floored to at least zero.
   * @returns whether the string is longer than the limit; false when absent or not a string.
   */
  stringExceeds(key, maxLength) {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember(
      `exceeds:${limit}`,
      key,
      () => (this.lengthNow(key, limit + 1) ?? 0) > limit
    );
  }
  /**
   * Read a decoded string, including a streaming prefix.
   * @param key - argument name.
   * @returns the string field's decoded text so far; undefined when absent or not a string.
   */
  text(key) {
    return this.remember("text", key, () => this.textNow(key));
  }
  /**
   * Read at most the first decoded UTF-16 units of a string.
   * @param key - argument name.
   * @param maxLength - maximum decoded UTF-16 length, floored to at least one.
   * @returns the bounded string prefix; undefined when absent or not a string.
   */
  textPrefix(key, maxLength) {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember(
      `prefix:${limit}`,
      key,
      () => this.textPrefixNow(key, limit)
    );
  }
  /**
   * Read a completed non-string argument.
   * @param key - argument name.
   * @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
   */
  value(key) {
    return this.remember("value", key, () => this.valueNow(key));
  }
  /** Answer a question and, on a streaming view, remember it for change detection. */
  remember(kind, key, read, comparison) {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id = `${kind}/${key}`;
      if (!this.#reads.has(id)) {
        this.#reads.set(id, {
          completion: kind === "complete",
          answer: comparison === void 0 ? read : () => comparison(read()),
          last: comparison === void 0 ? result : comparison(result)
        });
      }
    }
    return result;
  }
  closedNow() {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }
  keysNow() {
    return this.object === void 0 ? this.#order : Object.keys(this.object);
  }
  hasNow(key) {
    return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }
  completeNow(key) {
    if (this.object !== void 0) return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
  }
  lengthNow(key, limit = Number.POSITIVE_INFINITY) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.length : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
    const read = entry.length ??= { at: entry.start, length: 0, text: "" };
    this.readString(entry, read, limit, false);
    return read.length;
  }
  textNow(key) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
      let text;
      try {
        text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
      } catch (_error) {
      }
      if (text !== void 0) entry.text = { at: entry.end, length: text.length, text };
    }
    const read = entry.text ??= { at: entry.start, length: 0, text: "" };
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }
  textPrefixNow(key, maxLength) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.slice(0, maxLength) : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
    let read = prefixes.get(maxLength);
    if (read === void 0) {
      read = { at: entry.start, length: 0, text: "" };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }
  valueNow(key) {
    if (this.object !== void 0) {
      if (!Object.hasOwn(this.object, key)) return void 0;
      const field = this.object[key];
      return typeof field === "string" ? void 0 : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
    if (entry.parsed === void 0) {
      try {
        entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
      } catch (_error) {
        entry.invalid = true;
        this.#invalidValue = true;
      }
    }
    return entry.parsed;
  }
  chunkAt(at) {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.#ends[mid] <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  /** Materialize only a requested range, never the cumulative source. */
  slice(start, end) {
    if (start >= end) return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : this.#ends[first - 1];
    if (first === last) return this.chunks[first].slice(start - base, end - base);
    const parts = [this.chunks[first].slice(start - base)];
    for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
    parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
    return parts.join("");
  }
  readString(entry, read, limit, materialize) {
    const end = Math.min(
      entry.end < 0 ? this.#consumed : entry.end,
      entry.invalidAt ?? Number.POSITIVE_INFINITY,
      this.#invalidAt ?? Number.POSITIVE_INFINITY
    );
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0) return;
      if (materialize) read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
      const chunk = this.chunks[chunkIndex];
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize) read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length) chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
      let decoded;
      let width = 2;
      if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0; i < hex.length; i++) if (!isHex(hex[i])) valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0) return;
          if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== void 0) {
        decoded = SIMPLE_ESCAPES[type];
      }
      if (decoded === void 0) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize) read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
    }
  }
  /** Locate new field ranges without decoding or parsing their contents. */
  scan() {
    if (this.object !== void 0 || this.#consumed === this.#size) return;
    for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
      const pending = this.chunks[i];
      const base = i === 0 ? 0 : this.#ends[i - 1];
      for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length) break;
        }
        this.step(pending[index], this.#consumed);
        this.#consumed++;
      }
    }
  }
  /** Only raw quotes and their preceding backslash runs can terminate a string. */
  stringBoundary(fragment, start) {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped) return end;
      at = quote + 1;
    }
  }
  step(c, at) {
    switch (this.#mode) {
      case "root":
        if (isWhitespace(c)) return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace(c)) return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace(c)) return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace(c)) return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace(c)) return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace(c)) return;
        this.fail();
        return;
      /* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
      case "invalid":
        return;
      /* v8 ignore next 2 -- Every scanner mode has a handler above. */
      default:
        assertNever(this.#mode);
    }
  }
  fail() {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }
  beginKey(at) {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }
  stepKey(c, at) {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"') return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped) {
      try {
        this.#key = JSON.parse(`"${raw}"`);
      } catch (_error) {
        this.fail();
        return;
      }
    } else {
      this.#key = raw;
    }
    this.#mode = "colon";
  }
  open(entry) {
    if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }
  beginValue(c, at) {
    if (isWhitespace(c)) return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: void 0,
        length: void 0,
        text: void 0,
        prefixes: void 0
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({ kind: "value", start: at, end: -1, parsed: void 0, invalid: false });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }
  stepScalar(c, at) {
    if (c !== "," && c !== "}" && !isWhitespace(c)) return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }
  stepNested(c, at) {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }
  closeValue(end) {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
};

function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

function isTokenDelta(chunk) {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return chunk.text !== "";
    case "tool-call-delta":
      return chunk.argumentsDelta !== "" || chunk.name !== void 0;
    default:
      return false;
  }
}
function firstRunMemberTime(run, predicate) {
  const fragments = run.type === "tool-call-chunks" ? run.args : run.texts;
  let time = run.time0;
  for (let index = 0; index < fragments.length; index += 1) {
    if (index > 0)
      time += run.dt[index - 1];
    if (predicate(fragments[index]))
      return time;
  }
  return void 0;
}
function runFirstTokenTime(run) {
  if (run.type === "tool-call-chunks" && run.name !== void 0)
    return run.time0;
  return firstRunMemberTime(run, (fragment) => fragment !== "");
}
function assistantStreamFirstTokenTime(stream) {
  for (const record2 of stream) {
    const time = record2.type === "chunk" ? isTokenDelta(record2.chunk) ? record2.time : void 0 : runFirstTokenTime(record2);
    if (time !== void 0)
      return time;
  }
  return void 0;
}

// src/client/adapter/trajectory-definition-common.ts
function trajectoryNode(context, anchorSeq, data) {
  return {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: "trajectory",
    anchorSeq,
    location: context.start?.location ?? { kind: "unresolved" },
    data
  };
}

// src/client/adapter/trajectory-event-projection.ts
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function readString(record2, key) {
  const value = record2[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
function collect(source, member, field) {
  const list = source[member];
  if (!Array.isArray(list)) return [];
  const seen = [];
  for (const entry of list) {
    const record2 = asRecord(entry);
    const value = record2 === null ? null : readString(record2, field);
    if (value !== null && !seen.includes(value)) seen.push(value);
  }
  return seen;
}
function joined(names) {
  return names.length > 0 ? names.join(", ") : null;
}
var KNOWN_FORMS = [
  "instructions",
  "catalog",
  "snapshot",
  "notice",
  "relay",
  "recall"
];
function contextForm(source) {
  const record2 = asRecord(source);
  const form = record2 === null ? null : readString(record2, "form");
  return form !== null && KNOWN_FORMS.includes(form) ? form : null;
}
function contextProducer(source) {
  const record2 = asRecord(source);
  const kind = record2 === null ? null : readString(record2, "kind");
  if (record2 === null || kind === null) return { role: "inject", label: null };
  switch (kind) {
    case "session-reference":
      return { role: "recall", label: joined(collect(record2, "references", "label")) ?? kind };
    case "agent-instructions":
      return { role: "inject", label: joined(collect(record2, "changes", "path")) ?? kind };
    case "skill-invocation":
      return { role: "inject", label: readString(record2, "name") ?? kind };
    default:
      return { role: "inject", label: kind };
  }
}
function toAssistantBlocks(content) {
  return content.map(toAssistantBlock);
}
function toAssistantBlock(block) {
  switch (block.type) {
    case "text":
      return { kind: "text", text: block.text };
    case "reasoning":
      return { kind: "reasoning", text: block.text };
    case "image":
      return { kind: "image", attachment: block.attachment };
    case "tool-call":
      return { kind: "tool-call", callId: String(block.id), name: block.name, argsRaw: block.arguments };
    default:
      return { kind: "other", block };
  }
}
function emptyAssistantBlock(blockType) {
  switch (blockType) {
    case "text":
      return { kind: "text", text: "" };
    case "reasoning":
      return { kind: "reasoning", text: "" };
    case "tool-call":
      return { kind: "tool-call", callId: "", name: "", argsRaw: "" };
    default:
      return { kind: "other", block: null };
  }
}
function displayFailure(failure) {
  if (failure === null || typeof failure !== "object") return { message: String(failure) };
  const record2 = failure;
  const code = typeof record2.code === "string" ? record2.code : void 0;
  if (code === "AUTH") return { code, message: "" };
  return {
    ...code === void 0 ? {} : { code },
    message: typeof record2.message === "string" ? record2.message : JSON.stringify(failure)
  };
}
function isTokenDelta2(chunk) {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return chunk.text !== "";
    case "tool-call-delta":
      return chunk.argumentsDelta !== "" || chunk.name !== void 0;
    default:
      return false;
  }
}

// src/client/adapter/trajectory-assistant-definition.ts
function initialState(turn, step, startSeq, startTime, started) {
  return {
    turn,
    step,
    startSeq,
    startTime,
    started,
    blocks: [],
    visibleBlocks: 0,
    firstVisibleSeq: void 0,
    firstVisibleTime: void 0,
    firstTokenTime: void 0,
    final: void 0,
    usage: void 0,
    retry: void 0,
    stepEnd: void 0
  };
}
function compactBlocks(blocks) {
  return blocks.filter((block) => block !== void 0);
}
function blockIsVisible(block) {
  if (block === void 0 || block.kind === "tool-call") return false;
  if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
  return true;
}
function countVisibleBlocks(blocks) {
  let count = 0;
  for (const block of blocks) if (blockIsVisible(block)) count++;
  return count;
}
function hasInterruptionEvidence(blocks) {
  return blocks.some((block) => {
    if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
    return true;
  });
}
function addUsage(current, next) {
  return {
    inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
    ...current?.cacheReadTokens === void 0 && next.cacheReadTokens === void 0 ? {} : { cacheReadTokens: (current?.cacheReadTokens ?? 0) + (next.cacheReadTokens ?? 0) },
    ...current?.cacheWriteTokens === void 0 && next.cacheWriteTokens === void 0 ? {} : { cacheWriteTokens: (current?.cacheWriteTokens ?? 0) + (next.cacheWriteTokens ?? 0) },
    ...current?.reasoningTokens === void 0 && next.reasoningTokens === void 0 ? {} : { reasoningTokens: (current?.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0) }
  };
}
function updateChunk(state, chunk, seq, time) {
  if (chunk.type === "usage") {
    return { ...state, usage: addUsage(state.usage, chunk.usage) };
  }
  const blocks = [...state.blocks];
  let changedIndex = -1;
  let previousVisible = false;
  switch (chunk.type) {
    case "block-start":
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(blocks[chunk.index]);
      blocks[chunk.index] = emptyAssistantBlock(chunk.blockType);
      break;
    case "text-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      blocks[chunk.index] = {
        kind: "text",
        text: (previous?.kind === "text" ? previous.text : "") + chunk.text
      };
      break;
    }
    case "reasoning-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      blocks[chunk.index] = {
        kind: "reasoning",
        text: (previous?.kind === "reasoning" ? previous.text : "") + chunk.text
      };
      break;
    }
    case "tool-call-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      const base = previous?.kind === "tool-call" ? previous : { kind: "tool-call", callId: "", name: "", argsRaw: "" };
      blocks[chunk.index] = {
        kind: "tool-call",
        callId: base.callId || String(chunk.id),
        name: chunk.name ?? base.name,
        argsRaw: base.argsRaw + chunk.argumentsDelta
      };
      break;
    }
    case "block-end":
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(blocks[chunk.index]);
      blocks[chunk.index] = toAssistantBlock(chunk.block);
      break;
    default:
      return state;
  }
  const visibleBlocks = state.visibleBlocks - Number(previousVisible) + Number(blockIsVisible(blocks[changedIndex]));
  return {
    ...state,
    blocks,
    visibleBlocks,
    ...visibleBlocks > 0 && state.firstVisibleSeq === void 0 ? { firstVisibleSeq: seq, firstVisibleTime: time } : {},
    ...isTokenDelta2(chunk) && state.firstTokenTime === void 0 ? { firstTokenTime: time } : {}
  };
}
function settleTiming(state, event) {
  return {
    ...state,
    firstTokenTime: state.firstTokenTime ?? assistantStreamFirstTokenTime(event.data.stream)
  };
}
function settleMessage(state, match, event) {
  const blocks = toAssistantBlocks(event.data.message.content);
  return {
    ...settleTiming(state, event),
    blocks,
    visibleBlocks: countVisibleBlocks(blocks),
    final: match,
    usage: event.data.usage
  };
}
function closedBoundary(context) {
  if (context.state?.stepEnd?.event.type === "step/end") return context.state.stepEnd.event;
  const location = context.start?.location ?? context.matches.at(-1)?.location;
  if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
  if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") return location.turn.end;
  return void 0;
}
function fallbackState(context) {
  let state;
  for (const match of context.matches) {
    const event = match.event;
    if (event.type === "assistant/live-chunk") {
      state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
      state = updateChunk(state, event.data.chunk, event.seq, event.time);
    } else if (event.type === "assistant/attempt") {
      state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
      state = settleTiming(state, event);
    } else if (event.type === "assistant/message") {
      state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
      state = settleMessage(state, match, event);
    } else if (event.type === "step/end" && state !== void 0) {
      state = { ...state, stepEnd: match };
    }
  }
  return state;
}
function finalNode(state, context) {
  const final = state.final;
  if (final?.event.type === "assistant/message") {
    const event = final.event;
    return {
      kind: "assistant",
      seq: event.seq,
      messageId: event.data.message.id,
      time: event.time,
      turn: state.turn,
      step: state.step,
      blocks: toAssistantBlocks(event.data.message.content),
      usage: event.data.usage,
      providerMetadata: {
        provider: event.data.message.source.provider,
        model: event.data.message.source.model
      },
      timing: {
        stepStartTime: state.started ? state.startTime : null,
        firstTokenTime: state.firstTokenTime ?? null,
        completedTime: event.time
      },
      ...event.data.interrupted === true ? { interrupted: true } : {}
    };
  }
  const boundary = closedBoundary(context);
  if (boundary === void 0) return void 0;
  const blocks = compactBlocks(state.blocks);
  if (!hasInterruptionEvidence(blocks)) return void 0;
  return {
    kind: "assistant",
    seq: boundary.seq - 0.9,
    time: boundary.time,
    turn: state.turn,
    step: state.step,
    blocks,
    interrupted: true
  };
}
function assistantRequest(state, node, boundary) {
  if (!state.started) return void 0;
  const status = node !== void 0 ? node.interrupted === true ? "error" : "complete" : boundary !== void 0 ? "error" : "running";
  return {
    purpose: "assistant",
    startSeq: state.startSeq,
    turn: state.turn,
    step: state.step,
    startedAt: state.startTime,
    completedAt: node?.time ?? boundary?.time ?? null,
    status,
    ...state.retry === void 0 ? {} : {
      error: state.retry.message,
      ...state.retry.code === void 0 ? {} : { errorCode: state.retry.code },
      retry: state.retry.retry,
      ...state.retry.maxRetries === void 0 ? {} : { maxRetries: state.retry.maxRetries },
      retryDelayMs: state.retry.delayMs
    },
    ...node?.messageId === void 0 ? {} : {
      resultSeq: node.seq,
      ...node.providerMetadata === void 0 ? {} : { providerMetadata: node.providerMetadata }
    },
    ...state.usage === void 0 ? {} : { usage: state.usage }
  };
}
var trajectoryAssistantDefinition = {
  kind: "trajectory-assistant-step",
  target: "trajectory",
  match: (event) => {
    if (event.type === "step/start") {
      return { id: `${event.data.turn}:${event.data.step}`, role: "start" };
    }
    if (event.type === "assistant/live-chunk" || event.type === "assistant/message" || event.type === "assistant/attempt" || event.type === "llm/retry" || event.type === "step/end") {
      return { id: `${event.data.turn}:${event.data.step}`, role: "update" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "step/start") {
      throw new Error("trajectory-assistant-step start requires step/start");
    }
    return initialState(
      match.event.data.turn,
      match.event.data.step,
      match.event.seq,
      match.event.time,
      true
    );
  },
  update: (context, match) => {
    if (match.event.type === "assistant/live-chunk") {
      return updateChunk(context.state, match.event.data.chunk, match.event.seq, match.event.time);
    }
    if (match.event.type === "assistant/message") return settleMessage(context.state, match, match.event);
    if (match.event.type === "assistant/attempt") return settleTiming(context.state, match.event);
    if (match.event.type === "step/end") return { ...context.state, stepEnd: match };
    if (match.event.type !== "llm/retry") return context.state;
    const data = match.event.data;
    const failure = displayFailure(data.failure);
    return {
      ...initialState(
        context.state.turn,
        context.state.step,
        context.state.startSeq,
        context.state.startTime,
        true
      ),
      firstTokenTime: context.state.firstTokenTime,
      usage: context.state.usage,
      retry: {
        message: failure.message,
        ...failure.code === void 0 ? {} : { code: failure.code },
        retry: data.retry,
        ...data.mode === "normal" ? { maxRetries: data.maxRetries } : {},
        delayMs: data.delayMs
      }
    };
  },
  publication: (match) => {
    if (match.event.type === "step/start" || match.event.type === "assistant/attempt") return "none";
    if (match.event.type !== "assistant/live-chunk") return "immediate";
    const type = match.event.data.chunk.type;
    return type === "usage" || type === "finish" ? "none" : "animation-frame";
  },
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState(context);
    if (state === void 0) return null;
    const node = finalNode(state, context);
    const boundary = closedBoundary(context);
    const partial = node === void 0 && boundary === void 0 && state.blocks.length > 0 ? {
      turn: state.turn,
      step: state.step,
      blocks: compactBlocks(state.blocks),
      timing: {
        stepStartTime: state.started ? state.startTime : null,
        firstTokenTime: state.firstTokenTime ?? null
      }
    } : null;
    const request = assistantRequest(state, node, boundary);
    if (node === void 0 && partial === null && request === void 0) return null;
    return trajectoryNode(context, state.startSeq, {
      kind: "assistant",
      ...node === void 0 ? {} : { node },
      partial,
      ...request === void 0 ? {} : { request }
    });
  }
};
var trajectoryTurnEndDefinition = {
  kind: "trajectory-turn-end",
  target: "trajectory",
  match: (event) => event.type === "turn/end" ? { id: String(event.seq), role: "start" } : null,
  start: (_context, match) => {
    if (match.event.type !== "turn/end") {
      throw new Error("trajectory-turn-end start requires turn/end");
    }
    const reason = match.event.data.reason;
    const failure = reason.kind === "error" ? displayFailure(reason.error) : void 0;
    return {
      turn: match.event.data.turn,
      seq: match.event.seq,
      time: match.event.time,
      ...failure === void 0 ? {} : {
        error: failure.message,
        ...failure.code === void 0 ? {} : { errorCode: failure.code }
      }
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
    kind: "turn-end",
    turn: context.state.turn,
    time: context.state.time,
    ...context.state.error === void 0 ? {} : { error: context.state.error },
    ...context.state.errorCode === void 0 ? {} : { errorCode: context.state.errorCode }
  })
};
function registerTrajectoryAssistantDefinition(ctx) {
  ctx.uiConversation.events.register(trajectoryAssistantDefinition);
  ctx.uiConversation.events.register(trajectoryTurnEndDefinition);
}

// src/client/adapter/trajectory-compaction-definition.ts
function checkpointId(event) {
  if (event.type !== "user/message") return void 0;
  const source = event.data.source;
  return source.kind === "compact-checkpoint" && typeof source.compactionId === "string" && source.compactionId !== "" ? source.compactionId : void 0;
}
function eventCompactionId(event) {
  if (event.type !== "compaction/start" && event.type !== "compaction/summary" && event.type !== "compaction/end") return void 0;
  const value = event.data.compactionId;
  return typeof value === "string" && value !== "" ? value : void 0;
}
function requestFromState(state) {
  const start = state.start.event;
  if (start.type !== "compaction/start") return void 0;
  const summary2 = state.summary?.event;
  const end = state.end?.event;
  const checkpoint = state.checkpoint?.event;
  return {
    purpose: "compaction",
    startSeq: start.seq,
    turn: start.data.turn,
    step: 0,
    startedAt: start.time,
    completedAt: end?.type === "compaction/end" ? end.time : null,
    status: end?.type !== "compaction/end" ? "running" : end.data.error === void 0 ? "complete" : "error",
    ...end?.type === "compaction/end" && end.data.error !== void 0 ? { error: end.data.error } : {},
    ...summary2?.type !== "compaction/summary" ? {} : {
      resultSeq: summary2.seq,
      summary: summary2.data.summary,
      ...summary2.data.rawOutput === void 0 ? {} : { rawOutput: summary2.data.rawOutput },
      providerMetadata: { provider: summary2.data.provider, model: summary2.data.model },
      requestConfig: {
        provider: summary2.data.provider,
        model: summary2.data.model,
        purpose: "compaction",
        ...summary2.data.maxTokens === void 0 ? {} : { maxTokens: summary2.data.maxTokens }
      },
      ...summary2.data.usage === void 0 ? {} : { usage: summary2.data.usage }
    },
    ...checkpoint?.type === "user/message" ? { replacementSeq: checkpoint.seq } : {}
  };
}
var trajectoryCompactionDefinition = {
  kind: "trajectory-compaction",
  target: "trajectory",
  match: (event) => {
    const compactId = eventCompactionId(event);
    if (compactId !== void 0) {
      return { id: compactId, role: event.type === "compaction/start" ? "start" : "update" };
    }
    const checkpoint = checkpointId(event);
    return checkpoint === void 0 ? null : { id: checkpoint, role: "update" };
  },
  start: (_context, match) => {
    if (match.event.type !== "compaction/start") {
      throw new Error("trajectory-compaction start requires compaction/start");
    }
    return { start: match };
  },
  update: (context, match) => {
    if (match.event.type === "compaction/summary") return { ...context.state, summary: match };
    if (match.event.type === "compaction/end") return { ...context.state, end: match };
    return checkpointId(match.event) === void 0 ? context.state : { ...context.state, checkpoint: match };
  },
  buildViewNode: (context) => {
    if (context.state === void 0) return null;
    const request = requestFromState(context.state);
    return request === void 0 ? null : trajectoryNode(context, request.startSeq, { kind: "compaction", request });
  }
};
var trajectorySessionEndDefinition = {
  kind: "trajectory-session-end",
  target: "trajectory",
  match: (event) => event.type === "session/end-seed" ? { id: String(event.seq), role: "start" } : null,
  start: (_context, match) => ({ seq: match.event.seq, time: match.event.time }),
  update: (context) => context.state,
  buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
    kind: "session-end",
    seq: context.state.seq,
    time: context.state.time
  })
};
function registerTrajectoryCompactionDefinitions(ctx) {
  ctx.uiConversation.events.register(trajectoryCompactionDefinition);
  ctx.uiConversation.events.register(trajectorySessionEndDefinition);
}

// src/client/adapter/trajectory-message-definitions.ts
var EMPTY_PENDING = { kind: "snapshot", ids: [] };
var EMPTY_CURRENT_CLAIMED = /* @__PURE__ */ new Set();
function materializePending(state) {
  const splices = [];
  let current = state;
  while (current.kind === "splice") {
    splices.push(current);
    current = current.previous;
  }
  const pending = [...current.ids];
  for (const splice of splices.reverse()) {
    pending.splice(splice.start, splice.removedCount, ...splice.inserted);
  }
  return pending;
}
function withoutInserted(claimed, inserted) {
  let next;
  for (const id of inserted) {
    if (!claimed.has(id)) continue;
    next ??= new Set(claimed);
    next.delete(id);
  }
  return next ?? claimed;
}
function applySplice(previous, splice) {
  const priorPending = previous?.state.pending ?? EMPTY_PENDING;
  const inserted = splice.inserted.map((identity) => identity.id);
  const removedCount = splice.removedCount ?? 0;
  if (removedCount > 0 && splice.outcome !== "canceled") {
    const pending = materializePending(priorPending);
    const removed = pending.splice(splice.start, removedCount, ...inserted);
    return {
      pending: { kind: "snapshot", ids: pending },
      currentClaimed: new Set(removed)
    };
  }
  const currentClaimed = withoutInserted(
    previous?.state.currentClaimed ?? EMPTY_CURRENT_CLAIMED,
    inserted
  );
  return {
    pending: {
      kind: "splice",
      previous: priorPending,
      start: splice.start,
      removedCount,
      inserted
    },
    currentClaimed
  };
}
var trajectoryInboxDefinition = {
  kind: "trajectory-inbox-next-step",
  match: (event) => {
    if (event.type === "agent/inbox/spliced" && event.data.target === "next-step") {
      return { id: String(event.seq), role: "start" };
    }
    return null;
  },
  start: (_context, match, reader) => {
    if (match.event.type !== "agent/inbox/spliced") {
      throw new Error("trajectory-inbox-next-step start requires agent/inbox/spliced");
    }
    return applySplice(
      reader.previous("trajectory-inbox-next-step"),
      match.event.data
    );
  },
  update: (context) => context.state,
  publication: () => "none"
};
var trajectoryMessageDefinition = {
  kind: "trajectory-input-message",
  target: "trajectory",
  match: (event) => {
    return event.type === "user/message" || event.type === "developer/message" ? { id: String(event.seq), role: "start" } : null;
  },
  start: (_context, match, reader) => {
    if (match.event.type === "developer/message") {
      const { seq, time, data: { message } } = match.event;
      return {
        kind: "context",
        seq,
        time,
        content: message.content,
        source: message.source,
        producer: contextProducer(message.source),
        form: contextForm(message.source)
      };
    }
    if (match.event.type !== "user/message") {
      throw new Error("trajectory-input-message start requires user/message");
    }
    const event = match.event;
    if (event.data.source.kind !== "user") {
      return {
        kind: "context",
        seq: event.seq,
        time: event.time,
        content: event.data.content,
        source: event.data.source,
        producer: contextProducer(event.data.source),
        form: contextForm(event.data.source)
      };
    }
    const claimed = reader.previous("trajectory-inbox-next-step")?.state.currentClaimed.has(String(event.data.id)) === true;
    return claimed ? {
      kind: "steering",
      messageId: event.data.id,
      seq: event.seq,
      time: event.time,
      content: event.data.content,
      source: event.data.source
    } : {
      kind: "user",
      seq: event.seq,
      time: event.time,
      content: event.data.content,
      source: event.data.source
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, { kind: "node", node: context.state })
};
function registerTrajectoryMessageDefinitions(ctx) {
  ctx.uiConversation.events.register(trajectoryInboxDefinition);
  ctx.uiConversation.events.register(trajectoryMessageDefinition);
}

// src/client/adapter/trajectory-request-header-definition.ts
function trajectorySystemMessageDefinition(inspect) {
  return {
    kind: "trajectory-system-message",
    target: "trajectory",
    match: (event) => event.type === "system/message" || "surfaceOp" in event && event.surfaceOp !== "append" ? { id: String(event.seq), role: "start" } : null,
    start: (_context, match, reader) => {
      if (match.event.type === "assistant/live-chunk") throw new Error("system-message requires a durable event");
      const prior = reader.previous("trajectory-system-message")?.state;
      const state = inspect(prior, match.event);
      const node = state.effective;
      if (state.uncertain) {
        const header2 = reader.previous("trajectory-request-header")?.state;
        if (header2 === void 0) return state;
        return {
          ...state,
          header: {
            seq: match.event.seq,
            time: match.event.time,
            location: match.location,
            prompt: { ...header2.prompt, system: "" }
          }
        };
      }
      if (node === void 0 || node.text === prior?.effective?.text || state.introduced !== void 0 && !state.introduced.update) {
        return { ...state, ...prior?.header === void 0 ? {} : { header: prior.header } };
      }
      const header = reader.previous("trajectory-request-header")?.state;
      const systemHeader = prior?.header;
      const previous = systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader : header;
      if (previous === void 0) return state;
      return {
        ...state,
        header: {
          seq: node.seq,
          time: node.time,
          prompt: { ...previous.prompt, system: node.text },
          change: { seq: node.seq, time: node.time, kind: "system", previous: previous.prompt },
          location: match.location
        }
      };
    },
    update: (context) => context.state,
    buildViewNode: (context) => {
      const state = context.state;
      if (state?.header !== void 0 && state.header.seq === context.start?.event.seq) {
        return trajectoryNode(context, state.header.seq, { kind: "request-header", header: state.header });
      }
      const prompt = state?.introduced;
      return prompt !== void 0 && prompt.text !== "" && context.start?.event.type === "system/message" && context.start.event.surfaceOp === "append" ? trajectoryNode(context, prompt.seq, { kind: "system-prompt", prompt }) : null;
    }
  };
}
function trajectoryRequestHeaderDefinition(inspect) {
  return {
    kind: "trajectory-request-header",
    target: "trajectory",
    match: (event) => event.type === "request/header" ? { id: String(event.seq), role: "start" } : null,
    start: (_context, match, reader) => {
      if (match.event.type !== "request/header") {
        throw new Error("trajectory-request-header start requires request/header");
      }
      const header = reader.previous("trajectory-request-header")?.state;
      const state = reader.previous("trajectory-system-message")?.state;
      const systemHeader = state?.header;
      const previous = systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader.prompt : header?.prompt;
      const system = state?.effective;
      const inspection = inspect(previous, match.event, system);
      const { prompt } = inspection;
      const change = inspection.change ?? (systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader.change : void 0);
      return {
        seq: match.event.seq,
        time: match.event.time,
        prompt,
        location: match.location,
        ...change === void 0 ? {} : { change }
      };
    },
    update: (context) => context.state,
    buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
      kind: "request-header",
      header: context.state
    })
  };
}
function registerTrajectoryRequestHeaderDefinition(ctx) {
  ctx.uiConversation.events.register(trajectorySystemMessageDefinition(
    (previous, event) => ctx.uiConversation.inspectSystemPrompt(previous, event)
  ));
  ctx.uiConversation.events.register(trajectoryRequestHeaderDefinition(
    (previous, event, system) => ctx.uiConversation.inspectRequestPrompt(previous, event, system)
  ));
}

var SIMPLE_ESCAPES2 = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
var CONTENT_ESCAPE2 = /[\\\u0000-\u001f]/u;
function isWhitespace2(c) {
  return c === " " || c === "\n" || c === "\r" || c === "	";
}
function isHex2(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
var PartialArguments2 = class PartialArguments3 {
  /** The view of a call with no arguments available. */
  static EMPTY = PartialArguments3.fromObject({});
  /**
  * View finished argument text without scanning it until a reader asks.
  * @param text - the complete argument JSON text.
  * @returns a sealed view.
  */
  static fromText(text) {
    const view = new PartialArguments3();
    view.append(text);
    view.sealed = true;
    return view;
  }
  /**
  * View an already parsed argument payload, such as a PTC dispatch object.
  * @param value - the parsed argument value.
  * @returns a sealed view; a non-object payload has no fields.
  */
  static fromObject(value) {
    const view = new PartialArguments3();
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    view.sealed = true;
    return view;
  }
  /**
  * The source: text so far or a parsed object, plus whether it can still grow.
  * These are the only enumerable fields, so two views over the same source
  * compare equal structurally however far each has been read.
  */
  chunks = [];
  object;
  sealed = false;
  #ends = [];
  #size = 0;
  #consumed = 0;
  #mode = "root";
  #escape = false;
  #keyStart = 0;
  #keyEscaped = false;
  #key = "";
  #current = null;
  #nestedEnds = [];
  #nestedInString = false;
  #invalidAt;
  #invalidValue = false;
  #entries = /* @__PURE__ */ new Map();
  #order = [];
  #reads = /* @__PURE__ */ new Map();
  /** Whether this view rejects further appends; does not scan text or register reads. */
  get isSealed() {
    return this.sealed;
  }
  /** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
  get invalid() {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }
  /**
  * Retain streamed argument text without scanning or comparing observed answers.
  * @param fragment - the text following every fragment appended before.
  */
  append(fragment) {
    if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0) return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }
  /**
  * Reconcile a streamed prefix with authoritative complete text without joining the fragments.
  * @param text - the final argument text, which replaces missing or conflicting deltas.
  * @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
  */
  settle(text) {
    if (this.object !== void 0 || text.length !== this.#size) return PartialArguments3.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset)) return PartialArguments3.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }
  /**
  * Compare observed answers and advance their publication baseline. Unread views remain unscanned.
  * @returns whether any observed answer changed since its first read or the preceding refresh.
  */
  refresh() {
    if (this.#reads.size === 0) return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
    }
    if (this.sealed) this.#reads.clear();
    return changed;
  }
  refreshRead(read) {
    const now = read.answer();
    if (Object.is(now, read.last)) return false;
    read.last = now;
    return true;
  }
  /**
  * Check whether no further fields can arrive.
  * @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
  */
  closed() {
    return this.remember("closed", "", () => this.closedNow());
  }
  /**
  * List discovered fields in first-appearance order.
  * @returns top-level keys seen so far, in first-appearance order.
  */
  keys() {
    return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
  }
  /**
  * Check whether a top-level field has appeared.
  * @param key - argument name.
  * @returns whether the field has appeared (a string opened or another value began).
  */
  has(key) {
    return this.remember("has", key, () => this.hasNow(key));
  }
  /**
  * Check whether a field's closing delimiter has arrived, without validating its contents.
  * @param key - argument name.
  * @returns whether its delimiter arrived and no content reader has reported an error for this value.
  */
  complete(key) {
    return this.remember("complete", key, () => this.completeNow(key));
  }
  /**
  * Read string length without materializing its text.
  * @param key - argument name.
  * @param options - change granularity for a streaming string.
  * @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
  */
  stringLength(key, options) {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
  }
  /**
  * Check a string against a decoded UTF-16 length limit without materializing it.
  * @param key - argument name.
  * @param maxLength - decoded UTF-16 limit, floored to at least zero.
  * @returns whether the string is longer than the limit; false when absent or not a string.
  */
  stringExceeds(key, maxLength) {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
  }
  /**
  * Read a decoded string, including a streaming prefix.
  * @param key - argument name.
  * @returns the string field's decoded text so far; undefined when absent or not a string.
  */
  text(key) {
    return this.remember("text", key, () => this.textNow(key));
  }
  /**
  * Read at most the first decoded UTF-16 units of a string.
  * @param key - argument name.
  * @param maxLength - maximum decoded UTF-16 length, floored to at least one.
  * @returns the bounded string prefix; undefined when absent or not a string.
  */
  textPrefix(key, maxLength) {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
  }
  /**
  * Read a completed non-string argument.
  * @param key - argument name.
  * @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
  */
  value(key) {
    return this.remember("value", key, () => this.valueNow(key));
  }
  /** Answer a question and, on a streaming view, remember it for change detection. */
  remember(kind, key, read, comparison) {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id = `${kind}/${key}`;
      if (!this.#reads.has(id)) this.#reads.set(id, {
        completion: kind === "complete",
        answer: comparison === void 0 ? read : () => comparison(read()),
        last: comparison === void 0 ? result : comparison(result)
      });
    }
    return result;
  }
  closedNow() {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }
  keysNow() {
    return this.object === void 0 ? this.#order : Object.keys(this.object);
  }
  hasNow(key) {
    return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }
  completeNow(key) {
    if (this.object !== void 0) return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
  }
  lengthNow(key, limit = Number.POSITIVE_INFINITY) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.length : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
    const read = entry.length ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, limit, false);
    return read.length;
  }
  textNow(key) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
      let text;
      try {
        text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
      } catch (_error) {
      }
      if (text !== void 0) entry.text = {
        at: entry.end,
        length: text.length,
        text
      };
    }
    const read = entry.text ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }
  textPrefixNow(key, maxLength) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.slice(0, maxLength) : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
    let read = prefixes.get(maxLength);
    if (read === void 0) {
      read = {
        at: entry.start,
        length: 0,
        text: ""
      };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }
  valueNow(key) {
    if (this.object !== void 0) {
      if (!Object.hasOwn(this.object, key)) return void 0;
      const field = this.object[key];
      return typeof field === "string" ? void 0 : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
    if (entry.parsed === void 0) try {
      entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
    } catch (_error) {
      entry.invalid = true;
      this.#invalidValue = true;
    }
    return entry.parsed;
  }
  chunkAt(at) {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.#ends[mid] <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  /** Materialize only a requested range, never the cumulative source. */
  slice(start, end) {
    if (start >= end) return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : this.#ends[first - 1];
    if (first === last) return this.chunks[first].slice(start - base, end - base);
    const parts = [this.chunks[first].slice(start - base)];
    for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
    parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
    return parts.join("");
  }
  readString(entry, read, limit, materialize) {
    const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0) return;
      if (materialize) read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
      const chunk = this.chunks[chunkIndex];
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE2);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize) read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length) chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
      let decoded;
      let width = 2;
      if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0; i < hex.length; i++) if (!isHex2(hex[i])) valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0) return;
          if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== void 0) decoded = SIMPLE_ESCAPES2[type];
      if (decoded === void 0) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize) read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
    }
  }
  /** Locate new field ranges without decoding or parsing their contents. */
  scan() {
    if (this.object !== void 0 || this.#consumed === this.#size) return;
    for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
      const pending = this.chunks[i];
      const base = i === 0 ? 0 : this.#ends[i - 1];
      for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length) break;
        }
        this.step(pending[index], this.#consumed);
        this.#consumed++;
      }
    }
  }
  /** Only raw quotes and their preceding backslash runs can terminate a string. */
  stringBoundary(fragment, start) {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE2.test(fragment.slice(at, end))) entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped) return end;
      at = quote + 1;
    }
  }
  step(c, at) {
    switch (this.#mode) {
      case "root":
        if (isWhitespace2(c)) return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace2(c)) return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace2(c)) return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace2(c)) return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace2(c)) return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace2(c)) return;
        this.fail();
        return;
      /* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
      case "invalid":
        return;
      /* v8 ignore next 2 -- Every scanner mode has a handler above. */
      default:
        assertNever2(this.#mode);
    }
  }
  fail() {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }
  beginKey(at) {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }
  stepKey(c, at) {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"') return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped) try {
      this.#key = JSON.parse(`"${raw}"`);
    } catch (_error) {
      this.fail();
      return;
    }
    else this.#key = raw;
    this.#mode = "colon";
  }
  open(entry) {
    if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }
  beginValue(c, at) {
    if (isWhitespace2(c)) return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: void 0,
        length: void 0,
        text: void 0,
        prefixes: void 0
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({
      kind: "value",
      start: at,
      end: -1,
      parsed: void 0,
      invalid: false
    });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }
  stepScalar(c, at) {
    if (c !== "," && c !== "}" && !isWhitespace2(c)) return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }
  stepNested(c, at) {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }
  closeValue(end) {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
};
function assertNever2(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

// src/client/adapter/trajectory-tool-definition.ts
var MAX_DEPTH = 256;
function rootCall(match) {
  if (match.event.type !== "tool/call") {
    throw new Error("trajectory-tool-call start requires tool/call");
  }
  return {
    phase: "start",
    callId: String(match.event.data.callId),
    name: match.event.data.name,
    argsRaw: match.event.data.arguments,
    args: PartialArguments2.fromText(match.event.data.arguments),
    turn: match.event.data.turn,
    step: match.event.data.step,
    time: match.event.time,
    subCalls: []
  };
}
function rootResult(match, previous) {
  if (match.event.type !== "tool/result") return void 0;
  const message = match.event.data.message;
  return {
    kind: "tool-result",
    seq: match.event.seq,
    time: match.event.time,
    callId: String(message.source.callId),
    name: previous?.name ?? "",
    args: previous?.args ?? PartialArguments2.EMPTY,
    call: previous === void 0 ? null : { name: previous.name, argsRaw: previous.argsRaw },
    callTime: previous?.time ?? null,
    content: message.content,
    isError: message.isError === true,
    ...match.event.data.error === void 0 ? {} : { error: match.event.data.error },
    meta: match.event.data.meta,
    subCalls: []
  };
}
function locationTurn(match) {
  return match.location.kind === "step" || match.location.kind === "turn" ? match.location.turn.turn : 0;
}
function locationStep(match) {
  return match.location.kind === "step" ? match.location.step.step : 0;
}
function childCall(match, data) {
  return {
    phase: "start",
    callId: data.subCallId,
    parentCallId: data.parentCallId,
    name: data.name,
    argsRaw: JSON.stringify(data.arguments),
    args: PartialArguments2.fromObject(data.arguments),
    turn: locationTurn(match),
    step: locationStep(match),
    time: match.event.time,
    subCalls: []
  };
}
function childResult(match, data, previous) {
  return {
    kind: "tool-result",
    seq: match.event.seq,
    time: match.event.time,
    callId: data.subCallId,
    parentCallId: data.parentCallId,
    name: data.name,
    args: previous?.args ?? PartialArguments2.fromObject(data.arguments),
    call: { name: data.name, argsRaw: JSON.stringify(data.arguments) },
    callTime: previous === void 0 || "kind" in previous ? null : previous.time,
    content: data.content ?? [],
    meta: data.meta,
    isError: data.isError === true,
    ...data.error === void 0 ? {} : { error: data.error },
    subCalls: []
  };
}
function acceptsEdge(state, parent, child) {
  if (parent === child || state.parents.has(child)) return false;
  let cursor = parent;
  let parentDepth = 0;
  const ancestors = /* @__PURE__ */ new Set();
  while (cursor !== void 0) {
    if (cursor === child || ancestors.has(cursor)) return false;
    ancestors.add(cursor);
    parentDepth++;
    cursor = state.parents.get(cursor);
  }
  const pending = [{ callId: child, depth: 1 }];
  const descendants = /* @__PURE__ */ new Set();
  let subtreeDepth = 0;
  for (const candidate of pending) {
    if (descendants.has(candidate.callId)) return false;
    descendants.add(candidate.callId);
    subtreeDepth = Math.max(subtreeDepth, candidate.depth);
    for (const nested of state.children.get(candidate.callId) ?? []) {
      pending.push({ callId: nested, depth: candidate.depth + 1 });
    }
  }
  return parentDepth + subtreeDepth <= MAX_DEPTH;
}
function updateDispatch(state, match) {
  const event = match.event;
  if (event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return state;
  const data = event.data;
  const parentId = String(data.parentCallId);
  const childId = String(data.subCallId);
  const siblings = state.children.get(parentId) ?? [];
  const index = siblings.indexOf(childId);
  if (index < 0 && !acceptsEdge(state, parentId, childId)) return state;
  if (event.type === "tool/ptc-dispatch-start" && index >= 0) return state;
  const calls = new Map(state.calls);
  calls.set(childId, event.type === "tool/ptc-dispatch-start" ? childCall(match, data) : childResult(match, data, calls.get(childId)));
  if (index >= 0) return { ...state, calls };
  const children = new Map(state.children);
  children.set(parentId, [...siblings, childId]);
  const parents = new Map(state.parents);
  parents.set(childId, parentId);
  return { ...state, calls, children, parents };
}
function interruption(context) {
  const location = context.start?.location;
  if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
  if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") return location.turn.end;
  return void 0;
}
function projectCall(state, callId, interruptedAt, visited = /* @__PURE__ */ new Set(), depth = 1) {
  const block = state.calls.get(callId);
  if (block === void 0) return void 0;
  if (visited.has(callId) || depth > MAX_DEPTH) return { ...block, subCalls: [] };
  const nextVisited = new Set(visited);
  nextVisited.add(callId);
  const subCalls = (state.children.get(callId) ?? []).flatMap((childId) => {
    const child = projectCall(state, childId, interruptedAt, nextVisited, depth + 1);
    return child === void 0 ? [] : [child];
  });
  if ("kind" in block || interruptedAt === void 0) return { ...block, subCalls };
  return {
    kind: "tool-result",
    seq: interruptedAt.seq - 0.8,
    time: interruptedAt.time,
    callId: block.callId,
    ...block.parentCallId === void 0 ? {} : { parentCallId: block.parentCallId },
    name: block.name,
    args: block.args,
    call: { name: block.name, argsRaw: block.argsRaw },
    callTime: block.time,
    content: [],
    isError: true,
    error: { name: "Interrupted", code: "interrupted" },
    subCalls
  };
}
function fallbackState2(context) {
  const resultMatch = context.matches.find((match) => match.event.type === "tool/result");
  const root = resultMatch === void 0 ? void 0 : rootResult(resultMatch);
  if (root === void 0) return void 0;
  let state = {
    rootId: root.callId,
    calls: /* @__PURE__ */ new Map([[root.callId, root]]),
    children: /* @__PURE__ */ new Map(),
    parents: /* @__PURE__ */ new Map()
  };
  for (const match of context.matches) state = updateDispatch(state, match);
  return state;
}
var trajectoryToolDefinition = {
  kind: "trajectory-tool-call",
  target: "trajectory",
  match: (event) => {
    if (event.type === "tool/call") return { id: String(event.data.callId), role: "start" };
    if (event.type === "tool/result") {
      return { id: String(event.data.message.source.callId), role: "update" };
    }
    if (event.type === "tool/ptc-dispatch-start" || event.type === "tool/ptc-dispatch") {
      const rootCallId = event.data.rootCallId;
      return typeof rootCallId === "string" && rootCallId !== "" ? { id: rootCallId, role: "update" } : null;
    }
    return null;
  },
  start: (_context, match) => {
    const root = rootCall(match);
    return {
      rootId: root.callId,
      calls: /* @__PURE__ */ new Map([[root.callId, root]]),
      children: /* @__PURE__ */ new Map(),
      parents: /* @__PURE__ */ new Map()
    };
  },
  update: (context, match) => {
    if (match.event.type !== "tool/result") return updateDispatch(context.state, match);
    const previous = context.state.calls.get(context.state.rootId);
    const running = previous !== void 0 && !("kind" in previous) ? previous : void 0;
    const result = rootResult(match, running);
    if (result === void 0) return context.state;
    const calls = new Map(context.state.calls);
    calls.set(context.state.rootId, result);
    return { ...context.state, calls };
  },
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState2(context);
    if (state === void 0) return null;
    const root = projectCall(state, state.rootId, interruption(context));
    if (root === void 0) return null;
    const anchorSeq = context.start?.event.seq ?? ("kind" in root ? root.seq : context.matches[0]?.event.seq ?? 0);
    return trajectoryNode(context, anchorSeq, { kind: "tool", root });
  }
};
function registerTrajectoryToolDefinition(ctx) {
  ctx.uiConversation.events.register(trajectoryToolDefinition);
}

// src/client/adapter/copy-codes.ts
var COMPACTION_INTERRUPTED_ERROR = "trajectory.compaction-interrupted";

// src/client/adapter/trajectory-snapshot-builder.ts
var EMPTY_LIST = [];
var EMPTY_TRAJECTORY_SNAPSHOT = {
  eventNodes: EMPTY_LIST,
  eventLocations: /* @__PURE__ */ new Map(),
  requests: EMPTY_LIST,
  callSchemas: /* @__PURE__ */ new Map(),
  partial: null,
  runningCalls: EMPTY_LIST
};
function stepKey(turn, step) {
  return `${turn}\0${step}`;
}
function headerStepKey(header) {
  const location = header.location;
  return location.kind === "step" ? stepKey(location.turn.turn, location.step.step) : void 0;
}
function headerFor(request, headersByStep, previous) {
  return headersByStep.get(stepKey(request.turn, request.step)) ?? (previous !== void 0 && previous.seq < request.startSeq ? {
    latest: previous,
    ...previous.change === void 0 ? {} : { change: previous.change }
  } : void 0);
}
function applyHeader(request, header, includeChange) {
  return header === void 0 ? request : {
    ...request,
    prompt: header.latest.prompt,
    requestConfig: header.latest.prompt.config,
    ...includeChange && header.change !== void 0 ? { promptChange: header.change } : {}
  };
}
function withRequestConfig(node, prompt) {
  return prompt === void 0 ? node : { ...node, requestConfig: prompt.config };
}
function captureSchemas(block, toolsByName, output) {
  const name = "kind" in block ? block.call?.name : block.name;
  const schema = name === void 0 ? void 0 : toolsByName.get(name);
  if (schema !== void 0) output.set(block.callId, schema);
  for (const child of block.subCalls) captureSchemas(child, toolsByName, output);
}
function indexTools(tools) {
  return new Map(tools.map((tool) => [tool.name, tool]));
}
function interruptCompactions(requests, boundaries) {
  let nextRequest = 0;
  const runningCompactions = [];
  for (const boundary of boundaries) {
    while (nextRequest < requests.length) {
      const request2 = requests[nextRequest];
      if (request2 === void 0 || request2.startSeq >= boundary.seq) break;
      if (request2.purpose === "compaction" && request2.status === "running") {
        runningCompactions.push(nextRequest);
      }
      nextRequest++;
    }
    let index = runningCompactions.pop();
    while (index !== void 0 && requests[index]?.status !== "running") {
      index = runningCompactions.pop();
    }
    if (index === void 0) continue;
    const request = requests[index];
    if (request?.purpose !== "compaction") continue;
    requests[index] = {
      ...request,
      completedAt: boundary.time,
      status: "error",
      error: COMPACTION_INTERRUPTED_ERROR
    };
  }
}
function applyTurnErrors(requests, endings) {
  const lastAssistantByTurn = /* @__PURE__ */ new Map();
  for (const [index, request] of requests.entries()) {
    if (request.purpose === "assistant") lastAssistantByTurn.set(request.turn, index);
  }
  for (const ending of endings) {
    if (ending.error === void 0) continue;
    const index = lastAssistantByTurn.get(ending.turn);
    if (index === void 0) continue;
    const request = requests[index];
    if (request?.purpose !== "assistant") continue;
    requests[index] = {
      ...request,
      completedAt: request.completedAt ?? ending.time,
      status: "error",
      error: ending.error,
      ...ending.errorCode === void 0 ? {} : { errorCode: ending.errorCode }
    };
  }
}
var TrajectorySnapshotBuilder = class {
  nodes = /* @__PURE__ */ new Map();
  positions = /* @__PURE__ */ new Map();
  contributions = [];
  empty = EMPTY_TRAJECTORY_SNAPSHOT;
  replace(input) {
    this.nodes.clear();
    for (const node of input.nodes) this.nodes.set(node.key, node);
    this.rebuildContributions();
    return this.snapshot();
  }
  apply(input) {
    let structural = false;
    for (const node of input.upserts) {
      const previous = this.nodes.get(node.key);
      this.nodes.set(node.key, node);
      if (previous === void 0 || previous.anchorSeq !== node.anchorSeq) {
        structural = true;
        continue;
      }
      const position = this.positions.get(node.key);
      if (position === void 0) structural = true;
      else this.contributions[position] = node;
    }
    if (structural) this.rebuildContributions();
    return this.snapshot();
  }
  snapshot() {
    const headersByStep = /* @__PURE__ */ new Map();
    for (const contribution of this.contributions) {
      if (contribution.data.kind !== "request-header") continue;
      const key = headerStepKey(contribution.data.header);
      if (key === void 0) continue;
      const previous = headersByStep.get(key);
      headersByStep.set(key, {
        latest: contribution.data.header,
        ...contribution.data.header.change !== void 0 ? { change: contribution.data.header.change } : previous?.change === void 0 ? {} : { change: previous.change }
      });
    }
    const representedPrompts = new Set(this.contributions.flatMap((node) => node.data.kind === "request-header" && node.data.header.change !== void 0 ? [node.data.header.change.seq] : []));
    const systemPrompts = [];
    const finalized = [];
    const eventLocations = /* @__PURE__ */ new Map();
    const requests = [];
    const boundaries = [];
    const turnEndings = [];
    const callSchemas = /* @__PURE__ */ new Map();
    const consumedPromptChanges = /* @__PURE__ */ new Set();
    let previousHeader;
    let previousTools = /* @__PURE__ */ new Map();
    let partial = null;
    const runningCalls = [];
    for (const contribution of this.contributions) {
      const data = contribution.data;
      if (data.kind === "system-prompt") {
        if (!representedPrompts.has(data.prompt.seq)) systemPrompts.push(data.prompt);
        continue;
      }
      if (data.kind === "request-header") {
        previousHeader = data.header;
        previousTools = indexTools(data.header.prompt.tools);
        continue;
      }
      if (data.kind === "node") {
        finalized.push(data.node);
        eventLocations.set(data.node.seq, contribution.location);
        continue;
      }
      if (data.kind === "assistant") {
        if (data.request !== void 0) eventLocations.set(data.request.startSeq, contribution.location);
        if (data.node !== void 0) eventLocations.set(data.node.seq, contribution.location);
        const header = data.request === void 0 ? void 0 : headerFor(data.request, headersByStep, previousHeader);
        if (data.node !== void 0) finalized.push(withRequestConfig(data.node, header?.latest.prompt));
        if (data.partial !== null) partial = data.partial;
        if (data.request !== void 0) {
          const change = header?.change;
          const includeChange = change !== void 0 && !consumedPromptChanges.has(change.seq);
          requests.push(applyHeader(data.request, header, includeChange));
          if (includeChange) consumedPromptChanges.add(change.seq);
        }
        continue;
      }
      if (data.kind === "tool") {
        if ("kind" in data.root) {
          finalized.push(data.root);
          eventLocations.set(data.root.seq, contribution.location);
        } else runningCalls.push(data.root);
        if (previousHeader !== void 0 && previousHeader.seq < contribution.anchorSeq) {
          captureSchemas(data.root, previousTools, callSchemas);
        }
        continue;
      }
      if (data.kind === "compaction") {
        requests.push(data.request);
        continue;
      }
      if (data.kind === "session-end") {
        boundaries.push({ seq: data.seq, time: data.time });
        continue;
      }
      turnEndings.push({
        turn: data.turn,
        time: data.time,
        ...data.error === void 0 ? {} : { error: data.error },
        ...data.errorCode === void 0 ? {} : { errorCode: data.errorCode }
      });
    }
    requests.sort((left, right) => left.startSeq - right.startSeq);
    interruptCompactions(requests, boundaries);
    applyTurnErrors(requests, turnEndings);
    finalized.sort((left, right) => left.seq - right.seq);
    const eventNodes = finalized;
    return {
      eventNodes,
      ...systemPrompts.length > 0 ? { systemPrompts } : {},
      eventLocations,
      requests,
      callSchemas,
      partial,
      runningCalls
    };
  }
  rebuildContributions() {
    this.contributions = [...this.nodes.values()].sort((left, right) => left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key));
    this.positions.clear();
    for (const [index, contribution] of this.contributions.entries()) {
      this.positions.set(contribution.key, index);
    }
  }
};
var trajectoryViewDefinition = {
  target: "trajectory",
  toolCallFocus: (callId) => callId,
  create: () => new TrajectorySnapshotBuilder()
};
function registerTrajectoryConversationView(ctx) {
  ctx.uiConversation.views.register(trajectoryViewDefinition);
}

// src/client/locales.ts
var NS = "trace-waterfall";
var en = {
  title: "Trace",
  subtitle: "Every step, on one timeline",
  search: "Search steps, tools, or output\u2026",
  clear: "Clear search",
  duration: "Duration",
  tokens: "Tokens",
  llmCalls: "LLM calls",
  toolCalls: "Tool calls",
  errors: "Errors",
  steps: "Steps",
  timeline: "Trace timeline",
  all: "All steps",
  onlyErrors: "Errors only",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  expand: "Expand {name}",
  collapse: "Collapse {name}",
  turn: "Turn {number}",
  step: "Step {number}",
  llm: "Model request",
  tool: "Tool call",
  compaction: "Compaction",
  message: "User message",
  context: "Context",
  system: "System prompt",
  running: "Running",
  complete: "Complete",
  error: "Error",
  live: "Live",
  empty: "No trace yet",
  emptyHint: "Run a prompt to see model requests and tool calls here.",
  noMatches: "No matching steps",
  noMatchesHint: "Try another search or clear the filters.",
  close: "Close details",
  details: "Span details",
  input: "Input",
  output: "Output",
  metadata: "Metadata",
  status: "Status",
  start: "Start offset",
  model: "Model",
  provider: "Provider",
  inputTokens: "Uncached input tokens",
  outputTokens: "Output tokens",
  cacheTokens: "Cached input tokens",
  reasoningTokens: "Reasoning tokens",
  firstToken: "Time to first token",
  retries: "Retries",
  unavailable: "\u2014",
  unknownTiming: "The start of this span is outside loaded history.",
  noPayload: "No recorded content",
  pending: "Waiting for output\u2026",
  loadOlder: "Load earlier history",
  loading: "Loading\u2026",
  historyError: "Could not load history. {reason}",
  retry: "Retry",
  fit: "Fit timeline",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  shown: "{shown} of {total} steps",
  loaded: "Loaded history",
  copy: "Copy",
  copied: "Copied",
  copyError: "Could not copy. Select and copy the text below.",
  interrupted: "The request was interrupted.",
  inspect: "Inspect {name}",
  cacheRate: "{value}% cache",
  cacheWriteTokens: "Cache write tokens",
  sessionUsage: "Whole session usage",
  waiting: "Waiting",
  nested: "Handoff",
  failed: "Failed",
  legend: "Timeline legend",
  idle: "{duration} idle",
  focus: "Focus {name}",
  errorCount: "{count} recovered or failed operations",
  overview: "Session overview",
  overviewHint: "Drag to select a time range. Double-click to reset.",
  inputLane: "Input",
  modelLane: "Model",
  toolLane: "Tools",
  resizeLabels: "Resize label column",
  rangeStart: "From {time}",
  summary: "Span summary",
  fullDetails: "Full details",
  source: "Source",
  throughput: "Throughput",
  firstTokenShort: "TTFT",
  newInput: "New input",
  noNewInput: "No new input in loaded history",
  attachments: "Attachments",
  image: "Image",
  file: "File",
  imagePreview: "Toggle image preview",
  imageFailed: "Image unavailable"
};
var zh = {
  title: "\u8FFD\u8E2A",
  subtitle: "\u5728\u540C\u4E00\u65F6\u95F4\u7EBF\u4E0A\u67E5\u770B\u6BCF\u4E00\u6B65",
  search: "\u641C\u7D22\u6B65\u9AA4\u3001\u5DE5\u5177\u6216\u8F93\u51FA\u2026",
  clear: "\u6E05\u9664\u641C\u7D22",
  duration: "\u603B\u8017\u65F6",
  tokens: "Token \u6570",
  llmCalls: "\u6A21\u578B\u8C03\u7528",
  toolCalls: "\u5DE5\u5177\u8C03\u7528",
  errors: "\u9519\u8BEF",
  steps: "\u6B65\u9AA4",
  timeline: "\u8FFD\u8E2A\u65F6\u95F4\u7EBF",
  all: "\u5168\u90E8\u6B65\u9AA4",
  onlyErrors: "\u4EC5\u770B\u9519\u8BEF",
  expandAll: "\u5168\u90E8\u5C55\u5F00",
  collapseAll: "\u5168\u90E8\u6298\u53E0",
  expand: "\u5C55\u5F00 {name}",
  collapse: "\u6298\u53E0 {name}",
  turn: "\u7B2C {number} \u8F6E",
  step: "\u7B2C {number} \u6B65",
  llm: "\u6A21\u578B\u8BF7\u6C42",
  tool: "\u5DE5\u5177\u8C03\u7528",
  compaction: "\u4E0A\u4E0B\u6587\u538B\u7F29",
  message: "\u7528\u6237\u6D88\u606F",
  context: "\u4E0A\u4E0B\u6587",
  system: "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
  running: "\u8FD0\u884C\u4E2D",
  complete: "\u5DF2\u5B8C\u6210",
  error: "\u9519\u8BEF",
  live: "\u5B9E\u65F6",
  empty: "\u6682\u65E0\u8FFD\u8E2A\u8BB0\u5F55",
  emptyHint: "\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF0C\u5373\u53EF\u5728\u6B64\u67E5\u770B\u6A21\u578B\u8BF7\u6C42\u548C\u5DE5\u5177\u8C03\u7528\u3002",
  noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u6B65\u9AA4",
  noMatchesHint: "\u5C1D\u8BD5\u5176\u4ED6\u641C\u7D22\u8BCD\u6216\u6E05\u9664\u7B5B\u9009\u6761\u4EF6\u3002",
  close: "\u5173\u95ED\u8BE6\u60C5",
  details: "\u6B65\u9AA4\u8BE6\u60C5",
  input: "\u8F93\u5165",
  output: "\u8F93\u51FA",
  metadata: "\u5143\u6570\u636E",
  status: "\u72B6\u6001",
  start: "\u5F00\u59CB\u504F\u79FB",
  model: "\u6A21\u578B",
  provider: "\u63D0\u4F9B\u5546",
  inputTokens: "\u672A\u7F13\u5B58\u8F93\u5165 Token",
  outputTokens: "\u8F93\u51FA Token",
  cacheTokens: "\u7F13\u5B58\u8F93\u5165 Token",
  reasoningTokens: "\u63A8\u7406 Token",
  firstToken: "\u9996 Token \u5EF6\u8FDF",
  retries: "\u91CD\u8BD5\u6B21\u6570",
  unavailable: "\u2014",
  unknownTiming: "\u6B64\u6B65\u9AA4\u7684\u8D77\u59CB\u8BB0\u5F55\u4E0D\u5728\u5DF2\u52A0\u8F7D\u7684\u5386\u53F2\u4E2D\u3002",
  noPayload: "\u6CA1\u6709\u8BB0\u5F55\u5185\u5BB9",
  pending: "\u7B49\u5F85\u8F93\u51FA\u2026",
  loadOlder: "\u52A0\u8F7D\u66F4\u65E9\u7684\u5386\u53F2",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  historyError: "\u65E0\u6CD5\u52A0\u8F7D\u5386\u53F2\u3002{reason}",
  retry: "\u91CD\u8BD5",
  fit: "\u9002\u5E94\u65F6\u95F4\u7EBF",
  zoomIn: "\u653E\u5927",
  zoomOut: "\u7F29\u5C0F",
  shown: "{shown} / {total} \u4E2A\u6B65\u9AA4",
  loaded: "\u5DF2\u52A0\u8F7D\u7684\u5386\u53F2",
  copy: "\u590D\u5236",
  copied: "\u5DF2\u590D\u5236",
  copyError: "\u65E0\u6CD5\u590D\u5236\uFF0C\u8BF7\u9009\u4E2D\u4E0B\u65B9\u6587\u672C\u624B\u52A8\u590D\u5236\u3002",
  interrupted: "\u8BF7\u6C42\u5DF2\u4E2D\u65AD\u3002",
  inspect: "\u67E5\u770B {name}",
  cacheRate: "\u7F13\u5B58 {value}%",
  cacheWriteTokens: "\u7F13\u5B58\u5199\u5165 Token",
  sessionUsage: "\u6574\u4E2A\u4F1A\u8BDD\u7684\u7528\u91CF",
  waiting: "\u7B49\u5F85",
  nested: "\u5B50\u4EE3\u7406 / \u5D4C\u5957",
  failed: "\u5931\u8D25",
  legend: "\u65F6\u95F4\u7EBF\u56FE\u4F8B",
  idle: "{duration} \u7A7A\u95F2",
  focus: "\u805A\u7126 {name}",
  errorCount: "{count} \u4E2A\u5DF2\u6062\u590D\u6216\u5931\u8D25\u7684\u64CD\u4F5C",
  overview: "\u4F1A\u8BDD\u6982\u89C8",
  overviewHint: "\u62D6\u9009\u65F6\u95F4\u8303\u56F4\uFF0C\u53CC\u51FB\u6062\u590D\u5168\u8C8C\u3002",
  inputLane: "\u8F93\u5165",
  modelLane: "\u6A21\u578B",
  toolLane: "\u5DE5\u5177",
  resizeLabels: "\u8C03\u6574\u6807\u7B7E\u5217\u5BBD\u5EA6",
  rangeStart: "\u4ECE {time} \u8D77",
  summary: "\u6B65\u9AA4\u6458\u8981",
  fullDetails: "\u5B8C\u6574\u8BE6\u60C5",
  source: "\u6E90\u7801",
  throughput: "\u541E\u5410",
  firstTokenShort: "\u9996 token",
  newInput: "\u65B0\u589E\u8F93\u5165",
  noNewInput: "\u5F53\u524D\u5386\u53F2\u4E2D\u6CA1\u6709\u65B0\u589E\u8F93\u5165\u8BB0\u5F55",
  attachments: "\u9644\u4EF6",
  image: "\u56FE\u7247",
  file: "\u6587\u4EF6",
  imagePreview: "\u5207\u6362\u56FE\u7247\u9884\u89C8",
  imageFailed: "\u65E0\u6CD5\u52A0\u8F7D\u56FE\u7247"
};

// src/client/TraceView.tsx
var import_react3 = require("react");

// src/client/model.ts
function totalTokens(usage) {
  if (!usage || !["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"].some((key) => Reflect.get(usage, key) !== void 0)) return null;
  return (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.outputTokens ?? 0);
}
function cacheRate(usage) {
  const input = (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  return input > 0 ? (usage.cacheReadTokens ?? 0) / input : null;
}
function addUsage2(target, usage) {
  if (!usage) return;
  for (const key of ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens"]) {
    if (usage[key] !== void 0) target[key] = (target[key] ?? 0) + usage[key];
  }
}
function usageOf(value) {
  if (value === null || typeof value !== "object") return void 0;
  const usage = {};
  for (const key of ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens"]) {
    const amount = Reflect.get(value, key);
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) usage[key] = amount;
  }
  return Object.keys(usage).length ? usage : void 0;
}
function requestInputs(snapshot, assistants) {
  const inputs = snapshot.eventNodes.flatMap((node) => {
    if (node.kind !== "user" && node.kind !== "steering" && node.kind !== "context" && node.kind !== "tool-result") return [];
    const value = {
      kind: node.kind === "tool-result" ? "tool" : node.kind === "context" ? "context" : "message",
      ...node.kind === "tool-result" ? { name: node.name } : {},
      content: node.content
    };
    return [{ seq: node.seq, time: node.time, value }];
  }).sort((a, b) => a.seq - b.seq);
  const requests = snapshot.requests.filter((request) => request.purpose === "assistant").sort((a, b) => a.startSeq - b.startSeq);
  const result = /* @__PURE__ */ new Map();
  let consumed = -Infinity;
  for (const [index, request] of requests.entries()) {
    const assistant = assistants.get(`${request.turn}:${request.step}`);
    const upper = request.resultSeq ?? assistant?.seq ?? requests[index + 1]?.startSeq ?? Infinity;
    for (const previous of assistants.values()) if (previous.seq < request.startSeq) consumed = Math.max(consumed, previous.seq);
    const added = inputs.filter((input) => input.seq > consumed && input.seq < upper && (request.completedAt === null || input.time <= request.completedAt));
    result.set(request.startSeq, added.map((input) => input.value));
    consumed = Math.max(consumed, request.resultSeq ?? assistant?.seq ?? request.startSeq, added.at(-1)?.seq ?? -Infinity);
  }
  return result;
}
function buildTrace(snapshot) {
  const spans = [];
  const assistants = /* @__PURE__ */ new Map();
  for (const node of snapshot.eventNodes) {
    if (node.kind === "assistant") assistants.set(`${node.turn}:${node.step}`, node);
  }
  const newInputs = requestInputs(snapshot, assistants);
  const represented = /* @__PURE__ */ new Set();
  for (const request of snapshot.requests) {
    const key = `${request.turn}:${request.step}`;
    const assistant = request.purpose === "assistant" ? assistants.get(key) : void 0;
    const partial = snapshot.partial?.turn === request.turn && snapshot.partial.step === request.step ? snapshot.partial : void 0;
    if (assistant) represented.add(key);
    spans.push({
      id: `request:${request.startSeq}`,
      kind: request.purpose === "assistant" ? "llm" : "compaction",
      ...request.turn === null ? {} : { parentId: `turn:${request.turn}`, turn: request.turn },
      step: request.step,
      start: request.startedAt,
      end: request.completedAt,
      anchor: request.startedAt,
      status: request.status,
      model: request.providerMetadata?.model ?? request.requestConfig?.model,
      provider: request.providerMetadata?.provider ?? request.requestConfig?.provider,
      usage: usageOf(request.usage),
      metadata: request.requestConfig,
      input: request.purpose === "assistant" ? request.prompt : void 0,
      newInput: request.purpose === "assistant" ? newInputs.get(request.startSeq) : void 0,
      output: request.purpose === "compaction" ? request.rawOutput ?? request.summary : assistant?.blocks ?? partial?.blocks,
      firstToken: assistant?.timing?.firstTokenTime ?? partial?.timing?.firstTokenTime ?? void 0,
      retries: request.purpose === "assistant" ? request.retry : void 0,
      error: request.error || request.errorCode
    });
  }
  function addTool(call, parentId, turn) {
    const done = "kind" in call;
    const start2 = done ? call.callTime : call.time;
    const ownerTurn = done ? turn : call.turn;
    spans.push({
      id: `tool:${call.callId}`,
      parentId: parentId ?? (ownerTurn === void 0 ? void 0 : `turn:${ownerTurn}`),
      kind: "tool",
      name: call.name || void 0,
      turn: ownerTurn,
      step: done ? void 0 : call.step,
      start: start2,
      end: done ? call.time : null,
      anchor: start2 ?? call.time,
      status: done ? call.isError ? "error" : "complete" : "running",
      input: done ? call.call?.argsRaw : call.phase === "start" ? call.argsRaw : void 0,
      output: done ? call.content : void 0,
      metadata: done ? call.meta : void 0,
      schema: snapshot.callSchemas.get(call.callId),
      nested: parentId !== void 0 || call.name === "subagent" || call.name.startsWith("subagent_") || call.name === "spawn_teammate",
      error: done ? call.error?.reason ?? call.error?.code : void 0
    });
    for (const child of call.subCalls) addTool(child, `tool:${call.callId}`, ownerTurn);
  }
  for (const node of snapshot.eventNodes) {
    const location = snapshot.eventLocations.get(node.seq);
    const turn = location?.kind === "step" || location?.kind === "turn" ? location.turn.turn : void 0;
    if (node.kind === "tool-result") {
      addTool(node, void 0, turn);
      continue;
    }
    if (node.kind === "assistant") {
      if (!represented.has(`${node.turn}:${node.step}`)) spans.push({
        id: `assistant:${node.seq}`,
        kind: "llm",
        parentId: `turn:${node.turn}`,
        turn: node.turn,
        step: node.step,
        start: node.timing?.stepStartTime ?? null,
        end: node.time,
        anchor: node.time,
        status: node.interrupted ? "error" : "complete",
        output: node.blocks,
        model: node.providerMetadata?.model,
        provider: node.providerMetadata?.provider,
        usage: usageOf(node.usage),
        firstToken: node.timing?.firstTokenTime ?? void 0
      });
      continue;
    }
    if (node.kind === "user" || node.kind === "steering" || node.kind === "context") {
      spans.push({
        id: `event:${node.seq}`,
        parentId: turn === void 0 ? void 0 : `turn:${turn}`,
        turn,
        kind: node.kind === "context" ? "context" : "message",
        start: node.time,
        end: node.time,
        anchor: node.time,
        status: "complete",
        input: node.content
      });
    }
  }
  for (const call of snapshot.runningCalls) addTool(call);
  for (const prompt of snapshot.systemPrompts ?? []) {
    if (!spans.some((span) => span.id === `event:${prompt.seq}`)) spans.push({
      id: `event:${prompt.seq}`,
      kind: "system",
      start: prompt.time,
      end: prompt.time,
      anchor: prompt.time,
      status: "complete",
      input: prompt.text
    });
  }
  const metrics = { llm: 0, tools: 0, errors: 0, tokens: null, cacheRate: null };
  const usage = {};
  const turns = /* @__PURE__ */ new Map();
  let start = Infinity;
  let end = -Infinity;
  for (const span of spans) {
    start = Math.min(start, span.start ?? span.anchor);
    end = Math.max(end, span.end ?? span.anchor);
    if (span.kind === "llm" || span.kind === "compaction") metrics.llm++;
    if (span.kind === "tool") metrics.tools++;
    if (span.status === "error") metrics.errors++;
    addUsage2(usage, span.usage);
    if (span.turn === void 0) continue;
    let root = turns.get(span.turn);
    if (!root) {
      root = {
        id: `turn:${span.turn}`,
        kind: "turn",
        turn: span.turn,
        start: span.start ?? span.anchor,
        end: span.end,
        anchor: span.anchor,
        status: span.status === "running" ? "running" : "complete",
        usage: {},
        errorCount: 0
      };
      turns.set(span.turn, root);
    } else {
      root.start = Math.min(root.start ?? span.anchor, span.start ?? span.anchor);
      root.anchor = Math.min(root.anchor, span.anchor);
      root.end = root.end === null || span.end === null ? null : Math.max(root.end, span.end);
      root.status = root.status === "running" || span.status === "running" ? "running" : "complete";
    }
    addUsage2(root.usage, span.usage);
    if (span.status === "error") root.errorCount = (root.errorCount ?? 0) + 1;
  }
  metrics.tokens = totalTokens(usage);
  metrics.cacheRate = cacheRate(usage);
  for (const root of turns.values()) {
    const members = spans.filter((span) => span.turn === root.turn).sort((a, b) => a.anchor - b.anchor);
    root.input = members.find((span) => span.kind === "message" || span.kind === "context")?.input;
    root.output = members.filter((span) => span.kind === "llm").at(-1)?.output;
  }
  for (const location of snapshot.eventLocations.values()) {
    if (location.kind !== "step" && location.kind !== "turn") continue;
    const root = turns.get(location.turn.turn);
    if (!root) continue;
    if (location.turn.start) root.start = location.turn.start.time;
    if (location.turn.end) {
      root.end = location.turn.end.time;
      root.status = location.turn.end.data.reason.kind === "error" ? "error" : "complete";
      if (location.turn.end.data.reason.kind === "error") root.error = location.turn.end.data.reason.error.message;
    }
    start = Math.min(start, root.start ?? root.anchor);
    end = Math.max(end, root.end ?? root.anchor);
  }
  spans.push(...turns.values());
  spans.sort((a, b) => a.anchor - b.anchor || a.id.localeCompare(b.id));
  const byId = new Map(spans.map((span) => [span.id, span]));
  const children = /* @__PURE__ */ new Map();
  const roots = [];
  for (const span of spans) {
    if (span.parentId && byId.has(span.parentId)) {
      const siblings = children.get(span.parentId) ?? [];
      siblings.push(span);
      children.set(span.parentId, siblings);
    } else roots.push(span);
  }
  return {
    spans,
    byId,
    children,
    roots,
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0,
    running: spans.some((span) => span.status === "running"),
    metrics
  };
}
function spanLabel(span, t) {
  if (span.kind === "turn") return t("turn", { number: span.turn });
  return span.name ?? t(span.kind);
}
function payloadText(value) {
  if (value === void 0) return "";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2) ?? "";
}
function visibleRows(model, collapsed, query, errorsOnly, t) {
  const term = query.trim().toLocaleLowerCase();
  const filtering = term !== "" || errorsOnly;
  const included = /* @__PURE__ */ new Set();
  if (filtering) for (const span of model.spans) {
    if (errorsOnly && (span.status !== "error" || span.kind === "turn")) continue;
    if (term) {
      const text = [
        spanLabel(span, t),
        span.model,
        span.provider,
        span.error,
        payloadText(span.newInput),
        payloadText(span.input),
        payloadText(span.output)
      ].join(" ").toLocaleLowerCase();
      if (!text.includes(term) && span.id.toLocaleLowerCase() !== term) continue;
    }
    let current = span;
    while (current && !included.has(current.id)) {
      included.add(current.id);
      current = current.parentId ? model.byId.get(current.parentId) : void 0;
    }
  }
  const rows = [];
  const visit = (span, depth) => {
    if (filtering && !included.has(span.id)) return;
    const children = model.children.get(span.id) ?? [];
    rows.push({ span, depth, hasChildren: children.length > 0 });
    if (filtering || !collapsed.has(span.id)) for (const child of children) visit(child, depth + 1);
  };
  for (const root of model.roots) visit(root, 0);
  return rows;
}
function compactDuration(ms, offset = false) {
  if (ms === null || !Number.isFinite(ms)) return "\u2014";
  const value = offset ? Math.abs(ms) : Math.max(0, ms);
  const text = value < 1e3 ? `${Math.round(value)}ms` : value < 12e4 ? `${+(value / 1e3).toFixed(1)}s` : value < 72e5 ? `${+(value / 6e4).toFixed(1)}m` : `${+(value / 36e5).toFixed(1)}h`;
  return offset ? `${ms < 0 ? "-" : "+"}${text}` : text;
}
function compactTokens(tokens) {
  if (tokens === null) return "\u2014";
  if (tokens >= 1e6) return `${+(tokens / 1e6).toFixed(1)}M`;
  if (tokens >= 1e3) return `${+(tokens / 1e3).toFixed(1)}k`;
  return tokens.toLocaleString();
}
function throughput(span) {
  return span.firstToken !== void 0 && span.end !== null && span.end > span.firstToken && span.usage?.outputTokens !== void 0 ? span.usage.outputTokens * 1e3 / (span.end - span.firstToken) : null;
}

// src/client/TraceDetails.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/presentation.ts
function record(value) {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return void 0;
    }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function summary(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map(summary).filter(Boolean).join(" \xB7 ");
  const object = record(value);
  if (!object) return String(value);
  if (typeof object.text === "string") return summary(object.text);
  if (object.content !== void 0) return summary(object.content);
  if (object.blocks !== void 0) return summary(object.blocks);
  if (object.messages !== void 0) return summary(object.messages);
  if (object.attachment !== void 0) return summary(record(object.attachment)?.name);
  if (object.kind === "tool-call" || object.type === "tool-call") return String(object.name ?? "");
  return JSON.stringify(value);
}
function requestInputSummary(span, t) {
  for (const kind of ["message", "tool", "context"]) {
    const entries = span.newInput?.filter((input) => input.kind === kind && summary(input.content));
    if (entries?.length) return entries.slice(-3).reverse().map((input) => `${input.name || t(kind)} \xB7 ${summary(input.content)}`).join(" \xB7 ");
  }
  return t("noNewInput");
}
function codeProgram(span) {
  if (span.name !== "run_code") return void 0;
  const args = record(span.input);
  if (typeof args?.code !== "string") return void 0;
  const schema = record(span.schema);
  const properties = record(record(schema?.parameters)?.properties);
  const description = record(properties?.code)?.description;
  const ts = typeof description === "string" && /\bTypeScript\b/i.test(description);
  const py = typeof description === "string" && /\bPython\b/i.test(description);
  return {
    source: args.code,
    description: typeof args.description === "string" ? args.description : args.code.split(/\r?\n/).find((line) => line.trim()) ?? "",
    language: ts === py ? void 0 : ts ? "typescript" : "python"
  };
}
function spanSummary(span, query = "") {
  const args = record(span.input);
  const delegated = span.name === "spawn_teammate" && args ? [args.name, args.description].filter((value) => typeof value === "string").join(" \xB7 ") : void 0;
  const primary = codeProgram(span)?.description ?? delegated ?? (args && [args.command, args.path, args.file_path, args.pattern, args.query, args.url, args.description, args.prompt].find((value) => typeof value === "string"));
  let input = span.kind === "llm" ? span.model ?? "" : summary(primary ?? span.input);
  const output = summary(span.output);
  const term = query.trim().toLocaleLowerCase();
  if (term) {
    const matches = (text) => text.toLocaleLowerCase().includes(term);
    const prompt = summary(span.newInput ?? span.input);
    if (!matches(input) && matches(prompt)) input = prompt;
    if (![input, output, span.name ?? ""].some(matches)) {
      const match = [span.error, span.provider, payloadText(span.newInput), payloadText(span.input), payloadText(span.output)].find((value) => value && matches(value));
      if (match) input = match;
      else if (span.id.toLocaleLowerCase() === term) input = span.id;
    }
  }
  return { input, output };
}
function excerpt(text, query, limit = 240) {
  const normalized = text.replace(/\s+/g, " ");
  const index = query.trim() ? normalized.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase()) : -1;
  const from = index > 32 ? Math.max(0, index - 16) : 0;
  return (from ? "\u2026" : "") + normalized.slice(from, from + limit) + (normalized.length > from + limit ? "\u2026" : "");
}
function attachments(value) {
  const found = /* @__PURE__ */ new Map();
  function visit(item, depth) {
    if (depth > 12) return;
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, depth + 1));
      return;
    }
    const object = item !== null && typeof item === "object" ? record(item) : void 0;
    if (!object) return;
    const attachment = object.attachment ?? object.file;
    const ref = record(attachment);
    if (ref && typeof ref.attachmentId === "string") {
      const isImage = typeof ref.mediaType === "string" && ref.mediaType.startsWith("image/");
      found.set(ref.attachmentId, { ref: attachment, image: isImage });
    }
    for (const key of ["content", "blocks", "messages", "images"]) if (object[key] !== void 0) visit(object[key], depth + 1);
  }
  visit(value, 0);
  return [...found.values()];
}

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var shapes = {
  turn: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m2 5 6-3 6 3-6 3-6-3Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m2 8 6 3 6-3M2 11l6 3 6-3" })
  ] }),
  llm: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "4", y: "4", width: "8", height: "8", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 1.5V4m4-2.5V4M6 12v2.5M10 12v2.5M1.5 6H4m-2.5 4H4m8-4h2.5M12 10h2.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "6.5", y: "6.5", width: "3", height: "3", rx: ".5" })
  ] }),
  tool: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.4 2a4 4 0 0 0-4.7 5.2l-3 3a2 2 0 0 0 2.8 2.8l3-3A4 4 0 0 0 13 5.4l-2.4 2.4-2.4-2.4L10.6 3" }),
  compaction: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 2h4v4M14 2h-4v4M2 14h4v-4m8 4h-4v-4M2 6l4-4m4 0 4 4M2 10l4 4m4 0 4-4" }) }),
  message: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-4 2v-2H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" }),
  context: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 2H2v12h2m8-12h2v12h-2M5.5 5h5m-5 3h5m-5 3h3" }) }),
  system: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 4h3m3 0h6M2 8h7m3 0h2M2 12h2m3 0h7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6.5", cy: "4", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10.5", cy: "8", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "5.5", cy: "12", r: "1.5" })
  ] }),
  nested: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4", cy: "3", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "6", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4", cy: "13", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 4.5v7m0-7V6a3 3 0 0 0 3 3h2a3 3 0 0 0 3-1.5" })
  ] }),
  search: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6.7", cy: "6.7", r: "4.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10 10 3.8 3.8" })
  ] }),
  terminal: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "1.5", y: "2.5", width: "13", height: "11", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 6 2 2-2 2m4 0h4" })
  ] }),
  network: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", { cx: "8", cy: "8", rx: "2.5", ry: "6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 8h12" })
  ] }),
  image: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "2", width: "12", height: "12", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "5.5", cy: "5.5", r: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m2 11 3-3 2.5 2L10 7l4 5" })
  ] }),
  chevronDown: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 6 4 4 4-4" }),
  chevronRight: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 4 4 4-4 4" }),
  focus: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 1.5V5m0 6v3.5M1.5 8H5m6 0h3.5" })
  ] }),
  fit: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4" }),
  close: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 4 8 8M12 4l-8 8" }),
  plus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3v10M3 8h10" }),
  minus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 8h10" }),
  arrowRight: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 8h11m-4-4 4 4-4 4" }),
  open: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 3h8v8M3 13 13 3" }),
  file: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 2H3v12h10V6L9 2Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 2v4h4M5 9h6m-6 3h4" })
  ] }),
  error: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 4.5v4M8 11v.1" })
  ] }),
  running: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 4v4l2.5 1.5" })
  ] })
};
function spanTone(span) {
  if (span.status === "error") return "error";
  if (span.nested) return "nested";
  if (span.kind !== "tool") return span.kind;
  const name = span.name?.toLowerCase() ?? "";
  if (/image|audio|video|media|screenshot/.test(name)) return "media";
  if (/glob|grep|search|find/.test(name)) return "search";
  if (/browser|web|fetch|http|url/.test(name)) return "network";
  if (/file|read|write|edit|patch|diff/.test(name)) return "file";
  return "shell";
}
function spanIcon(span) {
  if (span.nested) return "nested";
  if (span.kind !== "tool") return span.kind;
  const tone = spanTone({ ...span, status: "complete" });
  return tone === "media" ? "image" : tone === "shell" ? "terminal" : tone === "file" ? "file" : tone === "search" ? "search" : tone === "network" ? "network" : "tool";
}
function TraceIcon({ name }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className: "tw-icon", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", children: shapes[name] });
}

// src/client/TraceDetails.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function Highlight({ text, query }) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: text });
  const lower = text.toLocaleLowerCase(), parts = [];
  let cursor = 0, index = lower.indexOf(term);
  while (index >= 0) {
    parts.push(text.slice(cursor, index), /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("mark", { children: text.slice(index, index + term.length) }, index));
    cursor = index + term.length;
    index = lower.indexOf(term, cursor);
  }
  parts.push(text.slice(cursor));
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: parts });
}
function Thumbnail({ attachment, load, t }) {
  const [url, setUrl] = (0, import_react.useState)(() => load.peek?.(attachment));
  const [failed, setFailed] = (0, import_react.useState)(false);
  const [expanded, setExpanded] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    let active = true;
    void load(attachment).then((value) => {
      if (active) setUrl(value);
    }, () => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [attachment, load]);
  return url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "tw-thumbnail", "data-expanded": expanded || void 0, onClick: () => setExpanded((value) => !value), title: t("imagePreview"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { src: url, alt: attachment.name ?? t("image"), loading: "lazy" }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "tw-file-preview", children: t(failed ? "imageFailed" : "loading") });
}
function Attachments({ value, loadImage, t }) {
  const items = (0, import_react.useMemo)(() => attachments(value), [value]);
  if (!items.length) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "tw-attachments", "aria-label": t("attachments"), children: items.map(({ ref, image }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tw-attachment", children: [
    image && loadImage ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Thumbnail, { attachment: ref, load: loadImage, t }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "tw-file-icon", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TraceIcon, { name: "file" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { title: ref.name, children: ref.name ?? t(image ? "image" : "file") })
  ] }, ref.attachmentId)) });
}
function SpanDetails({ span, origin, now, t, close, loadImage }) {
  const program = codeProgram(span);
  const [tab, setTab] = (0, import_react.useState)(program ? "source" : span.output === void 0 ? "input" : "output");
  const [copy, setCopy] = (0, import_react.useState)("copy");
  const value = tab === "source" ? program?.source : tab === "input" && span.kind === "llm" ? { prompt: span.input, newInput: span.newInput } : span[tab];
  const text = payloadText(value);
  const speed = throughput(span);
  const metrics = [
    ["status", t(span.status)],
    ["duration", compactDuration(span.start === null ? null : (span.end ?? now) - span.start)],
    ["start", compactDuration(span.start === null ? null : span.start - origin, true)]
  ];
  if (span.model) metrics.push(["model", span.model]);
  if (span.provider) metrics.push(["provider", span.provider]);
  if (span.usage?.inputTokens !== void 0) metrics.push(["inputTokens", span.usage.inputTokens.toLocaleString()]);
  if (span.usage?.outputTokens !== void 0) metrics.push(["outputTokens", span.usage.outputTokens.toLocaleString()]);
  if (span.usage?.cacheReadTokens !== void 0) metrics.push(["cacheTokens", span.usage.cacheReadTokens.toLocaleString()]);
  if (span.usage?.cacheWriteTokens !== void 0) metrics.push(["cacheWriteTokens", span.usage.cacheWriteTokens.toLocaleString()]);
  if (span.usage?.reasoningTokens !== void 0) metrics.push(["reasoningTokens", span.usage.reasoningTokens.toLocaleString()]);
  if (span.firstToken !== void 0 && span.start !== null) metrics.push(["firstToken", compactDuration(span.firstToken - span.start)]);
  if (speed !== null) metrics.push(["throughput", `${speed.toFixed(1)} tok/s`]);
  if (span.retries) metrics.push(["retries", span.retries]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("aside", { className: "tw-details", "aria-label": t("details"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: spanLabel(span, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "tw-icon-button", onClick: close, "aria-label": t("close"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TraceIcon, { name: "close" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tw-details-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "tw-status", "data-status": span.status, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", {}),
        t(span.status)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: "tw-identity", children: span.id }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dl", { className: "tw-properties", children: metrics.map(([key, amount]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t(key) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: amount })
      ] }, key)) }),
      span.start === null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "tw-notice", children: t("unknownTiming") }),
      span.error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: span.status === "error" ? "tw-error" : "tw-notice", children: span.error === "trajectory.compaction-interrupted" ? t("interrupted") : span.error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "tw-detail-tabs", "aria-label": t("details"), children: [...program ? ["source"] : [], "input", "output", "metadata"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          "aria-pressed": key === tab,
          onClick: () => {
            setTab(key);
            setCopy("copy");
          },
          children: t(key)
        },
        key
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tw-code-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t(tab) }),
        text && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { onClick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopy("copied");
          } catch {
            setCopy("copyError");
          }
        }, children: t(copy === "copyError" ? "copy" : copy) })
      ] }),
      copy === "copyError" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", className: "tw-error", children: t("copyError") }),
      tab === "source" && program ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.CodeBlock, { code: program.source, lang: program.language, lineNumbers: true, showHeader: false, copyLabel: t("copy"), copiedLabel: t("copied") }) : text ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Attachments, { value, loadImage, t }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { tabIndex: 0, children: text })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "tw-no-payload", children: t(span.status === "running" && tab === "output" ? "pending" : "noPayload") })
    ] })
  ] });
}
function SpanPopover({ span, origin, now, t, close, fullDetails, anchor, loadImage }) {
  const card = (0, import_react.useRef)(null);
  const content = spanSummary(span);
  if (span.kind === "llm") content.input = requestInputSummary(span, t);
  (0, import_react.useEffect)(() => {
    card.current?.focus({ preventScroll: true });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      className: "tw-popover",
      role: "dialog",
      "aria-label": t("summary"),
      tabIndex: -1,
      ref: card,
      style: { left: anchor.left, top: anchor.top, maxHeight: anchor.bottom },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "tw-kind", "data-kind": span.kind, "data-tone": spanTone(span), "data-nested": span.nested || void 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TraceIcon, { name: spanIcon(span) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: spanLabel(span, t) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "tw-status", "data-status": span.status, children: t(span.status) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { "aria-label": t("close"), onClick: close, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TraceIcon, { name: "close" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dl", { className: "tw-popover-metrics", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("duration") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: compactDuration(span.start === null ? null : (span.end ?? now) - span.start) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("start") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: compactDuration(span.start === null ? null : span.start - origin, true) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("tokens") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: compactTokens(totalTokens(span.usage)) })
          ] })
        ] }),
        ["input", "output"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t(key === "input" && span.kind === "llm" ? "newInput" : key) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { "data-code": key === "input" && span.kind === "tool" || void 0, children: excerpt(content[key], "", 260) || t(key === "output" && span.status === "running" ? "pending" : "noPayload") })
        ] }, key)),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Attachments, { value: [span.newInput, span.output ?? span.input], loadImage, t }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: span.firstToken !== void 0 && span.start !== null ? `${t("firstTokenShort")} ${compactDuration(span.firstToken - span.start)}` : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { onClick: fullDetails, children: [
            t("fullDetails"),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TraceIcon, { name: "open" })
          ] })
        ] })
      ]
    }
  );
}

// src/client/TraceTimeline.tsx
var import_react2 = require("react");

// src/client/timeline.ts
function createTimeAxis(model, now = model.end, idleThreshold = 6e4) {
  const end = Math.max(model.start + 1, model.end, model.running ? now : model.end);
  const occupied = model.spans.filter((span) => span.kind !== "turn").map((span) => ({
    start: span.start ?? span.anchor,
    end: span.end ?? now
  })).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const span of occupied) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
    else merged.push({ ...span });
  }
  const activeLength = merged.reduce((sum, span) => sum + Math.max(0, span.end - span.start), 0);
  const gapWidth = Math.max(1e3, Math.min(15e3, activeLength / 50));
  const intervals = [];
  let cursor = model.start, position = 0;
  const append = (start, finish, gap) => {
    if (finish <= start) return;
    const width = gap ? gapWidth : finish - start;
    intervals.push({ start, end: finish, from: position, to: position + width, gap });
    position += width;
  };
  for (const span of merged) {
    append(cursor, span.start, span.start - cursor > idleThreshold);
    append(Math.max(cursor, span.start), span.end, false);
    cursor = Math.max(cursor, span.end);
  }
  append(cursor, end, end - cursor > idleThreshold);
  const interpolate = (value, reverse) => {
    const piece = intervals.find((part) => value <= (reverse ? part.to : part.end)) ?? intervals.at(-1);
    if (!piece) return reverse ? model.start : 0;
    const [a, b, c, d] = reverse ? [piece.from, piece.to, piece.start, piece.end] : [piece.start, piece.end, piece.from, piece.to];
    return c + (Math.min(b, Math.max(a, value)) - a) / (b - a) * (d - c);
  };
  return {
    start: model.start,
    end,
    length: Math.max(1, position),
    intervals,
    project: (time) => interpolate(time, false),
    unproject: (value) => interpolate(value, true)
  };
}
function clampWindow(window, length) {
  const width = Math.min(length, Math.max(Math.min(1, length), window.to - window.from));
  const from = Math.min(Math.max(0, window.from), length - width);
  return { from, to: from + width };
}
function zoomWindow(window, factor, length, anchor = (window.from + window.to) / 2) {
  const ratio = Math.min(1, Math.max(0, (anchor - window.from) / (window.to - window.from)));
  const width = (window.to - window.from) / factor;
  return clampWindow({ from: anchor - width * ratio, to: anchor + width * (1 - ratio) }, length);
}
function focusSpan(axis, span, now) {
  const from = axis.project(span.start ?? span.anchor), to = axis.project(span.end ?? now);
  return clampWindow({ from, to: Math.max(from + 1, to) }, axis.length);
}
function visibleGaps(axis, window) {
  return axis.intervals.filter((part) => part.gap && part.to > window.from && part.from < window.to).map((part) => {
    const from = Math.max(part.from, window.from), to = Math.min(part.to, window.to);
    return { ...part, from, to, start: axis.unproject(from), end: axis.unproject(to) };
  }).filter((part) => part.end - part.start > 6e4);
}
function activityKind(span) {
  if (span.status === "error") return "error";
  if (span.nested) return "nested";
  if (span.kind === "llm" || span.kind === "compaction") return "llm";
  if (span.kind === "tool") return "tool";
  return "input";
}
function leafSegments(span, now) {
  const start = span.start ?? span.anchor, end = span.end ?? now;
  const kind = activityKind(span);
  if (span.kind === "llm" && span.firstToken !== void 0 && span.firstToken > start && span.firstToken < end && span.status !== "error") {
    return [{ start, end: span.firstToken, kind: "waiting" }, { start: span.firstToken, end, kind }];
  }
  return [{ start, end, kind }];
}
function compositeSegments(parent, children, now) {
  const start = parent.start ?? parent.anchor, end = parent.end ?? now;
  const activity = children.flatMap((child) => leafSegments(child, now)).filter((part) => part.end > part.start && part.kind !== "input");
  const points = [.../* @__PURE__ */ new Set([start, end, ...activity.flatMap((part) => [Math.max(start, part.start), Math.min(end, part.end)])])].filter((time) => time >= start && time <= end).sort((a, b) => a - b);
  const priority = { error: 5, nested: 4, llm: 3, tool: 2, waiting: 1, input: 0 };
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const active = activity.filter((part) => part.start < b && part.end > a).sort((left, right) => priority[right.kind] - priority[left.kind])[0];
    const kind = active?.kind ?? "waiting";
    const previous = result.at(-1);
    if (previous?.kind === kind && previous.end === a) previous.end = b;
    else result.push({ start: a, end: b, kind });
  }
  return result;
}
function intervalPosition(axis, window, start, end) {
  const a = axis.project(start), b = axis.project(end);
  if (b < window.from || a > window.to) return null;
  const scale = 100 / (window.to - window.from);
  return { left: Math.max(0, a - window.from) * scale, width: Math.max(0, Math.min(window.to, b) - Math.max(window.from, a)) * scale };
}

// src/client/timeline-layout.ts
var TICK_STEPS = [
  ...[1, 2, 5, 10, 15, 20, 30].map((seconds) => seconds * 1e3),
  ...[1, 2, 5, 10, 15, 30].map((minutes) => minutes * 6e4),
  ...[1, 2, 3, 6, 12].map((hours) => hours * 36e5)
];
function timelineTicks(axis, window, origin, width) {
  const rough = (window.to - window.from) / Math.max(1, Math.floor(width / 110));
  const step = TICK_STEPS.find((value) => value >= rough) ?? Math.ceil(rough / 432e5) * 432e5;
  const unit = step >= 36e5 ? 36e5 : step >= 6e4 ? 6e4 : 1e3;
  const suffix = unit === 1e3 ? "s" : unit === 6e4 ? "m" : "h";
  const firstGapEnd = axis.intervals.find((part) => part.gap && part.end > origin)?.end;
  const offsets = /* @__PURE__ */ new Set();
  if (axis.project(origin) >= window.from && axis.project(origin) <= window.to) offsets.add(0);
  for (const part of axis.intervals) {
    if (part.gap || part.to < window.from || part.from > window.to) continue;
    const from = Math.max(part.start, axis.unproject(window.from)) - origin;
    const to = Math.min(part.end, axis.unproject(window.to)) - origin;
    for (let offset = Math.ceil(from / step) * step; offset <= to; offset += step) offsets.add(offset);
  }
  let previous = -Infinity;
  return [...offsets].sort((a, b) => a - b).flatMap((offset) => {
    const left = (axis.project(origin + offset) - window.from) / (window.to - window.from) * 100;
    if ((left - previous) * width / 100 < 64) return [];
    previous = left;
    const hoursAfterGap = offset >= 72e5 && firstGapEnd !== void 0 && origin + offset >= firstGapEnd;
    return [{ left, label: offset === 0 ? "0s" : hoursAfterGap ? compactDuration(offset) : `${offset / unit}${suffix}` }];
  });
}
function compositeLayout(segments, axis, window, width) {
  const result = [];
  let pending;
  const append = (left, end, kind) => {
    const narrow = end - left < 6;
    const inset = narrow ? 0 : 1;
    result.push({ left: left + inset, width: Math.max(0.5, end - left - inset * 2), kind, narrow });
  };
  const flush = () => {
    if (!pending) return;
    const kind = [...pending.weights].sort((a, b) => b[1] - a[1])[0][0];
    append(pending.left, pending.end, kind);
    pending = void 0;
  };
  for (const segment of segments) {
    const position = intervalPosition(axis, window, segment.start, segment.end);
    if (!position || !position.width) continue;
    const left = position.left * width / 100, size = position.width * width / 100, end = left + size;
    if (size >= 6 || segment.kind === "error" || segment.kind === "nested") {
      flush();
      append(left, end, segment.kind);
    } else {
      if (pending && left - pending.end > 2) flush();
      pending ??= { left, end, weights: /* @__PURE__ */ new Map() };
      pending.end = end;
      pending.weights.set(segment.kind, (pending.weights.get(segment.kind) ?? 0) + size);
    }
  }
  flush();
  return result;
}

// src/client/TraceTimeline.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var ROW_HEIGHT = 28;
var AXIS_HEIGHT = 30;
function SpanBadge({ span, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-kind", "data-kind": span.kind, "data-tone": spanTone(span), "data-nested": span.nested || void 0, title: t(span.nested ? "nested" : span.kind), "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: spanIcon(span) }) });
}
function TraceRowView({ row, index, axis, window, trackWidth, segments, now, t, query, selected, expanded, inspect, collapse, focus, sticky = false }) {
  const { span, depth, hasChildren } = row;
  const label = spanLabel(span, t), content = (0, import_react2.useMemo)(() => spanSummary(span, query), [span, query]);
  const position = intervalPosition(axis, window, span.start ?? span.anchor, span.end ?? now);
  const instant = ["message", "context", "system"].includes(span.kind) && (span.start === null || span.start === span.end);
  const painted = hasChildren ? compositeLayout(segments, axis, window, trackWidth) : [];
  const spanDuration = compactDuration(span.start === null ? null : (span.end ?? now) - span.start);
  const tokens = totalTokens(span.usage);
  const matches = query.trim().toLocaleLowerCase();
  const input = excerpt(content.input, query, 260), output = excerpt(content.output, query, 260);
  const showOutput = !!output && (!matches || output.toLocaleLowerCase().includes(matches));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      role: sticky ? void 0 : "listitem",
      className: sticky ? "tw-row tw-sticky-row" : "tw-row",
      "data-selected": selected || void 0,
      "data-kind": span.kind,
      "data-nested": span.nested || void 0,
      "data-searching": !!matches || void 0,
      style: { top: sticky ? void 0 : index * ROW_HEIGHT, "--tw-depth": Math.min(depth, 10) },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tw-row-label", children: [
          Array.from({ length: Math.min(depth, 10) }, (_, level) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { className: "tw-tree-guide", style: { left: 13 + level * 13 } }, level)),
          hasChildren ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "tw-disclosure", "aria-expanded": expanded, "aria-label": t(expanded ? "collapse" : "expand", { name: label }), onClick: collapse, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: expanded ? "chevronDown" : "chevronRight" }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-disclosure-space" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { className: "tw-label-button", onClick: (event) => inspect(event, span), "aria-label": t("inspect", { name: label }), title: [label, excerpt(content.input, "", 180), excerpt(content.output, "", 220)].filter(Boolean).join(" \u2192 "), children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SpanBadge, { span, t }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { className: "tw-label-name", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Highlight, { text: label, query }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "tw-ledger-text", "data-output": showOutput || void 0, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-input-summary", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Highlight, { text: input, query }) }),
              showOutput && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-arrow", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: "arrowRight" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-output-summary", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Highlight, { text: output, query }) })
              ] })
            ] }),
            span.status !== "complete" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-row-status", "data-status": span.status, "aria-label": t(span.status), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: span.status }) })
          ] }),
          !!span.errorCount && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-error-count", title: t("errorCount", { count: span.errorCount }), children: span.errorCount }),
          hasChildren && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "tw-focus", title: t("focus", { name: label }), "aria-label": t("focus", { name: label }), onClick: focus, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: "focus" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { className: "tw-track", tabIndex: -1, "aria-label": t("inspect", { name: label }), onClick: (event) => inspect(event, span), onDoubleClick: focus, children: [
          position && (instant ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-instant", style: { left: `${position.left}%` } }) : hasChildren ? painted.map((part, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "span",
            {
              className: "tw-bar",
              "data-activity": part.kind,
              "data-narrow": part.narrow || void 0,
              "data-running": span.status === "running" || void 0,
              style: { left: part.left, width: part.width }
            },
            i
          )) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tw-leaf-bar", "data-running": span.status === "running" || void 0, style: { left: `${position.left}%`, width: `${position.width}%` }, children: segments.map((segment, i) => {
            const part = intervalPosition(axis, window, segment.start, segment.end);
            return part && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "span",
              {
                className: "tw-leaf-segment",
                "data-activity": segment.kind,
                style: { left: `${position.width ? (part.left - position.left) / position.width * 100 : 0}%`, width: `${position.width ? part.width / position.width * 100 : 100}%` }
              },
              i
            );
          }) })),
          position && !instant && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "tw-bar-duration", style: { left: `calc(${Math.min(100, position.left + position.width)}% + ${hasChildren ? 0 : Math.max(0, 6 - position.width * trackWidth / 100)}px)` }, children: [
            spanDuration,
            hasChildren && tokens !== null ? ` \xB7 ${compactTokens(tokens)} tok` : ""
          ] })
        ] })
      ]
    }
  );
}
function Overview({ model, axis, window, change, reset, t, now }) {
  const drag = (0, import_react2.useRef)(null);
  const lanes = ["inputLane", "modelLane", "toolLane"];
  const bars = model.spans.filter((span) => span.kind !== "turn");
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tw-overview", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tw-overview-labels", children: lanes.map((lane) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t(lane) }, lane)) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        className: "tw-overview-track",
        role: "group",
        "aria-label": t("overview"),
        tabIndex: 0,
        title: t("overviewHint"),
        onDoubleClick: reset,
        onKeyDown: (event) => {
          if (event.key === "Escape" || event.key === "Home") reset();
        },
        onPointerDown: (event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          drag.current = { start: Math.max(0, Math.min(axis.length, (event.clientX - rect.left) / rect.width * axis.length)), x: event.clientX };
        },
        onPointerMove: (event) => {
          if (!drag.current || Math.abs(event.clientX - drag.current.x) < 3) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const end = Math.max(0, Math.min(axis.length, (event.clientX - rect.left) / rect.width * axis.length));
          change({ from: Math.min(drag.current.start, end), to: Math.max(drag.current.start, end) });
        },
        onPointerUp: () => {
          drag.current = null;
        },
        onPointerCancel: () => {
          drag.current = null;
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { viewBox: "0 0 1000 36", preserveAspectRatio: "none", "aria-hidden": "true", children: [
            [12, 24].map((y) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: `M0 ${y}H1000`, className: "tw-overview-rule" }, y)),
            bars.map((span) => {
              const x = axis.project(span.start ?? span.anchor) / axis.length * 1e3;
              const end = axis.project(span.end ?? now) / axis.length * 1e3;
              const lane = span.kind === "llm" || span.kind === "compaction" ? 1 : span.kind === "tool" ? 2 : 0;
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x, y: lane * 12 + 3, width: Math.max(1.2, end - x), height: "6", rx: "1.5", "data-activity": activityKind(span) }, span.id);
            })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tw-overview-shade", style: { width: `${window.from / axis.length * 100}%` } }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tw-overview-shade", style: { left: `${window.to / axis.length * 100}%`, right: 0 } }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tw-overview-window", style: { left: `${window.from / axis.length * 100}%`, width: `${(window.to - window.from) / axis.length * 100}%` }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", {}),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", {})
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "tw-overview-reset", title: t("fit"), "aria-label": t("fit"), onClick: reset, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TraceIcon, { name: "fit" }) })
  ] });
}
function Handoffs({ rows, axis, window, start, end }) {
  const indexes = new Map(rows.map((row, index) => [row.span.id, index]));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tw-handoffs", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "100%", height: rows.length * ROW_HEIGHT, viewBox: `0 0 100 ${rows.length * ROW_HEIGHT}`, preserveAspectRatio: "none", "aria-hidden": "true", children: rows.slice(start, end).map(({ span }, offset) => {
    const parent = span.parentId ? indexes.get(span.parentId) : void 0;
    if (!span.nested || parent === void 0) return null;
    const position = intervalPosition(axis, window, span.start ?? span.anchor, span.start ?? span.anchor);
    if (!position) return null;
    const y = (start + offset) * ROW_HEIGHT + ROW_HEIGHT / 2;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: `M${position.left} ${parent * ROW_HEIGHT + ROW_HEIGHT / 2}V${y - 5}Q${position.left} ${y} ${position.left + 0.8} ${y}H${position.left + 1.2}` }, span.id);
  }) }) });
}

// src/client/waterfall.css
var waterfall_default = `.tw-root {
  --tw-bg: var(--dsw-alias-bg-layer-1);
  --tw-surface: var(--dsw-alias-bg-layer-2);
  --tw-text: var(--dsw-alias-label-primary);
  --tw-muted: var(--dsw-alias-label-secondary);
  --tw-faint: color-mix(in srgb, var(--dsw-alias-label-secondary) 72%, var(--dsw-alias-label-caption));
  --tw-border: var(--dsw-alias-border-l2);
  --tw-soft: color-mix(in srgb, var(--tw-muted) 5%, var(--tw-bg));
  --tw-grid: color-mix(in srgb, var(--tw-border) 48%, transparent);
  --tw-accent: var(--dsw-alias-state-business-primary);
  --tw-model: var(--tw-accent);
  --tw-tool: color-mix(in srgb, var(--tw-model) 42%, var(--tw-bg));
  --tw-handoff: color-mix(in srgb, color-mix(in srgb, var(--dsw-alias-state-success-primary) 60%, var(--tw-accent)) 80%, var(--tw-muted));
  --tw-red: var(--dsw-alias-state-error-primary);
  --tw-amber: color-mix(in srgb, var(--dsw-alias-state-warn-label) 78%, var(--tw-muted));
  --tw-file: color-mix(in srgb, color-mix(in srgb, var(--tw-accent) 70%, var(--tw-red)) 82%, var(--tw-muted));
  --tw-media: color-mix(in srgb, var(--tw-red) 65%, var(--tw-muted));
  --tw-network: color-mix(in srgb, var(--tw-accent) 80%, var(--tw-handoff));
  --tw-label-width: 48%;
  --tw-effective-label: min(var(--tw-label-width), 70%);
  --tw-gutter: 116px;
  position: relative; isolation: isolate; container-type: inline-size;
  display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0;
  overflow: hidden; background: var(--tw-bg); color: var(--tw-text);
  font: 11px/1.45 var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  box-sizing: border-box; padding-bottom: calc(var(--dsh-composer-height, 0px) + 5px);
}
:where([data-ds-dark-theme]) .tw-root {
  --tw-amber: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 78%, var(--tw-text));
  --tw-file: color-mix(in srgb, var(--tw-accent) 68%, var(--tw-red));
  --tw-media: color-mix(in srgb, var(--tw-red) 75%, var(--tw-muted));
}
.tw-root *, .tw-root *::before, .tw-root *::after { box-sizing: border-box; }
.tw-root button, .tw-root input { font: inherit; color: inherit; }
.tw-icon { display: block; width: 16px; height: 16px; flex: none; }
.tw-root button { border: 0; background: transparent; cursor: pointer; }
.tw-root button:disabled { opacity: .35; cursor: default; }
.tw-root :is(button, input, pre, [tabindex]):focus-visible { outline: 2px solid var(--tw-accent); outline-offset: -2px; }
.tw-root button:hover:not(:disabled) { background-color: color-mix(in srgb, var(--tw-muted) 7%, transparent); }
.tw-root mark { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, var(--tw-bg)); color: var(--tw-text); border-radius: 3px; }
.tw-header { flex: none; border-bottom: 1px solid var(--tw-border); }
.tw-heading { display: flex; align-items: center; gap: 20px; height: 42px; padding: 0 18px; }
.tw-title { display: flex; align-items: center; gap: 8px; flex: none; }
.tw-title h2 { font-size: 14px; font-weight: 650; margin: 0; letter-spacing: -.2px; }
.tw-live { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--tw-accent); }
.tw-live i, .tw-status i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.tw-search { margin-left: auto; display: flex; align-items: center; gap: 7px; color: var(--tw-muted); width: min(285px, 40%); min-width: 150px; border: 1px solid var(--tw-border); padding: 4px 8px; border-radius: 7px; background: var(--tw-surface); }
.tw-search > .tw-icon { width: 14px; height: 14px; }
.tw-search input { border: 0; background: transparent; outline: none; width: 100%; min-width: 0; font-size: 11px; }
.tw-search input::placeholder { color: var(--tw-faint); }
.tw-search kbd { flex: none; font: 500 11px/18px ui-monospace, SFMono-Regular, monospace; color: var(--tw-muted); padding: 0 4px; border: 1px solid var(--tw-border); border-radius: 3px; background: var(--tw-bg); white-space: nowrap; }
.tw-metrics { margin: 0; display: grid; grid-template-columns: repeat(5, 1fr); min-width: 0; padding: 8px 18px 13px; }
.tw-metrics > div { padding: 0 18px; border-left: 1px solid var(--tw-border); white-space: nowrap; }
.tw-metrics > div:first-child { padding-left: 0; border-left: 0; }
.tw-metrics dt { color: var(--tw-muted); font-size: 10px; margin-bottom: 2px; }
.tw-metrics dd { font-size: 19px; font-weight: 500; margin: 0; font-variant-numeric: tabular-nums; letter-spacing: -.35px; }
.tw-metrics dd small { color: var(--tw-faint); font-size: 9px; font-weight: 400; margin-left: 7px; letter-spacing: 0; }
.tw-metrics [data-error] dd { color: var(--tw-red); }
.tw-toolbar { min-height: 32px; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 3px 12px; flex: none; }
.tw-filters, .tw-controls { display: flex; align-items: center; gap: 3px; }
.tw-controls { margin-left: auto; }
.tw-range-label { color: var(--tw-muted); font-size: 10px; margin-left: 8px; white-space: nowrap; }
.tw-filters button, .tw-controls button, .tw-load { padding: 3px 7px; color: var(--tw-muted); font-size: 10px; border-radius: 4px; white-space: nowrap; }
.tw-filters button[aria-pressed='true'] { background: var(--tw-surface); color: var(--tw-text); }
.tw-filters button span { margin-left: 5px; color: var(--tw-red); }
.tw-controls button { display: inline-flex; justify-content: center; align-items: center; min-height: 24px; padding: 2px 6px; }
.tw-controls .tw-icon { width: 13px; height: 13px; }
.tw-divider { height: 11px; width: 1px; background: var(--tw-border); margin: 0 5px; }
.tw-overview { display: flex; height: 44px; flex: none; padding: 3px 12px 5px; gap: 7px; border-bottom: 1px solid var(--tw-border); }
.tw-overview-labels { display: flex; flex-direction: column; width: 32px; font-size: 8px; line-height: 12px; color: var(--tw-faint); }
.tw-overview-track { flex: 1; position: relative; cursor: crosshair; touch-action: none; border-radius: 3px; overflow: hidden; }
.tw-overview-track svg { width: 100%; height: 36px; display: block; }
.tw-overview-rule { stroke: var(--tw-grid); stroke-width: .6; }
.tw-overview-track rect { fill: var(--tw-model); }
.tw-overview-track rect[data-activity='tool'] { fill: var(--tw-tool); }
.tw-overview-track rect[data-activity='input'] { fill: var(--tw-muted); }
.tw-overview-track rect[data-activity='nested'] { fill: var(--tw-handoff); }
.tw-overview-track rect[data-activity='error'] { fill: var(--tw-red); }
.tw-overview-shade { pointer-events: none; position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--tw-bg) 76%, transparent); }
.tw-overview-window { position: absolute; top: 0; bottom: 0; border: 1px solid color-mix(in srgb, var(--tw-accent) 45%, transparent); border-radius: 3px; pointer-events: none; }
.tw-overview-window i { position: absolute; width: 3px; height: 12px; top: 10px; background: var(--tw-accent); border-radius: 2px; left: -1px; }
.tw-overview-window i:last-child { left: auto; right: -1px; }
.tw-overview-reset { display: grid; place-content: center; width: 22px; padding: 0; color: var(--tw-faint) !important; }
.tw-main { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.tw-chart { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.tw-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.tw-axis { display: grid; grid-template-columns: var(--tw-effective-label) 1fr; height: 30px; position: sticky; top: 0; z-index: 8; background: var(--tw-bg); border-bottom: 1px solid var(--tw-border); color: var(--tw-faint); font-size: 9px; }
.tw-axis-label { display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; position: relative; background: var(--tw-bg); border-right: 1px solid var(--tw-border); }
.tw-axis-label span { font-variant-numeric: tabular-nums; opacity: .7; }
.tw-resizer { position: absolute; right: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 10; touch-action: none; }
.tw-resizer:hover { background: color-mix(in srgb, var(--tw-accent) 24%, transparent); }
.tw-ticks { position: relative; margin-right: var(--tw-gutter); }
.tw-ticks > span { position: absolute; top: 7px; transform: translateX(-50%); white-space: nowrap; font-size: 11px; font-variant-numeric: tabular-nums; }
.tw-ticks > span:first-child { transform: none; padding-left: 6px; }
.tw-break-label { position: absolute; top: 6px; transform: translateX(-50%); padding: 1px 5px; border-radius: 3px; background: var(--tw-bg); font-size: 11px; font-variant-numeric: tabular-nums; font-style: normal; white-space: nowrap; z-index: 1; box-shadow: 0 0 0 2px var(--tw-bg); }
.tw-rows { position: relative; }
.tw-row { --tw-row-bg: var(--tw-bg); display: grid; grid-template-columns: var(--tw-effective-label) 1fr; height: 28px; position: absolute; width: 100%; background: var(--tw-row-bg); }
.tw-row-label { display: flex; gap: 4px; align-items: center; padding-left: calc(8px + var(--tw-depth) * 13px); padding-right: 8px; border-right: 1px solid var(--tw-border); position: relative; z-index: 2; background: var(--tw-row-bg); min-width: 0; }
.tw-tree-guide { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tw-grid); pointer-events: none; }
.tw-row[data-kind='turn'] { --tw-row-bg: color-mix(in srgb, var(--tw-muted) 2%, var(--tw-bg)); }
.tw-row:hover { --tw-row-bg: var(--tw-soft); }
.tw-row[data-selected] { --tw-row-bg: color-mix(in srgb, var(--tw-accent) 7%, var(--tw-bg)); }
.tw-root .tw-row :is(.tw-label-button, .tw-track):hover { background-color: transparent; }
.tw-label-button { display: flex; align-items: center; gap: 7px; flex: 1; height: 27px; padding: 0; min-width: 0; text-align: left; border-radius: 3px; }
.tw-label-name { font-weight: 500; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis; flex: none; font-size: 12px; }
.tw-row[data-kind='turn'] .tw-label-name { font-weight: 600; }
.tw-ledger-text { display: flex; gap: 0; white-space: nowrap; overflow: hidden; min-width: 0; color: var(--tw-muted); font-size: 11px; }
.tw-input-summary { color: var(--tw-muted); overflow: hidden; text-overflow: ellipsis; }
.tw-output-summary { color: var(--tw-muted); overflow: hidden; text-overflow: ellipsis; }
.tw-output-summary, .tw-arrow { display: none; }
.tw-row:is(:hover, [data-searching]) .tw-output-summary { display: inline; }
.tw-row:is(:hover, [data-searching]) .tw-arrow { display: inline-flex; }
.tw-row:is(:hover, [data-searching]) .tw-input-summary { max-width: 45%; flex: none; }
.tw-row .tw-ledger-text:not([data-output]) .tw-input-summary { max-width: 100%; flex: 1; }
.tw-arrow { align-items: center; padding: 0 6px; color: var(--tw-faint); }
.tw-arrow .tw-icon { width: 11px; height: 11px; }
.tw-ledger-text { font-family: inherit; font-weight: 400; }
.tw-kind { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid var(--tw-border); border-radius: 5px; color: var(--tw-muted); background: var(--tw-bg); flex: none; }
.tw-kind .tw-icon { width: 14px; height: 14px; }
.tw-kind[data-kind='llm'], .tw-kind[data-kind='compaction'] { color: var(--tw-model); }
.tw-kind[data-tone='shell'] { color: color-mix(in srgb, var(--tw-text) 75%, var(--tw-muted)); }
.tw-kind[data-tone='file'] { color: var(--tw-file); }
.tw-kind[data-tone='network'] { color: var(--tw-network); }
.tw-kind[data-tone='media'] { color: var(--tw-media); }
.tw-kind[data-tone='message'] { color: var(--tw-amber); }
.tw-kind[data-tone='search'], .tw-kind[data-tone='nested'] { color: var(--tw-handoff); }
.tw-kind[data-tone='error'] { color: var(--tw-red); }
.tw-disclosure, .tw-disclosure-space { position: relative; flex: none; width: 11px; padding: 0; }
.tw-disclosure { display: grid; place-content: center; height: 24px; color: var(--tw-faint) !important; }
.tw-disclosure .tw-icon { width: 12px; height: 12px; }
.tw-focus { display: grid; place-content: center; padding: 3px; color: var(--tw-faint) !important; border-radius: 3px; }
.tw-focus .tw-icon { width: 13px; height: 13px; }
.tw-error-count { background: color-mix(in srgb, var(--tw-red) 10%, transparent); color: var(--tw-red); border-radius: 8px; padding: 0 5px; font-size: 9px; flex: none; }
.tw-track { display: block; position: relative; z-index: 2; margin-right: var(--tw-gutter); padding: 0; border-radius: 0; overflow: visible; min-width: 0; }
.tw-bar, .tw-legend i { background: var(--tw-muted); }
.tw-bar, .tw-leaf-bar { position: absolute; top: 8px; height: 12px; border-radius: 6px; }
.tw-bar[data-narrow] { border-radius: 0; border: 0; }
.tw-leaf-bar { min-width: 6px; overflow: hidden; }
.tw-leaf-segment { position: absolute; top: 0; height: 100%; }
.tw-instant { position: absolute; top: 11px; width: 6px; height: 6px; border-radius: 50%; background: var(--tw-muted); opacity: .65; }
.tw-root [data-activity='llm'] { background: var(--tw-model); }
.tw-root [data-activity='tool'] { background: var(--tw-tool); }
.tw-root [data-activity='nested'] { background: color-mix(in srgb, var(--tw-handoff) 65%, var(--tw-bg)); }
.tw-root [data-activity='error'] { background: var(--tw-red); }
.tw-root [data-activity='waiting'] { background: repeating-linear-gradient(125deg, transparent 0 3px, color-mix(in srgb, var(--tw-muted) 32%, transparent) 3px 4px); border: 1px solid color-mix(in srgb, var(--tw-muted) 25%, transparent); }
.tw-root .tw-bar[data-narrow] { border: 0; border-radius: 0; }
.tw-leaf-segment[data-activity='waiting'] { border: 0; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tw-muted) 25%, transparent); }
.tw-bar[data-running], .tw-leaf-bar[data-running] { animation: tw-live 1.5s ease-in-out infinite alternate; }
.tw-bar-duration { position: absolute; top: 6px; padding-left: 7px; font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; color: var(--tw-muted); white-space: nowrap; pointer-events: none; }
.tw-row-status { margin-left: auto; color: var(--tw-faint); }
.tw-row-status .tw-icon { width: 12px; height: 12px; }
.tw-row-status[data-status='error'] { color: var(--tw-red); }
.tw-sticky { position: sticky; height: 28px; margin-bottom: -28px; z-index: 7; box-shadow: 0 2px 3px color-mix(in srgb, var(--tw-text) 6%, transparent); }
.tw-sticky-row { position: relative; border-bottom: 1px solid var(--tw-border); }
.tw-handoffs, .tw-breaks, .tw-gridlines { position: absolute; left: var(--tw-effective-label); right: var(--tw-gutter); top: 0; bottom: 0; pointer-events: none; }
.tw-gridlines { z-index: 1; }
.tw-gridlines i { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tw-grid); }
.tw-handoffs { z-index: 3; }
.tw-handoffs path { stroke: var(--tw-handoff); fill: none; stroke-width: 1; opacity: .7; vector-effect: non-scaling-stroke; }
.tw-breaks { z-index: 3; }
.tw-breaks i { position: absolute; top: 0; bottom: 0; width: 4px; transform: translateX(-2px); border-left: 1px dashed var(--tw-faint); border-right: 1px dashed var(--tw-faint); background: color-mix(in srgb, var(--tw-bg) 65%, transparent); opacity: .45; }
.tw-footer { padding: 6px 12px; border-top: 1px solid var(--tw-border); display: flex; align-items: center; justify-content: space-between; color: var(--tw-muted); font-size: 11px; gap: 10px; flex: none; }
.tw-legend { display: flex; gap: 12px; align-items: center; }
.tw-legend > span { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.tw-legend i { display: grid; place-items: center; width: 14px; height: 8px; border-radius: 4px; }
.tw-legend i[data-activity="error"] { color: var(--dsw-static-neutral-00); border-radius: 3px; }
.tw-legend .tw-icon { width: 8px; height: 8px; stroke-width: 2; }
.tw-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 230px; color: var(--tw-faint); text-align: center; }
.tw-empty h3 { color: var(--tw-muted); font-size: 13px; font-weight: 500; margin: 10px 0 0; }
.tw-empty p { margin: 6px 0; }
.tw-empty button { padding: 6px 10px; color: var(--tw-accent); }
.tw-details { width: 365px; min-width: 300px; flex: none; border-left: 1px solid var(--tw-border); background: var(--tw-bg); display: flex; flex-direction: column; }
.tw-details > header, .tw-popover > header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--tw-border); }
.tw-details header strong, .tw-popover header strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.tw-icon-button, .tw-popover header button { display: grid; place-content: center; width: 24px; height: 24px; padding: 0; color: var(--tw-muted) !important; border-radius: 50%; }
.tw-details-body { padding: 13px 15px 20px; overflow: auto; min-height: 0; scrollbar-width: thin; }
.tw-status { display: inline-flex; align-items: center; gap: 4px; color: var(--tw-handoff); background: color-mix(in srgb, var(--tw-handoff) 10%, transparent); border-radius: 5px; padding: 1px 5px; font-size: 9px; white-space: nowrap; }
.tw-status[data-status='error'] { color: var(--tw-red); background: color-mix(in srgb, var(--tw-red) 8%, transparent); }
.tw-status[data-status='running'] { color: var(--tw-model); background: color-mix(in srgb, var(--tw-model) 8%, transparent); }
.tw-identity { display: block; margin-top: 8px; font: 9px/1.5 ui-monospace, monospace; overflow-wrap: anywhere; color: var(--tw-faint); opacity: .65; }
.tw-properties { margin: 14px 0; }
.tw-properties > div { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
.tw-properties dt { color: var(--tw-faint); font-size: 10px; }
.tw-properties dd { margin: 0; text-align: right; word-break: break-word; font-size: 10px; font-variant-numeric: tabular-nums; }
.tw-detail-tabs { display: flex; border-bottom: 1px solid var(--tw-border); gap: 10px; margin: 12px 0; }
.tw-detail-tabs button { padding: 5px 0; color: var(--tw-faint); font-size: 10px; }
.tw-detail-tabs button[aria-pressed='true'] { color: var(--tw-text); border-bottom: 2px solid var(--tw-model); }
.tw-code-heading { display: flex; justify-content: space-between; align-items: center; margin: 12px 0 8px; color: var(--tw-faint); font-size: 9px; }
.tw-code-heading button { color: var(--tw-muted); font-size: 9px; border-radius: 3px; }
.tw-details pre { margin: 0; font: 11px/1.65 ui-monospace, SFMono-Regular, monospace; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--tw-muted); tab-size: 2; }
.tw-popover { position: absolute; width: 330px; overflow: auto; z-index: 30; background: var(--tw-bg); border: 1px solid var(--tw-border); border-radius: 12px; box-shadow: 0 8px 28px color-mix(in srgb, var(--tw-text) 8%, transparent), 0 2px 5px color-mix(in srgb, var(--tw-text) 4%, transparent); padding: 0 12px 10px; outline: none; }
.tw-popover > header { padding: 12px 0; border: 0; font-size: 13px; }
.tw-popover header button { background: var(--tw-soft); }
.tw-popover-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--tw-soft); border-radius: 8px; margin: 0 0 12px; padding: 10px; }
.tw-popover dt, .tw-popover section label { font-size: 11px; color: var(--tw-muted); }
.tw-popover dd { margin: 2px 0 0; font-size: 13px; font-variant-numeric: tabular-nums; }
.tw-popover section { margin-top: 10px; }
.tw-popover section p { margin: 3px 0 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tw-popover section p[data-code] { font-family: ui-monospace, SFMono-Regular, monospace; }
.tw-popover footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tw-border); color: var(--tw-faint); font-size: 9px; }
.tw-popover footer button { display: inline-flex; align-items: center; gap: 5px; color: var(--tw-text); font-size: 10px; padding: 3px 5px; border-radius: 4px; }
.tw-popover footer button .tw-icon { width: 12px; height: 12px; }
.tw-error, .tw-notice, .tw-history-error { font-size: 10px; padding: 8px; border-radius: 5px; overflow-wrap: anywhere; color: var(--tw-red); background: color-mix(in srgb, var(--tw-red) 6%, transparent); }
.tw-notice { color: var(--tw-faint); background: var(--tw-surface); }
.tw-history-error { margin: 3px 12px; }
.tw-no-payload { color: var(--tw-faint); font-size: 10px; }
.tw-attachments { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.tw-attachment { display: flex; flex-direction: column; width: 92px; gap: 3px; font-size: 9px; color: var(--tw-muted); }
.tw-attachment > span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tw-thumbnail { padding: 0; height: 62px; border: 1px solid var(--tw-border) !important; border-radius: 5px; background: var(--tw-surface) !important; overflow: hidden; }
.tw-thumbnail img { width: 100%; height: 100%; object-fit: contain; }
.tw-thumbnail[data-expanded] { position: fixed; inset: 15vh 15vw; width: 70vw; height: 70vh; z-index: 50; box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--tw-bg) 80%, transparent); }
.tw-file-icon, .tw-file-preview { display: grid; place-content: center; height: 62px; background: var(--tw-surface); border: 1px solid var(--tw-border); border-radius: 5px; }
.tw-file-icon { color: var(--tw-faint); }
.tw-file-icon .tw-icon { width: 28px; height: 28px; }
@keyframes tw-live { to { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { .tw-bar[data-running], .tw-leaf-bar[data-running] { animation: none; } }
@container (max-width: 950px) {
  .tw-header { gap: 10px; padding: 8px 12px; }
  .tw-metrics > div { padding: 0 9px; }
  .tw-metrics dd small { display: block; margin: 1px 0 0; }
  .tw-main { position: relative; }
  .tw-details { position: absolute; inset: 0 0 0 auto; z-index: 15; width: min(90%, 365px); box-shadow: -8px 0 24px color-mix(in srgb, var(--tw-text) 8%, transparent); }
}
@container (max-width: 650px) {
  .tw-header { flex-wrap: wrap; gap: 8px; }
  .tw-title { order: 0; }
  .tw-search { order: 1; width: 65%; }
  .tw-metrics { order: 2; flex-basis: 100%; }
  .tw-metrics > div:first-child { border: 0; padding-left: 0; }
  .tw-metrics dd { font-size: 13px; }
  .tw-legend { gap: 6px; }
  .tw-legend > span { gap: 2px; }
  .tw-footer { padding: 5px 8px; font-size: 8px; }
  .tw-root { --tw-gutter: 60px; --tw-label-width: 55%; }
  .tw-toolbar { flex-wrap: wrap; }
  .tw-label-name { max-width: 86px; }
  .tw-popover { width: min(330px, calc(100% - 16px)); }
}
`;

// src/client/TraceView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function Metrics({ model, now, t, usage }) {
  const tokens = usage ? usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens : model.metrics.tokens;
  const cache = usage ? cacheRate({ inputTokens: usage.uncachedInputTokens, ...usage }) : model.metrics.cacheRate;
  const values = [
    ["duration", compactDuration(model.spans.length ? Math.max(model.end, model.running ? now : model.end) - model.start : 0)],
    ["tokens", compactTokens(tokens)],
    ["llmCalls", model.metrics.llm],
    ["toolCalls", model.metrics.tools],
    ["errors", model.metrics.errors]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dl", { className: "tw-metrics", children: values.map(([key, value]) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      "data-error": key === "errors" && model.metrics.errors > 0 || void 0,
      title: key === "tokens" ? `${tokens?.toLocaleString() ?? "\u2014"} \xB7 ${t(usage ? "sessionUsage" : "loaded")}` : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: t(key) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dd", { children: [
          value,
          key === "tokens" && cache !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: t("cacheRate", { value: (cache * 100).toFixed(1) }) })
        ] })
      ]
    },
    key
  )) });
}
function TraceView({ useTrajectory, useSession, useProjection, loadOlder, loadImage, t, viewRequest, completeViewRequest }) {
  const snapshot = useTrajectory((value) => value);
  const model = (0, import_react3.useMemo)(() => buildTrace(snapshot), [snapshot]);
  const usage = useProjection?.("tokenUsage");
  const hasMore = useSession((value) => value.hasMore);
  const loading = useSession((value) => value.openState === "loading" || value.loadingOlder);
  const openError = useSession((value) => value.openError);
  const [query, setQuery] = (0, import_react3.useState)(""), [errorsOnly, setErrorsOnly] = (0, import_react3.useState)(false);
  const [collapsed, setCollapsed] = (0, import_react3.useState)(/* @__PURE__ */ new Set());
  const [selection, setSelection] = (0, import_react3.useState)(null);
  const [mode, setMode] = (0, import_react3.useState)("popover");
  const [anchor, setAnchor] = (0, import_react3.useState)({ left: 0, top: 0, bottom: 360 });
  const [dismissedRequest, setDismissedRequest] = (0, import_react3.useState)(null);
  const [range, setRange] = (0, import_react3.useState)(null);
  const [scrollTarget, setScrollTarget] = (0, import_react3.useState)(null);
  const [labelWidth, setLabelWidth] = (0, import_react3.useState)(null);
  const [scrollTop, setScrollTop] = (0, import_react3.useState)(0), [height, setHeight] = (0, import_react3.useState)(600);
  const [trackWidth, setTrackWidth] = (0, import_react3.useState)(600);
  const [now, setNow] = (0, import_react3.useState)(Date.now);
  const [historyError, setHistoryError] = (0, import_react3.useState)(null);
  const search = (0, import_react3.useRef)(null), scroller = (0, import_react3.useRef)(null), root = (0, import_react3.useRef)(null);
  const tickTrack = (0, import_react3.useRef)(null);
  const resize = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    if (!model.running) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [model.running]);
  (0, import_react3.useEffect)(() => {
    if (!scroller.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === scroller.current) setHeight(entry.contentRect.height);
        if (entry.target === tickTrack.current) setTrackWidth(Math.max(1, entry.contentRect.width));
      }
    });
    observer.observe(scroller.current);
    if (tickTrack.current) observer.observe(tickTrack.current);
    return () => observer.disconnect();
  }, []);
  const requestedId = viewRequest?.view === "trajectory" ? `tool:${viewRequest.focus}` : null;
  const focusId = requestedId && viewRequest !== dismissedRequest && model.byId.has(requestedId) ? requestedId : null;
  const selected = model.byId.get(focusId ?? selection ?? "");
  const detail = !!selected && (focusId !== null || mode === "detail");
  const rows = (0, import_react3.useMemo)(() => visibleRows(model, collapsed, query, errorsOnly, t), [model, collapsed, query, errorsOnly, t]);
  (0, import_react3.useEffect)(() => {
    if (!scrollTarget || !scroller.current) return;
    const index = rows.findIndex((row) => row.span.id === scrollTarget);
    if (index >= 0) {
      scroller.current.scrollTop = index * ROW_HEIGHT;
      setScrollTop(index * ROW_HEIGHT);
    }
    setScrollTarget(null);
  }, [rows, scrollTarget]);
  const axis = (0, import_react3.useMemo)(() => createTimeAxis(model, now), [model, now]);
  const window = range ? clampWindow({ from: axis.project(range.from), to: axis.project(range.to) }, axis.length) : { from: 0, to: axis.length };
  const zoom = axis.length / (window.to - window.from);
  const segmentMap = (0, import_react3.useMemo)(() => {
    const descendants = (span) => (model.children.get(span.id) ?? []).flatMap((child) => [child, ...descendants(child)]);
    return new Map(model.spans.map((span) => [span.id, model.children.has(span.id) ? compositeSegments(span, descendants(span), now) : leafSegments(span, now)]));
  }, [model, now]);
  const visibleCount = Math.ceil(height / ROW_HEIGHT) + 16;
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
  const startRow = Math.min(Math.max(0, rows.length - visibleCount), Math.max(0, firstVisible - 8));
  const rendered = rows.slice(startRow, startRow + visibleCount);
  const current = rows[Math.min(rows.length - 1, firstVisible)];
  const stickyIndex = current?.span.turn === void 0 ? -1 : rows.findIndex((row) => row.span.id === `turn:${current.span.turn}`);
  const sticky = stickyIndex >= 0 && stickyIndex < firstVisible ? rows[stickyIndex] : void 0;
  const branches = [...model.children.keys()];
  const allCollapsed = branches.length > 0 && branches.every((key) => collapsed.has(key));
  function resetScroll() {
    if (scroller.current) scroller.current.scrollTop = 0;
    setScrollTop(0);
  }
  function closeDetails() {
    setSelection(null);
    setDismissedRequest(viewRequest);
    if (requestedId) completeViewRequest();
  }
  function changeWindow(value) {
    const clamped = clampWindow(value, axis.length);
    setRange({ from: axis.unproject(clamped.from), to: axis.unproject(clamped.to) });
  }
  function focus(span) {
    changeWindow(focusSpan(axis, span, now));
    setCollapsed((previous) => {
      const next = new Set(previous);
      next.delete(span.id);
      return next;
    });
    setScrollTarget(span.id);
  }
  function zoomBy(factor) {
    const center = selected ? axis.project(((selected.start ?? selected.anchor) + (selected.end ?? now)) / 2) : void 0;
    changeWindow(zoomWindow(window, factor, axis.length, center));
  }
  function inspect(event, span) {
    const parent = root.current?.getBoundingClientRect(), target = event.currentTarget.getBoundingClientRect();
    if (parent) {
      const x = event.currentTarget.classList.contains("tw-track") && event.detail > 0 ? event.clientX : target.right;
      const top = target.bottom - parent.top + 7;
      const usableHeight = parent.height - parseFloat(getComputedStyle(root.current).paddingBottom || "0");
      const available = usableHeight - top - 10;
      setAnchor({
        left: Math.max(8, Math.min(parent.width - 338, x - parent.left - 80)),
        top: available > 280 ? top : Math.max(54, target.top - parent.top - 300),
        bottom: Math.max(260, Math.min(380, parent.height - 65))
      });
    }
    setSelection(span.id);
    setMode("popover");
    setDismissedRequest(viewRequest);
    if (focusId) completeViewRequest();
  }
  (0, import_react3.useEffect)(() => {
    if (!selected || detail) return;
    const dismiss = (event) => {
      if (event.target instanceof Element && !event.target.closest(".tw-popover, .tw-label-button, .tw-track")) setSelection(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [selected, detail]);
  const renderRow = (row, index, isSticky = false) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    TraceRowView,
    {
      row,
      index,
      axis,
      window,
      segments: segmentMap.get(row.span.id) ?? [],
      trackWidth,
      now,
      t,
      query,
      selected: selected?.id === row.span.id,
      sticky: isSticky,
      expanded: query.trim() !== "" || errorsOnly || !collapsed.has(row.span.id),
      inspect,
      focus: () => focus(row.span),
      collapse: () => setCollapsed((previous) => {
        const next = new Set(previous);
        if (next.has(row.span.id)) next.delete(row.span.id);
        else next.add(row.span.id);
        return next;
      })
    },
    row.span.id
  );
  const gaps = visibleGaps(axis, window);
  const tickOrigin = range ? axis.unproject(window.from) : model.start;
  const ticks = timelineTicks(axis, window, tickOrigin, trackWidth);
  const shortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd F" : "Ctrl F";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "section",
    {
      className: "tw-root",
      ref: root,
      "data-conversation-composer-overlay": "",
      "aria-label": t("timeline"),
      style: labelWidth === null ? void 0 : { "--tw-label-width": `${labelWidth}px` },
      onKeyDown: (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
          event.preventDefault();
          search.current?.focus();
        }
        if (event.key === "Escape") {
          if (selected) closeDetails();
          else {
            setQuery("");
            setErrorsOnly(false);
            resetScroll();
          }
        }
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("style", { children: waterfall_default }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "tw-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-heading", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("title") }),
              model.running && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tw-live", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
                t("live")
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "tw-search", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TraceIcon, { name: "search" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "input",
                {
                  ref: search,
                  type: "search",
                  value: query,
                  "aria-label": t("search"),
                  "aria-keyshortcuts": "Meta+F Control+F",
                  placeholder: t("search"),
                  onChange: (event) => {
                    setQuery(event.target.value);
                    setRange(null);
                    resetScroll();
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("kbd", { children: shortcut })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Metrics, { model, now, usage, t })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-filters", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { "aria-pressed": !errorsOnly, onClick: () => {
              setErrorsOnly(false);
              resetScroll();
            }, children: t("all") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { "aria-pressed": errorsOnly, onClick: () => {
              setErrorsOnly(true);
              setRange(null);
              resetScroll();
            }, children: [
              t("onlyErrors"),
              model.metrics.errors > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: model.metrics.errors })
            ] })
          ] }),
          hasMore && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { className: "tw-load", disabled: loading, onClick: async () => {
            setHistoryError(null);
            try {
              await loadOlder();
            } catch (error) {
              setHistoryError(error instanceof Error ? error.message : String(error));
            }
          }, children: t(loading ? "loading" : "loadOlder") }),
          range && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tw-range-label", children: t("rangeStart", { time: new Date(tickOrigin).toLocaleTimeString() }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-controls", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => {
              setCollapsed(allCollapsed ? /* @__PURE__ */ new Set() : new Set(branches));
              resetScroll();
            }, disabled: !branches.length, children: t(allCollapsed ? "expandAll" : "collapseAll") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tw-divider" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { "aria-label": t("zoomOut"), title: t("zoomOut"), disabled: zoom <= 1.001, onClick: () => zoomBy(0.5), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TraceIcon, { name: "minus" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { onClick: () => setRange(null), title: t("fit"), children: [
              zoom < 1.01 ? "1" : zoom.toFixed(1),
              "\xD7"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { "aria-label": t("zoomIn"), title: t("zoomIn"), onClick: () => zoomBy(2), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TraceIcon, { name: "plus" }) })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Overview, { model, axis, window, change: changeWindow, reset: () => setRange(null), t, now }),
        (openError || historyError) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { role: "alert", className: "tw-history-error", children: t("historyError", { reason: openError?.message ?? historyError ?? "" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-chart", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-scroll", ref: scroller, onScroll: (event) => {
              setScrollTop(event.currentTarget.scrollTop);
              if (mode === "popover") setSelection(null);
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-axis", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-axis-label", children: [
                  t("steps"),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: rows.length }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      className: "tw-resizer",
                      role: "separator",
                      tabIndex: 0,
                      "aria-orientation": "vertical",
                      "aria-label": t("resizeLabels"),
                      "aria-valuenow": labelWidth ?? 560,
                      onKeyDown: (event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                          event.preventDefault();
                          setLabelWidth((value) => Math.max(260, Math.min((root.current?.clientWidth ?? 1e3) - 230, (value ?? 560) + (event.key === "ArrowLeft" ? -24 : 24))));
                        }
                      },
                      onPointerDown: (event) => {
                        event.currentTarget.setPointerCapture?.(event.pointerId);
                        resize.current = { x: event.clientX, width: event.currentTarget.parentElement.getBoundingClientRect().width };
                      },
                      onPointerMove: (event) => {
                        if (resize.current) setLabelWidth(Math.max(260, Math.min((root.current?.clientWidth ?? 1e3) - 230, resize.current.width + event.clientX - resize.current.x)));
                      },
                      onPointerUp: () => {
                        resize.current = null;
                      },
                      onPointerCancel: () => {
                        resize.current = null;
                      }
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-ticks", ref: tickTrack, children: [
                  ticks.map((tick) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { left: `${tick.left}%` }, children: tick.label }, tick.left)),
                  gaps.map((gap) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("em", { className: "tw-break-label", style: { left: `${((gap.from + gap.to) / 2 - window.from) / (window.to - window.from) * 100}%` }, title: new Date(gap.start).toLocaleString() + " \u2192 " + new Date(gap.end).toLocaleString(), children: [
                    "\u22EF ",
                    t("idle", { duration: compactDuration(gap.end - gap.start) })
                  ] }, gap.start))
                ] })
              ] }),
              sticky && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tw-sticky", style: { top: AXIS_HEIGHT }, children: renderRow(sticky, stickyIndex, true) }),
              !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tw-empty", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: t(model.spans.length ? "noMatches" : "empty") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t(loading ? "loading" : model.spans.length ? "noMatchesHint" : "emptyHint") }),
                (query || errorsOnly) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => {
                  setQuery("");
                  setErrorsOnly(false);
                  resetScroll();
                }, children: t("clear") })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { role: "list", "aria-label": t("steps"), className: "tw-rows", style: { height: rows.length * ROW_HEIGHT }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tw-gridlines", children: ticks.map((tick) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { style: { left: `${tick.left}%` } }, tick.left)) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tw-breaks", children: gaps.map((gap) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { style: { left: `${((gap.from + gap.to) / 2 - window.from) / (window.to - window.from) * 100}%` } }, gap.start)) }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Handoffs, { rows, axis, window, start: startRow, end: startRow + visibleCount }),
                rendered.map((row, i) => renderRow(row, startRow + i))
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("footer", { className: "tw-footer", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("shown", { shown: rows.length, total: model.spans.length }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tw-legend", "aria-label": t("legend"), children: ["llm", "tool", "waiting", "nested", "error"].map((kind) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { "data-activity": kind, children: kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TraceIcon, { name: "close" }) }),
                t(kind === "error" ? "failed" : kind)
              ] }, kind)) })
            ] })
          ] }),
          selected && detail && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SpanDetails, { span: selected, origin: tickOrigin, now, t, close: closeDetails, loadImage }, selected.id)
        ] }),
        selected && !detail && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SpanPopover, { span: selected, origin: tickOrigin, now, t, close: closeDetails, loadImage, anchor, fullDetails: () => setMode("detail") }, selected.id)
      ]
    }
  );
}

// src/client/index.ts
var inject = ["slots", "sessions", "uiSession", "uiConversation", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "trace-waterfall: dictionaries");
  const sources = /* @__PURE__ */ new WeakMap();
  registerTrajectoryMessageDefinitions(ctx);
  registerTrajectoryRequestHeaderDefinition(ctx);
  registerTrajectoryAssistantDefinition(ctx);
  registerTrajectoryToolDefinition(ctx);
  registerTrajectoryCompactionDefinitions(ctx);
  registerTrajectoryConversationView(ctx);
  ctx.uiSession.provide({
    hooks: ["trajectory"],
    resolve(binding) {
      let source = sources.get(binding);
      if (!source) {
        const target = ctx.uiConversation.binding(binding).target("trajectory");
        source = {
          getSnapshot: () => target.getSnapshot() ?? EMPTY_TRAJECTORY_SNAPSHOT,
          subscribe: (listener) => target.subscribe(listener)
        };
        sources.set(binding, source);
      }
      return { hooks: { trajectory: source } };
    }
  });
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "trajectory",
    order: 10,
    locale: NS,
    label: () => t("title"),
    inject: (sessionId) => ({
      loadImage: Object.assign(
        (attachment) => ctx.uiConversation.imageUrl(sessionId, attachment),
        { peek: (attachment) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }
      ),
      loadOlder: async () => {
        const session = ctx.sessions.binding(sessionId)?.session;
        if (!session) throw new Error("Session is no longer available");
        await session.loadOlder();
      }
    })
  }, TraceView));
}

return module.exports;
} });
