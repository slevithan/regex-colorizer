/*! Regex Colorizer 0.5
 * (c) 2010-2024 Steven Levithan
 * MIT license
 */

const RegexColorizer = (() => {

// ------------------------------------
// Private variables
// ------------------------------------

  const regexToken = new RegExp(String.raw`
  \[\^?(?:[^\\\]]+|\\.?)*]?
| \\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|k(?:<(?<backrefName>\w+)>)?|.?)
| \((?:\?(?:<(?:[=!]|(?<captureName>[A-Za-z_]\w*)>)|[:=!]))?
| (?:[?*+]|\{\d+(?:,\d*)?\})\??
| [^.?*+^$[{()|\\]+
| .
`.replace(/\s+/g, ''), 'gs');
  const charClassToken = /[^\\-]+|-|\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|.?)/gs;
  const charClassParts = /^(?<opening>\[\^?)(?<content>(?:[^\\\]]+|\\.?)*)(?<closing>]?)$/s;
  const quantifier = /^(?:[?*+]|\{\d+(?:,\d*)?\})\??$/;
  const type = {
      NONE: 0,
      RANGE_HYPHEN: 1,
      SHORT_CLASS: 2,
      ALTERNATOR: 3,
  };
  const error = {
    DUPLICATE_CAPTURE_NAME: 'Duplicate capture name',
    EMPTY_TOP_ALTERNATIVE: 'Empty alternative effectively truncates the regex here',
    INCOMPLETE_TOKEN: 'Incomplete regex token',
    INTERVAL_OVERFLOW: 'Interval quantifier cannot use value over 65,535',
    INTERVAL_REVERSED: 'Interval quantifier range is reversed',
    INVALID_GROUP_NAME: 'Missing or invalid group name',
    INVALID_RANGE: 'Reversed or invalid range',
    UNBALANCED_LEFT_PAREN: 'Unclosed grouping',
    UNBALANCED_RIGHT_PAREN: 'No matching opening parenthesis',
    UNCLOSED_CLASS: 'Unclosed character class',
    UNQUANTIFIABLE: 'The preceding token is not quantifiable',
  };
  const styleId = `rc-${(+new Date).toString(36).slice(-5)}`;
  const self = {};

// ------------------------------------
// Private helper functions
// ------------------------------------

  // HTML generation functions for regex syntax parts
  const to = {
    // Depth is 0-5
    alternator: (s, depth) => `<b${depth ? ` class="g${depth}"` : ''}>${s}</b>`,
    backref: s => `<b class="bref">${s}</b>`,
    charClass: s => `<i>${s}</i>`,
    charClassBoundary: s => `<span>${s}</span>`,
    error: (s, msg) => `<b class="err" title="${msg}">${s}</b>`,
    escapedLiteral: s => `<span>${s}</span>`,
    // Depth is 1-5
    group: (s, depth) => `<b class="g${depth}">${s}</b>`,
    metasequence: s => `<b>${s}</b>`,
    // Depth is 0-5
    quantifier: (s, depth) => `<b${depth ? ` class="g${depth}"` : ''}>${s}</b>`,
    range: s => `<u>${s}</u>`,
  };
  to.group.openingTagLength = '<b class="gN">'.length;

  /**
   * Converts special characters to HTML entities.
   * @param {string} str String with characters to expand.
   * @returns {string} String with characters expanded.
   */
  function expandEntities(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  /**
   * Converts HTML entities to literal characters.
   * @param {string} str String with entities to collapse.
   * @returns {string} String with entities collapsed.
   */
  function collapseEntities(str) {
    return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<');
  }

  /**
   * Returns the character code for the provided regex token. Supports tokens used within character
   * classes only, since that's all it's currently needed for.
   * @param {string} token Regex token.
   * @returns {number} Character code of the provided token, or NaN.
   */
  function getTokenCharCode(token) {
    // Escape sequence
    if (token.length > 1 && token.charAt(0) === '\\') {
      const t = token.slice(1);
      // Control character
      if (/^c[A-Za-z]$/.test(t)) {
        return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(t.charAt(1).toUpperCase()) + 1;
      }
      // Two or four digit hexadecimal character code
      if (/^(?:x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4})$/.test(t)) {
        return parseInt(t.slice(1), 16);
      }
      // One to three digit octal character code up to 377 (0xFF)
      if (/^(?:[0-3][0-7]{0,2}|[4-7][0-7]?)$/.test(t)) {
        return parseInt(t, 8);
      }
      // Shorthand class or incomplete token
      if (t.length === 1 && 'cuxDdSsWw'.includes(t)) {
        return NaN;
      }
      // Metacharacter representing a single character index, or escaped literal character
      if (t.length === 1) {
        switch (t) {
          case 'b': return 8;  // Backspace
          case 'f': return 12; // Form feed
          case 'n': return 10; // Line feed
          case 'r': return 13; // Carriage return
          case 't': return 9;  // Horizontal tab
          case 'v': return 11; // Vertical tab
          default : return t.charCodeAt(0); // Escaped literal character
        }
      }
    }
    // Unescaped literal token(s)
    if (token !== '\\') {
      return token.charCodeAt(0);
    }
    return NaN;
  }

  /**
   * Returns HTML for displaying the given character class with syntax highlighting.
   * Character classes have their own syntax rules which are different (sometimes subtly) from
   * surrounding regex syntax. Hence, they're treated as a single token and parsed separately.
   * @param {string} value Character class pattern to be colorized.
   * @returns {string}
   */
  function parseCharClass(value) {
    let output = '';
    let lastToken = {
      rangeable: false,
      type: type.NONE,
    };
    const {opening, content, closing} = charClassParts.exec(value).groups;

    // Sequences of unescaped, literal tokens are matched in one step
    const matches = content.matchAll(charClassToken);
    for (const match of matches) {
      const m = match[0];
      // Escape
      if (m.charAt(0) === '\\') {
        // Inside character classes, browsers differ on how they handle the following:
        // - Any representation of character index zero (\0, \00, \000, \x00, \u0000)
        // - '\c', when not followed by A-Z or a-z
        // - '\x', when not followed by two hex characters
        // - '\u', when not followed by four hex characters
        // However, although representations of character index zero within character classes don't
        // work on their own in old Firefox, they don't throw an error, they work when used with
        // ranges, and it's highly unlikely that the user will actually have such a character in
        // their test data, so such tokens are highlighted normally. The remaining metasequences
        // are flagged as errors
        if (/^\\[cux]$/.test(m)) {
          output += to.error(m, error.INCOMPLETE_TOKEN);
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
          };
        // Shorthand class (matches more than one character index)
        } else if (/^\\[dsw]$/i.test(m)) {
          output += to.metasequence(m);
          // Traditional regex behavior is that a shorthand class should be unrangeable. Hence,
          // [-\dz], [\d-z], and [z-\d] should all be equivalent. However, some old browsers handle
          // this inconsistently. Ex: Firefox 2 throws an invalid range error for [z-\d] and [\d--]
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
            type: type.SHORT_CLASS,
          };
        // Unescaped '\' at the end of the regex
        } else if (m === '\\') {
          output += to.error(m, error.INCOMPLETE_TOKEN);
          // Don't need to set lastToken since this is the end of the line
        // Metasequence representing a single character index, or escaped literal character
        } else {
          output += to.metasequence(expandEntities(m));
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
            charCode: getTokenCharCode(m),
          };
        }
      // Hyphen (might indicate a range)
      } else if (m === '-') {
        if (lastToken.rangeable) {
          // Copy the regex to not mess with its lastIndex
          const tokenCopy = new RegExp(charClassToken);
          tokenCopy.lastIndex = match.index + match[0].length;
          const nextToken = tokenCopy.exec(content);

          if (nextToken) {
            const nextTokenCharCode = getTokenCharCode(nextToken[0]);
            // Hypen for a reverse range (ex: z-a) or shorthand class (ex: \d-x or x-\S)
            if (
              (!isNaN(nextTokenCharCode) && lastToken.charCode > nextTokenCharCode) ||
              lastToken.type === type.SHORT_CLASS ||
              /^\\[dsw]$/i.test(nextToken[0])
            ) {
              output += to.error('-', error.INVALID_RANGE);
            // Hyphen creating a valid range
            } else {
              output += to.range('-');
            }
            lastToken = {
              rangeable: false,
              type: type.RANGE_HYPHEN
            };
          } else {
            // Hyphen at the end of a properly closed character class (literal character)
            if (closing) {
              // Since this is a literal, it's technically rangeable, but that doesn't matter
              output += '-';
            // Hyphen at the end of an unclosed character class (i.e., the end of the regex)
            } else {
              output += to.range('-');
            }
          }
        // Hyphen at the beginning of a character class or after a non-rangeable token
        } else {
          output += '-';
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
          };
        }
      // Literal character sequence
      } else {
        output += expandEntities(m);
        lastToken = {
          rangeable: (m.length > 1 || lastToken.type !== type.RANGE_HYPHEN),
          charCode: m.charCodeAt(m.length - 1),
        };
      }
    }

    if (closing) {
      output = to.charClassBoundary(opening) + output + to.charClassBoundary(closing);
    } else {
      output = to.error(opening, error.UNCLOSED_CLASS) + output;
    }
    return output;
  }

  /**
   * Returns unique capture names used in a regex pattern.
   * @param {string} pattern Regex pattern to be searched.
   * @returns {Set} Unique capture names.
   */
  function getCaptureNames(pattern) {
    const captureNames = new Set();
    const matches = pattern.matchAll(regexToken);
    for (const match of matches) {
      const captureName = match.groups.captureName;
      if (captureName) {
        captureNames.add(captureName);
      }
    }
    return captureNames;
  }

// ------------------------------------
// Public methods
// ------------------------------------

  /**
   * Returns HTML for displaying the given regex with syntax highlighting.
   * @param {string} pattern Regex pattern to be colorized.
   * @returns {string}
   */
  self.colorizeText = pattern => {
    let output = '';
    let capturingGroupCount = 0;
    let groupStyleDepth = 0;
    const openGroups = [];
    const usedCaptureNames = new Set();
    // Having any named captures changes the meaning of '\k', so we have to know in advance
    const allCaptureNames = getCaptureNames(pattern);
    let lastToken = {
      quantifiable: false,
      type: type.NONE,
    };

    // Sequences of unescaped, literal tokens are matched in one step (except '{' when not part of
    // a quantifier, which is matched on its own)
    const matches = pattern.matchAll(regexToken);
    for (const match of matches) {
      const m = match[0];
      const char0 = m.charAt(0);
      const char1 = m.charAt(1);
      // Character class
      if (char0 === '[') {
        output += to.charClass(parseCharClass(m));
        lastToken = {
          quantifiable: true,
        };
      // Group opening
      } else if (char0 === '(') {
        const captureName = match.groups.captureName;
        groupStyleDepth = groupStyleDepth === 5 ? 1 : groupStyleDepth + 1;
        // '(?<name>' with a duplicate name
        if (usedCaptureNames.has(captureName)) {
          openGroups.push({
            valid: false,
            opening: expandEntities(m),
          });
          output += to.error(expandEntities(m), error.DUPLICATE_CAPTURE_NAME);
        // Valid group
        } else {
          if (m === '(' || captureName) {
            capturingGroupCount++;
            if (captureName) {
              usedCaptureNames.add(captureName);
            }
          }
          // Record the group opening's position and value so we can mark it later as invalid if it
          // turns out to be unclosed in the remainder of the regex
          openGroups.push({
            valid: true,
            opening: expandEntities(m),
            index: output.length + to.group.openingTagLength,
          });
          output += to.group(expandEntities(m), groupStyleDepth);
        }
        lastToken = {
          quantifiable: false,
        };
      // Group closing
      } else if (m === ')') {
        // If this is an invalid group closing
        if (!openGroups.length || !openGroups.at(-1).valid) {
          output += to.error(m, error.UNBALANCED_RIGHT_PAREN);
          lastToken = {
            quantifiable: false,
          };
        } else {
          output += to.group(m, groupStyleDepth);
          // Although it's possible to quantify lookarounds, this adds no value, doesn't work as
          // you'd expect in JavaScript, and is an error with flag u or v (and in some other regex
          // flavors such as PCRE), so flag them as unquantifiable
          lastToken = {
            quantifiable: !/^\(\?<?[=!]/.test(collapseEntities(openGroups.at(-1).opening)),
            groupStyleDepth,
          };
        }
        groupStyleDepth = groupStyleDepth === 1 ? 5 : groupStyleDepth - 1;
        // Drop the last opening paren from depth tracking
        openGroups.pop();
      // Escape or backreference
      } else if (char0 === '\\') {
        // Backreference, octal character code without a leading zero, or a literal '\8' or '\9'
        if (/^[1-9]/.test(char1)) {
          // What does '\10' mean?
          // - Backref 10, if 10 or more capturing groups opened before this point
          // - Backref 1 followed by '0', if 1-9 capturing groups opened before this point
          // - Otherwise, it's octal character index 10 (since 10 is in octal range 0-377)
          // In fact, octals are not included in ES3, but browsers support them for backcompat.
          // With flag u or v (not yet supported), the rules change significantly:
          // - Escaped digits must be a backref or \0 and can't be immediately followed by digits
          // - An escaped number is a valid backreference if it is not in a character class and
          //   there are as many capturing groups anywhere in the pattern (before or after)
          let nonBackrefDigits = '';
          let num = +m.slice(1);
          while (num > capturingGroupCount) {
            nonBackrefDigits = `${/\d$/.exec(num)[0]}${nonBackrefDigits}`;
            // Drop the last digit
            num = Math.floor(num / 10);
          }
          if (num > 0) {
            output += `${to.backref(`\\${num}`)}${nonBackrefDigits}`;
          } else {
            const {escapedNum, escapedLiteral, literal} =
              /^\\(?<escapedNum>[0-3][0-7]{0,2}|[4-7][0-7]?|(?<escapedLiteral>[89]))(?<literal>\d*)/.exec(m).groups;
            if (escapedLiteral) {
              // For \8 and \9 (escaped non-octal digits) when as many capturing groups weren't
              // opened before this point, they match '8' and '9' (when not using flag u or v).
              // However, they could be marked as errors since some old browsers handled them
              // differently (in Firefox 2, they seemed to be equivalent to `(?!)`)
              output += `${to.escapedLiteral(`\\${escapedLiteral}`)}${literal}`;
            } else {
              output += `${to.metasequence(`\\${escapedNum}`)}${literal}`;
            }
          }
          lastToken = {
            quantifiable: true,
          };
        // Named backreference, \k token with error, or a literal '\k' or '\k<name>'
        } else if (char1 === 'k') {
          // What does '\k' or '\k<name>' mean?
          // - If a named capture appears anywhere (before or after), treat as backreference
          // - Otherwise, it's a literal '\k' plus any following chars
          // - In backreference mode, error if name doesn't appear in a capture (before or after)
          // With flag u or v, the rules change to always use backreference mode
          // Backreference mode
          if (allCaptureNames.size) {
            // Valid
            if (allCaptureNames.has(match.groups.backrefName)) {
              output += to.backref(expandEntities(m));
              lastToken = {
                quantifiable: true,
              };
            // References a missing or invalid (ex: \k<1>) named group
            } else if (m.endsWith('>')) {
              output += to.error(expandEntities(m), error.INVALID_GROUP_NAME);
              lastToken = {
                quantifiable: false,
              };
            // '\k'
            } else {
              output += to.error(m, error.INCOMPLETE_TOKEN);
              lastToken = {
                quantifiable: false,
              };
            }
          // Literal mode
          } else {
            output += to.escapedLiteral('\\k') + expandEntities(m.slice(2));
            lastToken = {
              quantifiable: true,
            };
          }
        // Metasequence
        } else if (/^[0bBcdDfnrsStuvwWx]/.test(char1)) {
          // Browsers differ on how they handle:
          // - '\c', when not followed by A-Z or a-z
          // - '\x', when not followed by two hex characters
          // - '\u', when not followed by four hex characters
          // Hence, such metasequences are flagged as errors
          if (/^\\[cux]$/.test(m)) {
            output += to.error(m, error.INCOMPLETE_TOKEN);
            lastToken = {
              quantifiable: false,
            };
          // Unquantifiable metasequence
          } else if ('bB'.includes(char1)) {
            output += to.metasequence(m);
            lastToken = {
              quantifiable: false,
            };
          // Quantifiable metasequence
          } else {
            output += to.metasequence(m);
            lastToken = {
              quantifiable: true,
            };
          }
        // Unescaped '\' at the end of the regex
        } else if (m === '\\') {
          output += to.error(m, error.INCOMPLETE_TOKEN);
          // Don't need to set lastToken since this is the end of the line
        // Escaped literal character
        } else {
          output += to.escapedLiteral(expandEntities(m));
          lastToken = {
            quantifiable: true,
          };
        }
      // Quantifier
      } else if (quantifier.test(m)) {
        if (lastToken.quantifiable) {
          const interval = /^\{(\d+)(?:,(\d*))?/.exec(m);
          // Interval quantifier out of range for old Firefox
          if (interval && (+interval[1] > 65535 || (interval[2] && +interval[2] > 65535))) {
            output += to.error(m, error.INTERVAL_OVERFLOW);
          // Interval quantifier in reverse numeric order
          } else if (interval && interval[2] && (+interval[1] > +interval[2])) {
            output += to.error(m, error.INTERVAL_REVERSED);
          } else {
            // Quantifiers for groups are shown in the style of the (preceeding) group's depth
            output += to.quantifier(m, lastToken.groupStyleDepth ?? 0);
          }
        } else {
          output += to.error(m, error.UNQUANTIFIABLE);
        }
        lastToken = {
          quantifiable: false,
        };
      // Alternation
      } else if (m === '|') {
        // If there is a vertical bar at the very start of the regex, flag it as an error since it
        // effectively truncates the regex at that point. If two top-level vertical bars are next
        // to each other, flag it as an error for the same reason
        if (lastToken.type === type.NONE || (lastToken.type === type.ALTERNATOR && !openGroups.length)) {
          output += to.error(m, error.EMPTY_TOP_ALTERNATIVE);
        } else {
          // Alternators within groups are shown in the style of the containing group's depth
          output += to.alternator(m, openGroups.length && groupStyleDepth);
        }
        lastToken = {
          quantifiable: false,
          type: type.ALTERNATOR,
        };
      // ^ or $ anchor
      } else if (m === '^' || m === '$') {
        output += to.metasequence(m);
        lastToken = {
          quantifiable: false,
        };
      // Dot (.)
      } else if (m === '.') {
        output += to.metasequence(m);
        lastToken = {
          quantifiable: true,
        };
      // Literal character sequence
      } else {
        output += expandEntities(m);
        lastToken = {
          quantifiable: true,
        };
      }
    }

    // Mark the opening character sequence for each unclosed grouping as invalid
    let numCharsAdded = 0;
    for (const openGroup of openGroups) {
      // Skip groups that are already marked as errors
      if (!openGroup.valid) {
        continue;
      }
      const errorIndex = openGroup.index + numCharsAdded;
      output = (
        output.slice(0, errorIndex) +
        to.error(openGroup.opening, error.UNBALANCED_LEFT_PAREN) +
        output.slice(errorIndex + openGroup.opening.length)
      );
      numCharsAdded += to.error('', error.UNBALANCED_LEFT_PAREN).length;
    }

    return output.replace(/\r?\n/g, '<br>');
  };

  /**
   * Applies highlighting to all regex elements on the page, replacing their content with HTML.
   * @param {string} [className] Class used by elements to be colorized.
   */
  self.colorizeAll = (className = 'regex') => {
    const els = document.querySelectorAll(`.${className}`);
    els.forEach(el => {
      el.classList.add(styleId);
      el.innerHTML = self.colorizeText(el.textContent);
    });
  };

  /**
   * Adds the default theme styles to the page. Don't run this if you provide your own stylesheet.
   */
  self.addStyleSheet = () => {
    if (document.getElementById(styleId)) {
      return;
    }
    const ss = document.createElement('style');
    ss.id = styleId;
    // See: themes/default.css
    ss.textContent = `
.${styleId} {color: #000; font-family: Consolas, "Source Code Pro", Monospace; white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere;}
.${styleId} b {font-weight: normal;}
.${styleId} i {font-style: normal;}
.${styleId} u {text-decoration: none;}
.${styleId} * {border-radius: 0.25em;}
.${styleId} span {background: #eee;}
.${styleId} b {background: #80c0ff; color: #092e7f;}
.${styleId} b.bref {background: #86e9ff; color: #0d47c4;}
.${styleId} b.err {background: #e30000; color: #fff; font-style: normal;}
.${styleId} i {background: #e3e3e3; font-style: italic;}
.${styleId} i span {background: #c3c3c3; font-style: normal;}
.${styleId} i b {background: #c3c3c3; color: #222;}
.${styleId} i u {background: #d3d3d3;}
.${styleId} b.g1 {background: #b4fa50; color: #074d0b;}
.${styleId} b.g2 {background: #8cd400; color: #053c08;}
.${styleId} b.g3 {background: #26b809; color: #fff;}
.${styleId} b.g4 {background: #30ea60; color: #125824;}
.${styleId} b.g5 {background: #0c8d15; color: #fff;}
    `;
    document.querySelector('head').appendChild(ss);
  };

  return self;
})();
