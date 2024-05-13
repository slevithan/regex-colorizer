/*! Regex Colorizer 0.4
 * (c) 2010-2024 Steven Levithan
 * MIT license
 */

// Adds syntax highlighting to regular expressions for readability. Supports the JavaScript regex
// flavor, with extensions for web reality. Unsupported regex features are marked as errors, along
// with some edge cases that can cause cross-browser grief. Syntax changes activated by flags `u`
// and `v` are not yet supported.

const RegexColorizer = (() => {

// ------------------------------------
// Private variables
// ------------------------------------

  const regexToken = /\[\^?(?:[^\\\]]+|\\.?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|k<[A-Za-z_]\w*>|.?)|\((?:\?(?:<(?:[=!]|[A-Za-z_]\w*>)|[:=!]?))?|(?:[?*+]|\{\d+(?:,\d*)?\})\??|[^.?*+^${[()|\\]+|./gs;
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
    UNCLOSED_CLASS: 'Unclosed character class',
    INCOMPLETE_TOKEN: 'Incomplete regex token',
    INVALID_RANGE: 'Reversed or invalid range',
    INVALID_GROUP_TYPE: 'Invalid or unsupported group type',
    UNBALANCED_LEFT_PAREN: 'Unclosed grouping',
    UNBALANCED_RIGHT_PAREN: 'No matching opening parenthesis',
    INTERVAL_OVERFLOW: 'Interval quantifier cannot use value over 65,535',
    INTERVAL_REVERSED: 'Interval quantifier range is reversed',
    UNQUANTIFIABLE: 'Quantifiers must be preceded by a token that can be repeated',
    IMPROPER_EMPTY_ALTERNATIVE: 'Empty alternative effectively truncates the regex here',
  };
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
      if (t.length === 1 && 'cuxDdSsWw'.indexOf(t) > -1) {
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
          // [-\dz], [\d-z], and [z-\d] should all be equivalent. However, at least some browsers
          // handle this inconsistently. E.g., Firefox 2 throws an invalid range error for [z-\d]
          // and [\d--]
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
            // Hypen for a reverse range (e.g., z-a) or shorthand class (e.g., \d-x or x-\S)
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
    let lastToken = {
      quantifiable: false,
      type: type.NONE,
    };
    // Most sequences of unescaped, literal tokens are matched in one step
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
        // If this is an invalid group type, mark the error and don't count it toward group depth
        // or total count
        if (m.length === 2) { // m is '(?'
          output += to.error(m, error.INVALID_GROUP_TYPE);
        } else {
          // TODO: Capture names must be unique
          if (m.length === 1 || /^\(\?<[a-z_]/i.test(m)) {
            capturingGroupCount++;
          }
          groupStyleDepth = groupStyleDepth === 5 ? 1 : groupStyleDepth + 1;
          // Record the group opening's position and value so we can mark it later as invalid if it
          // turns out to be unclosed in the remainder of the regex
          openGroups.push({
            index: output.length + to.group.openingTagLength,
            opening: expandEntities(m),
          });
          // Add markup to the group-opening character sequence
          output += to.group(expandEntities(m), groupStyleDepth);
        }
        lastToken = {
          quantifiable: false,
        };
      // Group closing
      } else if (char0 === ')') {
        // If this is an invalid group closing
        if (!openGroups.length) {
          output += to.error(')', error.UNBALANCED_RIGHT_PAREN);
          lastToken = {
            quantifiable: false,
          };
        } else {
          output += to.group(')', groupStyleDepth);
          // Although it's possible to quantify lookarounds, this adds no value, doesn't work as
          // you'd expect in JavaScript, and is an error with flag u or v (and in some other regex
          // flavors such as PCRE), so flag them as unquantifiable
          lastToken = {
            quantifiable: !/^\(\?<?[=!]/.test(collapseEntities(openGroups[openGroups.length - 1].opening)),
            groupStyleDepth,
          };
          groupStyleDepth = groupStyleDepth === 1 ? 5 : groupStyleDepth - 1;
          // Drop the last opening paren from depth tracking
          openGroups.pop();
        }
      // Escape or backreference
      } else if (char0 === '\\') {
        // Backreference or octal character code without a leading zero
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
        // Named backreference
        } else if (char1 === 'k' && m.length > 2) {
          // TODO: Add correct handling for \k<name> (assuming no flag u or v):
          // - If a named capture appears anywhere (before or after), treat as backreference
          // - Otherwise, it's a literal '\k<name>'
          // - In backreference mode, error if name doesn't appear in a capture (before or after)
          output += to.backref(expandEntities(m));
          lastToken = {
            quantifiable: true,
          };
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
          } else if ('bB'.indexOf(char1) > -1) {
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
      // Vertical bar (alternator)
      } else if (m === '|') {
        // If there is a vertical bar at the very start of the regex, flag it as an error since it
        // effectively truncates the regex at that point. If two top-level vertical bars are next
        // to each other, flag it as an error for the same reason
        if (lastToken.type === type.NONE || (lastToken.type === type.ALTERNATOR && !openGroups.length)) {
          output += to.error(m, error.IMPROPER_EMPTY_ALTERNATIVE);
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
   * Applies regex syntax highlighting to all elements on the page with the specified class.
   * @param {string} [cls='regex'] Class name used by elements to be colorized.
   */
  self.colorizeAll = cls => {
    cls ||= 'regex';
    const els = document.querySelectorAll(`.${cls}`);
    els.forEach(el => el.innerHTML = self.colorizeText(el.textContent));
  };

  /**
   * Adds a stylesheet with the default regex highlighting styles to the page. If you provide your
   * own stylesheet, you don't need to run this.
   */
  self.addStyleSheet = () => {
    const ss = document.createElement('style');
    ss.id = 'regex-colorizer-ss';
    // See: themes/default.css
    ss.textContent = `
.regex {color: #000; font-family: Consolas, "Source Code Pro", Monospace;}
.regex b {font-weight: normal;}
.regex i {font-style: normal;}
.regex u {text-decoration: none;}
.regex * {border-radius: 0.25em;}
.regex span {background: #f0f0f0;}
.regex b {background: #80c0ff; color: #092e7f;}
.regex b.bref {background: #86e9ff; color: #0d47c4;}
.regex b.err {background: #e30000; color: #fff;}
.regex i {background: #e3e3e3; font-style: italic;}
.regex i span {background: #c3c3c3; font-style: normal;}
.regex i b {background: #c3c3c3;}
.regex i u {background: #d3d3d3;}
.regex b.g1 {background: #b4fa50;}
.regex b.g2 {background: #8cd400;}
.regex b.g3 {background: #26b809; color: #fff;}
.regex b.g4 {background: #30ea60;}
.regex b.g5 {background: #0c8d15; color: #fff;}
    `;
    document.querySelector('head').appendChild(ss);
  };

  return self;
})();
