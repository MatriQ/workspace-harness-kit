#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/adapters/workspace.ts
import fs3 from "node:fs";
import path5 from "node:path";

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
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
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
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
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
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
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
  let state = 0;
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
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str = str.replaceAll("_", "");
  return state > 1 ? parseFloat(str) : parseInteger(ctx, str, 10, startPtr);
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
  let start = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
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
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
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
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
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
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
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
var HAS_WELLFORMED = !!"".isWellFormed;

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

// src/core/local-context.ts
var LOCAL_START = "<!-- workspace-harness-kit:local-context:start -->";
var LOCAL_END = "<!-- workspace-harness-kit:local-context:end -->";
var DEFAULT_LOCAL_CONTEXT = ".harness/docs/workspace.local.md";
var LEGACY_LOCAL_CONTEXT = ".harness/workspace.local.json";
function localContextPath(value) {
  const name = relativePath(value);
  requireWorkspace(name.endsWith(".local.md"), "Local context must be a repository-relative *.local.md file");
  return name;
}
function isLocalResource(file) {
  return file.endsWith(".local.md") || file.endsWith(".local.json") || file === LEGACY_LOCAL_CONTEXT || file.startsWith(".harness/local-backups/") || file.startsWith(".harness/local-evidence/");
}
function validateLocalContext(value) {
  schema(value);
  const fields = ["schema_version", "checkouts", "machine", "tools", "environment", "access", "execution", "state", "onboarding_status"];
  requireWorkspace(Object.keys(value).every((key) => fields.includes(key)), "Unknown local-context field; put project-specific state under state");
  requireWorkspace(isObject(value.checkouts), "Local checkouts must be an object keyed by member ID");
  if ("machine" in value) requireWorkspace(typeof value.machine === "string" && /^[a-f0-9]{64}$/.test(value.machine), "Invalid local machine fingerprint");
  for (const [id, binding] of Object.entries(value.checkouts)) {
    validateId(id);
    requireWorkspace(isObject(binding) && Object.keys(binding).every((key) => ["path", "git_common_dir"].includes(key)), `Invalid checkout fields: ${id}`);
    for (const field of ["path", "git_common_dir"]) requireWorkspace(typeof binding[field] === "string" && !!binding[field] && !/[\x00-\x1f\x7f]/.test(binding[field]), `Expected a local ${field} for ${id}`);
  }
  for (const field of ["tools", "environment", "access", "execution", "state", "onboarding_status"]) if (field in value) requireWorkspace(isObject(value[field]), `Local ${field} must be an object`);
}
function parseLocalContext(markdown) {
  requireWorkspace(Buffer.byteLength(markdown, "utf8") <= 1024 * 1024, "Local context exceeds the 1 MiB limit");
  const start = markdown.indexOf(LOCAL_START), end = markdown.indexOf(LOCAL_END);
  if (start < 0 && end < 0) return void 0;
  requireWorkspace(start >= 0 && end > start && markdown.indexOf(LOCAL_START, start + LOCAL_START.length) < 0 && markdown.indexOf(LOCAL_END, end + LOCAL_END.length) < 0, "Malformed or repeated local-context markers");
  const content = markdown.slice(start + LOCAL_START.length, end).trim();
  const match = /^```json\r?\n([\s\S]*?)\r?\n```$/.exec(content);
  requireWorkspace(match && !match[1].includes("```"), "Local context needs exactly one JSON fenced block");
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Malformed local-context JSON");
  }
  validateLocalContext(data);
  return data;
}
function renderLocalContext(markdown, data) {
  validateLocalContext(data);
  const previous = parseLocalContext(markdown);
  const block = `${LOCAL_START}
\`\`\`json
${json(data).trimEnd()}
\`\`\`
${LOCAL_END}`;
  const output = previous ? markdown.slice(0, markdown.indexOf(LOCAL_START)) + block + markdown.slice(markdown.indexOf(LOCAL_END) + LOCAL_END.length) : markdown + (markdown && !markdown.endsWith("\n") ? "\n" : "") + (markdown ? "\n" : "") + block + "\n";
  requireWorkspace(Buffer.byteLength(output, "utf8") <= 1024 * 1024, "Local context exceeds the 1 MiB limit; link raw evidence instead");
  return output;
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
function validateHarnessSelection(value) {
  shape(value, "harness", ["layout", "targets", "artifacts"]);
  if ("layout" in value) requireHarness(value.layout === "centralized" || value.layout === "native", "Choose centralized or native harness layout");
  if ("targets" in value) targets(value.targets);
  if ("artifacts" in value) {
    shape(value.artifacts, "harness.artifacts", [...HARNESS_PARTS]);
    requireHarness(Object.values(value.artifacts).every((item) => typeof item === "boolean"), "Artifact choices must be booleans; omit unanswered choices");
    if (value.layout === "centralized") requireHarness(!["settings", "hooks"].some((part) => value.artifacts[part] === true), "Centralized layout does not register native settings or hooks; choose native layout for those integrations");
  }
}

// src/core/onboarding.ts
var ACTIVITIES = ["development", "testing", "deployment", "operations"];
var OnboardingError = class extends Error {
  name = "OnboardingError";
};
function requireProfile(condition, message) {
  if (!condition) throw new OnboardingError(message);
}
function shape2(value, name, fields) {
  requireProfile(isObject(value), `${name} must be an object`);
  requireProfile(Object.keys(value).every((key) => fields.includes(key)), `${name} has unknown fields`);
}
function nonempty(value, name) {
  requireProfile(typeof value === "string" && value.trim() && value.length <= 2e3, `${name} must be nonempty text of at most 2000 characters`);
}
function names(value, name) {
  requireProfile(Array.isArray(value), `${name} must be a list`);
  for (const item of value) nonempty(item, name);
  requireProfile(new Set(value).size === value.length, `${name} contains duplicates`);
}
function relative(value) {
  requireProfile(typeof value === "string" && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split("/").every((part) => part && ![".", "..", ".git", "node_modules"].includes(part)), "Documentation paths must be normalized relative paths outside Git metadata and dependencies");
}
function validateOnboarding(value) {
  shape2(value, "onboarding", ["schema_version", "language", "background", "activities", "platforms", "tool_policy", "documentation", "harness"]);
  requireProfile(value.schema_version === 1, "Expected onboarding schema_version 1");
  if ("language" in value) requireProfile(value.language === "en" || value.language === "zh-CN", "Choose en or zh-CN for generated harness prose");
  if ("harness" in value) validateHarnessSelection(value.harness);
  if ("background" in value) nonempty(value.background, "background");
  if ("activities" in value) {
    shape2(value.activities, "activities", [...ACTIVITIES]);
    requireProfile(Object.values(value.activities).every((item) => typeof item === "boolean"), "Activity choices must be booleans; omit unanswered choices");
  }
  if ("tool_policy" in value) requireProfile(["install-missing", "inspect-only"].includes(value.tool_policy), "Unknown tool_policy");
  if ("documentation" in value) {
    shape2(value.documentation, "documentation", ["placement", "root", "entrypoint", "existing_documents"]);
    requireProfile(["coordinator", "members"].includes(value.documentation.placement), "Choose coordinator or members documentation placement");
    relative(value.documentation.root);
    if ("entrypoint" in value.documentation) relative(value.documentation.entrypoint);
    if ("existing_documents" in value.documentation) {
      requireProfile(Array.isArray(value.documentation.existing_documents), "existing_documents must be a list of explicit choices");
      const seen = /* @__PURE__ */ new Set(), destinations = /* @__PURE__ */ new Set();
      for (const choice of value.documentation.existing_documents) {
        shape2(choice, "existing document choice", ["member", "path", "action", "destination"]);
        requireProfile(typeof choice.member === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, choice.member), "Existing documents need a stable member ID");
        relative(choice.path);
        const key = JSON.stringify([choice.member, choice.path]);
        requireProfile(!seen.has(key), "Repeated existing document choice");
        seen.add(key);
        requireProfile(choice.action === "keep" || choice.action === "move", "Choose keep or move for each existing document");
        if (choice.action === "move") {
          relative(choice.destination);
          requireProfile(choice.destination.startsWith(`${value.documentation.root}/`) && choice.destination !== choice.path, "Move destinations must be inside the documentation root and differ from the source");
          const destination = JSON.stringify([choice.member, choice.destination]);
          requireProfile(!destinations.has(destination), "Multiple documents cannot move to the same destination");
          destinations.add(destination);
        } else requireProfile(!("destination" in choice), "Kept documents do not have a move destination");
      }
    }
  }
  if ("platforms" in value) {
    requireProfile(Array.isArray(value.platforms), "platforms must be a list");
    const seen = /* @__PURE__ */ new Set();
    for (const platform of value.platforms) {
      shape2(platform, "platform", ["id", "provider", "name", "services", "environments", "access", "delivery", "tools"]);
      requireProfile(typeof platform.id === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, platform.id) && !seen.has(platform.id), "Platform IDs must be unique lowercase identifiers");
      seen.add(platform.id);
      requireProfile(["aws", "azure", "gcp", "other"].includes(platform.provider), "Unknown provider; use other with its actual name");
      if ("name" in platform) nonempty(platform.name, "platform.name");
      if (platform.provider === "other") nonempty(platform.name, "platform.name");
      for (const field of ["services", "environments", "tools"]) if (field in platform) names(platform[field], `platform.${field}`);
      if ("access" in platform) requireProfile(["cli", "existing-tools", "documentation-only"].includes(platform.access), "Unknown platform access mode");
      if ("delivery" in platform) requireProfile(["github-actions", "azure-pipelines", "gitlab-ci", "manual", "other"].includes(platform.delivery), "Unknown delivery method; use other for a project-owned workflow");
    }
  }
}
var TOOL_CATALOG = [
  { id: "aws", executable: "aws", version_args: ["--version"], minimum_major: 2, install_url: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" },
  { id: "azure", executable: "az", version_args: ["version", "--output", "json"], minimum_major: 2, install_url: "https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" },
  { id: "gcloud", executable: "gcloud", version_args: ["version", "--format=json"], install_url: "https://docs.cloud.google.com/sdk/docs/install-sdk" },
  { id: "gh", executable: "gh", version_args: ["--version"], install_url: "https://github.com/cli/cli#installation" },
  { id: "kubectl", executable: "kubectl", version_args: ["version", "--client=true", "--output=json"], install_url: "https://kubernetes.io/docs/tasks/tools/" },
  { id: "helm", executable: "helm", version_args: ["version", "--short"], install_url: "https://helm.sh/docs/intro/install/" },
  { id: "terraform", executable: "terraform", version_args: ["version", "-json"], install_url: "https://developer.hashicorp.com/terraform/install" },
  { id: "docker", executable: "docker", version_args: ["--version"], install_url: "https://docs.docker.com/get-started/get-docker/" }
];
function planOnboarding(input) {
  validateOnboarding(input);
  const profile = input, activities = profile.activities ?? {}, platforms = profile.platforms ?? [];
  const remote = activities.deployment === true || activities.operations === true;
  const questions = [];
  if (!profile.language) questions.push({ id: "language", prompt: "Which language should the generated harness documents and agent instructions use?", choices: ["English (en)", "简体中文 (zh-CN)"] });
  if (!profile.background) questions.push({
    id: "background",
    prompt: "What role should this workspace serve? In an empty directory, choose its role before describing an application; an existing project can supply background from its sources.",
    choices: [
      "Harness documentation hub — keep shared harness guides here and connect other repositories by Git URL or local directory",
      "Monorepo — initialize the harness here and add application code to this repository later",
      "Existing or other project — use confirmed project context or describe another setup"
    ]
  });
  const unanswered = ACTIVITIES.filter((activity) => activities[activity] === void 0);
  if (unanswered.length) questions.push({ id: "activities", prompt: `Which of these activities should initialization cover: ${unanswered.join(", ")}? Record each as needed or not needed.` });
  if (remote && !platforms.length) questions.push({ id: "platforms", prompt: "Which platforms host the environments you want to deploy to or operate? Multiple platforms are supported.", choices: ["AWS", "Azure", "Google Cloud", "Other / self-hosted"] });
  if (remote) for (const platform of platforms) {
    if (!platform.services?.length || !platform.environments?.length) questions.push({ id: `${platform.id}.targets`, prompt: `For ${platform.name ?? platform.provider}, which services and environments are in scope? Reuse confirmed repository configuration where possible.` });
    if (platform.access === void 0) questions.push({ id: `${platform.id}.access`, prompt: `How should the harness access ${platform.id}?`, choices: ["Provider CLI", "Existing tools or connector", "Documentation only"] });
    if (activities.deployment && platform.delivery === void 0) questions.push({ id: `${platform.id}.delivery`, prompt: `How are releases to ${platform.id} performed?`, choices: ["GitHub Actions", "Azure Pipelines", "GitLab CI", "Manual procedure", "Other"] });
    if (platform.provider === "other" && platform.access === "cli" && !platform.tools?.length) questions.push({ id: `${platform.id}.tools`, prompt: `Which vendor CLI or project-owned tools are needed for ${platform.name}? Supply their official installation documentation during setup.` });
  }
  const preparesTools = activities.development || activities.testing || remote && platforms.some((platform) => platform.access === "cli");
  if (preparesTools && !profile.tool_policy) questions.push({ id: "tool_policy", prompt: "Should setup install missing tools, or only inspect and document prerequisites?", choices: ["Install missing tools", "Inspect only"] });
  if (profile.harness) {
    if (!profile.harness.targets?.length) questions.push({ id: "harness.targets", prompt: "Which local agents should load the generated harness?", choices: ["Codex", "Claude Code", "Both"] });
    const missing = HARNESS_PARTS.filter((part) => profile.harness.artifacts?.[part] === void 0);
    if (missing.length) questions.push({ id: "harness.artifacts", prompt: `Which harness parts should be generated or refreshed: ${missing.join(", ")}? Reuse existing components where suitable.` });
  }
  const requirements = /* @__PURE__ */ new Map();
  const addTool = (id, reason) => requirements.set(id, [.../* @__PURE__ */ new Set([...requirements.get(id) ?? [], reason])]);
  if (remote) {
    for (const platform of platforms) if (platform.access === "cli") {
      if (platform.provider !== "other") addTool({ aws: "aws", azure: "azure", gcp: "gcloud" }[platform.provider], `${platform.id}: provider access`);
      if (activities.deployment && platform.delivery === "github-actions") addTool("gh", `${platform.id}: release workflow inspection`);
      if (activities.deployment && platform.delivery === "azure-pipelines") addTool("azure", `${platform.id}: pipeline access; verify the Azure DevOps extension separately`);
      for (const tool of platform.tools ?? []) addTool(tool, `${platform.id}: explicitly selected tool`);
    }
  }
  const scope = profile.documentation?.placement === "members" ? "selected-members" : "workspace";
  const root = profile.documentation?.root ?? (profile.harness?.layout === "centralized" ? ".harness/docs" : "docs/harness");
  const documents = [{ scope, path: `${root}/index.md`, topic: "Background, selected repositories, requested activities, task routing, sources and unresolved decisions" }];
  if (activities.development) documents.push({ scope, path: `${root}/development.md`, topic: "Project runtimes, installation, configuration, startup and a representative local smoke check" });
  if (activities.testing) documents.push({ scope, path: `${root}/testing.md`, topic: "Native test entry points, scope, fixtures, CI gates and report locations" });
  if (remote) documents.push({ scope, path: `${root}/environments.md`, topic: "Per-platform environment identity, services, regions, access method and evidence sources" });
  if (activities.deployment) documents.push({ scope, path: `${root}/release.md`, topic: "Release trigger, artifact, ordering, authorization, runtime verification and rollback" });
  if (activities.operations) documents.push({ scope, path: `${root}/operations.md`, topic: "Logs, metrics, alerts, queues, dependencies, investigation steps and escalation" });
  if (ACTIVITIES.some((activity) => activities[activity])) documents.push({ scope, path: `${root}/toolchain.md`, topic: "Selected tools, authoritative installation methods, version constraints and access verification procedures" });
  if (profile.documentation?.entrypoint) documents.push({ scope, path: profile.documentation.entrypoint, topic: "Short task router linking existing and generated authoritative guides" });
  return {
    status: questions.length ? "needs-input" : "planned",
    language: profile.language ?? "undecided",
    questions,
    tools: [...requirements].map(([id, reasons]) => {
      const definition = TOOL_CATALOG.find((tool) => tool.id === id);
      return { id, reasons, definition: definition ? structuredClone(definition) : null };
    }),
    tool_policy: profile.tool_policy ?? "undecided",
    documents,
    platform_guides: remote ? platforms.map((platform) => ({ platform: platform.id, reference: `references/providers/${platform.provider}.md` })) : [],
    ...profile.harness ? { harness: { layout: profile.harness.layout ?? "native", targets: [...profile.harness.targets ?? []], artifacts: HARNESS_PARTS.filter((part) => profile.harness.artifacts?.[part]), reference: "references/generation.md", activation: "not run" } } : {},
    execution: { installation: "not run", authentication: "not run", target_access: "not run", documentation: "not run" }
  };
}

// src/core/registry.ts
var MODES = ["register", "analyze", "init"];
var RELATIONSHIPS = ["starts_after", "deploys_after", "consumes", "validated_by", "requires"];
var WorkspaceError = class extends Error {
  name = "WorkspaceError";
};
function requireWorkspace(condition, message) {
  if (!condition) throw new WorkspaceError(message);
}
var optional = (value, key, fallback) => Object.hasOwn(value, key) ? value[key] : fallback;
function validateId(value) {
  requireWorkspace(typeof value === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid member ID: ${String(value)}. Use lowercase letters, numbers, dots, dashes, or underscores.`);
}
function validateLanguage(value) {
  requireWorkspace(typeof value === "string" && fullMatch(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/, value), `Invalid language tag: ${String(value)}. Use a tag such as en or zh-CN.`);
}
function relativePath(value) {
  requireWorkspace(typeof value === "string" && value.length > 0 && !/[\\:\0]/.test(value) && value.split("/").every((part) => part && part !== "." && part !== ".."), `Invalid relative file reference: ${String(value)}`);
  return value;
}
function schema(value) {
  requireWorkspace(isObject(value) && value.schema_version === 1, "Expected workspace schema version 1.");
}
function docRefs(value) {
  requireWorkspace(Array.isArray(value), "Document references must be a list of relative paths.");
  for (const item of value) {
    relativePath(item);
    requireWorkspace(!isLocalResource(item), "Local context cannot be a shared document or source reference");
  }
}
function fingerprints(value) {
  requireWorkspace(Array.isArray(value), "Source fingerprints must be a list.");
  const entries = /* @__PURE__ */ new Map();
  for (const source of value) {
    requireWorkspace(isObject(source), "Each source fingerprint must be an object.");
    const path6 = relativePath(source.path), digest = source.sha256;
    requireWorkspace(!isLocalResource(path6), "Local context cannot enter shared source or document review fingerprints");
    requireWorkspace(!entries.has(path6) && typeof digest === "string" && fullMatch(/^[a-f0-9]{64}$/, digest), `Invalid or repeated source fingerprint: ${path6}`);
    entries.set(path6, digest);
  }
  return Object.fromEntries(entries);
}
function componentModel(value, members) {
  const components = /* @__PURE__ */ new Map(), explicitMembers = /* @__PURE__ */ new Set();
  const entries = optional(value, "components", []);
  requireWorkspace(Array.isArray(entries), "Components must be a list.");
  for (const item of entries) {
    requireWorkspace(isObject(item), "Each component must be an object.");
    validateId(item.id);
    validateId(item.member);
    requireWorkspace(!components.has(item.id) && Object.hasOwn(members, item.member), `Repeated component or unknown member: ${item.id}`);
    const path6 = optional(item, "path", ".");
    if (path6 !== ".") relativePath(path6);
    components.set(item.id, { ...item, id: item.id, member: item.member, path: path6 });
    explicitMembers.add(item.member);
  }
  for (const id of Object.keys(members).sort()) if (!explicitMembers.has(id)) {
    requireWorkspace(!components.has(id), `Component shadows an implicit component: ${id}`);
    components.set(id, { id, member: id, path: "." });
  }
  const relationships = optional(value, "relationships", []);
  requireWorkspace(Array.isArray(relationships), "Relationships must be a list.");
  const seen = /* @__PURE__ */ new Set();
  for (const edge of relationships) {
    requireWorkspace(isObject(edge), "Each relationship must be an object.");
    requireWorkspace(typeof edge.type === "string" && typeof edge.from === "string" && typeof edge.to === "string", "A relationship needs string type, from, and to fields.");
    requireWorkspace(RELATIONSHIPS.includes(edge.type), `Unknown relationship type: ${edge.type}`);
    const key = JSON.stringify([edge.type, edge.from, edge.to]);
    requireWorkspace(components.has(edge.from) && components.has(edge.to) && edge.from !== edge.to && !seen.has(key), `Invalid or repeated relationship: ${key}`);
    seen.add(key);
  }
  const orders = { starts_after: [], deploys_after: [] };
  for (const kind of ["starts_after", "deploys_after"]) {
    const remaining = new Map([...components.keys()].map((key) => [key, /* @__PURE__ */ new Set()]));
    for (const edge of relationships) if (edge.type === kind) remaining.get(edge.from).add(edge.to);
    while (remaining.size) {
      const ready = [...remaining].filter(([, deps]) => !deps.size).map(([key]) => key).sort();
      requireWorkspace(ready.length, `Cycle in ${kind}: ${[...remaining.keys()].sort().join(", ")}`);
      orders[kind].push(...ready);
      for (const key of ready) remaining.delete(key);
      for (const dependencies of remaining.values()) for (const key of ready) dependencies.delete(key);
    }
  }
  const capabilities = optional(value, "capabilities", []);
  requireWorkspace(Array.isArray(capabilities), "Capabilities must be a list.");
  seen.clear();
  for (const item of capabilities) {
    requireWorkspace(isObject(item), "Each capability must be an object.");
    validateId(item.id);
    requireWorkspace(!seen.has(item.id) && Array.isArray(item.requires) && item.requires.length, `Invalid or repeated capability: ${item.id}`);
    for (const id of item.requires) {
      validateId(id);
      requireWorkspace(components.has(id), `Unknown component for ${item.id}: ${id}`);
    }
    requireWorkspace(item.requires.length === new Set(item.requires).size, `Repeated required component for ${item.id}`);
    seen.add(item.id);
  }
  return { components: Object.fromEntries(components), orders, capabilities };
}
function validateManifest(value) {
  schema(value);
  validateLanguage(value.language);
  if ("local_context" in value) requireWorkspace(typeof value.local_context === "string" && value.local_context.endsWith(".local.md") && !!relativePath(value.local_context), "Expected a relative *.local.md entry");
  docRefs(optional(value, "documents", []));
  if ("onboarding" in value) validateOnboarding(value.onboarding);
  requireWorkspace(Array.isArray(value.members), "Workspace members must be a list.");
  const members = /* @__PURE__ */ new Map(), remotes = /* @__PURE__ */ new Set();
  for (const member of value.members) {
    requireWorkspace(isObject(member), "Each workspace member must be an object.");
    validateId(member.id);
    requireWorkspace(!members.has(member.id), `Repeated member ID: ${member.id}`);
    requireWorkspace(typeof member.mode === "string" && MODES.includes(member.mode), `Unknown member mode for ${member.id}.`);
    if ("language" in member) validateLanguage(member.language);
    if ("remote" in member) {
      const remote = member.remote;
      requireWorkspace(typeof remote === "string" && fullMatch(/^[^/@?#\s]+\/[^@?#\s]+$/, remote) && !remote.includes("://"), `Invalid credential-free remote identity for ${member.id}.`);
      requireWorkspace(!remotes.has(remote), `Repeated remote identity for ${member.id}: ${remote}`);
      remotes.add(remote);
    }
    docRefs(optional(member, "documents", []));
    fingerprints(optional(member, "sources", []));
    docRefs(optional(member, "source_files", []));
    const reviews = optional(member, "document_reviews", []);
    requireWorkspace(Array.isArray(reviews), "Document reviews must be a list.");
    const seen = /* @__PURE__ */ new Set();
    for (const review of reviews) {
      fingerprints([review]);
      const item = review;
      if ("onboarding_sha256" in item) fingerprints([{ path: item.path, sha256: item.onboarding_sha256 }]);
      requireWorkspace(!seen.has(item.path) && (member.documents ?? []).includes(item.path), `Repeated or unlinked document review for ${member.id}: ${item.path}`);
      fingerprints(item.sources);
      seen.add(item.path);
    }
    members.set(member.id, member);
  }
  for (const [id, member] of members) {
    const dependencies = optional(member, "depends_on", []);
    requireWorkspace(Array.isArray(dependencies), `Dependencies for ${id} must be a list of member IDs.`);
    for (const dep of dependencies) {
      validateId(dep);
      requireWorkspace(dep !== id && members.has(dep), `Invalid dependency for ${id}: ${dep}`);
    }
  }
  if ("workspace_member" in value) requireWorkspace(typeof value.workspace_member === "string" && members.has(value.workspace_member), "Unknown workspace member");
  const result = Object.fromEntries(members);
  componentModel(value, result);
  return result;
}
function sourceSnapshot(inventory) {
  return inventory.filter((item) => typeof item.sha256 === "string").map(({ path: path6, sha256 }) => ({ path: path6, sha256 }));
}
function documentFreshness(review, digest, current, invalidSources, onboardingDigest) {
  if (!review) return "no review baseline";
  if (digest !== review.sha256) return "document changed or unavailable";
  if (review.onboarding_sha256 !== onboardingDigest) return "initialization choices changed";
  if (invalidSources || !equal(fingerprints(review.sources), Object.fromEntries(Object.entries(current).filter(([path6]) => path6 !== review.path)))) return "review inputs changed";
  return null;
}

// src/adapters/files.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
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
function expandUser(file) {
  return file === "~" ? os.homedir() : file.startsWith("~/") ? path.join(os.homedir(), file.slice(2)) : file;
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

// src/adapters/local-context.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";

// src/adapters/git.ts
import path2 from "node:path";
import { spawnSync } from "node:child_process";
function git(directory, ...args) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const key of ["GIT_DIR", "GIT_COMMON_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_PREFIX"]) delete env[key];
  const result = spawnSync("git", ["-C", directory, ...args], { env, encoding: "utf8", timeout: 15e3, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout.replace(/\n+$/, "") : null;
}
function normalizedRemote(value) {
  if (!value) return null;
  let host, remotePath;
  if (value.includes("://")) {
    try {
      const url = new URL(value), protocol = url.protocol.slice(0, -1);
      if (!["http", "https", "ssh", "git"].includes(protocol) || !url.hostname) return null;
      host = url.hostname.toLowerCase();
      const defaults = { http: "80", https: "443", ssh: "22", git: "9418" };
      if (url.port && url.port !== defaults[protocol]) host += `:${url.port}`;
      remotePath = url.pathname;
    } catch {
      return null;
    }
  } else {
    const match = /^(?:[^@:/]+@)?([^:/]+):([^?#]+)(?:[?#].*)?$/.exec(value);
    if (!match) return null;
    host = match[1].toLowerCase();
    remotePath = match[2];
  }
  remotePath = remotePath.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  if (!remotePath || remotePath.split("/").some((part) => ["", ".", ".."].includes(part))) return null;
  return `${host}/${remotePath}`;
}
function checkout(directory) {
  const rootValue = stat(directory)?.isDirectory() ? git(directory, "rev-parse", "--show-toplevel") : null;
  requireWorkspace(rootValue, `Not a Git working directory: ${directory}`);
  const root = resolvePath(rootValue), commonValue = git(root, "rev-parse", "--git-common-dir");
  requireWorkspace(commonValue, `Could not determine the Git repository identity: ${root}`);
  const common = resolvePath(path2.resolve(root, commonValue));
  const superproject = git(root, "rev-parse", "--show-superproject-working-tree"), gitDir = git(root, "rev-parse", "--absolute-git-dir");
  const kind = superproject ? "submodule" : gitDir && resolvePath(gitDir) !== common ? "worktree" : "checkout";
  return {
    path: root,
    git_common_dir: common,
    kind,
    branch: git(root, "symbolic-ref", "--quiet", "--short", "HEAD"),
    head: git(root, "rev-parse", "--verify", "HEAD"),
    remote: normalizedRemote(git(root, "config", "--get", "remote.origin.url")),
    harness: ["AGENTS.md", "CLAUDE.md"].some((name) => stat(path2.join(root, name))?.isFile())
  };
}

// src/adapters/local-context.ts
var MissingLocalContext = class extends Error {
  name = "MissingLocalContext";
};
function machineFingerprint() {
  return hash(json([os2.hostname(), os2.platform(), os2.arch(), os2.homedir()]));
}
function regular(root, relative2) {
  const file = within(root, relative2), info = stat(file, false);
  requireWorkspace(!info || info.isFile() && !info.isSymbolicLink(), `Local context must be a regular file: ${relative2}`);
  requireWorkspace(!info || info.size <= 1024 * 1024, "Local context exceeds the 1 MiB limit");
  return file;
}
function assertPrivate(root, relative2, requireIgnored = true) {
  regular(root, relative2);
  if (!git(root, "rev-parse", "--show-toplevel")) return;
  const aliases = [.../* @__PURE__ */ new Set([relative2, path3.relative(root, resolvePath(within(root, relative2))).split(path3.sep).join("/")])];
  for (const alias of aliases) {
    requireWorkspace(git(root, "ls-files", "--error-unmatch", "--", alias) === null, `Untrack ${alias} before maintaining local context`);
    if (requireIgnored) requireWorkspace(git(root, "check-ignore", "--quiet", "--", alias) !== null, `Git does not ignore local context: ${alias}`);
  }
}
function localContextEntry(root, explicit) {
  const manifest = readJson(within(root, ".harness/workspace.json"), {});
  if (explicit !== void 0) return localContextPath(explicit);
  if (isObject(manifest) && manifest.local_context !== void 0) return localContextPath(manifest.local_context);
  const candidates = [];
  for (const folder of ["", ".harness/docs"]) {
    const directory = folder ? within(root, folder) : root;
    if (!stat(directory)?.isDirectory()) continue;
    for (const name of fs2.readdirSync(directory).filter((name2) => name2.endsWith(".local.md")).slice(0, 200)) {
      const relative2 = [folder, name].filter(Boolean).join("/");
      const file = regular(root, relative2);
      if (fs2.readFileSync(file, "utf8").includes(LOCAL_START)) candidates.push(relative2);
    }
  }
  requireWorkspace(candidates.length <= 1, "Multiple local-context entries; choose --local-context explicitly");
  return candidates[0] ?? (stat(within(root, "AGENTS.local.md")) ? "AGENTS.local.md" : DEFAULT_LOCAL_CONTEXT);
}
function normalize(root, input) {
  return { ...input, checkouts: Object.fromEntries(Object.entries(input.checkouts).map(([id, binding]) => [id, {
    path: resolvePath(path3.resolve(root, expandUser(binding.path))),
    git_common_dir: resolvePath(path3.resolve(root, expandUser(binding.git_common_dir)))
  }])) };
}
function merge(left, right, field = "") {
  if (left === void 0) return structuredClone(right);
  if (right === void 0 || equal(left, right)) return structuredClone(left);
  if (isObject(left) && isObject(right)) return Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [key, merge(left[key], right[key], field ? `${field}.${key}` : key)]));
  throw new Error(`Conflicting Markdown and legacy local-context field: ${field}; reconcile it before migration`);
}
function readLocalContext(root, options = {}) {
  root = resolvePath(root);
  const relative2 = localContextEntry(root, options.file), file = regular(root, relative2), legacy = regular(root, LEGACY_LOCAL_CONTEXT);
  const markdown = stat(file) ? fs2.readFileSync(file, "utf8") : "";
  if (stat(file)) assertPrivate(root, relative2, !options.planning);
  if (stat(legacy)) assertPrivate(root, LEGACY_LOCAL_CONTEXT, !options.planning);
  const parsed = parseLocalContext(markdown);
  let old;
  if (stat(legacy)) {
    const input = readJson(legacy);
    if (isObject(input)) {
      const fields = ["schema_version", "checkouts", "machine", "tools", "environment", "access", "execution", "state", "onboarding_status"];
      const extra = Object.fromEntries(Object.entries(input).filter(([key]) => !fields.includes(key)));
      for (const key of Object.keys(extra)) delete input[key];
      if (Object.keys(extra).length) input.state = { ...isObject(input.state) ? input.state : {}, legacy_fields: extra };
    }
    validateLocalContext(input);
    old = normalize(root, input);
  }
  const data = merge(parsed ? normalize(root, parsed) : void 0, old);
  return {
    path: relative2,
    markdown,
    data: data ?? { schema_version: 1, checkouts: {} },
    format: parsed ? "markdown" : old ? "legacy-json" : "missing",
    legacy: old ? LEGACY_LOCAL_CONTEXT : null,
    machine_matches: !data?.machine || data.machine === machineFingerprint()
  };
}
function memberBinding(root, id) {
  const context = readLocalContext(root);
  if (!context.machine_matches) throw new MissingLocalContext("Local context belongs to another machine; rebind and verify readiness");
  const members = validateManifest(readJson(within(root, ".harness/workspace.json")));
  requireWorkspace(Object.hasOwn(members, id), `Unregistered source member: ${id}`);
  const binding = context.data.checkouts[id];
  if (!binding) throw new MissingLocalContext(`Missing local checkout binding: ${id}; run workspace plan --member ${id} MODE PATH, then apply`);
  if (!stat(binding.path)?.isDirectory()) throw new MissingLocalContext(`Local checkout is unavailable: ${id}; supply its current path and rebind`);
  const actual = checkout(binding.path);
  requireWorkspace(actual.path === binding.path && actual.git_common_dir === binding.git_common_dir && actual.remote === (members[id].remote ?? null), `Local checkout identity differs for ${id}; inspect and rebind it`);
  return binding;
}
function localBindingFingerprint(root) {
  const context = readLocalContext(root);
  const identity = Object.fromEntries(Object.entries(context.data.checkouts).map(([id, binding]) => {
    const info = stat(binding.git_common_dir);
    return [id, { ...binding, head: git(binding.path, "rev-parse", "--verify", "HEAD"), branch: git(binding.path, "symbolic-ref", "--quiet", "--short", "HEAD"), ...info ? { device: info.dev, inode: info.ino } : {} }];
  }));
  return hash(json({
    machine: machineFingerprint(),
    recorded_machine: context.data.machine ?? null,
    checkouts: identity,
    tools: context.data.tools ?? {},
    environment: context.data.environment ?? {},
    access: context.data.access ?? {}
  }));
}
function localContextReport(root) {
  const context = readLocalContext(root), manifest = readJson(within(root, ".harness/workspace.json"), {});
  const bindings = {}, errors = [], pending = [];
  if (context.machine_matches) for (const id of Object.keys(context.data.checkouts)) {
    try {
      bindings[id] = memberBinding(root, id);
    } catch (error) {
      (error instanceof MissingLocalContext ? pending : errors).push(error.message);
    }
  }
  const missing = (manifest.members ?? []).map((member) => member.id).filter((id) => !bindings[id]);
  return {
    status: errors.length ? "failed" : context.machine_matches && !missing.length && context.format === "markdown" ? "available" : "pending",
    errors,
    pending,
    readiness: "not established by local context availability",
    path: context.path,
    format: context.format,
    machine_matches: context.machine_matches,
    missing,
    binding_sha256: localBindingFingerprint(root),
    data: context.data,
    next_action: context.format === "legacy-json" ? "Preview/apply workspace migration to *.local.md; legacy input is read-only" : missing.length || !context.machine_matches ? "Rebind selected checkouts and verify local tools, access and execution on this machine" : null
  };
}

// src/adapters/document-inventory.ts
import path4 from "node:path";
var EXCLUDED = /* @__PURE__ */ new Set([".git", ".venv", ".build", ".swiftpm", ".worktrees", "node_modules", "vendor", "target", "dist", "build", "coverage", "__pycache__"]);
var TOOL_DIRECTORIES = [
  ".harness/runtime/",
  ".harness/skills/",
  ".harness/commands/",
  ".harness/agents/",
  ".harness/rules/",
  ".harness/resources/",
  ".harness/state/",
  ".agents/skills/",
  ".codex/skills/",
  ".codex/agents/",
  ".codex/rules/",
  ".codex/hooks/",
  ".claude/skills/",
  ".claude/commands/",
  ".claude/agents/",
  ".claude/rules/",
  ".claude/hooks/",
  ".cursor/rules/"
];
var ENTRYPOINTS = /* @__PURE__ */ new Set(["agents.md", "agent.md", "claude.md", "gemini.md", "skill.md"]);
function inspectExistingDocuments(root, member, listing, profile, writable) {
  const folder = profile?.documentation?.root ?? (profile?.harness?.layout === "centralized" ? ".harness/docs" : "docs/harness");
  const choices = profile?.documentation?.existing_documents ?? [];
  const documents = [];
  for (const relative2 of [...new Set(listing.split("\0"))].filter(Boolean).sort()) {
    if (isLocalResource(relative2) || !/\.(md|markdown|mdx|rst|adoc)$/i.test(relative2) || relative2.startsWith(`${folder}/`) || relative2.split("/").some((part) => EXCLUDED.has(part)) || TOOL_DIRECTORIES.some((prefix) => relative2.startsWith(prefix) || relative2.includes(`/${prefix}`)) || ENTRYPOINTS.has(path4.posix.basename(relative2).toLowerCase())) continue;
    let file;
    try {
      file = within(root, relative2);
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      continue;
    }
    if (!stat(file, false)?.isFile()) continue;
    const choice = choices.find((item) => item.member === member && item.path === relative2);
    const document = { path: relative2, sha256: fileHash(file), action: choice?.action ?? "undecided" };
    if (choice?.destination) {
      document.destination = choice.destination;
      document.destination_exists = !!stat(within(root, choice.destination), false);
    }
    documents.push(document);
  }
  const unanswered = documents.some((item) => item.action === "undecided");
  return {
    root: folder,
    member_writable: writable,
    documents,
    status: unanswered ? "needs-input" : documents.some((item) => item.action === "move") ? "moves-pending" : documents.length ? "reviewed" : "none",
    question: unanswered ? `Existing documents were found outside ${folder}/ in ${member}. After reviewing their purpose and proposed destinations, which should move into the harness and which should stay in place?` : null,
    execution: "not run",
    limits: "Git-listed Markdown/MDX/reStructuredText/AsciiDoc files only; ignored files, dependencies, build output, symlinks and host/Skill entry points are excluded. Filenames do not establish AI authorship. Destinations are member-relative; read-only members need an explicit scope change before a move."
  };
}

// src/adapters/workspace.ts
var MANIFEST = "workspace.json";
var LOCAL = "local-context";
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "vendor", "target", "dist", "build", "coverage", "__pycache__"]);
var PROJECT_FILES = { "package.json": "JavaScript", "tsconfig.json": "TypeScript", "pyproject.toml": "Python", "setup.py": "Python", "setup.cfg": "Python", "requirements.txt": "Python", Pipfile: "Python", "go.mod": "Go", "Cargo.toml": "Rust", "pom.xml": "Java", "build.gradle": "JVM", "build.gradle.kts": "Kotlin", Gemfile: "Ruby", "composer.json": "PHP" };
var LOCKFILES = /* @__PURE__ */ new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "uv.lock", "poetry.lock", "Pipfile.lock", "go.sum", "Cargo.lock", ".node-version", ".nvmrc", ".python-version", ".tool-versions"]);
var FRAMEWORKS = { react: "React", next: "Next.js", vue: "Vue", nuxt: "Nuxt", express: "Express", "@nestjs/core": "NestJS", fastapi: "FastAPI", django: "Django", flask: "Flask" };
function discover(options = {}) {
  const depth = options.depth ?? 3;
  requireWorkspace(Number.isSafeInteger(depth) && depth >= 0, "--depth must be zero or greater.");
  const paths = /* @__PURE__ */ new Map(), issues = [];
  function add(candidate) {
    try {
      const record = checkout(candidate);
      paths.set(record.path, record);
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      issues.push(error.message);
    }
  }
  function visit(directory, remaining) {
    if (stat(path5.join(directory, ".git"))) {
      add(directory);
      if (!options.includeNested) return;
    }
    if (!remaining) return;
    let children;
    try {
      children = fs3.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      issues.push(error.message);
      return;
    }
    for (const child of children.sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (!child.name.startsWith(".") && !SKIP_DIRS.has(child.name) && child.isDirectory() && !child.isSymbolicLink()) visit(path5.join(directory, child.name), remaining - 1);
    }
  }
  let explicit = options.repo ?? [], directories = options.directory ?? [];
  if (!explicit.length && !directories.length) {
    const current = options.cwd ?? process.cwd();
    if (git(current, "rev-parse", "--show-toplevel")) explicit = [current];
    else directories = [current];
  }
  for (const directory of explicit) add(resolvePath(directory));
  for (const directory of directories) {
    const root = resolvePath(directory);
    if (stat(root)?.isDirectory()) visit(root, depth);
    else issues.push(`Directory is unavailable: ${root}`);
  }
  const groups = /* @__PURE__ */ new Map();
  for (const root of [...paths.keys()].sort()) {
    const item = paths.get(root), key = JSON.stringify(item.remote ? ["remote", item.remote] : ["git", item.git_common_dir]);
    groups.set(key, [...groups.get(key) ?? [], item]);
  }
  return { repositories: [...groups.values()].map((items) => ({ remote: items[0].remote, checkouts: items })), issues };
}
function sourceCategory(file) {
  const name = path5.posix.basename(file);
  if (Object.hasOwn(PROJECT_FILES, name) || LOCKFILES.has(name) || name.endsWith(".csproj") || name.startsWith("requirements") && name.endsWith(".txt")) return "project";
  if (["Makefile", "justfile", "Taskfile.yml", "Taskfile.yaml", "tox.ini", "pytest.ini", "AGENTS.md", "CLAUDE.md", "README.md", "CONTRIBUTING.md"].includes(name)) return "entrypoint";
  if ([".env.example", ".env.sample", ".env.template", "example.env"].includes(name)) return "configuration";
  if (["Dockerfile", "compose.", "docker-compose."].some((prefix) => name.startsWith(prefix)) || file.startsWith(".github/workflows/") || [".gitlab-ci.yml", "Jenkinsfile", "azure-pipelines.yml"].includes(name)) return "delivery";
  return null;
}
function inspectManifest(file, name, result) {
  if (!["package.json", "pyproject.toml"].includes(name) && !name.startsWith("requirements")) return;
  try {
    const data = fs3.readFileSync(file, "utf8");
    const dependencies = /* @__PURE__ */ new Set();
    if (name === "package.json") {
      const pkg = JSON.parse(data);
      if (!isObject(pkg)) throw new Error("Expected package object");
      const scripts = pkg.scripts ?? {};
      if (isObject(scripts)) result.script_names = Object.keys(scripts).sort();
      for (const key of ["dependencies", "devDependencies", "peerDependencies"]) if (isObject(pkg[key])) for (const dep of Object.keys(pkg[key])) dependencies.add(dep);
      if (dependencies.has("typescript")) result.typescript = true;
    } else if (name === "pyproject.toml") {
      const document = parse(data, { integersAsBigInt: "asNeeded" });
      const project = document.project ?? {}, tool = document.tool ?? {};
      if (!isObject(project) || !isObject(tool)) throw new Error("Invalid project tables");
      const poetry = tool.poetry ?? {};
      if (!isObject(poetry)) throw new Error("Invalid poetry table");
      const poetryDeps = poetry.dependencies ?? {}, declarations = project.dependencies ?? [];
      if (!isObject(poetryDeps) || !Array.isArray(declarations)) throw new Error("Invalid dependency declarations");
      for (const dep of Object.keys(poetryDeps)) dependencies.add(dep);
      for (const item of declarations) if (typeof item === "string") {
        const match = /^[A-Za-z0-9_.-]+/.exec(item);
        if (match) dependencies.add(match[0]);
      }
    } else for (const match of data.matchAll(/^[A-Za-z0-9][A-Za-z0-9_.-]*/gm)) dependencies.add(match[0]);
    result.frameworks = [...new Set([...dependencies].map((dep) => dep.toLowerCase()).filter((dep) => Object.hasOwn(FRAMEWORKS, dep)).map((dep) => FRAMEWORKS[dep]))].sort();
  } catch {
    result.parse_error = true;
  }
}
function analyze(root, extraSources = []) {
  const listing = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z");
  requireWorkspace(listing !== null, `Could not list repository files: ${root}`);
  const inventory = [];
  for (const entry of [.../* @__PURE__ */ new Set([...listing.split("\0"), ...extraSources])].filter(Boolean).sort()) {
    if (isLocalResource(entry)) {
      requireWorkspace(!extraSources.includes(entry), `Local context cannot be a shared source: ${entry}`);
      continue;
    }
    if (entry.split("/").some((part) => SKIP_DIRS.has(part) || [".venv", ".git", ".worktrees"].includes(part))) {
      requireWorkspace(!extraSources.includes(entry), `Explicit source is in an excluded directory: ${entry}`);
      continue;
    }
    let file;
    try {
      file = within(root, entry);
    } catch (error) {
      if (extraSources.includes(entry) || !(error instanceof WorkspaceError)) throw error;
      continue;
    }
    const category = sourceCategory(entry) ?? (extraSources.includes(entry) ? "explicit" : null);
    if (!category || stat(file, false)?.isSymbolicLink() && !extraSources.includes(entry)) continue;
    const result = { path: entry, category };
    if (!stat(file)?.isFile() || stat(file, false)?.isSymbolicLink()) result.unavailable = true;
    else {
      result.sha256 = fileHash(file);
      const name = path5.basename(file);
      result.language = Object.hasOwn(PROJECT_FILES, name) ? PROJECT_FILES[name] : null;
      if (name.endsWith(".csproj")) result.language = "C#";
      else if (name.startsWith("requirements")) result.language = "Python";
      inspectManifest(file, name, result);
    }
    inventory.push(result);
  }
  return inventory;
}
function manifestPaths(root, entry = localContextEntry(root)) {
  const state = path5.join(root, ".harness"), info = stat(state, false);
  requireWorkspace(!info || info.isDirectory() && !info.isSymbolicLink(), `Expected a regular state directory: ${state}`);
  const paths = {
    [MANIFEST]: within(root, ".harness/workspace.json"),
    [LOCAL]: within(root, entry),
    ".gitignore": within(root, ".harness/.gitignore"),
    "root-ignore": within(root, ".gitignore"),
    legacy: within(root, LEGACY_LOCAL_CONTEXT)
  };
  for (const file of Object.values(paths)) {
    const info2 = stat(file, false);
    requireWorkspace(!info2 || info2.isFile() && !info2.isSymbolicLink(), `Expected a regular state file: ${file}`);
  }
  return paths;
}
function fileState(paths) {
  return Object.fromEntries(Object.entries(paths).map(([name, file]) => [name, stat(file) ? fileHash(file) : null]));
}
function assertLocalUntracked(root, entry = localContextEntry(root)) {
  assertPrivate(root, entry, false);
  assertPrivate(root, LEGACY_LOCAL_CONTEXT, false);
}
function makePlan(root, selections = [], language = null, overrides = [], options = {}) {
  return planInternal(root, selections, language, overrides, options, false);
}
function planInternal(root, selections, language, overrides, options, lockHeld) {
  root = resolvePath(root);
  requireWorkspace(stat(root)?.isDirectory(), `Workspace directory is unavailable: ${root}`);
  const previousEntry = localContextEntry(root);
  if (options.local_context !== void 0 && options.local_context !== previousEntry) {
    const previous = readLocalContext(root, { planning: true });
    requireWorkspace(previous.format !== "markdown", `Local context already exists at ${previousEntry}; preserve/reconcile that entry before selecting another authority`);
  }
  const context = readLocalContext(root, { file: options.local_context, planning: true });
  const paths = manifestPaths(root, context.path);
  if (context.legacy) {
    const receiptFile = within(root, ".harness/generated.json");
    if (stat(receiptFile)) {
      const receipt = readJson(receiptFile);
      const runtime = isObject(receipt) && Array.isArray(receipt.files) ? receipt.files.find((file) => isObject(file) && file.path === ".harness/runtime/local-context.mjs") : void 0;
      requireWorkspace(isObject(runtime) && typeof runtime.sha256 === "string" && stat(within(root, runtime.path))?.isFile() && fileHash(within(root, runtime.path)) === runtime.sha256, "Refresh generated local-context consumers with the saved harness spec before retiring legacy JSON; reconcile custom project locators too");
      const saved = readJson(within(root, ".harness/harness.json"), {});
      const resources = isObject(saved) ? [saved.resources, ...Array.isArray(saved.skills) ? saved.skills.filter(isObject).map((skill) => skill.resources) : []].flatMap((value) => Array.isArray(value) ? value : []) : [];
      for (const resource of resources) if (isObject(resource) && typeof resource.path === "string" && /\.(?:[cm]?js|ts|py|sh)$/.test(resource.path) && typeof resource.body === "string" && resource.body.includes("workspace.local.json")) requireWorkspace(false, `Reconcile declared legacy locator resource before migration: ${resource.path}; use the shared local-context runtime`);
    }
  }
  requireWorkspace(lockHeld || !stat(path5.join(root, ".harness/.workspace.lock"), false), "Workspace apply is locked. Recover an interrupted apply and create a new plan.");
  assertLocalUntracked(root, context.path);
  const before = fileState(paths);
  const shared = readJson(paths[MANIFEST], { schema_version: 1, language: "en", members: [] });
  let local = structuredClone(context.data);
  if (!context.machine_matches) {
    const snapshot = { machine: local.machine, tools: local.tools, access: local.access, execution: local.execution, onboarding_status: local.onboarding_status };
    const history = isObject(local.state?.machine_history) ? local.state.machine_history : {};
    local.state = { ...local.state, machine_history: { ...history, [hash(json(snapshot))]: snapshot }, previous_machine_state: snapshot };
    local.tools = {};
    local.access = {};
    local.execution = { status: "pending", reason: "Machine changed; verify readiness again" };
    local.onboarding_status = {};
  }
  if (options.local_patch !== void 0) {
    requireWorkspace(isObject(options.local_patch) && !("schema_version" in options.local_patch) && !("machine" in options.local_patch), "Local patch must contain state fields, not schema_version or machine");
    const mergePatch = (current, patch) => isObject(current) && isObject(patch) ? Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(current), ...Object.keys(patch)])].map((key) => [key, Object.hasOwn(patch, key) ? mergePatch(current[key], patch[key]) : current[key]])) : structuredClone(patch);
    const patched = mergePatch(local, options.local_patch);
    validateLocalContext(patched);
    local = patched;
  }
  local.machine = machineFingerprint();
  const members = validateManifest(shared), bindings = local.checkouts;
  const manifest = shared;
  manifest.local_context = context.path;
  if (options.profile !== void 0) {
    validateOnboarding(options.profile);
    manifest.onboarding = structuredClone(options.profile);
  }
  if (options.profile?.language && language !== null) requireWorkspace(options.profile.language === language, "--language differs from the supplied profile language; choose one language before previewing");
  if (language !== null) {
    validateLanguage(language);
    manifest.language = language;
    if (manifest.onboarding && (language === "en" || language === "zh-CN")) manifest.onboarding.language = language;
  } else if (options.profile?.language) manifest.language = options.profile.language;
  requireWorkspace(Array.isArray(selections) && Array.isArray(overrides), "Invalid plan selections.");
  const selected = /* @__PURE__ */ new Map();
  for (const selection of selections) {
    requireWorkspace(Array.isArray(selection) && selection.length === 3, "Invalid member selection.");
    const [id, mode, directory] = selection;
    validateId(id);
    requireWorkspace(!selected.has(id) && MODES.includes(mode), `Repeated member ID or invalid member mode: ${id} ${mode}`);
    selected.set(id, [mode, checkout(resolvePath(directory))]);
  }
  const overrideById = /* @__PURE__ */ new Map();
  for (const [id, locale] of overrides) {
    requireWorkspace(selected.has(id) && !overrideById.has(id), `Language override requires a uniquely selected member: ${id}`);
    validateLanguage(locale);
    overrideById.set(id, locale);
  }
  const reviews = options.reviews ?? [], sourceFiles = options.sourceFiles ?? [];
  for (const [id, file] of [...reviews, ...sourceFiles]) {
    requireWorkspace(selected.has(id) && selected.get(id)[0] !== "register", `Source and review options need a selected analyze/init member: ${id}`);
    relativePath(file);
    requireWorkspace(!isLocalResource(file), "Local context cannot enter shared source or document review baselines");
  }
  const analysis = /* @__PURE__ */ new Map(), languages = /* @__PURE__ */ new Map();
  const documentInventories = /* @__PURE__ */ new Map();
  for (const [id, [mode, record]] of selected) {
    const old = Object.hasOwn(members, id) ? members[id] : void 0;
    requireWorkspace(!old?.remote || old.remote === record.remote, `Checkout identity changed for ${id}; review the shared member before rebinding it.`);
    for (const [otherId, binding] of Object.entries(bindings)) requireWorkspace(otherId === id || record.git_common_dir !== binding.git_common_dir, `${id} and ${otherId} refer to the same Git repository.`);
    const member = { ...old, id, mode };
    if (record.path === root) manifest.workspace_member = id;
    if (record.remote) member.remote = record.remote;
    if (overrideById.has(id)) member.language = overrideById.get(id);
    languages.set(id, member.language ?? manifest.language);
    const extra = [.../* @__PURE__ */ new Set([...member.source_files ?? [], ...sourceFiles.filter(([key]) => key === id).map(([, file]) => file)])].sort();
    if (extra.length) member.source_files = extra;
    const inventory = mode === "register" ? [] : analyze(record.path, extra);
    if (mode !== "register") {
      const listing = git(record.path, "ls-files", "--cached", "--others", "--exclude-standard", "-z");
      requireWorkspace(listing !== null, `Could not inventory existing documents: ${record.path}`);
      const writable = mode === "init" || record.path === root && manifest.onboarding?.documentation?.placement !== "members";
      documentInventories.set(id, inspectExistingDocuments(record.path, id, listing, manifest.onboarding, writable));
    }
    if (mode !== "register") member.sources = sourceSnapshot(inventory);
    const reviewed = new Map((member.document_reviews ?? []).map((item) => [item.path, item]));
    for (const file of [...new Set(reviews.filter(([key]) => key === id).map(([, file2]) => file2))].sort()) {
      const destination = within(record.path, file);
      requireWorkspace(stat(destination)?.isFile() && !stat(destination, false)?.isSymbolicLink(), `Review needs an existing regular document: ${id}/${file}`);
      requireWorkspace(!inventory.some((item) => item.unavailable || item.parse_error), `Resolve unavailable or malformed sources before reviewing ${id}/${file}`);
      reviewed.set(file, {
        path: file,
        sha256: fileHash(destination),
        sources: member.sources.filter((item) => item.path !== file),
        ...manifest.onboarding ? { onboarding_sha256: hash(json(manifest.onboarding)) } : {}
      });
      member.documents = [.../* @__PURE__ */ new Set([...member.documents ?? [], file])].sort();
    }
    if (reviewed.size) member.document_reviews = [...reviewed.keys()].sort().map((key) => reviewed.get(key));
    members[id] = member;
    bindings[id] = { path: record.path, git_common_dir: record.git_common_dir };
    analysis.set(id, inventory);
  }
  manifest.members = Object.keys(members).sort().map((key) => members[key]);
  for (const choice of manifest.onboarding?.documentation?.existing_documents ?? []) requireWorkspace(Object.hasOwn(members, choice.member), `Existing document choice references an unknown member: ${choice.member}`);
  validateLocalContext(local);
  for (const [id, binding] of Object.entries(bindings)) {
    const actual = checkout(resolvePath(path5.resolve(root, expandUser(binding.path))));
    requireWorkspace(Object.hasOwn(members, id) && actual.git_common_dir === resolvePath(path5.resolve(root, expandUser(binding.git_common_dir))) && actual.remote === (members[id].remote ?? null), `Local checkout identity differs for ${id}; inspect and rebind it`);
    bindings[id] = { path: actual.path, git_common_dir: actual.git_common_dir };
  }
  validateManifest(manifest);
  renderLocalContext(context.markdown, local);
  requireWorkspace(equal(before, fileState(paths)), "Workspace files changed while planning. Preview again.");
  const request = { language, member_languages: overrides, members: [...selected].map(([id, [mode, record]]) => [id, mode, record.path]) };
  if (reviews.length) request.reviews = reviews;
  if (sourceFiles.length) request.source_files = sourceFiles;
  if (options.profile !== void 0) request.profile = structuredClone(options.profile);
  if (options.local_context !== void 0) request.local_context = options.local_context;
  if (options.local_patch !== void 0) request.local_patch = structuredClone(options.local_patch);
  return {
    schema_version: 1,
    workspace: root,
    before,
    request,
    selections: Object.fromEntries([...selected].map(([id, [, record]]) => [id, record])),
    effective_languages: Object.fromEntries(languages),
    analysis: Object.fromEntries(analysis),
    document_consolidation: Object.fromEntries(documentInventories),
    shared: manifest,
    local,
    local_context: { path: context.path, migration: !!context.legacy, backup: context.legacy ? `.harness/local-backups/workspace.local.${before.legacy}.json.bak` : null, markdown_backup: context.legacy && before[LOCAL] ? `.harness/local-backups/${path5.basename(context.path)}.${before[LOCAL]}.bak` : null }
  };
}
function applyPlan(input, options = {}) {
  schema(input);
  requireWorkspace(typeof input.workspace === "string" && isObject(input.request), "Invalid plan. Create a new preview with the plan command.");
  const old = input, request = old.request, root = old.workspace;
  const planOptions = { reviews: request.reviews, sourceFiles: request.source_files, profile: request.profile, local_context: request.local_context, local_patch: request.local_patch };
  let fresh = makePlan(root, request.members, request.language, request.member_languages, planOptions);
  requireWorkspace(equal(fresh, old), "The workspace, selected checkout, or analysis changed since preview. Create a new plan.");
  let paths = manifestPaths(root, fresh.local_context.path);
  const state = path5.dirname(paths[MANIFEST]);
  const directories = [];
  fs3.mkdirSync(state, { recursive: true });
  paths = manifestPaths(root, fresh.local_context.path);
  const lock = path5.join(state, ".workspace.lock");
  try {
    fs3.mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new WorkspaceError(`Apply is locked: ${lock}. Recover the interrupted apply and create a new plan.`);
  }
  const backups = /* @__PURE__ */ new Map(), written = /* @__PURE__ */ new Map(), changes = [];
  const write = options.write ?? atomicWrite;
  try {
    fresh = planInternal(root, request.members, request.language, request.member_languages, planOptions, true);
    requireWorkspace(equal(fresh, old), "Workspace changed before the apply lock was acquired. Create a new plan.");
    for (const [name, file] of Object.entries(paths)) {
      const info = stat(file);
      backups.set(name, info ? { content: fs3.readFileSync(file), mode: info.mode & 511 } : null);
    }
    const addRules = (original, rules) => original + (original && !original.endsWith("\n") ? "\n" : "") + rules.filter((rule) => !original.split(/\r?\n/).includes(rule)).map((rule) => rule + "\n").join("");
    const ignores = addRules(backups.get(".gitignore")?.content.toString("utf8") ?? "", ["/.workspace.lock/", "/workspace.local.json", "/local-backups/", "/local-evidence/", "*.local.json", "*.local.md"]);
    const rootIgnores = addRules(backups.get("root-ignore")?.content.toString("utf8") ?? "", ["*.local.md", "*.local.json"]);
    const context = readLocalContext(root, { file: fresh.local_context.path, planning: true });
    const markdown = renderLocalContext(context.markdown, fresh.local);
    const payloads = [[".gitignore", ignores, 420], ["root-ignore", rootIgnores, 420], [LOCAL, markdown, 384], [MANIFEST, json(fresh.shared), 420]];
    for (const [name, relative2, source] of [["backup", fresh.local_context.backup, "legacy"], ["markdown-backup", fresh.local_context.markdown_backup, LOCAL]]) {
      if (!relative2) continue;
      const backup = within(root, relative2), original = backups.get(source).content;
      requireWorkspace(!stat(backup, false)?.isSymbolicLink(), "Migration recovery copy must be a regular file");
      paths[name] = backup;
      const previous = stat(backup);
      requireWorkspace(!previous || fs3.readFileSync(backup).equals(original), "Migration backup differs; preserve it and investigate");
      backups.set(name, previous ? { content: fs3.readFileSync(backup), mode: previous.mode & 511 } : null);
      payloads.splice(2, 0, [name, original.toString("utf8"), 384]);
    }
    for (const [name, content, mode] of payloads) {
      const file = paths[name];
      manifestPaths(root, fresh.local_context.path);
      within(root, path5.relative(root, file));
      requireWorkspace(!stat(file, false)?.isSymbolicLink(), `Workspace output became a symlink: ${file}`);
      if (name === LOCAL) assertPrivate(root, fresh.local_context.path);
      if (stat(file) && fs3.readFileSync(file).equals(Buffer.from(content))) continue;
      if (name !== "backup" && name !== "markdown-backup") requireWorkspace((stat(file) ? fileHash(file) : null) === fresh.before[name], `Workspace file changed during apply: ${file}`);
      if (name === LOCAL) assertPrivate(root, fresh.local_context.path);
      if (name === "backup" || name === "markdown-backup") assertPrivate(root, path5.relative(root, file));
      const missing = [];
      let parent = path5.dirname(file);
      while (!stat(parent)) {
        missing.push(parent);
        parent = path5.dirname(parent);
      }
      for (const directory of missing.reverse()) {
        fs3.mkdirSync(directory);
        directories.push(directory);
      }
      try {
        write(file, content, mode);
      } finally {
        if (stat(file, false)?.isFile() && fileHash(file) === hash(content)) written.set(name, hash(content));
      }
      changes.push(path5.relative(root, file));
    }
    if (fresh.local_context.migration) {
      within(root, LEGACY_LOCAL_CONTEXT);
      requireWorkspace(fileHash(paths.legacy) === fresh.before.legacy, "Legacy local context changed during migration");
      fs3.unlinkSync(paths.legacy);
      written.set("legacy", "deleted");
      changes.push(LEGACY_LOCAL_CONTEXT);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const [name, digest] of [...written].reverse()) {
      const file = paths[name];
      try {
        within(root, path5.relative(root, file));
        if ((digest === "deleted" ? !!stat(file) : !stat(file) || fileHash(file) !== digest) || stat(file, false)?.isSymbolicLink()) {
          rollbackErrors.push(`${file}: changed by another writer`);
          continue;
        }
        const backup = backups.get(name);
        if (!backup) fs3.unlinkSync(file);
        else write(file, backup.content, backup.mode);
      } catch {
        rollbackErrors.push(`${file}: restore failed`);
      }
    }
    for (const directory of directories.reverse()) if (stat(directory, false)?.isDirectory() && resolvePath(directory) === directory && !fs3.readdirSync(directory).length) fs3.rmdirSync(directory);
    if (rollbackErrors.length) throw new WorkspaceError("Apply failed and some files need manual recovery: " + rollbackErrors.join("; "));
    throw error;
  } finally {
    fs3.rmdirSync(lock);
  }
  return { workspace: root, members: Object.keys(fresh.selections).sort(), written: changes };
}
function checkWorkspace(root, local = false) {
  root = resolvePath(root);
  const paths = manifestPaths(root);
  requireWorkspace(!stat(path5.join(root, ".harness/.workspace.lock"), false), "Workspace apply is locked. Check again after it completes or recover the interrupted apply.");
  const shared = readJson(paths[MANIFEST]);
  const members = validateManifest(shared), manifest = shared;
  const errors = [], warnings = [];
  const documentStatus = [];
  const model = componentModel(manifest, members);
  for (const file of manifest.documents ?? []) if (!stat(within(root, file))?.isFile()) errors.push(`Missing workspace document: ${file}`);
  assertLocalUntracked(root);
  if (local) {
    const context = readLocalContext(root);
    if (!context.machine_matches) warnings.push("Local context belongs to another machine; rebind and verify readiness");
    const bindings = context.machine_matches ? context.data.checkouts : {};
    for (const id of Object.keys(bindings).sort()) if (!Object.hasOwn(members, id)) errors.push(`Local checkout has no shared member: ${id}`);
    for (const [id, member] of Object.entries(members)) {
      if (!Object.hasOwn(bindings, id)) {
        warnings.push(`Missing local checkout binding: ${id}; complete ${localContextEntry(root)}`);
        continue;
      }
      const binding = bindings[id], directory = binding.path;
      try {
        const record = checkout(directory);
        requireWorkspace(record.path === directory && record.git_common_dir === binding.git_common_dir && record.remote === (member.remote ?? null), "The current checkout identity differs from the recorded identity.");
        for (const file of member.documents ?? []) if (!stat(within(directory, file))?.isFile()) errors.push(`${id}: Missing member document ${file}`);
        if (member.mode !== "register" || member.sources?.length || member.document_reviews?.length) {
          const inventory = analyze(directory, member.source_files ?? []), current = fingerprints(sourceSnapshot(inventory)), previous = fingerprints(member.sources ?? []);
          for (const file of [.../* @__PURE__ */ new Set([...Object.keys(previous), ...Object.keys(current)])].sort()) {
            if (!Object.hasOwn(current, file)) warnings.push(`${id}: Source unavailable: ${file}`);
            else if (!Object.hasOwn(previous, file)) warnings.push(`${id}: Source added: ${file}`);
            else if (current[file] !== previous[file]) warnings.push(`${id}: Source changed: ${file}`);
          }
          const invalid = inventory.filter((item) => item.parse_error || item.unavailable).map((item) => item.path);
          for (const file of invalid) {
            if (!Object.hasOwn(previous, file)) warnings.push(`${id}: Source unavailable or malformed: ${file}`);
            else if (Object.hasOwn(current, file)) warnings.push(`${id}: Source malformed: ${file}`);
          }
          const reviews = new Map((member.document_reviews ?? []).map((item) => [item.path, item]));
          for (const name of member.documents ?? []) {
            const file = within(directory, name), digest = stat(file)?.isFile() && !stat(file, false)?.isSymbolicLink() ? fileHash(file) : null;
            const reason = documentFreshness(
              reviews.get(name),
              digest,
              current,
              invalid.length > 0,
              manifest.onboarding ? hash(json(manifest.onboarding)) : void 0
            );
            documentStatus.push({ member: id, path: name, status: reason ? "pending" : "current", reason });
            if (reason) warnings.push(`${id}: Document needs review (${reason}): ${name}`);
          }
        }
        for (const component of Object.values(model.components)) if (component.member === id) {
          const file = component.path === "." ? directory : within(directory, component.path);
          if (!stat(file)?.isDirectory()) errors.push(`${component.id}: Missing component directory ${component.path}`);
        }
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    }
  }
  return {
    workspace: root,
    members: Object.keys(members).sort(),
    errors,
    warnings,
    document_reviews: documentStatus,
    source_checks: local ? "performed" : "not run",
    ...model,
    ...manifest.onboarding ? { onboarding: planOnboarding(manifest.onboarding) } : {}
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
function integer(value, name) {
  if (typeof value !== "string" || !fullMatch(/^-?\d+$/, value) || !Number.isSafeInteger(Number(value))) throw new UsageError(`${name} must be an integer`);
  return Number(value);
}

// src/cli/workspace.ts
function workspaceMain(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: workspace <discover|plan|apply|check|local> [options]\ndiscover [--repo PATH] [--directory PATH] [--depth N] [--include-nested]\nplan --workspace PATH [--member ID MODE PATH] [--language LOCALE] [--member-language ID LOCALE]\n     [--source ID PATH] [--review-document ID PATH] [--profile PROFILE_JSON] [--local-context FILE]\nlocal --workspace PATH [--local-context FILE] [--patch PATCH_JSON | --migrate]\napply --plan FILE\ncheck --workspace PATH [--local] [--strict]");
    return 0;
  }
  try {
    const [command, ...args] = argv;
    let result, status = 0;
    if (command === "discover") {
      const { values } = parse2(args, { repo: multiple, directory: multiple, depth: stringOption, "include-nested": flag });
      result = discover({
        repo: values.repo,
        directory: values.directory,
        depth: values.depth === void 0 ? 3 : integer(values.depth, "--depth"),
        includeNested: Boolean(values["include-nested"])
      });
    } else if (command === "local") {
      const { values } = parse2(args, { workspace: required, "local-context": stringOption, patch: stringOption, migrate: flag });
      if (values.patch && values.migrate) throw new UsageError("Choose --patch or --migrate");
      const root = values.workspace;
      if (values.patch || values.migrate) {
        const plan = makePlan(root, [], null, [], {
          local_context: values["local-context"],
          ...values.patch ? { local_patch: readJson(values.patch) } : {}
        });
        result = { ...applyPlan(plan), local_context: localContextReport(root) };
      } else {
        if (values["local-context"]) throw new UsageError("--local-context selects an entry during --migrate or --patch");
        const report = localContextReport(root);
        result = report;
        status = report.status === "pending" ? 2 : report.status === "failed" ? 1 : 0;
      }
    } else if (command === "plan") {
      const { values } = parse2(args, {
        workspace: required,
        member: { ...multiple, width: 3 },
        language: stringOption,
        "member-language": { ...multiple, width: 2 },
        source: { ...multiple, width: 2 },
        "review-document": { ...multiple, width: 2 },
        profile: stringOption,
        "local-context": stringOption
      });
      const tuples = (key) => (values[key] ?? []).map((value) => JSON.parse(value));
      const profile = values.profile ? readJson(values.profile) : void 0;
      if (profile !== void 0) validateOnboarding(profile);
      result = makePlan(
        values.workspace,
        tuples("member"),
        values.language ?? null,
        tuples("member-language"),
        { sourceFiles: tuples("source"), reviews: tuples("review-document"), profile, local_context: values["local-context"] }
      );
    } else if (command === "apply") {
      const { values } = parse2(args, { plan: required });
      result = applyPlan(readJson(values.plan));
    } else if (command === "check") {
      const { values } = parse2(args, { workspace: required, local: flag, strict: flag });
      if (values.strict && !values.local) throw new Error("--strict requires --local to check source and document freshness.");
      const checked = checkWorkspace(values.workspace, Boolean(values.local));
      status = Number(Boolean(checked.errors.length || values.strict && checked.warnings.length));
      result = checked;
    } else throw new UsageError("Expected discover, plan, apply, or check. Use --help for usage.");
    process.stdout.write(json(result));
    return status;
  } catch (error) {
    console.error(`workspace: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

// src/entries/workspace.ts
process.exitCode = workspaceMain(process.argv.slice(2));
