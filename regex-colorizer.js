/*! Regex Colorizer v0.3.1-next
 * (c) 2010-2024 Steven Levithan
 * MIT license
 * <https://stevenlevithan.com/regex/colorizer/>
 */

// Adds syntax highlighting to regular expressions for readability. Supports the JavaScript regex
// flavor, with extensions for web reality. Any regex features not supported by JavaScript are
// marked as errors, along with some edge cases that cause cross-browser grief. Syntax changes
// enabled by flags `u` and `v` are not yet supported.

const RegexColorizer = (() => {

// ------------------------------------
// Private variables
// ------------------------------------

  const regexToken = /\[\^?]?(?:[^\\\]]+|\\.?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|k<[A-Za-z_]\w*>|.?)|\((?:\?(?:<(?:[=!]|[A-Za-z_]\w*>)|[:=!]?))?|(?:[?*+]|\{\d+(?:,\d*)?\})\??|[^.?*+^${[()|\\]+|./gs;
  const charClassToken = /[^\\-]+|-|\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|.?)/gs;
  const charClassParts = /^(?<opening>\[\^?)(?<content>]?(?:[^\\\]]+|\\.?)*)(?<closing>]?)$/s;
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

  /**
   * Returns HTML for error highlighting.
   *
   * @param {string} str Pattern to apply error highlighting to.
   * @param {string} desc Error description.
   * @returns {string}
   */
  function errorize(str, desc) {
    return `<b class="err" title="${desc}">${str}</b>`;
  }

  /**
   * Returns HTML for group highlighting.
   *
   * @param {string} str Pattern to apply group highlighting to.
   * @param {number} depth Group nesting depth.
   * @returns {string}
   */
  function groupize(str, depth) {
    return `<b class="g${depth}">${str}</b>`;
  }

  /**
   * Expands &, <, and > characters in the provided string to HTML entities &amp;, &lt;, and &gt;.
   *
   * @param {string} str String with characters to expand.
   * @returns {string} String with characters expanded.
   */
  function expandHtmlEntities(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Returns the character code for the provided regex token. Supports tokens used within character
   * classes only, since that's all it's currently needed for.
   *
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
   * Character classes have their own syntax rules which are different (sometimes quite subtly)
   * from surrounding regex syntax. Hence, they're treated as a single token and parsed separately.
   *
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
        // - Any representation of character index zero (\0, \00, \000, \x00, \u0000).
        // - '\c', when not followed by A-Z or a-z.
        // - '\x', when not followed by two hex characters.
        // - '\u', when not followed by four hex characters.
        // However, although representations of character index zero within character
        // classes don't work on their own in old Firefox, they don't throw an error, they work
        // when used with ranges, and it's highly unlikely that the user will actually have
        // such a character in their test data, so such tokens are highlighted normally.
        // The remaining metasequences are flagged as errors.
        if (/^\\[cux]$/.test(m)) {
          output += errorize(m, error.INCOMPLETE_TOKEN);
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
          };
        // Shorthand class (matches more than one character index)
        } else if (/^\\[dsw]$/i.test(m)) {
          output += `<b>${m}</b>`;
          // Traditional regex behavior is that a shorthand class should be unrangeable.
          // Hence, [-\dz], [\d-z], and [z-\d] should all be equivalent. However, at
          // least some browsers handle this inconsistently. E.g., Firefox 2 throws an
          // invalid range error for [z-\d] and [\d--].
          lastToken = {
            rangeable: lastToken.type !== type.RANGE_HYPHEN,
            type: type.SHORT_CLASS,
          };
        // Unescaped '\' at the end of the regex
        } else if (m === '\\') {
          output += errorize(m, error.INCOMPLETE_TOKEN);
          // Don't need to set lastToken since this is the end of the line
        // Metasequence representing a single character index, or escaped literal character
        } else {
          output += `<b>${expandHtmlEntities(m)}</b>`;
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
              output += errorize('-', error.INVALID_RANGE);
            // Hyphen creating a valid range
            } else {
              output += '<u>-</u>';
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
              output += '<u>-</u>';
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
        output += expandHtmlEntities(m);
        lastToken = {
          rangeable: (m.length > 1 || lastToken.type !== type.RANGE_HYPHEN),
          charCode: m.charCodeAt(m.length - 1),
        };
      }
    }

    if (closing) {
      output = `<span>${opening}</span>${output}<span>${closing}</span>`;
    } else {
      output = errorize(opening, error.UNCLOSED_CLASS) + output;
    }
    return output;
  }

// ------------------------------------
// Public methods
// ------------------------------------

  /**
   * Returns HTML for displaying the given regex with syntax highlighting.
   *
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
        output += `<i>${parseCharClass(m)}</i>`;
        lastToken = {
          quantifiable: true,
        };
      // Group opening
      } else if (char0 === '(') {
        // If this is an invalid group type, mark the error and don't count it towards
        // group depth or total count
        if (m.length === 2) { // m is '(?'
          output += errorize(m, error.INVALID_GROUP_TYPE);
        } else {
          // TODO: Capture names must be unique
          if (m.length === 1 || /^\(\?<[a-z_]/i.test(m)) {
            capturingGroupCount++;
          }
          groupStyleDepth = groupStyleDepth === 5 ? 1 : groupStyleDepth + 1;
          // Record the group opening's position and character sequence so we can later
          // mark it as invalid if it turns out to be unclosed in the remainder of the
          // regex. The value of index is the position plus the length of the opening <b>
          // element with group-depth class.
          openGroups.push({
            index: output.length + '<b class="gN">'.length,
            opening: expandHtmlEntities(m),
          });
          // Add markup to the group-opening character sequence
          output += groupize(expandHtmlEntities(m), groupStyleDepth);
        }
        lastToken = {
          quantifiable: false,
        };
      // Group closing
      } else if (char0 === ')') {
        // If this is an invalid group closing
        if (!openGroups.length) {
          output += errorize(')', error.UNBALANCED_RIGHT_PAREN);
          lastToken = {
            quantifiable: false,
          };
        } else {
          output += groupize(')', groupStyleDepth);
          // Although it's possible to quantify lookaheads, this adds no value, doesn't work as
          // you'd expect in JavaScript, and is an error with flag u or v (and in some other regex
          // flavors such as PCRE), so flag them as unquantifiable.
          lastToken = {
            quantifiable: !/^[=!]/.test(openGroups[openGroups.length - 1].opening.charAt(2)),
            style: `g${groupStyleDepth}`,
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
          // - Backref 10, if 10 or more capturing groups opened before this point.
          // - Backref 1 followed by '0', if 1-9 capturing groups opened before this point.
          // - Otherwise, it's octal character index 10 (since 10 is in octal range 0-377).
          // In the case of \8 or \9 when as many capturing groups weren't opened before
          // this point, they're highlighted as special tokens. However, they should
          // probably be marked as errors since the handling is browser-specific. E.g.,
          // in Firefox 2 they seem to be equivalent to '(?!)', while in IE 7 they match
          // the literal characters '8' and '9', which is correct handling. I don't mark
          // them as errors because it would seem inconsistent to users who don't
          // understand the highlighting rules for octals, etc. In fact, octals are not
          // included in ES3, but all the big browsers support them.
          let nonBackrefDigits = '';
          let num = +m.slice(1);
          while (num > capturingGroupCount) {
            nonBackrefDigits = `${/\d$/.exec(num)[0]}${nonBackrefDigits}`;
            num = Math.floor(num / 10); // Drop the last digit
          }
          if (num > 0) {
            output += `<b>\\${num}</b>${nonBackrefDigits}`;
          } else {
            const parts = /^\\([0-3][0-7]{0,2}|[4-7][0-7]?|[89])(\d*)/.exec(m);
            output += `<b>\\${parts[1]}</b>${parts[2]}`;
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
          output += `<b>${expandHtmlEntities(m)}</b>`;
          lastToken = {
            quantifiable: true,
          };
        // Metasequence
        } else if (/^[0bBcdDfnrsStuvwWx]/.test(char1)) {
          // Browsers differ on how they handle:
          // - '\c', when not followed by A-Z or a-z.
          // - '\x', when not followed by two hex characters.
          // - '\u', when not followed by four hex characters.
          // Hence, such metasequences are flagged as errors.
          if (/^\\[cux]$/.test(m)) {
            output += errorize(m, error.INCOMPLETE_TOKEN);
            lastToken = {
              quantifiable: false,
            };
          // Unquantifiable metasequence
          } else if ('bB'.indexOf(char1) > -1) {
            output += `<b>${m}</b>`;
            lastToken = {
              quantifiable: false,
            };
          // Quantifiable metasequence
          } else {
            output += `<b>${m}</b>`;
            lastToken = {
              quantifiable: true,
            };
          }
        // Unescaped '\' at the end of the regex
        } else if (m === '\\') {
          output += errorize(m, error.INCOMPLETE_TOKEN);
          // Don't need to set lastToken since this is the end of the line
        // Escaped literal character
        } else {
          output += `<span>${expandHtmlEntities(m)}</span>`;
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
            output += errorize(m, error.INTERVAL_OVERFLOW);
          // Interval quantifier in reverse numeric order
          } else if (interval && interval[2] && (+interval[1] > +interval[2])) {
            output += errorize(m, error.INTERVAL_REVERSED);
          } else {
            // Quantifiers for groups are shown in the style of the (preceeding) group's depth
            output += `<b${lastToken.style ? ` class="${lastToken.style}"` : ''}>${m}</b>`;
          }
        } else {
          output += errorize(m, error.UNQUANTIFIABLE);
        }
        lastToken = {
          quantifiable: false,
        };
      // Vertical bar (alternator)
      } else if (m === '|') {
        // If there is a vertical bar at the very start of the regex, flag it as an error
        // since it effectively truncates the regex at that point. If two top-level
        // vertical bars are next to each other, flag it as an error for similar reasons.
        if (lastToken.type === type.NONE || (lastToken.type === type.ALTERNATOR && !openGroups.length)) {
          output += errorize(m, error.IMPROPER_EMPTY_ALTERNATIVE);
        } else {
          // Alternators within groups are shown in the style of the containing group's depth
          output += openGroups.length ? groupize('|', groupStyleDepth) : '<b>|</b>';
        }
        lastToken = {
          quantifiable: false,
          type: type.ALTERNATOR,
        };
      // ^ or $ anchor
      } else if (m === '^' || m === '$') {
        output += `<b>${m}</b>`;
        lastToken = {
          quantifiable: false,
        };
      // Dot (.)
      } else if (m === '.') {
        output += '<b>.</b>';
        lastToken = {
          quantifiable: true,
        };
      // Literal character sequence
      } else {
        output += expandHtmlEntities(m);
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
        errorize(openGroup.opening, error.UNBALANCED_LEFT_PAREN) +
        output.slice(errorIndex + openGroup.opening.length)
      );
      numCharsAdded += errorize('', error.UNBALANCED_LEFT_PAREN).length;
    }

    return output.replace(/\r?\n/g, '<br>');
  };

  /**
   * Applies regex syntax highlighting to all elements on the page with the specified class.
   *
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
    ss.textContent = `
      .regex {
        font-family: Consolas, "Source Code Pro", Monospace;
      }
      .regex span   {background: #efefef;} /* escaped literal */
      .regex b      {background: #aad1f7;} /* metasequence */
      .regex i      {background: #e3e3e3;} /* char class */
      .regex i span {background: #c3c3c3;} /* char class: boundaries */
      .regex i b    {background: #c3c3c3;} /* char class: metasequence */
      .regex i u    {background: #d3d3d3;} /* char class: range-hyphen */
      .regex b.g1   {background: #b4fa50; color: #000;} /* group: depth 1 */
      .regex b.g2   {background: #8cd400; color: #000;} /* group: depth 2 */
      .regex b.g3   {background: #26b809; color: #fff;} /* group: depth 3 */
      .regex b.g4   {background: #30ea60; color: #000;} /* group: depth 4 */
      .regex b.g5   {background: #0c8d15; color: #fff;} /* group: depth 5 */
      .regex b.err  {background: #e30000; color: #fff;} /* error */
      .regex b, .regex i, .regex u {
        font-weight: normal;
        font-style: normal;
        text-decoration: none;
      }
    `;
    document.querySelector('head').appendChild(ss);
  };

  return self;
})();
