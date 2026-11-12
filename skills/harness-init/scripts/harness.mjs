#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/adapters/harness.ts
import fs2 from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID as randomUUID2 } from "node:crypto";

// node_modules/smol-toml/dist/error.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function getLineColFromPtr(string, ptr) {
  let lines = string.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
  let lines = string.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class _TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new _TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
};

// node_modules/smol-toml/dist/primitive.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state2 = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state2 = state2 && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state2 || state2 === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state2) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state2) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state2 = 1;
      }
    } else if (state2 === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state2 = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state2 = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state2 = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state2 === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state2 = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}

// node_modules/smol-toml/dist/date.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match = date.match(DATE_TIME_RE);
        if (match) {
          if (!match[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match[2] && +match[2] > 23) {
            date = "";
          } else {
            offset = match[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/smol-toml/dist/extract.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function isDigit(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state2 = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state2 = 2;
    else if (c === 101 || c === 69)
      state2 = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state2)
      state2 = 1;
    if (c === 95) {
      if (!(state2 & 1))
        TomlError.x("illegal underscore", ctx);
      state2 += 11;
      hasUnderscores = true;
    } else if (state2 === 1 && c === 46)
      state2 = 2;
    else if ((state2 === 1 || state2 === 3) && (c === 101 || c === 69))
      state2 = 4;
    else if (state2 === 4 && (c === 43 || c === 45)) {
      state2 = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state2 > 9)
      state2 -= 11;
    else if (!(state2 & 1))
      state2++;
  }
  if (!state2) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state2 & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str = str.replaceAll("_", "");
  return state2 > 1 ? parseFloat(str) : parseInteger(ctx, str, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str = str.replaceAll("_", "");
  return parseInteger(ctx, str, base, startPtr);
}
function parseInteger(ctx, str, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start2 = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start2, ctx.p);
  return readDate(ctx, t, 4, false, start2);
}
function readDate(ctx, str, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str);
      case 2:
        return Temporal.PlainDateTime.from(str);
      case 3:
        return Temporal.PlainDate.from(str);
      case 4:
        return Temporal.PlainTime.from(str);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}

// node_modules/smol-toml/dist/util.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}

// node_modules/smol-toml/dist/struct.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function parseKey(ctx, end = 61) {
  let startPtr;
  let state2 = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state2)
        TomlError.x("unexpected end of key", ctx);
      if (state2 === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state2)
        TomlError.x("illegal empty bare key", ctx);
      if (state2 === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state2 = 0;
    } else if (!state2 && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state2 = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state2 === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state2 = 2;
      }
    } else if (state2 === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state2) {
      state2 = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}

// node_modules/smol-toml/dist/parse.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
function peekTable(ctx, key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state2;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state2 = m[k]).c;
      if (type === 0 && (state2.t === 1 || state2.t === 2)) {
        return null;
      }
      if (state2.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state2 = m[k];
  if (state2.t !== type && !(type === 1 && state2.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state2.d) {
      state2.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state2.c[state2.i++] = state2 = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state2.d) {
    return null;
  }
  state2.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state2.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/smol-toml/dist/stringify.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var BARE_KEY = /^[a-z0-9-_]+$/i;
var HAS_WELLFORMED = !!"".isWellFormed;
function extendedTypeOf(obj) {
  let type = typeof obj;
  if (type === "object") {
    if (Array.isArray(obj))
      return "array";
    if (typeof obj.getUTCDate === "function" && obj instanceof Date)
      return "date";
    if (globalThis.Temporal) {
      if (obj.until) {
        if (obj instanceof Temporal.ZonedDateTime)
          return "temporal/tz+uc";
        if (obj instanceof Temporal.PlainDateTime || obj instanceof Temporal.PlainDate)
          return "temporal/uc";
        if (obj instanceof Temporal.PlainTime || obj instanceof Temporal.Instant)
          return "temporal";
        if (obj instanceof Temporal.PlainYearMonth)
          return "temporal/x";
      } else if (obj.toPlainDate && obj instanceof Temporal.PlainMonthDay || obj.negated && obj instanceof Temporal.Duration) {
        return "temporal/x";
      }
    }
  }
  return type;
}
function isArrayOfTables(obj) {
  for (let i = 0; i < obj.length; i++) {
    if (extendedTypeOf(obj[i]) !== "object")
      return false;
  }
  return obj.length != 0;
}
function formatWellFormedStringUnchecked(s) {
  return JSON.stringify(s).replaceAll("", "\\u007f");
}
function formatString(s) {
  return formatWellFormedStringUnchecked(HAS_WELLFORMED ? s.toWellFormed() : s);
}
function formatKey(s) {
  if (BARE_KEY.test(s))
    return s;
  if (HAS_WELLFORMED && !s.isWellFormed())
    throw new RangeError("key contains illegal lone surrogates");
  return formatWellFormedStringUnchecked(s);
}
function stringifyValue(val, type, depth, numberAsFloat, strictTemporal) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  switch (type) {
    // @ts-expect-error -- intentional fallthrough case
    case "number":
      if (isNaN(val))
        return "nan";
      if (val === Infinity)
        return "inf";
      if (val === -Infinity)
        return "-inf";
      if (Number.isInteger(val) && (numberAsFloat || !Number.isSafeInteger(val)))
        return val.toFixed(1);
    case "bigint":
    case "boolean":
    case "temporal":
      return val.toString();
    case "string":
      return formatString(val);
    case "date":
      if (isNaN(val.getTime()))
        throw new TypeError("cannot serialize invalid date");
      return val.toISOString();
    case "object":
      return stringifyInlineTable(val, depth, numberAsFloat, strictTemporal);
    case "array":
      return stringifyArray(val, depth, numberAsFloat, strictTemporal);
    // @ts-expect-error -- intentional fallthrough case
    case "temporal/tz+uc":
      if (strictTemporal) {
        let tz = val.timeZoneId;
        let tzc = tz.charCodeAt(0);
        if (
          // Classic offset
          tzc !== 43 && tzc !== 45 && // Fast pre-check pass; see below for the actually accepted values
          (tzc !== 85 && tzc !== 71 && tzc !== 90 && tzc !== 69 || // UTC and its aliases; Temporal implementations don't all canonicalise unfortunately
          tz !== "UTC" && tz !== "UCT" && tz !== "Universal" && tz !== "Zulu" && // GMT is a TZ but it's for all intents and purposes equivalent to UTC. Safe to downgrade.
          !tz.startsWith("GMT") && tz !== "Greenwich" && // Etc/* are all safe to downgrade to offset (either UTC, GMT, or offset)
          !tz.startsWith("Etc/"))
        ) {
          throw new TypeError("Temporal objects with an IANA timezone are not allowed in Temporal strict mode");
        }
      }
    case "temporal/uc":
      if (strictTemporal && val.calendarId !== "iso8601")
        throw new TypeError("Temporal objects with a non-default calendar are not allowed in Temporal strict mode");
      return val.toString({
        calendarName: "never",
        timeZoneName: "never"
      });
    case "temporal/x":
      throw new TypeError("Unsupported " + val[Symbol.toStringTag]);
  }
}
function stringifyInlineTable(obj, depth, numberAsFloat, strictTemporal) {
  let keys = Object.keys(obj);
  if (keys.length === 0)
    return "{}";
  let res = "{ ";
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    if (i)
      res += ", ";
    res += formatKey(k) + " = " + stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat, strictTemporal);
  }
  return res + " }";
}
function stringifyArray(array, depth, numberAsFloat, strictTemporal) {
  if (array.length === 0)
    return "[]";
  let res = "[ ";
  for (let i = 0; i < array.length; i++) {
    if (i)
      res += ", ";
    if (array[i] === null || array[i] === void 0) {
      throw new TypeError("arrays cannot contain null or undefined values");
    }
    res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat, strictTemporal);
  }
  return res + " ]";
}
function stringifyArrayTable(array, key, depth, numberAsFloat, strictTemporal) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  let res = "";
  for (let i = 0; i < array.length; i++) {
    res += `${res && "\n"}[[${key}]]
`;
    res += stringifyTable(0, array[i], key, depth, numberAsFloat, strictTemporal);
  }
  return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat, strictTemporal) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  let preamble = "";
  let tables = "";
  let keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    if (obj[k] !== null && obj[k] !== void 0) {
      let type = extendedTypeOf(obj[k]);
      if (type === "symbol" || type === "function") {
        throw new TypeError(`cannot serialize values of type '${type}'`);
      }
      let key = formatKey(k);
      if (type === "array" && isArrayOfTables(obj[k])) {
        tables += (tables && "\n") + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat, strictTemporal);
      } else if (type === "object") {
        let tblKey = prefix ? `${prefix}.${key}` : key;
        tables += (tables && "\n") + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat, strictTemporal);
      } else {
        preamble += key;
        preamble += " = ";
        preamble += stringifyValue(obj[k], type, depth, numberAsFloat, strictTemporal);
        preamble += "\n";
      }
    }
  }
  if (tableKey && (preamble || !tables))
    preamble = preamble ? `[${tableKey}]
${preamble}` : `[${tableKey}]`;
  return preamble && tables ? `${preamble}
${tables}` : preamble || tables;
}
function stringify(obj, { maxDepth = 1e3, numbersAsFloat = false, strictTemporal = false } = {}) {
  if (extendedTypeOf(obj) !== "object") {
    throw new TypeError("stringify can only be called with an object");
  }
  let str = stringifyTable(0, obj, "", maxDepth, numbersAsFloat, strictTemporal);
  if (str[str.length - 1] !== "\n")
    return str + "\n";
  return str;
}

// node_modules/smol-toml/dist/index.js
/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// src/core/json.ts
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sorted(item)]));
  }
  return value;
}
function equal(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}
function json(value) {
  return JSON.stringify(sorted(value), null, 2) + "\n";
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fullMatch(pattern, value) {
  return pattern.exec(value)?.[0] === value;
}

// src/core/evidence.ts
var ARTIFACTS = ["git_commit", "oci_manifest_digest", "oci_index_digest", "package_version", "runtime_revision"];
var EvidenceError = class extends Error {
  name = "EvidenceError";
};
function requireEvidence(condition, message) {
  if (!condition) throw new EvidenceError(message);
}
function object(value, name, required2, optional = []) {
  requireEvidence(isObject(value), `${name} must be an object`);
  requireEvidence(required2.every((key) => Object.hasOwn(value, key)), `${name} is missing required fields`);
  requireEvidence(Object.keys(value).every((key) => [...required2, ...optional].includes(key)), `${name} has unknown fields`);
}
function text(value, name) {
  requireEvidence(
    typeof value === "string" && value.trim() && [...value].length <= 2e3,
    `${name} must be nonempty text (at most 2000 characters)`
  );
}
function identifier(value, name) {
  requireEvidence(typeof value === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid ${name}`);
}
function timestamp(value) {
  text(value, "timestamp");
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireEvidence(match && match[0] === value, "Timestamp must be an ISO 8601 datetime with a timezone");
  const [, y, m, d, h, min, s, fraction = "", zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireEvidence(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && Number(h) < 24 && Number(min) < 60 && Number(s) < 60 && (zone === "Z" || Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60), "Invalid timestamp");
  const milliseconds = Date.parse(`${y}-${m}-${d}T${h}:${min}:${s}${zone}`) + Number(`0.${fraction || "0"}`) * 1e3;
  requireEvidence(Number.isFinite(milliseconds), "Invalid timestamp");
  return milliseconds;
}
function validateTarget(value) {
  object(value, "target", ["environment", "identity"]);
  for (const [key, item] of Object.entries(value)) text(item, `target.${key}`);
}
function validateArtifact(value) {
  object(value, "artifact", ["kind", "value"], ["platform"]);
  requireEvidence(typeof value.kind === "string" && ARTIFACTS.includes(value.kind), "Unsupported artifact identity kind; mutable tags are not evidence");
  text(value.value, "artifact.value");
  if ("platform" in value) text(value.platform, "artifact.platform");
  if (value.kind === "git_commit") requireEvidence(fullMatch(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, value.value), "git_commit requires a full lowercase SHA");
  else if (value.kind.startsWith("oci_")) requireEvidence(fullMatch(/^sha256:[a-f0-9]{64}$/, value.value), "OCI identities require a sha256 digest");
  else requireEvidence(!["latest", "main", "master", "head", "unknown"].includes(value.value.toLowerCase()) && !/[\s*^~<>=]/.test(value.value), "Artifact must be an exact resolved version or revision");
}
function validateRefs(values) {
  requireEvidence(Array.isArray(values), "Evidence references must be a list");
  for (const value of values) {
    text(value, "evidence reference");
    requireEvidence(!/[\r\n]/.test(value) && [...value].length <= 500, "Use short evidence references, not raw logs");
    if (value.includes("://")) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new EvidenceError("Invalid evidence URL");
      }
      requireEvidence(
        !url.username && !url.password && !url.search && !url.hash,
        "Evidence URLs must not contain user credentials, queries, or fragments"
      );
    }
  }
}

// src/core/verification.ts
function validateDiagnosticSpec(value, relative) {
  object(value, "verification", ["max_age_seconds", "checks"]);
  requireEvidence(Number.isSafeInteger(value.max_age_seconds) && Number(value.max_age_seconds) > 0, "max_age_seconds must be positive");
  requireEvidence(Array.isArray(value.checks), "checks must be a list");
  const ids = /* @__PURE__ */ new Set();
  for (const check of value.checks) {
    object(check, "diagnostic check", ["id", "layer", "target", "criterion"], ["artifact", "probe", "platform"]);
    identifier(check.id, "check ID");
    requireEvidence(!check.id.startsWith("harness-") && !ids.has(check.id), "Duplicate or reserved check ID");
    ids.add(check.id);
    requireEvidence(["tool", "access", "smoke", "ci"].includes(String(check.layer)), "Native agent and hook activation require session attestations, not command probes");
    validateTarget(check.target);
    text(check.criterion, "criterion");
    if ("artifact" in check) validateArtifact(check.artifact);
    if ("platform" in check) identifier(check.platform, "platform");
    if ("probe" in check) {
      requireEvidence(check.layer !== "ci", "CI execution requires an actual CI run reference");
      object(check.probe, "probe", ["argv", "timeout_seconds"], ["cwd", "member", "expect_json"]);
      requireEvidence(Array.isArray(check.probe.argv) && check.probe.argv.length > 0 && check.probe.argv.length <= 100, "Probe argv must be nonempty");
      for (const arg of check.probe.argv) requireEvidence(typeof arg === "string" && arg.length > 0 && arg.length <= 2e3 && !/[\x00-\x1f]/.test(arg), "Use literal bounded probe arguments without secrets");
      requireEvidence(Number.isSafeInteger(check.probe.timeout_seconds) && Number(check.probe.timeout_seconds) > 0 && Number(check.probe.timeout_seconds) <= 60, "Probe timeout must be between 1 and 60 seconds");
      if ("cwd" in check.probe) relative(check.probe.cwd);
      if ("member" in check.probe) identifier(check.probe.member, "probe member");
      if ("expect_json" in check.probe) requireEvidence(isObject(check.probe.expect_json) && Object.keys(check.probe.expect_json).length > 0, "expect_json must be a nonempty object");
      if (check.layer === "access" || check.layer === "smoke") requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.target, check.target), "Access and smoke probes must assert the observed target in expect_json.target");
      if (check.artifact) requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.artifact, check.artifact), "Artifact-bound probes must assert expect_json.artifact");
    }
  }
}
function validateVerificationRecord(value) {
  object(value, "verification record", ["schema_version", "observations"]);
  requireEvidence(value.schema_version === 1, "Expected verification schema_version 1");
  requireEvidence(Array.isArray(value.observations), "observations must be a list");
  const attempts = /* @__PURE__ */ new Set();
  for (const item of value.observations) {
    object(item, "verification observation", ["check", "attempt", "binding", "status", "target", "observed_at", "summary", "evidence", "method"], ["artifact"]);
    identifier(item.check, "observation check");
    requireEvidence(Number.isSafeInteger(item.attempt) && Number(item.attempt) > 0, "attempt must be positive");
    requireEvidence(typeof item.binding === "string" && fullMatch(/^[a-f0-9]{64}$/, item.binding), "Observation needs its exact configuration binding");
    requireEvidence(["passed", "failed", "pending", "not run"].includes(String(item.status)), "Invalid observation status");
    requireEvidence(["attestation", "probe"].includes(String(item.method)), "Invalid observation method");
    validateTarget(item.target);
    timestamp(item.observed_at);
    text(item.summary, "summary");
    validateRefs(item.evidence);
    if ("artifact" in item) validateArtifact(item.artifact);
    const key = `${item.check}/${item.attempt}`;
    requireEvidence(!attempts.has(key), "Repeated observation attempt");
    attempts.add(key);
  }
}
function evaluateVerification(checks, record, binding, maxAge, at) {
  validateVerificationRecord(record);
  const now = timestamp(at);
  requireEvidence(Array.isArray(checks) && checks.length > 0 && new Set(checks.map((check) => check.id)).size === checks.length, "Verification requires unique nonempty checks");
  requireEvidence(typeof binding === "string" && fullMatch(/^[a-f0-9]{64}$/, binding), "Invalid verification binding");
  requireEvidence(Number.isSafeInteger(maxAge) && maxAge > 0, "Invalid verification age limit");
  for (const check of checks) {
    identifier(check.id, "check ID");
    text(check.layer, "layer");
    text(check.criterion, "criterion");
    validateTarget(check.target);
    if (check.artifact) validateArtifact(check.artifact);
  }
  const ids = new Set(checks.map((check) => check.id));
  for (const observation of record.observations) requireEvidence(ids.has(observation.check), `Unknown verification check: ${observation.check}`);
  const rows = checks.map((check) => {
    const history = record.observations.filter((item) => item.check === check.id).sort((a, b) => a.attempt - b.attempt).map((item) => {
      let status2 = item.status === "failed" ? "failed" : item.status === "passed" ? "passed" : "pending";
      let reason = item.summary;
      const age = now - timestamp(item.observed_at);
      if (!equal(item.target, check.target)) {
        status2 = "failed";
        reason = "Observed target differs from the required target";
      } else if (item.binding !== binding) {
        status2 = "pending";
        reason = "Observation belongs to another configuration or checkout";
      } else if (age < 0 || age > maxAge * 1e3) {
        status2 = "pending";
        reason = "Observation is stale or future-dated";
      } else if (status2 === "passed" && !item.evidence.length) {
        status2 = "pending";
        reason = "A passing observation needs evidence references";
      } else if (status2 === "passed" && check.artifact && !equal(item.artifact, check.artifact)) {
        status2 = item.artifact && item.artifact.kind === check.artifact.kind && item.artifact.platform === check.artifact.platform ? "failed" : "pending";
        reason = "Tested artifact does not establish the required artifact identity";
      }
      if ((check.layer === "agent" || check.layer === "hook") && item.method !== "attestation") {
        status2 = "pending";
        reason = "Direct script execution does not establish native host activation";
      }
      return { ...item, status: status2, reason };
    });
    for (let i = 1; i < history.length; i++) requireEvidence(timestamp(history[i].observed_at) >= timestamp(history[i - 1].observed_at), "Retry times must not move backwards");
    const latest = history.at(-1);
    return { ...check, status: latest?.status ?? "pending", reason: latest?.reason ?? "No observation", recovered: latest?.status === "passed" && history.slice(0, -1).some((item) => item.status === "failed"), history };
  });
  const status = rows.some((row) => row.status === "failed") ? "failed" : rows.some((row) => row.status === "pending") ? "pending" : "passed";
  return { schema_version: 1, binding, evaluated_at: at, status, checks: rows };
}
function matchesJson(actual, expected) {
  if (isObject(expected)) return isObject(actual) && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && matchesJson(actual[key], value));
  return equal(actual, expected);
}

// src/core/documentation.ts
var DOCUMENT_TOPICS = ["index", "development", "testing", "environments", "release", "operations", "toolchain"];
function requiredDocumentTopics(profile) {
  if (!isObject(profile) || !isObject(profile.harness) || !isObject(profile.harness.artifacts) || profile.harness.artifacts.documents !== true) return [];
  const activities = isObject(profile.activities) ? profile.activities : {};
  const root = isObject(profile.documentation) && typeof profile.documentation.root === "string" ? profile.documentation.root : profile.harness.layout === "centralized" ? ".harness/docs" : "docs/harness";
  const topics = ["index"];
  if (activities.development === true) topics.push("development");
  if (activities.testing === true) topics.push("testing");
  if (activities.deployment === true || activities.operations === true) topics.push("environments");
  if (activities.deployment === true) topics.push("release");
  if (activities.operations === true) topics.push("operations");
  if (["development", "testing", "deployment", "operations"].some((activity) => activities[activity] === true)) topics.push("toolchain");
  return topics.map((topic) => ({ topic, path: `${root}/${topic}.md` }));
}

// src/core/harness.ts
var HARNESS_TARGETS = ["codex", "claude-code"];
var HARNESS_PARTS = ["documents", "skills", "commands", "agents", "rules", "settings", "hooks", "ci"];
var HarnessError = class extends Error {
  name = "HarnessError";
};
function requireHarness(condition, message) {
  if (!condition) throw new HarnessError(message);
}
function shape(value, name, fields) {
  requireHarness(isObject(value), `${name} must be an object`);
  requireHarness(Object.keys(value).every((key) => fields.includes(key)), `${name} has unknown fields`);
}
function text2(value, name) {
  requireHarness(typeof value === "string" && value.trim() && value.length <= 1e5 && !value.includes("\0"), `${name} must be nonempty text (at most 100000 characters)`);
}
function identifier2(value) {
  requireHarness(typeof value === "string" && value.length <= 64 && fullMatch(/^[a-z][a-z0-9-]*$/, value), "Names must be lowercase hyphenated identifiers of at most 64 characters");
}
function harnessPath(value) {
  requireHarness(typeof value === "string" && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split("/").every((part) => part && part !== "." && part !== ".."), "Expected a normalized relative harness path");
  requireHarness(!value.split("/").some((part) => [".git", "node_modules"].includes(part)), "Harness paths cannot address Git metadata or dependencies");
}
function list(value, name) {
  requireHarness(Array.isArray(value), `${name} must be a list`);
}
function unique(values, name) {
  requireHarness(new Set(values).size === values.length, `${name} contains duplicates`);
}
function targets(value) {
  list(value, "targets");
  requireHarness(value.length && value.every((item) => HARNESS_TARGETS.includes(item)), "Select codex, claude-code, or both");
  unique(value, "targets");
}
function resources(value) {
  list(value, "resources");
  for (const item of value) {
    shape(item, "resource", ["path", "body", "executable"]);
    harnessPath(item.path);
    text2(item.body, "resource.body");
    if ("executable" in item) requireHarness(typeof item.executable === "boolean", "executable must be boolean");
  }
  unique(value.map((item) => item.path), "resource paths");
}
function validateHarnessSpec(value) {
  shape(value, "harness spec", ["schema_version", "name", "language", "layout", "documentation_root", "targets", "sources", ...HARNESS_PARTS, "resources", "command_checks", "document_coverage", "provenance", "projections", "verification"]);
  requireHarness(value.schema_version === 1, "Expected harness schema_version 1");
  text2(value.name, "name");
  targets(value.targets);
  if ("language" in value) requireHarness(value.language === "en" || value.language === "zh-CN", "Generated entry-point language must be en or zh-CN");
  if ("layout" in value) requireHarness(value.layout === "centralized" || value.layout === "native", "Choose centralized or native harness layout");
  if ("documentation_root" in value) {
    harnessPath(value.documentation_root);
    requireHarness(value.documentation_root !== ".harness", "Documentation cannot use the harness state root");
    if (value.layout === "centralized") requireHarness(value.documentation_root === ".harness/docs" || value.documentation_root.startsWith(".harness/docs/"), "Centralized documentation_root must be .harness/docs or a subdirectory");
    else requireHarness(!value.documentation_root.startsWith(".harness/") || value.documentation_root === ".harness/docs" || value.documentation_root.startsWith(".harness/docs/"), "Documentation cannot use reserved harness state directories");
  }
  if (value.layout === "centralized") requireHarness(!["settings", "hooks", "ci"].some((part) => part in value), "Centralized layout does not register native settings, hooks or CI; choose native layout for those integrations");
  list(value.sources, "sources");
  for (const source of value.sources) {
    shape(source, "source", ["member", "path"]);
    harnessPath(source.path);
    if ("member" in source) {
      text2(source.member, "source.member");
      requireHarness(fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), "Invalid source member");
    }
  }
  unique(value.sources.map((source) => json(source)), "sources");
  if ("verification" in value) validateDiagnosticSpec(value.verification, harnessPath);
  const sourceRef = (source) => {
    shape(source, "source reference", ["member", "path"]);
    harnessPath(source.path);
    if ("member" in source) requireHarness(typeof source.member === "string" && fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), "Invalid member reference");
  };
  if ("command_checks" in value) {
    list(value.command_checks, "command_checks");
    for (const check of value.command_checks) {
      shape(check, "command check", ["document", "command", "member", "cwd", "phase", "reason"]);
      harnessPath(check.document);
      text2(check.command, "command");
      if ("cwd" in check) harnessPath(check.cwd);
      if ("member" in check) sourceRef({ member: check.member, path: "context" });
      if ("phase" in check) requireHarness(["current", "planned"].includes(String(check.phase)), "Command phase must be current or planned");
      if ("reason" in check) text2(check.reason, "command reason");
      if (check.phase === "planned") text2(check.reason, "Planned commands require a reason");
    }
    unique(value.command_checks.map((check) => {
      const item = check;
      return json([item.document, item.command]);
    }), "command contexts");
  }
  if ("document_coverage" in value) {
    list(value.document_coverage, "document_coverage");
    for (const entry of value.document_coverage) {
      shape(entry, "document coverage", ["topic", "path", "heading"]);
      requireHarness(DOCUMENT_TOPICS.includes(entry.topic), "Unknown documentation topic");
      harnessPath(entry.path);
      if ("heading" in entry) text2(entry.heading, "coverage heading");
    }
    unique(value.document_coverage.map((entry) => entry.topic), "document coverage topics");
  }
  if ("provenance" in value) {
    list(value.provenance, "provenance");
    for (const entry of value.provenance) {
      shape(entry, "provenance entry", ["output", "sources"]);
      harnessPath(entry.output);
      list(entry.sources, "provenance sources");
      for (const source of entry.sources) {
        sourceRef(source);
        requireHarness(value.sources.some((item) => json(item) === json(source)), "Provenance must reference a declared source");
      }
      unique(entry.sources.map(json), "provenance sources");
    }
    unique(value.provenance.map((entry) => entry.output), "provenance outputs");
  }
  if ("projections" in value) {
    list(value.projections, "projections");
    for (const entry of value.projections) {
      shape(entry, "projection", ["source", "target"]);
      sourceRef(entry.source);
      sourceRef(entry.target);
      requireHarness(json(entry.source) !== json(entry.target), "A projection needs different source and target files");
      requireHarness(value.sources.some((item) => json(item) === json(entry.source)), "Projection owner must be a declared source");
    }
    unique(value.projections.map((entry) => json(entry.target)), "projection targets");
  }
  for (const kind of ["documents", "resources"]) if (kind in value) {
    resources(value[kind]);
    for (const resource of value[kind]) {
      if (kind === "documents" && value.documentation_root !== void 0) requireHarness(resource.path.startsWith(`${value.documentation_root}/`), "Generated documents must stay inside documentation_root");
      if (value.layout === "centralized") requireHarness(resource.path.startsWith(kind === "documents" ? ".harness/docs/" : ".harness/resources/"), "Centralized documents belong in .harness/docs/ and resources in .harness/resources/");
      else requireHarness(!resource.path.startsWith(".harness/") || kind === "documents" && value.documentation_root !== void 0 && resource.path.startsWith(`${value.documentation_root}/`), "The .harness directory is reserved for generated state and runtimes");
    }
  }
  for (const kind of ["skills", "commands", "agents"]) if (kind in value) {
    list(value[kind], kind);
    for (const item of value[kind]) {
      shape(item, kind, ["name", "description", "body", "resources"]);
      identifier2(item.name);
      text2(item.description, "description");
      text2(item.body, "body");
      if ("resources" in item) {
        requireHarness(kind === "skills", "Only skills can contain portable resources");
        resources(item.resources);
        requireHarness(!item.resources.some((resource) => resource.path === "SKILL.md"), "Skill resources cannot replace SKILL.md");
      }
    }
    unique(value[kind].map((item) => item.name), `${kind} names`);
  }
  unique([...value.skills ?? [], ...value.commands ?? []].map((item) => item.name), "Skill and command names");
  if ("rules" in value) {
    list(value.rules, "rules");
    for (const rule of value.rules) {
      shape(rule, "rule", ["name", "body"]);
      identifier2(rule.name);
      text2(rule.body, "rule.body");
    }
    unique(value.rules.map((rule) => rule.name), "rule names");
  }
  if ("settings" in value) {
    shape(value.settings, "settings", ["commands", "codex", "claude_code"]);
    requireHarness(value.settings.codex !== void 0 || value.settings.claude_code !== void 0 || Array.isArray(value.settings.commands) && value.settings.commands.length > 0, "Settings need a native configuration or nonempty command policies");
    if ("commands" in value.settings) {
      list(value.settings.commands, "settings.commands");
      for (const policy of value.settings.commands) {
        shape(policy, "command policy", ["prefix", "decision", "reason"]);
        list(policy.prefix, "prefix");
        requireHarness(policy.prefix.length && policy.prefix.every((part) => typeof part === "string" && fullMatch(/^[a-zA-Z0-9_./:=@+-]+$/, part)), "Command prefixes require literal tokens without whitespace or shell metacharacters");
        requireHarness(["ask", "deny"].includes(policy.decision), "Command policy must ask or deny");
        text2(policy.reason, "reason");
      }
    }
    if ("codex" in value.settings) {
      requireHarness(value.targets.includes("codex"), "Codex settings require the codex target");
      shape(value.settings.codex, "codex settings", ["sandbox_mode", "approval_policy"]);
      requireHarness(["read-only", "workspace-write"].includes(value.settings.codex.sandbox_mode), "Choose a read-only or workspace-write sandbox");
      requireHarness(["on-request", "never"].includes(value.settings.codex.approval_policy), "Unsupported approval policy");
    }
    if ("claude_code" in value.settings) {
      requireHarness(value.targets.includes("claude-code"), "Claude settings require the claude-code target");
      shape(value.settings.claude_code, "claude_code settings", ["defaultMode"]);
      requireHarness(["default", "plan", "dontAsk"].includes(value.settings.claude_code.defaultMode), "Unsupported Claude permission mode");
    }
  }
  if ("hooks" in value) {
    shape(value.hooks, "hooks", ["guards", "cases"]);
    list(value.hooks.guards, "guards");
    list(value.hooks.cases, "cases");
    requireHarness(value.hooks.guards.length > 0 && value.hooks.cases.length > 1, "Hooks need guards and positive/negative cases");
    for (const guard of value.hooks.guards) {
      shape(guard, "guard", ["id", "contains_all", "reason"]);
      identifier2(guard.id);
      text2(guard.reason, "guard.reason");
      list(guard.contains_all, "contains_all");
      requireHarness(guard.contains_all.length > 0, "A guard needs nonempty command fragments");
      for (const fragment of guard.contains_all) text2(fragment, "command fragment");
    }
    unique(value.hooks.guards.map((guard) => guard.id), "guard IDs");
    for (const example of value.hooks.cases) {
      shape(example, "hook case", ["name", "input", "expected"]);
      text2(example.name, "case.name");
      requireHarness(isObject(example.input), "Hook input must be an object");
      requireHarness(["pass", "deny"].includes(example.expected), "Hook case expects pass or deny");
    }
    const cases = value.hooks.cases, guards = value.hooks.guards;
    unique(cases.map((example) => example.name), "case names");
    requireHarness(cases.some((example) => example.expected === "pass"), "Hooks need a non-blocking case");
    for (const guard of guards) requireHarness(cases.some((example) => example.expected === "deny" && evaluateGuard([guard], example.input).guard === guard.id), `Missing blocking case for guard ${guard.id}`);
  }
  if ("ci" in value) {
    shape(value.ci, "ci", ["provider", "checks"]);
    requireHarness(value.ci.provider === "github-actions", "Currently supported CI provider: github-actions");
    list(value.ci.checks, "ci.checks");
    for (const check of value.ci.checks) {
      shape(check, "CI check", ["name", "run", "working_directory"]);
      text2(check.name, "CI check name");
      text2(check.run, "CI command");
      if ("working_directory" in check) harnessPath(check.working_directory);
    }
  }
}
function evaluateGuard(guards, input) {
  if (!isObject(input)) return { decision: "deny", reason: "Malformed hook input" };
  if (input.hook_event_name !== "PreToolUse") return { decision: "pass" };
  if (!["Bash", "exec_command", "shell_command"].includes(input.tool_name)) return { decision: "pass" };
  const args = input.tool_input;
  const command = isObject(args) ? args.command ?? args.cmd : void 0;
  if (typeof command !== "string" || command.length > 256 * 1024) return { decision: "deny", reason: "Cannot inspect this shell tool input" };
  const normalized = command.replace(/\s+/g, " ");
  const guard = guards.find((item) => item.contains_all.every((fragment) => normalized.includes(fragment.replace(/\s+/g, " "))));
  return guard ? { decision: "deny", reason: guard.reason, guard: guard.id } : { decision: "pass" };
}
function harnessDocumentRoot(spec) {
  return spec.documentation_root ?? (spec.layout === "centralized" ? ".harness/docs" : "docs/harness");
}
function harnessConfiguration(spec, artifacts) {
  const kinds = {
    documents: ["document"],
    skills: ["skill", "skill-resource"],
    commands: ["command"],
    agents: ["agent"],
    rules: ["rule"],
    settings: ["settings"],
    hooks: ["hook"],
    ci: ["ci"]
  };
  const parts = Object.fromEntries(HARNESS_PARTS.map((part) => [part, spec[part] === void 0 ? [] : artifacts.filter((file) => kinds[part].includes(file.kind) || part === "hooks" && (file.path === ".claude/settings.json" || file.path === ".harness/runtime/hook.mjs")).map((file) => file.path)]));
  return {
    layout: spec.layout ?? "native",
    discovery: spec.layout === "centralized" ? "entrypoint-routed" : "native",
    documentation_policy: { root: harnessDocumentRoot(spec), new_ai_documents: "inside-root", existing_documents: "ask-before-moving", enforcement: "agent-instructions" },
    kind: HARNESS_PARTS.some((part) => part !== "documents" && parts[part].length) ? "repository-harness" : parts.documents.length ? "documents-only" : "entrypoints-only",
    targets: spec.targets.map((target) => ({ target, entrypoint: target === "codex" ? "AGENTS.md" : "CLAUDE.md" })),
    parts
  };
}
function frontmatter(item, extra = "") {
  return `---
name: ${JSON.stringify(item.name)}
description: ${JSON.stringify(item.description)}
${extra}---

${item.body.trim()}
`;
}
function renderHarness(spec, runtimes) {
  validateHarnessSpec(spec);
  const chinese = spec.language === "zh-CN";
  const artifacts = [], routes = [];
  const add = (path6, kind, content, format = "text", executable = false) => artifacts.push({ path: path6, kind, format, content, executable });
  for (const document of spec.documents ?? []) {
    add(document.path, "document", document.body.trim() + "\n");
    routes.push(`- [${document.path}](${document.path})`);
  }
  for (const resource of spec.resources ?? []) add(resource.path, "resource", resource.body, "text", resource.executable);
  if (spec.layout === "centralized") {
    for (const skill of spec.skills ?? []) {
      const folder = `.harness/skills/${skill.name}`;
      add(`${folder}/SKILL.md`, "skill", frontmatter(skill));
      routes.push(`- ${skill.description} — [${skill.name}](${folder}/SKILL.md)`);
      for (const resource of skill.resources ?? []) add(`${folder}/${resource.path}`, "skill-resource", resource.body, "text", resource.executable);
    }
    for (const command of spec.commands ?? []) {
      const file = `.harness/commands/${command.name}.md`;
      add(file, "command", frontmatter(command));
      routes.push(chinese ? `- 按需执行「${command.description}」，阅读 [${command.name}](${file})。` : `- For ${command.description}, follow [${command.name}](${file}).`);
    }
    for (const agent of spec.agents ?? []) {
      const file = `.harness/agents/${agent.name}.md`;
      add(file, "agent", frontmatter(agent));
      routes.push(chinese ? `- 需要且允许委派时，按 [${agent.name}](${file}) 的任务说明执行：${agent.description}` : `- When delegation is appropriate and allowed, use [${agent.name}](${file}): ${agent.description}`);
    }
    for (const rule of spec.rules ?? []) {
      const file = `.harness/rules/${rule.name}.md`;
      add(file, "rule", rule.body.trim() + "\n");
      routes.push(chinese ? `- 必读规则：[${rule.name}](${file})。` : `- Required guidance: [${rule.name}](${file}).`);
    }
  }
  for (const target of spec.layout === "centralized" ? [] : spec.targets) {
    const base = target === "codex" ? ".agents" : ".claude";
    for (const skill of spec.skills ?? []) {
      const folder = `${base}/skills/${skill.name}`;
      add(`${folder}/SKILL.md`, "skill", frontmatter(skill));
      routes.push(`- ${target}: ${skill.description} — [${skill.name}](${folder}/SKILL.md)`);
      for (const resource of skill.resources ?? []) add(`${folder}/${resource.path}`, "skill-resource", resource.body, "text", resource.executable);
    }
    for (const command of spec.commands ?? []) {
      const file = target === "codex" ? `${base}/skills/${command.name}/SKILL.md` : `${base}/commands/${command.name}.md`;
      add(file, "command", frontmatter(command, target === "claude-code" ? "disable-model-invocation: true\n" : ""));
      if (target === "codex") add(`${base}/skills/${command.name}/agents/openai.yaml`, "command", "policy:\n  allow_implicit_invocation: false\n");
      routes.push(chinese ? `- ${target}：调用 ${target === "codex" ? "$" : "/"}${command.name}，参见[操作步骤](${file})。` : `- ${target}: invoke ${target === "codex" ? "$" : "/"}${command.name} — [procedure](${file})`);
    }
    for (const agent of spec.agents ?? []) {
      const file = target === "codex" ? `.codex/agents/${agent.name}.toml` : `.claude/agents/${agent.name}.md`;
      const content = target === "codex" ? `name = ${JSON.stringify(agent.name)}
description = ${JSON.stringify(agent.description)}
developer_instructions = ${JSON.stringify(agent.body)}
` : frontmatter(agent);
      add(file, "agent", content);
      routes.push(chinese ? `- ${target}：任务需要时，将「${agent.description}」委派给 [${agent.name}](${file})；沿用父级权限。` : `- ${target}: delegate ${agent.description} to [${agent.name}](${file}) when the task calls for it; parent permissions apply.`);
    }
    for (const rule of spec.rules ?? []) {
      const file = target === "codex" ? `.harness/rules/${rule.name}.md` : `.claude/rules/${rule.name}.md`;
      add(file, "rule", rule.body.trim() + "\n");
      routes.push(chinese ? `- ${target} 的必读规则：在适用范围内执行操作前，阅读 [${rule.name}](${file})。` : `- Required guidance for ${target}: read [${rule.name}](${file}) before acting in its scope.`);
    }
  }
  const introduction = chinese ? "在选定的工作区中遵循已有说明，并通过现有的本地映射定位成员仓库。" : "Use the selected workspace and its existing instructions. Resolve member checkout paths through the established local mapping.";
  const verification = chinese ? "配置与本地验证参见 [harness 配置](.harness/harness.json)。修改后运行 `node .harness/runtime/check.mjs --workspace .`。检查通过不代表 Agent 已加载配置，也不代表已具备部署条件。" : "Configuration and local verification: [harness specification](.harness/harness.json). Run `node .harness/runtime/check.mjs --workspace .` after changes. A passing check does not establish agent activation or deployment readiness.";
  const routing = spec.layout === "centralized" ? chinese ? "\n\nAGENTS.md 是统一入口正文；其他宿主入口软链到它。按任务读取下列流程和规则；这些内容通过本入口使用，不注册宿主原生斜杠命令、自动发现的 Skills 或子代理。" : "\n\nAGENTS.md is the canonical entry point; other host entry points link to it. Read the relevant procedures and rules below. These are entry-point-routed instructions, not registered native commands, automatically discovered Skills or agents." : "";
  const documentRoot = harnessDocumentRoot(spec);
  const documentPolicy = chinese ? `## 文档存放规则

后续所有由 AI 新增的项目文档（包括计划、设计、分析、验证报告和交接记录）必须放在 \`${documentRoot}/\`，按主题组织并更新该目录的索引。 本仓库内的文件和工作流按用途命名，省略重复的仓库名或项目名前缀；只有需要区分组件时才加限定词。不得在仓库根目录或其他目录新增此类文档或重复副本。AGENTS.md 与宿主入口只保留规则和导航；工具要求的配置、Skill 和运行文件按各自约定存放。

发现其他位置的现有文档时，先列出原路径、拟迁入路径和需要更新的引用，询问用户选择迁入哪些文档、保留哪些文档；已有明确选择时直接沿用。未经选择不移动或删除原文，保留原位的文档通过链接引用。迁移须保留内容，检查重名、修复相对链接及调用方，再核对来源与文档完整性。` : `## Documentation location

All new project documentation written by AI, including plans, designs, analyses, validation reports and handoff notes, must live under \`${documentRoot}/\`. Organize it by topic and update that directory's index. Name repository-local files and workflows by purpose, without repeating the repository or product name; add a component qualifier only when needed to distinguish workflows. Do not create these documents or duplicate copies at the repository root or elsewhere. AGENTS.md and host entry points contain rules and navigation; tool-required configuration, Skills and runtime files retain their prescribed locations.

When existing documents are found elsewhere, list their current paths, proposed destinations and affected references, then ask the user which to move and which to keep. Reuse an explicit prior choice. Do not move or delete unselected originals; link to documents kept in place. For a selected move, preserve content, check collisions, repair relative links and callers, then verify sources and documentation completeness.`;
  const entry = `# ${spec.name}

${introduction}${routing}

${documentPolicy}

${routes.join("\n")}

${verification}
`;
  if (spec.targets.includes("codex") || spec.layout === "centralized") add("AGENTS.md", "entrypoint", entry, "entrypoint");
  if (spec.targets.includes("claude-code")) add("CLAUDE.md", spec.layout === "centralized" ? "entrypoint-alias" : "entrypoint", spec.layout === "centralized" ? "AGENTS.md" : entry, spec.layout === "centralized" ? "symlink" : "entrypoint");
  if (spec.targets.includes("codex") && spec.settings?.codex) add(".codex/config.toml", "settings", json(spec.settings.codex), "toml-merge");
  if (spec.targets.includes("codex") && spec.settings?.commands?.length) {
    add(".codex/rules/harness.rules", "settings", spec.settings.commands.map((policy) => `prefix_rule(pattern = ${JSON.stringify(policy.prefix)}, decision = ${JSON.stringify(policy.decision === "deny" ? "forbidden" : "prompt")}, justification = ${JSON.stringify(policy.reason)})`).join("\n") + "\n");
  }
  const hookCommand = 'node "$(git rev-parse --show-toplevel)/.harness/runtime/hook.mjs"';
  const hooks = { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: hookCommand, timeout: 10 }] }] };
  if (spec.targets.includes("codex") && spec.hooks) add(".codex/hooks.json", "hook", json({ hooks }), "json-merge");
  if (spec.targets.includes("claude-code") && (spec.settings || spec.hooks)) {
    const settings = {}, permissions = {};
    for (const decision of ["ask", "deny"]) {
      const entries = (spec.settings?.commands ?? []).filter((policy) => policy.decision === decision).flatMap((policy) => [`Bash(${policy.prefix.join(" ")})`, `Bash(${policy.prefix.join(" ")} *)`]);
      if (entries.length) permissions[decision] = entries;
    }
    if (spec.settings?.claude_code) permissions.defaultMode = spec.settings.claude_code.defaultMode;
    if (Object.keys(permissions).length) settings.permissions = permissions;
    if (spec.hooks) settings.hooks = hooks;
    add(".claude/settings.json", "settings", json(settings), "json-merge");
  }
  if (spec.ci) {
    add(".github/workflows/harness-gate.yml", "ci", json({
      name: "Harness gate",
      on: { pull_request: {}, push: {}, workflow_call: {} },
      permissions: { contents: "read" },
      jobs: { harness: { "runs-on": "ubuntu-latest", "timeout-minutes": 10, steps: [
        { uses: "actions/checkout@v7", with: { "persist-credentials": false } },
        { uses: "actions/setup-node@v7", with: { "node-version": "24", "package-manager-cache": false } },
        { name: "Validate generated harness and hook cases", run: "node .harness/runtime/check.mjs --workspace ." },
        ...spec.ci.checks.map((check) => ({ name: check.name, run: check.run, ...check.working_directory ? { "working-directory": check.working_directory } : {} }))
      ] } }
    }));
  }
  add(".harness/runtime/check.mjs", "runtime", runtimes.check, "text", true);
  if (spec.hooks) add(".harness/runtime/hook.mjs", "runtime", runtimes.hook, "text", true);
  add(".harness/runtime/THIRD-PARTY-NOTICES.txt", "runtime", runtimes.notices);
  add(".harness/harness.json", "spec", json(spec));
  unique(artifacts.map((artifact) => artifact.path), "generated paths");
  const paths = artifacts.map((artifact) => artifact.path.toLowerCase()).sort();
  unique(paths, "case-insensitive generated paths");
  const names = new Set(paths);
  for (const entry2 of spec.provenance ?? []) requireHarness(artifacts.some((item) => item.path === entry2.output), `Unknown provenance output: ${entry2.output}`);
  for (const entry2 of spec.command_checks ?? []) requireHarness(artifacts.some((item) => item.path === entry2.document), `Unknown command document: ${entry2.document}`);
  for (const entry2 of spec.document_coverage ?? []) requireHarness(spec.documents?.some((item) => item.path === entry2.path) || spec.sources.some((source) => !source.member && source.path === entry2.path), `Coverage must reference a generated document or declared local source: ${entry2.path}`);
  for (const file of paths) {
    const parts = file.split("/");
    for (let index = 1; index < parts.length; index++) requireHarness(!names.has(parts.slice(0, index).join("/")), "A generated file cannot also be a parent directory");
  }
  return artifacts;
}

// src/adapters/files.ts
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

// src/core/registry.ts
var WorkspaceError = class extends Error {
  name = "WorkspaceError";
};
function requireWorkspace(condition, message) {
  if (!condition) throw new WorkspaceError(message);
}
function relativePath(value) {
  requireWorkspace(typeof value === "string" && value.length > 0 && !/[\\:\0]/.test(value) && value.split("/").every((part) => part && part !== "." && part !== ".."), `Invalid relative file reference: ${String(value)}`);
  return value;
}

// src/adapters/files.ts
function stat(file, follow = true) {
  try {
    return follow ? fs.statSync(file) : fs.lstatSync(file);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return void 0;
    throw error;
  }
}
function resolvePath(file) {
  const absolute = path.resolve(file);
  try {
    return fs.realpathSync(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(resolvePath(parent), path.basename(absolute));
  }
}
function isWithin(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || !rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel);
}
function within(root, value) {
  const file = path.join(root, relativePath(value));
  if (!isWithin(resolvePath(root), resolvePath(file))) throw new WorkspaceError(`File reference escapes its directory: ${value}`);
  return file;
}
function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}
function fileHash(file) {
  return hash(fs.readFileSync(file));
}
function readJson(file, fallback) {
  if (!stat(file) && fallback !== void 0) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}
function atomicWrite(file, content, mode) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", mode);
    fs.writeFileSync(descriptor, content);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = void 0;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== void 0) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
}

// src/adapters/harness.ts
var HARNESS_RECEIPT = ".harness/generated.json";
var HARNESS_SPEC = ".harness/harness.json";
var START = "<!-- workspace-harness-kit:configuration:start -->";
var END = "<!-- workspace-harness-kit:configuration:end -->";
function currentProfileHash(root) {
  const manifest = readJson(within(root, ".harness/workspace.json"), {});
  return isObject(manifest) && manifest.onboarding ? hash(json(manifest.onboarding)) : null;
}
function sourcePath(root, source) {
  if (!source.member) return within(root, source.path);
  const manifest = readJson(within(root, ".harness/workspace.json"));
  requireHarness(isObject(manifest) && Array.isArray(manifest.members) && manifest.members.some((member) => isObject(member) && member.id === source.member), `Unregistered source member: ${source.member}`);
  const local = readJson(within(root, ".harness/workspace.local.json"));
  const bindings = isObject(local) && isObject(local.checkouts) ? local.checkouts : {};
  const binding = bindings[source.member];
  requireHarness(isObject(binding) && typeof binding.path === "string", `Missing source binding: ${source.member}`);
  return within(resolvePath(binding.path), source.path);
}
function readHarnessReceipt(root) {
  const file = within(root, HARNESS_RECEIPT);
  if (!stat(file)) return void 0;
  const receipt = readJson(file);
  requireHarness(isObject(receipt) && receipt.schema_version === 1 && Array.isArray(receipt.files) && Array.isArray(receipt.sources), "Invalid generated harness receipt");
  const paths = /* @__PURE__ */ new Set();
  for (const record of receipt.files) {
    requireHarness(isObject(record), "Invalid generated file record");
    harnessPath(record.path);
    requireHarness(!paths.has(record.path), "Repeated generated file record");
    paths.add(record.path);
    requireHarness(typeof record.sha256 === "string" && /^[a-f0-9]{64}$/.test(record.sha256), "Invalid generated hash");
    requireHarness(Array.isArray(record.logical_paths) && record.logical_paths.length > 0, "Missing logical file paths");
    for (const alias of record.logical_paths) harnessPath(alias);
    requireHarness(typeof record.executable === "boolean" && typeof record.owns_file === "boolean" && typeof record.kind === "string", "Invalid file metadata");
    if ("managed_sha256" in record) requireHarness(typeof record.managed_sha256 === "string" && /^[a-f0-9]{64}$/.test(record.managed_sha256), "Invalid managed block hash");
    if ("settings_patch" in record) requireHarness(isObject(record.settings_patch), "Invalid managed settings patch");
    if ("symlink_target" in record) requireHarness(record.symlink_target === "AGENTS.md" && record.path === "CLAUDE.md" && record.kind === "entrypoint-alias", "Invalid entry-point symlink record");
  }
  for (const source of receipt.sources) {
    requireHarness(isObject(source) && typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256), "Invalid source snapshot");
    harnessPath(source.path);
    if ("member" in source) requireHarness(typeof source.member === "string", "Invalid source member");
  }
  requireHarness(receipt.profile_sha256 === null || typeof receipt.profile_sha256 === "string" && /^[a-f0-9]{64}$/.test(receipt.profile_sha256), "Invalid initialization fingerprint");
  return receipt;
}
function merge(existing, desired, overwrite, key = "") {
  if (existing === void 0 || equal(existing, desired)) return structuredClone(desired);
  if (Array.isArray(existing) && Array.isArray(desired)) return [...existing, ...desired.filter((item) => !existing.some((old) => equal(old, item)))];
  if (isObject(existing) && isObject(desired)) return Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(existing), ...Object.keys(desired)])].map((name) => [
    name,
    Object.hasOwn(desired, name) ? merge(existing[name], desired[name], overwrite, key ? `${key}.${name}` : name) : existing[name]
  ]));
  requireHarness(overwrite, `Existing setting differs at ${key}; review the merged value and adopt this file explicitly`);
  return structuredClone(desired);
}
function checkRetiredSettings(existing, previous, next, key = "") {
  if (Array.isArray(previous) && Array.isArray(existing)) {
    for (const value of previous) requireHarness(Array.isArray(next) && next.some((item) => equal(item, value)) || !existing.some((item) => equal(item, value)), `Retired generated setting remains at ${key}; reconcile it explicitly before refreshing`);
  } else if (isObject(previous) && isObject(existing)) {
    for (const [name, value] of Object.entries(previous)) checkRetiredSettings(existing[name], value, isObject(next) ? next[name] : void 0, key ? `${key}.${name}` : name);
  } else if (next === void 0 && existing !== void 0) requireHarness(!equal(existing, previous), `Retired generated setting remains at ${key}; reconcile it explicitly before refreshing`);
}
function managedBlock(content) {
  const first = content.indexOf(START), last = content.indexOf(END);
  if (first === -1 && last === -1) return void 0;
  requireHarness(first >= 0 && last > first && content.indexOf(START, first + START.length) === -1 && content.indexOf(END, last + END.length) === -1, "Malformed or repeated harness markers");
  return content.slice(first, last + END.length);
}
function entrypoint(existing, desired) {
  const block = `${START}
${desired.trim()}
${END}`, previous = managedBlock(existing);
  return previous ? existing.replace(previous, block) : existing + (existing && !existing.endsWith("\n") ? "\n" : "") + (existing ? "\n" : "") + block + "\n";
}
function tomlSettings(original, patch) {
  const start2 = "# workspace-harness-kit:settings:start", end = "# workspace-harness-kit:settings:end";
  const first = original.indexOf(start2), last = original.indexOf(end);
  requireHarness(first === -1 && last === -1 || first >= 0 && last > first && original.indexOf(start2, first + start2.length) === -1 && original.indexOf(end, last + end.length) === -1, "Malformed TOML settings markers");
  const block = first >= 0 ? original.slice(first, last + end.length) : "";
  const outside = block ? original.replace(block, "") : original;
  const existing = parse(outside), owned = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.hasOwn(existing, key)) requireHarness(equal(existing[key], value), `Existing setting differs at ${key}; reconcile the original key before generation`);
    else owned[key] = value;
  }
  if (!Object.keys(owned).length) return outside;
  const replacement = `${start2}
${stringify(owned).trim()}
${end}`;
  return block ? original.replace(block, replacement) : replacement + "\n" + original;
}
function runtimeFiles() {
  const folder = path2.dirname(fileURLToPath(import.meta.url));
  const support = stat(path2.join(folder, "harness-check.mjs")) ? folder : path2.resolve(folder, "../skills/harness-init/scripts");
  return { check: fs2.readFileSync(path2.join(support, "harness-check.mjs"), "utf8"), hook: fs2.readFileSync(path2.join(support, "harness-hook.mjs"), "utf8"), notices: fs2.readFileSync(path2.join(support, "THIRD-PARTY-NOTICES.txt"), "utf8") };
}
function state(root) {
  return Object.fromEntries([HARNESS_RECEIPT, ".harness/workspace.json", ".harness/workspace.local.json"].map((name) => {
    const file = within(root, name);
    return [name, stat(file) ? fileHash(file) : null];
  }));
}
function outputState(file) {
  const info = stat(file, false);
  const link = info?.isSymbolicLink() ? fs2.readlinkSync(file) : null;
  return { info, link, digest: info ? link === null ? fileHash(file) : hash(link) : null };
}
function atomicSymlink(file, target) {
  const temporary = path2.join(path2.dirname(file), `.${path2.basename(file)}.${randomUUID2()}`);
  try {
    fs2.symlinkSync(target, temporary);
    fs2.renameSync(temporary, file);
  } finally {
    fs2.rmSync(temporary, { force: true });
  }
}
function assertSelection(root, spec) {
  const manifest = readJson(within(root, ".harness/workspace.json"), {});
  const onboarding = isObject(manifest) && isObject(manifest.onboarding) ? manifest.onboarding : {};
  if (onboarding.language !== void 0) {
    const local = readJson(within(root, ".harness/workspace.local.json"), {});
    const checkouts = isObject(local) && isObject(local.checkouts) ? local.checkouts : {};
    const self = isObject(manifest) && Array.isArray(manifest.members) ? manifest.members.find((member) => {
      if (!isObject(member) || typeof member.id !== "string") return false;
      const binding = checkouts[member.id];
      return isObject(binding) && typeof binding.path === "string" && resolvePath(binding.path) === root;
    }) : void 0;
    const language = isObject(self) && typeof self.language === "string" ? self.language : onboarding.language;
    requireHarness((spec.language ?? "en") === language, "Generation language differs from the saved initialization choice");
  }
  if (isObject(onboarding.documentation) && typeof onboarding.documentation.root === "string") {
    requireHarness(harnessDocumentRoot(spec) === onboarding.documentation.root, "Generation documentation_root differs from the saved initialization choice");
  }
  if (!isObject(onboarding.harness)) return;
  const selection = onboarding.harness;
  const configuration = harnessConfiguration(spec, renderHarness(spec, { check: "", hook: "", notices: "" }));
  if (selection.layout !== void 0) requireHarness(selection.layout === (spec.layout ?? "native"), "Generation layout differs from the saved initialization choices");
  if (Array.isArray(selection.targets)) requireHarness(equal([...selection.targets].sort(), [...spec.targets].sort()), "Generation targets differ from the saved initialization choices");
  if (isObject(selection.artifacts)) for (const part of HARNESS_PARTS) {
    if (typeof selection.artifacts[part] !== "boolean") continue;
    const value = spec[part], present = Array.isArray(value) ? value.length > 0 : value !== void 0;
    requireHarness(present === selection.artifacts[part], `Generation does not match the selected ${part} scope`);
    if (present) requireHarness(configuration.parts[part].length > 0, `Selected ${part} produces no native files for the selected targets`);
  }
}
function makeHarnessPlan(root, input, options = {}, lockHeld = false) {
  validateHarnessSpec(input);
  root = resolvePath(root);
  requireHarness(stat(root)?.isDirectory(), "Harness workspace must exist");
  requireHarness(!stat(path2.join(root, ".harness"), false)?.isSymbolicLink(), "Harness state must be a regular directory");
  requireHarness(lockHeld || !stat(path2.join(root, ".harness/.generation.lock"), false), "Harness generation is locked");
  const before = state(root), old = readHarnessReceipt(root), spec = structuredClone(input), adopt = [...new Set(options.adopt ?? [])].sort();
  for (const file of adopt) harnessPath(file);
  assertSelection(root, spec);
  const sources = spec.sources.map((source) => {
    const file = sourcePath(root, source);
    requireHarness(stat(file)?.isFile(), `Source is unavailable: ${source.member ?? "workspace"}/${source.path}`);
    return { ...source, sha256: fileHash(file) };
  });
  const files = [], conflicts = [], physical = /* @__PURE__ */ new Map();
  const aliases = /* @__PURE__ */ new Map();
  for (const artifact of renderHarness(spec, runtimeFiles())) {
    const file = within(root, artifact.path);
    if (spec.layout === "centralized" && artifact.path === "AGENTS.md") requireHarness(!stat(file, false)?.isSymbolicLink(), "Centralized AGENTS.md must be a regular file; reconcile the existing entry-point alias first");
    const target = artifact.format === "symlink" ? artifact.path : path2.relative(root, resolvePath(file)).split(path2.sep).join("/");
    const previous = physical.get(target);
    requireHarness(!previous || artifact.kind === "entrypoint" && previous.kind === "entrypoint" && previous.content === artifact.content, `Generated artifacts collide at ${target}`);
    physical.set(target, artifact);
    aliases.set(target, [...aliases.get(target) ?? [], artifact.path]);
  }
  for (const file of adopt) requireHarness([...aliases].some(([target, paths]) => target === file || paths.includes(file)), `Adoption path is not a planned file: ${file}`);
  for (const source of spec.sources) {
    const relative = path2.relative(root, resolvePath(sourcePath(root, source))).split(path2.sep).join("/");
    requireHarness(!physical.has(relative), `A generated output cannot also be its own source: ${source.path}`);
  }
  for (const [target, artifact] of physical) {
    if (artifact.format === "symlink") {
      const destination2 = within(root, target), { info: info2, link, digest: digest2 } = outputState(destination2), prior2 = old?.files.find((record) => record.path === target);
      requireHarness(!info2 || info2.isFile() || info2.isSymbolicLink(), `Output is not a file or symlink: ${target}`);
      const adopted2 = adopt.includes(target), controlled2 = !!prior2?.owns_file && digest2 === prior2.sha256 && (prior2.symlink_target ?? null) === link;
      if (info2 && link !== artifact.content && !controlled2 && !adopted2) {
        conflicts.push({ path: target, reason: "Existing entry point needs explicit reconciliation before replacing it with a symlink" });
        continue;
      }
      files.push({
        path: target,
        logical_paths: [target],
        kind: artifact.kind,
        before: digest2,
        before_mode: info2 ? info2.mode & 511 : null,
        before_link: link,
        mode: 511,
        content: artifact.content,
        symlink_target: artifact.content,
        sha256: hash(artifact.content),
        executable: false,
        owns_file: !info2 || controlled2 || adopted2,
        action: !info2 ? "create" : link === artifact.content ? "unchanged" : "update"
      });
      continue;
    }
    const destination = within(root, target), info = stat(destination), prior = old?.files.find((record) => record.path === target);
    requireHarness(!info || info.isFile(), `Output is not a regular file: ${target}`);
    const original = info ? fs2.readFileSync(destination, "utf8") : "", digest = info ? hash(original) : null;
    const adopted = adopt.some((file) => file === target || aliases.get(target).includes(file));
    const controlled = !!prior?.owns_file && digest === prior.sha256;
    const beforeMode = info ? info.mode & 511 : null;
    const mode = artifact.executable ? (beforeMode ?? 420) | 73 : beforeMode ?? 420;
    let content = artifact.content;
    try {
      if (artifact.format === "entrypoint") {
        const block2 = managedBlock(original);
        if (block2) requireHarness(adopted || prior?.managed_sha256 && hash(block2) === prior.managed_sha256, "Managed entry-point block changed or has no ownership record");
        content = entrypoint(original, artifact.content);
      } else {
        if (prior && digest !== prior.sha256) requireHarness(adopted, "Generated file changed or disappeared; reconcile it before explicit adoption");
        if (artifact.format === "json-merge" || artifact.format === "toml-merge") {
          const existing = info ? artifact.format === "json-merge" ? JSON.parse(original) : parse(original) : {};
          requireHarness(isObject(existing), "Existing settings must be an object");
          const patch = JSON.parse(artifact.content);
          if (artifact.format === "json-merge" && prior?.settings_patch) checkRetiredSettings(existing, prior.settings_patch, patch);
          if (artifact.format === "toml-merge" && isObject(patch) && "sandbox_mode" in patch) requireHarness(!("default_permissions" in existing) && !("permissions" in existing), "Existing Codex permission profiles need a deliberate migration before sandbox settings can be generated");
          const merged = merge(existing, patch, controlled || adopted);
          content = artifact.format === "json-merge" ? json(merged) : tomlSettings(original, patch);
        } else if (info && original !== content) requireHarness(controlled || adopted, "Existing file is not an unchanged owned artifact; preserve or explicitly adopt its reviewed replacement");
      }
    } catch (error) {
      conflicts.push({ path: target, reason: error.message });
      continue;
    }
    const block = artifact.format === "entrypoint" ? managedBlock(content) : void 0;
    files.push({
      path: target,
      logical_paths: aliases.get(target),
      kind: artifact.kind,
      before: digest,
      before_mode: beforeMode,
      mode,
      content,
      sha256: hash(content),
      executable: artifact.executable ?? false,
      owns_file: !info || controlled || adopted,
      ...artifact.format === "json-merge" ? { settings_patch: JSON.parse(artifact.content) } : {},
      ...block ? { managed_sha256: hash(block) } : {},
      action: !info ? "create" : original === content && beforeMode === mode ? "unchanged" : ["entrypoint", "json-merge", "toml-merge"].includes(artifact.format) ? "merge" : "update"
    });
  }
  for (const previous of old?.files ?? []) if (!physical.has(previous.path) && stat(within(root, previous.path), false)) conflicts.push({ path: previous.path, reason: "Artifact is no longer selected; reconcile or remove it explicitly before refreshing. It has not been deleted." });
  requireHarness(equal(before, state(root)), "Workspace metadata changed while planning");
  return {
    schema_version: 1,
    workspace: root,
    spec,
    adopt,
    before,
    files,
    conflicts,
    receipt: {
      schema_version: 1,
      profile_sha256: currentProfileHash(root),
      sources,
      files: files.map(({ before: _before, before_mode: _beforeMode, before_link: _beforeLink, mode: _mode, content: _content, action: _action, ...record }) => record)
    },
    activation: "not run"
  };
}
function applyHarnessPlan(input, options = {}) {
  requireHarness(isObject(input) && input.schema_version === 1 && typeof input.workspace === "string" && Array.isArray(input.adopt), "Invalid harness plan");
  const plan = input, root = resolvePath(plan.workspace);
  const fresh = () => makeHarnessPlan(root, plan.spec, { adopt: plan.adopt }, true);
  requireHarness(equal(fresh(), plan), "Harness inputs changed since preview; create a new plan");
  requireHarness(plan.conflicts.length === 0, "Resolve harness plan conflicts before applying");
  const stateDir = path2.join(root, ".harness");
  fs2.mkdirSync(stateDir, { recursive: true });
  const lock = path2.join(stateDir, ".generation.lock");
  try {
    fs2.mkdirSync(lock);
  } catch {
    throw new Error("Harness generation is locked");
  }
  const backups = /* @__PURE__ */ new Map(), written = /* @__PURE__ */ new Map(), directories = [];
  const write = options.write ?? atomicWrite;
  const verifyAliases = (record) => {
    const target = path2.join(root, record.path);
    if (record.symlink_target) {
      requireHarness(resolvePath(path2.dirname(within(root, record.path))) === root && !stat(within(root, record.symlink_target), false)?.isSymbolicLink(), `Entry-point alias target changed: ${record.path}`);
      return;
    }
    requireHarness(resolvePath(within(root, record.path)) === target && record.logical_paths.every((alias) => resolvePath(within(root, alias)) === target), `Output alias changed during generation: ${record.path}`);
  };
  try {
    requireHarness(equal(fresh(), plan), "Harness inputs changed before acquiring the generation lock");
    const outputs = [
      ...plan.files.filter((file) => file.action !== "unchanged").map((file) => ({ path: file.path, content: file.content, mode: file.mode, link: file.symlink_target ?? null })),
      { path: HARNESS_RECEIPT, content: json(plan.receipt), mode: 420, link: null }
    ];
    for (const output of outputs) {
      const file = within(root, output.path), { info, link, digest } = outputState(file);
      if (output.path === HARNESS_RECEIPT) {
        requireHarness(equal(state(root), plan.before), "Workspace metadata changed during generation");
        for (const source of plan.receipt.sources) requireHarness(fileHash(sourcePath(root, source)) === source.sha256, `Source changed during generation: ${source.path}`);
        for (const record of plan.files) {
          verifyAliases(record);
          const current = outputState(within(root, record.path));
          requireHarness(current.digest === record.sha256 && current.link === (record.symlink_target ?? null) && (record.symlink_target ? current.info?.isSymbolicLink() : current.info?.isFile() && (current.info.mode & 511) === record.mode), `Output changed during generation: ${record.path}`);
        }
      } else {
        const record = plan.files.find((item) => item.path === output.path);
        verifyAliases(record);
        requireHarness(digest === record.before && link === (record.before_link ?? null) && (info ? info.mode & 511 : null) === record.before_mode, `Output changed during generation: ${output.path}`);
      }
      if (info && digest === hash(output.content) && link === output.link && (link !== null || (info.mode & 511) === output.mode)) continue;
      backups.set(file, info ? { bytes: link === null ? fs2.readFileSync(file) : Buffer.alloc(0), mode: info.mode & 511, link } : null);
      const missing = [];
      let parent = path2.dirname(file);
      while (!stat(parent)) {
        missing.push(parent);
        parent = path2.dirname(parent);
      }
      for (const directory of missing.reverse()) {
        fs2.mkdirSync(directory);
        directories.push(directory);
      }
      try {
        if (output.link !== null) atomicSymlink(file, output.link);
        else write(file, output.content, output.mode);
      } finally {
        const current = outputState(file);
        if (current.digest === hash(output.content) && current.link === output.link) written.set(file, { digest: current.digest, link: current.link });
      }
    }
    return { status: "applied", written: [...written.keys()].map((file) => path2.relative(root, file)), activation: "not run" };
  } catch (error) {
    const retained = [];
    for (const [file, expected] of [...written].reverse()) {
      let unchanged = false;
      try {
        const current = outputState(file);
        unchanged = resolvePath(path2.dirname(file)) === path2.dirname(file) && current.digest === expected.digest && current.link === expected.link;
      } catch {
      }
      if (!unchanged) {
        retained.push(path2.relative(root, file));
        continue;
      }
      const backup = backups.get(file);
      if (backup?.link !== null && backup?.link !== void 0) atomicSymlink(file, backup.link);
      else if (backup) atomicWrite(file, backup.bytes, backup.mode);
      else fs2.unlinkSync(file);
    }
    for (const directory of directories.reverse()) if (stat(directory, false)?.isDirectory() && resolvePath(directory) === directory && fs2.readdirSync(directory).length === 0) fs2.rmdirSync(directory);
    if (retained.length) throw new Error(`${error.message}; concurrent edits retained: ${retained.join(", ")}`);
    throw error;
  } finally {
    fs2.rmdirSync(lock);
  }
}

// src/adapters/harness-check.ts
import fs5 from "node:fs";
import path4 from "node:path";

// src/adapters/commands.ts
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/commands.ts
var start = /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run|test|start)\b|make(?:\s|$)|(?:node|python3?|bash|sh)\s+|\.\/)/;
function documentCommands(document, body) {
  const result = [];
  let fence, shell = false;
  for (const [index, line] of body.split("\n").entries()) {
    const marker = /^\s*(`{3,}|~{3,})(\S*)/.exec(line);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
        shell = /^(sh|bash|shell|console|zsh)$/.test(marker[2]);
      } else if (fence === marker[1][0]) fence = void 0;
      continue;
    }
    const snippets = fence ? shell ? [line.trim().replace(/^\$\s+/, "")] : [] : [...line.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
    for (const command of snippets) if (start.test(command)) result.push({ document, line: index + 1, command });
  }
  return result;
}
function commandReference(command) {
  if (!/^[\w@%+.,/:=\s-]+$/.test(command)) return { kind: "unknown", reason: "Shell operators, quoting or substitutions need an explicit review" };
  const [tool, ...args] = command.trim().split(/\s+/);
  if (["npm", "pnpm", "yarn", "bun"].includes(tool)) {
    const options = args.slice(0, args.includes("--") ? args.indexOf("--") : args.length);
    if (options.some((arg) => /^(?:--(?:prefix|workspace|workspaces|cwd|filter|dir)(?:=|$)|-[Cw])/.test(arg))) return { kind: "unknown", reason: "Package directory/workspace selectors need an explicit project review" };
    const script = args[0] === "run" ? args[1] : ["test", "start"].includes(args[0]) ? args[0] : void 0;
    return script && !script.startsWith("-") ? { kind: "package", script } : { kind: "unknown", reason: "Package invocation needs a literal script and explicit working directory" };
  }
  if (tool === "make") return args.length && args.every((arg) => /^[a-zA-Z0-9_.\/-]+$/.test(arg) && !arg.startsWith("-")) ? { kind: "make", targets: args } : { kind: "unknown", reason: "Make options, assignments and implicit default targets need review" };
  const file = ["node", "python", "python3", "bash", "sh"].includes(tool) ? args[0] : tool.startsWith("./") ? tool : void 0;
  return file && !file.startsWith("-") ? { kind: "file", path: file.replace(/^\.\//, "") } : { kind: "unknown", reason: "No supported literal script entry point" };
}
function makeDeclarations(content) {
  const targets2 = /* @__PURE__ */ new Set();
  const incomplete = /(?:^\s*(?:-?include|sinclude|ifeq|ifneq|ifdef|ifndef|define)\b)|\$|%/m.test(content);
  for (const line of content.split("\n")) {
    if (/^\s|^#/.test(line)) continue;
    const phony = /^\.PHONY\s*:\s*([a-zA-Z0-9_.\/-]+(?: +[a-zA-Z0-9_.\/-]+)*)\s*(?:#.*)?$/.exec(line);
    if (phony) for (const target of phony[1].split(/\s+/)) targets2.add(target);
    const match = /^([a-zA-Z0-9_.\/-]+(?: +[a-zA-Z0-9_.\/-]+)*)\s*:(?!=)/.exec(line);
    if (match) {
      for (const target of match[1].split(/\s+/)) if (!target.startsWith(".")) targets2.add(target);
    }
  }
  return { targets: [...targets2], incomplete };
}

// src/adapters/commands.ts
function checkCommands(root, spec, documents, local = false) {
  const found = documents.flatMap((document) => documentCommands(document.path, document.body));
  for (const check of spec.ci?.checks ?? []) {
    for (const item of documentCommands(".github/workflows/harness-gate.yml", "```sh\n" + check.run + "\n```")) found.push({ ...item, cwd: check.working_directory });
  }
  const explicit = spec.command_checks ?? [];
  const result = [];
  for (const claim of explicit) if (!found.some((item) => item.document === claim.document && item.command === claim.command)) {
    const document = documents.find((item) => item.path === claim.document);
    if (document?.body.includes(claim.command)) found.push({ document: claim.document, command: claim.command, line: 0 });
    else result.push({ ...claim, line: 0, status: "failed", reason: "Declared command is absent from its generated document", sources: [] });
  }
  for (const item of found) {
    const context = explicit.find((claim) => claim.document === item.document && claim.command === item.command);
    const row = { ...item, ...context?.member ? { member: context.member } : {}, ...context?.cwd ? { cwd: context.cwd } : {}, status: "pending", reason: "", sources: [] };
    result.push(row);
    if (context?.phase === "planned") {
      row.reason = `Planned instruction, not executed: ${context.reason}`;
      continue;
    }
    if (row.member && !local) {
      row.reason = "Member command requires local checkout bindings and --local";
      continue;
    }
    try {
      const reference = commandReference(item.command);
      if (reference.kind === "unknown") {
        row.reason = reference.reason;
        continue;
      }
      const base = row.member ? path3.dirname(sourcePath(root, { member: row.member, path: "__harness_context__" })) : root;
      const directory = row.cwd ? within(base, row.cwd) : base;
      const source = (file) => {
        row.sources.push([row.cwd, file].filter(Boolean).join("/"));
        return within(directory, file);
      };
      if (reference.kind === "package") {
        const file = source("package.json");
        if (!stat(file)) {
          row.status = "failed";
          row.reason = "No package.json in the documented working directory";
          continue;
        }
        const pkg = readJson(file), scripts = isObject(pkg) && isObject(pkg.scripts) ? pkg.scripts : {};
        const declared = scripts[reference.script];
        row.status = Object.hasOwn(scripts, reference.script) && typeof declared === "string" && declared.trim() ? "passed" : "failed";
        row.reason = row.status === "passed" ? "Script declared in package.json; execution not verified" : `Missing package script: ${reference.script}`;
      } else if (reference.kind === "make") {
        const name = ["GNUmakefile", "makefile", "Makefile"].find((file) => stat(within(directory, file))?.isFile());
        if (!name) {
          row.status = "failed";
          row.reason = "No Makefile in the documented working directory";
          continue;
        }
        const declarations = makeDeclarations(fs3.readFileSync(source(name), "utf8"));
        const missing = reference.targets.filter((target) => !declarations.targets.includes(target));
        row.status = declarations.incomplete ? "pending" : missing.length ? "failed" : "passed";
        row.reason = declarations.incomplete ? "Dynamic, included or conditional Make rules require review" : missing.length ? `Missing Make targets: ${missing.join(", ")}` : "Literal Make targets declared; execution not verified";
      } else {
        row.status = stat(source(reference.path))?.isFile() ? "passed" : "failed";
        row.reason = row.status === "passed" ? "Referenced script exists; execution not verified" : `Missing script: ${reference.path}`;
      }
    } catch {
      row.status = "failed";
      row.reason = "Command context or declaration is invalid, unavailable or outside the selected checkout";
    }
  }
  return result;
}

// src/adapters/harness-impact.ts
function harnessImpact(root, local = false) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC));
  validateHarnessSpec(spec);
  const receipt = readHarnessReceipt(root);
  if (!receipt) throw new Error("No generated harness receipt");
  const profileChanged = currentProfileHash(root) !== receipt.profile_sha256;
  const sources = receipt.sources.map((source) => {
    let current = null;
    let status = "pending";
    if (!source.member || local) {
      try {
        current = fileHash(sourcePath(root, source));
        status = current === source.sha256 ? "unchanged" : "changed";
      } catch {
        status = "unavailable";
      }
    }
    return { member: source.member, path: source.path, previous_sha256: source.sha256, current_sha256: current, status };
  });
  const affected = receipt.files.flatMap((file) => file.logical_paths.flatMap((output) => {
    const mapping = spec.provenance?.find((entry) => entry.output === output);
    const dependencies = mapping?.sources ?? spec.sources;
    const reasons = sources.filter((source) => source.status !== "unchanged" && dependencies.some((dependency) => json([dependency.member, dependency.path]) === json([source.member, source.path])));
    return reasons.length || profileChanged ? [{ output, dependency_scope: mapping ? "explicit" : "conservative", profile_changed: profileChanged, sources: reasons.map((source) => ({ member: source.member, path: source.path, status: source.status })) }] : [];
  }));
  return { schema_version: 1, scope: local ? "local" : "shared", profile_changed: profileChanged, sources, affected };
}
function harnessSync(root, local = false) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC));
  validateHarnessSpec(spec);
  const projections = (spec.projections ?? []).map((projection) => {
    let sourceHash = null, targetHash = null;
    let status = "pending";
    if (local || !projection.source.member && !projection.target.member) {
      try {
        sourceHash = fileHash(sourcePath(root, projection.source));
        targetHash = fileHash(sourcePath(root, projection.target));
        status = sourceHash === targetHash ? "passed" : "failed";
      } catch {
        status = "failed";
      }
    }
    return { ...projection, source_sha256: sourceHash, target_sha256: targetHash, status };
  });
  return { schema_version: 1, observed_at: (/* @__PURE__ */ new Date()).toISOString(), status: projections.some((row) => row.status === "failed") ? "failed" : projections.some((row) => row.status === "pending") ? "pending" : "passed", projections, writes: 0 };
}

// src/adapters/documentation.ts
import fs4 from "node:fs";

// src/core/markdown.ts
function proseLines(body) {
  let fence;
  const lines = body.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, " ")).split("\n");
  const frontmatterEnd = lines[0]?.trim() === "---" ? lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) : -1;
  return lines.map((line, index) => {
    if (frontmatterEnd >= 0 && index <= frontmatterEnd) return "";
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker && !fence) {
      fence = { character: marker[1][0], length: marker[1].length };
      return "";
    }
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = void 0;
      return "";
    }
    return line;
  });
}
function plain(value) {
  return value.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*_`]/g, "").replace(/\\([\p{P}])/gu, "$1").trim();
}
function markdownHeadings(body) {
  const lines = proseLines(body), headings = [], anchors = /* @__PURE__ */ new Set();
  for (const [index, line] of lines.entries()) {
    const atx = /^ {0,3}(#{1,6})(?:\s+(.+?)\s*#*\s*|\s*)$/.exec(line);
    const setext = !atx && line.trim() && index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1]);
    if (!atx && !setext) continue;
    const heading = plain(atx ? atx[2] ?? "" : line);
    const base = heading.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/\s/g, "-");
    let anchor = base, suffix = 0;
    while (anchors.has(anchor)) anchor = `${base}-${++suffix}`;
    anchors.add(anchor);
    headings.push({ text: heading, anchor, level: atx ? atx[1].length : lines[index + 1].trim().startsWith("=") ? 1 : 2, line: index });
  }
  return headings;
}
function markdownSection(body, heading) {
  const lines = body.split("\n"), headings = markdownHeadings(body);
  const selected = heading === void 0 ? void 0 : headings.filter((item) => item.text === heading);
  if (selected && selected.length !== 1) return void 0;
  const start2 = selected?.[0], end = start2 ? headings.find((item) => item.line > start2.line && item.level <= start2.level)?.line : void 0;
  const headingLines = new Set(headings.flatMap((item) => /^ {0,3}#{1,6}(?:\s|$)/.test(lines[item.line]) ? [item.line] : [item.line, item.line + 1]));
  const frontmatterEnd = lines[0]?.trim() === "---" ? lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) : -1;
  const section = lines.map((line, index) => headingLines.has(index) || index <= frontmatterEnd ? "" : line).slice(start2 ? start2.line + 1 : 0, end).join("\n");
  return section.replace(/<!--[\s\S]*?-->/g, "").replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gm, "").trim();
}
function markdownLinks(body) {
  const lines = proseLines(body), definitions = /* @__PURE__ */ new Map(), links = [], unresolved = [];
  const key = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const line of lines) {
    const match = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/.exec(line);
    if (match) definitions.set(key(match[1]), match[2] ?? match[3]);
  }
  for (const [index, raw] of lines.entries()) {
    if (/^ {0,3}\[[^\]]+\]:/.test(raw)) continue;
    const line = raw.replace(/`+[^`]*`+/g, "");
    const inline = /!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g;
    for (const match of line.matchAll(inline)) links.push({ destination: match[1] ?? match[2], line: index + 1 });
    const remaining = line.replace(inline, "");
    const references = /!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g;
    for (const match of remaining.matchAll(references)) {
      const label = match[2] || match[1], destination = definitions.get(key(label));
      if (destination) links.push({ destination, line: index + 1 });
      else unresolved.push(label);
    }
    for (const match of remaining.replace(references, "").matchAll(/!?\[([^\]\n]+)\]/g)) {
      const destination = definitions.get(key(match[1]));
      if (destination) links.push({ destination, line: index + 1 });
    }
  }
  return { links, unresolved };
}
function markdownHasAnchor(body, anchor) {
  return markdownHeadings(body).some((heading) => heading.anchor === anchor) || [...proseLines(body).join("\n").matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/gi)].some((match) => match[1] === anchor);
}

// src/adapters/documentation.ts
function checkDocumentCoverage(root, spec) {
  const manifest = readJson(within(root, ".harness/workspace.json"), {});
  const required2 = requiredDocumentTopics(isObject(manifest) ? manifest.onboarding : void 0);
  const requirements = [...required2, ...(spec.document_coverage ?? []).filter((entry) => !required2.some((item) => item.topic === entry.topic))];
  const topics = requirements.map((requirement) => {
    const entry = spec.document_coverage?.find((item) => item.topic === requirement.topic) ?? requirement;
    const heading = "heading" in entry && typeof entry.heading === "string" ? entry.heading : void 0;
    try {
      if (!spec.documents?.some((item) => item.path === entry.path) && !spec.sources.some((source) => !source.member && source.path === entry.path)) return { ...entry, status: "missing", reason: "Topic needs a generated guide or an explicit mapping to a declared source" };
      const file = within(root, entry.path);
      if (!stat(file)?.isFile()) return { ...entry, status: "missing", reason: "Document is unavailable" };
      const section = markdownSection(fs4.readFileSync(file, "utf8"), heading);
      if (section === void 0) return { ...entry, status: "missing", reason: "Mapped heading is absent or ambiguous" };
      if (!section) return { ...entry, status: "missing", reason: "Document or mapped section has no body" };
      return { ...entry, status: "present", reason: "Guide content is present; factual accuracy and executable handoff require review" };
    } catch {
      return { ...entry, status: "missing", reason: "Document cannot be read within the workspace" };
    }
  });
  return {
    status: !topics.length ? "not configured" : topics.some((topic) => topic.status === "missing") ? "incomplete" : "covered",
    topics,
    content_review: "not attested",
    execution: "not established by document coverage"
  };
}

// src/adapters/harness-check.ts
function checkHarness(root, local = false) {
  root = resolvePath(root);
  const receipt = readHarnessReceipt(root);
  if (!receipt) throw new Error("No generated harness receipt");
  const errors = [], pending = [];
  const documents = [];
  const spec = readJson(within(root, HARNESS_SPEC));
  validateHarnessSpec(spec);
  const rendered = renderHarness(spec, { check: "", hook: "", notices: "" });
  const configuration = harnessConfiguration(spec, rendered);
  const expected = new Set(rendered.map((artifact) => artifact.path));
  try {
    assertSelection(root, spec);
  } catch (error) {
    errors.push(error.message);
  }
  const recorded = receipt.files.flatMap((record) => record.logical_paths);
  if (new Set(recorded).size !== recorded.length) errors.push("Repeated logical receipt entry");
  for (const name of expected) if (!recorded.includes(name)) errors.push(`Missing receipt entry: ${name}`);
  for (const name of recorded) if (!expected.has(name)) errors.push(`Unexpected receipt entry: ${name}`);
  const sourceKey = (source) => json([source.member ?? null, source.path]);
  const expectedSources = new Set(spec.sources.map(sourceKey)), recordedSources = receipt.sources.map(sourceKey);
  if (new Set(recordedSources).size !== recordedSources.length) errors.push("Repeated source receipt entry");
  for (const source of expectedSources) if (!recordedSources.includes(source)) errors.push(`Missing source receipt entry: ${source.trim()}`);
  for (const source of recordedSources) if (!expectedSources.has(source)) errors.push(`Unexpected source receipt entry: ${source.trim()}`);
  for (const record of receipt.files) {
    try {
      const file = within(root, record.path);
      const expectedFile = rendered.find((item) => item.path === record.path);
      if (record.symlink_target || expectedFile?.format === "symlink") {
        if (expectedFile?.format !== "symlink" || record.symlink_target !== expectedFile.content || !stat(file, false)?.isSymbolicLink() || fs5.readlinkSync(file) !== expectedFile.content || record.sha256 !== hash(expectedFile.content) || !stat(file)?.isFile()) errors.push(`Entry-point symlink changed: ${record.path}`);
        continue;
      }
      if (spec.layout === "centralized" && record.path === "AGENTS.md" && stat(file, false)?.isSymbolicLink()) errors.push("Centralized AGENTS.md must be a regular file");
      for (const alias of record.logical_paths) if (resolvePath(within(root, alias)) !== resolvePath(file)) errors.push(`Alias changed: ${alias}`);
      if (!stat(file)?.isFile()) {
        errors.push(`Missing generated file: ${record.path}`);
        continue;
      }
      if (fileHash(file) !== record.sha256) errors.push(`Generated file changed: ${record.path}`);
      if (record.executable && !(fs5.statSync(file).mode & 64)) errors.push(`Generated script is not executable: ${record.path}`);
      const content = fs5.readFileSync(file, "utf8");
      if (record.path.endsWith(".md") || (spec.command_checks ?? []).some((check) => record.logical_paths.includes(check.document))) {
        for (const alias of record.logical_paths) documents.push({ path: alias, body: content });
      }
      if (record.path.endsWith(".json") || record.kind === "ci") JSON.parse(content);
      if (record.path.endsWith(".toml")) parse(content);
      if (record.path.endsWith(".md")) {
        const links = markdownLinks(content);
        for (const label of links.unresolved) errors.push(`Unresolved Markdown reference in ${record.path}: ${label}`);
        for (const { destination: link } of links.links) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
          const [pathname, fragment] = link.split("#");
          const relative = path4.relative(root, pathname ? path4.resolve(path4.dirname(file), decodeURIComponent(pathname)) : file).split(path4.sep).join("/");
          harnessPath(relative);
          const target = within(root, relative), info = stat(target);
          if (!info) errors.push(`Broken link in ${record.path}: ${link}`);
          else if (fragment && info.isFile() && relative.endsWith(".md") && !markdownHasAnchor(fs5.readFileSync(target, "utf8"), decodeURIComponent(fragment))) errors.push(`Broken Markdown anchor in ${record.path}: ${link}`);
        }
      }
    } catch (error) {
      errors.push(`${record.path}: ${error.message}`);
    }
  }
  if (currentProfileHash(root) !== receipt.profile_sha256) errors.push("Initialization choices changed since harness generation");
  for (const source of receipt.sources) {
    if (source.member && !local) {
      pending.push(`External source requires --local: ${source.member}/${source.path}`);
      continue;
    }
    try {
      if (fileHash(sourcePath(root, source)) !== source.sha256) errors.push(`Source changed: ${source.member ?? "workspace"}/${source.path}`);
    } catch {
      errors.push(`Source unavailable: ${source.member ?? "workspace"}/${source.path}`);
    }
  }
  const cases = (spec.hooks?.cases ?? []).map((example) => {
    const actual = evaluateGuard(spec.hooks.guards, example.input).decision;
    if (actual !== example.expected) errors.push(`Hook case failed: ${example.name}`);
    return { name: example.name, expected: example.expected, actual, status: actual === example.expected ? "passed" : "failed" };
  });
  const commands = checkCommands(root, spec, documents, local);
  for (const command of commands) {
    const message = `${command.document}:${command.line}: ${command.command}: ${command.reason}`;
    if (command.status === "failed") errors.push(message);
    else if (command.status === "pending") pending.push(message);
  }
  const synchronization = harnessSync(root, local);
  for (const row of synchronization.projections) {
    if (row.status === "failed") errors.push(`Projection drift or unavailable file: ${row.target.member ?? "workspace"}/${row.target.path}`);
    if (row.status === "pending") pending.push(`Projection requires --local: ${row.target.member ?? "workspace"}/${row.target.path}`);
  }
  const documentation = checkDocumentCoverage(root, spec);
  for (const topic of documentation.topics) if (topic.status === "missing") errors.push(`Missing documentation topic ${topic.topic}: ${topic.path}: ${topic.reason}`);
  return {
    status: errors.length ? "failed" : "passed",
    scope: local ? "artifacts-and-local-sources" : "shared-artifacts",
    errors,
    pending,
    files: receipt.files.length,
    configuration,
    hook_cases: cases,
    commands,
    documentation,
    impact: harnessImpact(root, local),
    synchronization,
    activation: spec.targets.map((target) => ({ target, status: "not run", next_action: spec.layout === "centralized" ? "Verify that the target session loaded AGENTS.md (through its entry-point alias where applicable) and followed a linked procedure; native Skill/command/agent registration is not configured" : target === "codex" ? "Verify the installed Codex version, trusted project config, skill/agent discovery and /hooks trust in the target session" : "Verify project settings, skill/command/agent discovery and hooks in the target Claude Code session" })),
    ci_execution: "not run",
    application_execution: "not run"
  };
}

// src/adapters/harness-doctor.ts
import path5 from "node:path";
import { spawnSync } from "node:child_process";
var diagnosticRunner = (argv, cwd, timeoutSeconds) => {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding: "utf8",
    timeout: timeoutSeconds * 1e3,
    maxBuffer: 256 * 1024,
    shell: false,
    env: { ...process.env, AWS_PAGER: "", AZURE_CORE_ONLY_SHOW_ERRORS: "true", GH_PROMPT_DISABLED: "1", CLOUDSDK_CORE_DISABLE_PROMPTS: "1" }
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
};
function harnessDoctor(root, options = {}) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC));
  validateHarnessSpec(spec);
  const artifacts = checkHarness(root, true);
  const localFile = within(root, ".harness/workspace.local.json");
  const fingerprint = () => {
    const local = stat(localFile) ? readJson(localFile) : {};
    return hash(json({ root, receipt: fileHash(within(root, HARNESS_RECEIPT)), checkouts: isObject(local) ? local.checkouts : null }));
  };
  const binding = fingerprint();
  const checks = spec.targets.map((target) => ({ id: `harness-agent-${target}`, layer: "agent", target: { environment: "local", identity: target }, criterion: spec.layout === "centralized" ? "The target session loaded AGENTS.md through its entry point and followed a linked procedure; native Skill, command and agent registration is not configured" : "The current trusted host session discovered the generated entry points, selected skills and agents; cite a session observation" }));
  if (spec.hooks) for (const target of spec.targets) checks.push({ id: `harness-hook-${target}`, layer: "hook", target: { environment: "local", identity: target }, criterion: "The current host invoked its configured hook; harmless positive and negative session probes produced the expected result" });
  checks.push(...spec.verification?.checks ?? []);
  for (const layer of ["tool", "smoke"]) if (!checks.some((check) => check.layer === layer)) checks.push({ id: `harness-${layer}`, layer, target: { environment: "local", identity: "workspace" }, criterion: layer === "tool" ? "Record the project-required tool versions" : "Define and run the first application smoke against its observed target and artifact" });
  if (spec.ci && !checks.some((check) => check.layer === "ci")) checks.push({ id: "harness-ci", layer: "ci", target: { environment: "ci", identity: "github-actions" }, criterion: "Cite the actual required CI run and its result for this configuration" });
  const manifest = readJson(within(root, ".harness/workspace.json"), {});
  if (isObject(manifest) && isObject(manifest.onboarding) && Array.isArray(manifest.onboarding.platforms)) {
    for (const platform of manifest.onboarding.platforms) if (isObject(platform) && platform.access !== "documentation-only" && !spec.verification?.checks.some((check) => check.layer === "access" && check.platform === platform.id)) {
      checks.push({ id: `harness-access-${platform.id}`, layer: "access", target: { environment: "configured-platform", identity: String(platform.id) }, criterion: "Define a target-specific access probe and verify the selected account, subscription or project before use" });
    }
  }
  const record = options.record === void 0 ? { schema_version: 1, observations: [] } : structuredClone(options.record);
  validateVerificationRecord(record);
  const at = options.at ?? (/* @__PURE__ */ new Date()).toISOString();
  const runIds = options.run ?? [];
  if (new Set(runIds).size !== runIds.length) throw new Error("Select each probe at most once");
  const selected = runIds.map((id) => {
    const check = spec.verification?.checks.find((check2) => check2.id === id);
    if (!check?.probe) throw new Error(`No declared executable probe: ${id}`);
    return check;
  });
  evaluateVerification(checks, record, binding, spec.verification?.max_age_seconds ?? 86400, at);
  if (selected.length && artifacts.status !== "passed") throw new Error("Repair artifact/source drift before executing declared probes");
  const executions = [];
  for (const check of selected) {
    const probe = check.probe;
    const base = probe.member ? path5.dirname(sourcePath(root, { member: probe.member, path: "__harness_context__" })) : root;
    const cwd = probe.cwd ? within(base, probe.cwd) : base;
    const execution = (options.runner ?? diagnosticRunner)(probe.argv, cwd, probe.timeout_seconds);
    let matched = true;
    if (probe.expect_json) {
      try {
        matched = matchesJson(JSON.parse(execution.stdout), probe.expect_json);
      } catch {
        matched = false;
      }
    }
    const passed = !execution.error && execution.status === 0 && matched;
    const attempt = Math.max(0, ...record.observations.filter((item) => item.check === check.id).map((item) => item.attempt)) + 1;
    const observation = {
      check: check.id,
      attempt,
      binding,
      status: passed ? "passed" : "failed",
      target: check.target,
      ...check.artifact ? { artifact: check.artifact } : {},
      observed_at: options.at ?? (/* @__PURE__ */ new Date()).toISOString(),
      method: "probe",
      summary: passed ? "Declared probe completed and its expected JSON assertions matched" : "Probe failed, timed out or did not establish the expected JSON assertions",
      evidence: [`probe:${check.id}:stdout-sha256:${hash(execution.stdout)}`, `probe:${check.id}:exit:${execution.status ?? "unavailable"}`]
    };
    record.observations.push(observation);
    executions.push({ check: check.id, exit_code: execution.status, stdout_sha256: hash(execution.stdout), stderr_sha256: hash(execution.stderr) });
  }
  const after = selected.length ? checkHarness(root, true) : artifacts;
  const evaluation = evaluateVerification(checks, record, binding, spec.verification?.max_age_seconds ?? 86400, options.at ?? (/* @__PURE__ */ new Date()).toISOString());
  const configurationChanged = fingerprint() !== binding;
  const drift = after.status !== "passed" || configurationChanged;
  return {
    ...evaluation,
    status: drift ? "failed" : evaluation.status === "failed" ? "failed" : after.pending.length ? "pending" : evaluation.status,
    artifacts: after,
    configuration_changed_during_probes: configurationChanged,
    executions,
    record,
    probes: (spec.verification?.checks ?? []).filter((check) => check.probe).map((check) => ({ id: check.id, target: check.target, criterion: check.criterion, ...check.probe })),
    evidence_note: "Session attestations are supplied evidence, not independently authenticated host activation. Probe output hashes are retained; raw output is not."
  };
}

// src/cli/args.ts
import { parseArgs } from "node:util";
var UsageError = class extends Error {
  name = "UsageError";
};
function parse2(argv, specs, count = 0) {
  const normalized = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index], option = specs[arg.slice(2)];
    if (arg.startsWith("--") && option?.width) {
      const parts = argv.slice(index + 1, index + 1 + option.width);
      if (parts.length !== option.width || parts.some((part) => part.startsWith("--"))) throw new UsageError(`${arg} needs ${option.width} values`);
      normalized.push(arg, JSON.stringify(parts));
      index += option.width;
    } else normalized.push(arg);
  }
  try {
    const options = Object.fromEntries(Object.entries(specs).map(([name, { type, multiple: multiple2 }]) => [name, { type, multiple: multiple2 ?? false }]));
    const result = parseArgs({ args: normalized, options, allowPositionals: true, strict: true });
    for (const [name, spec] of Object.entries(specs)) if (spec.required && result.values[name] === void 0) throw new UsageError(`Missing required --${name}`);
    if (result.positionals.length !== count) throw new UsageError(`Expected ${count} positional argument(s)`);
    return result;
  } catch (error) {
    throw new UsageError(error.message);
  }
}
var stringOption = { type: "string" };
var required = { type: "string", required: true };
var flag = { type: "boolean" };
var multiple = { type: "string", multiple: true };

// src/cli/harness.ts
function harnessMain(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: harness plan --workspace DIR --spec FILE [--adopt PATH] > PLAN\n       harness apply --plan PLAN\n       harness <check|impact|sync> --workspace DIR [--local]\n       harness doctor --workspace DIR [--record FILE] [--run-probe ID] [--at ISO_TIME]\nPlans include reviewable file content. Doctor is read-only unless individual probes are selected with --run-probe; review their argv first. Sync reports drift without writing members.");
    return 0;
  }
  try {
    const [command, ...args] = argv;
    let result;
    if (command === "plan") {
      const { values } = parse2(args, { workspace: required, spec: required, adopt: multiple });
      result = makeHarnessPlan(values.workspace, readJson(values.spec), { adopt: values.adopt });
    } else if (command === "apply") {
      const { values } = parse2(args, { plan: required });
      result = applyHarnessPlan(readJson(values.plan));
    } else if (command === "check") {
      const { values } = parse2(args, { workspace: required, local: flag });
      const checked = checkHarness(values.workspace, Boolean(values.local));
      console.log(JSON.stringify(checked, null, 2));
      return checked.status === "passed" ? 0 : 1;
    } else if (command === "impact" || command === "sync") {
      const { values } = parse2(args, { workspace: required, local: flag });
      if (command === "impact") result = harnessImpact(values.workspace, Boolean(values.local));
      else {
        const report = harnessSync(values.workspace, Boolean(values.local));
        console.log(JSON.stringify(report, null, 2));
        return report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
      }
    } else if (command === "doctor") {
      const { values } = parse2(args, { workspace: required, record: stringOption, "run-probe": multiple, at: stringOption });
      const input = values.record ? readJson(values.record) : void 0;
      const record = isObject(input) && "record" in input ? input.record : input;
      const report = harnessDoctor(values.workspace, { record, run: values["run-probe"], at: values.at });
      console.log(JSON.stringify(report, null, 2));
      return report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
    } else throw new UsageError("Expected plan, apply, check, impact, sync or doctor");
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ status: "invalid", error: error.message }));
    return 2;
  }
}

// src/entries/harness.ts
process.exitCode = harnessMain(process.argv.slice(2));
