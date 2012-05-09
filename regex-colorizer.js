/*! Regex Colorizer v0.2
 * (c) 2010-2012 Steven Levithan <http://slevithan.com/>
 * MIT license
 */

/* v0.1 of this script was extracted from RegexPal v0.1.4 and named JavaScript Regex Syntax
 * Highlighter. Currently supports JavaScript regex syntax only.
 */

var RegexColorizer = (function () {
    "use strict";

// Private variables

    var self = {},
        regexToken = /\[\^?]?(?:[^\\\]]+|\\[\S\s]?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9][0-9]*|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)|\((?:\?[:=!]?)?|(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??|[^.?*+^${[()|\\]+|./g,
        charClassParts = /^(\[\^?)(]?(?:[^\\\]]+|\\[\S\s]?)*)(]?)$/,
        charClassToken = /[^\\-]+|-|\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)/g,
        quantifier = /^(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??$/,
        type = {
            NONE: 0,
            RANGE_HYPHEN: 1,
            METACLASS: 2,
            ALTERNATOR: 3
        },
        error = {
            UNCLOSED_CLASS: "Unclosed character class",
            INCOMPLETE_METASEQUENCE: "Incomplete metasequence",
            TRAILING_BACKSLASH: "Trailing unescaped backslash",
            INVALID_RANGE: "Invalid range",
            INVALID_GROUP_TYPE: "Invalid or unsupported group type",
            UNBALANCED_LEFT_PAREN: "Unbalanced opening parenthesis",
            UNBALANCED_RIGHT_PAREN: "Unbalanced closing parenthesis",
            INTERVAL_OVERFLOW: "Interval quantifier cannot use value above 65,535",
            INTERVAL_REVERSED: "Interval quantifier range is reversed",
            UNQUANTIFIABLE: "Quantifier not allowed here",
            IMPROPER_EMPTY_ALTERNATIVE: "Empty alternative effectively truncates the regex here"
        };

// Private functions

    function errorStr(str, desc) {
        return '<b class="err"' + (desc ? ' title="' + desc + '"' : '') + '>' + str + '</b>';
    }

    function groupStr(str, depth) {
        return '<b class="g' + depth + '">' + str + '</b>';
    }

    function expandHtmlEntities(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function elsByClass(cls) {
        if (document.getElementsByClassName) {
            return document.body.getElementsByClassName(cls);
        }
        var els = document.body.getElementsByTagName("*"),
            regex = new RegExp("(?:^|\\s)" + cls + "(?:\\s|$)"),
            result = [],
            len = els.length,
            i;
        for (i = 0; i < len; i++) {
            if (regex.test(els[i].className)) {
                result.push(els[i]);
            }
        }
        return result;
    }

    // This supports only tokens used within character classes, since that's all it's needed for
    function getTokenCharCode(token) {
        // Escape sequence
        if (token.length > 1 && token.charAt(0) === "\\") {
            var t = token.slice(1);
            // Control character
            if (/^c[A-Za-z]$/.test(t)) {
                return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(t.charAt(1).toUpperCase()) + 1;
            }
            // Two or four digit hexadecimal character code
            if (/^(?:x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})$/.test(t)) {
                return parseInt(t.slice(1), 16);
            }
            // One to three digit octal character code up to 377 (hex FF)
            if (/^(?:[0-3][0-7]{0,2}|[4-7][0-7]?)$/.test(t)) {
                return parseInt(t, 8);
            }
            // Metaclass or incomplete token
            if (t.length === 1 && "cuxDdSsWw".indexOf(t) > -1) {
                return false;
            }
            // Metacharacter representing a single character index, or escaped literal character
            if (t.length === 1) {
                switch (t) {
                    case "b": return 8;  // Backspace
                    case "f": return 12; // Form feed
                    case "n": return 10; // Line feed
                    case "r": return 13; // Carriage return
                    case "t": return 9;  // Horizontal tab
                    case "v": return 11; // Vertical tab
                    default : return t.charCodeAt(0); // Escaped literal character
                }
            }
        }
        // Unescaped literal token(s)
        if (token !== "\\") {
            return token.charCodeAt(0);
        }
        return false;
    }

    function parseCharClass(value) {
        // Character classes have their own syntax rules which are different (sometimes quite
        // subtly) from surrounding regex syntax. Hence, they're treated as a single token and
        // parsed separately.

        var output = "",
            parts = charClassParts.exec(value),
            parser = charClassToken,
            lastToken = {
                rangeable: false,
                type: type.NONE
            },
            match, m;

        parts.opening = parts[1];
        parts.contents = parts[2];
        parts.closing = parts[3];

        output += parts.closing ? parts.opening : errorStr(parts.opening, error.UNCLOSED_CLASS);

        // The charClassToken regex does most of the tokenization grunt work
        while (match = parser.exec(parts.contents)) {
            m = match[0];
            // Escape
            if (m.charAt(0) === "\\") {
                // Inside character classes, browsers differ on how they handle the following:
                //   - Any representation of character index zero (\0, \00, \000, \x00, \u0000).
                //   - "\c", when not followed by A-Z or a-z.
                //   - "\x", when not followed by two hex characters.
                //   - "\u", when not followed by four hex characters.
                // However, although representations of character index zero within character
                // classes don't work on their own in Firefox, they don't throw an error, they work
                // when used with ranges, and it's highly unlikely that the user will actually have
                // such a character in their test data, so such tokens are highlighted normally.
                // The remaining metasequences are flagged as errors.
                if (/^\\[cux]$/.test(m)) {
                    output += errorStr(m, error.INCOMPLETE_METASEQUENCE);
                    lastToken = {rangeable: lastToken.type !== type.RANGE_HYPHEN};
                // Metaclass (matches more than one character index)
                } else if (/^\\[dsw]$/i.test(m)) {
                    output += "<b>" + m + "</b>";
                    // Traditional regex behavior is that a metaclass should be unrangeable
                    // (RegexPal terminology). Hence, [-\dz], [\d-z], and [z-\d] should all be
                    // equivalent. However, at least some browsers handle this inconsistently.
                    // E.g., Firefox 2 throws an invalid range error for [z-\d] and [\d--].
                    lastToken = {
                        rangeable: lastToken.type !== type.RANGE_HYPHEN,
                        type: type.METACLASS
                    };
                // Unescaped "\" at the end of the regex
                } else if (m === "\\") {
                    output += errorStr(m, error.TRAILING_BACKSLASH);
                // Metasequence representing a single character index, or escaped literal character
                } else {
                    output += "<b>" + expandHtmlEntities(m) + "</b>";
                    lastToken = {
                        rangeable: lastToken.type !== type.RANGE_HYPHEN,
                        charCode: getTokenCharCode(m)
                    };
                }
            // Hyphen (might indicate a range)
            } else if (m === "-") {
                if (lastToken.rangeable) {
                    // Save the regex's lastIndex so we can reset it after checking the next token
                    var lastIndex = parser.lastIndex,
                        nextToken = parser.exec(parts.contents);

                    if (nextToken) {
                        var nextTokenCharCode = getTokenCharCode(nextToken[0]);
                        // Hypen for a reverse range (e.g., z-a) or metaclass (e.g., \d-x or x-\S)
                        if (
                            (nextTokenCharCode !== false && lastToken.charCode > nextTokenCharCode) ||
                            lastToken.type === type.METACLASS ||
                            /^\\[dsw]$/i.test(nextToken[0])
                        ) {
                            output += errorStr("-", error.INVALID_RANGE);
                        // Hyphen creating a valid range
                        } else {
                            output += "<u>-</u>";
                        }
                        lastToken = {
                            rangeable: false,
                            type: type.RANGE_HYPHEN
                        };
                    } else {
                        // Hyphen at the end of a properly closed character class (literal character)
                        if (parts.closing) {
                            output += "-"; // Since this is a literal, it's technically "rangeable," but that doesn't matter
                        // Hyphen at the end of an unclosed character class (i.e., the end of the regex)
                        } else {
                            //output += errorStr("-"); // Old RegexBuddy handling
                            output += "<u>-</u>";
                            break; // Might as well break
                        }
                    }

                    // Reset the regex's lastIndex so the next while loop iteration will continue appropriately
                    parser.lastIndex = lastIndex;
                // Hyphen at the beginning of a character class or after a non-rangeable token
                } else {
                    output += "-";
                    lastToken = {rangeable: lastToken.type !== type.RANGE_HYPHEN};
                }
            // Literal character sequence
            } else {
                output += expandHtmlEntities(m);
                lastToken = {
                    rangeable: (m.length > 1 || lastToken.type !== type.RANGE_HYPHEN),
                    charCode: m.charCodeAt(m.length - 1)
                };
            }
        } // End charClassToken loop

        return output + parts.closing;
    }

// Public methods

    self.colorizeText = function (value) {
        var output = "",
            capturingGroupCount = 0,
            groupStyleDepth = 0,
            openGroups = [],
            lastToken = {
                quantifiable: false,
                type: type.NONE
            },
            match, m;

        while (match = regexToken.exec(value)) {
            m = match[0];
            switch (m.charAt(0)) {
                // Character class
                case "[":
                    output += "<i>" + parseCharClass(m) + "</i>";
                    lastToken = {quantifiable: true};
                    break;
                // Group opening
                case "(":
                    // If this is an invalid group type, mark the error and don't count it towards
                    // group depth or total count
                    if (m.length === 2) { // m is "(?"
                        output += errorStr(m, error.INVALID_GROUP_TYPE);
                    } else {
                        if (m.length === 1) capturingGroupCount++;
                        groupStyleDepth = groupStyleDepth === 5 ? 1 : groupStyleDepth + 1;
                        // Record the group opening's position and character sequence so we can
                        // later mark it as invalid if it turns out to be unclosed in the remainder
                        // of the regex. The value of index is the position plus the length of the
                        // opening <b> element with group class ('<b class="gN">'.length).
                        openGroups.push({
                            index:   output.length + 14,
                            opening: m
                        });
                        // Add markup to the group-opening character sequence
                        output += groupStr(m, groupStyleDepth);
                    }
                    lastToken = {quantifiable: false};
                    break;
                // Group closing
                case ")":
                    // If this is an invalid group closing
                    if (!openGroups.length) {
                        output += errorStr(")", error.UNBALANCED_RIGHT_PAREN);
                        lastToken = {quantifiable: false};
                    } else {
                        output += groupStr(")", groupStyleDepth);
                        // Although at least in some browsers it is possible to quantify
                        // lookaheads, this adds no value and is an error with some regex flavors
                        // such as PCRE, so flag them as unquantifiable.
                        lastToken = {
                            quantifiable: !/^[=!]/.test(openGroups[openGroups.length - 1].opening.charAt(2)),
                            style:        "g" + groupStyleDepth
                        };
                        groupStyleDepth = groupStyleDepth === 1 ? 5 : groupStyleDepth - 1;
                        // Drop the last opening paren from depth tracking
                        openGroups.pop();
                    }
                    break;
                // Escape or backreference
                case "\\":
                    // Backreference or octal character code without a leading zero
                    if (/^[1-9]/.test(m.charAt(1))) {
                        // What does "\10" mean?
                        //   - Backref 10, if 10 or more capturing groups were opened before this point.
                        //   - Backref 1 followed by "0", if 1-9 capturing groups were opened before this point.
                        //   - Otherwise, it's octal character index 10 (since 10 is inside octal range 0-377).
                        // In the case of \8 or \9 when as many capturing groups weren't opened
                        // before this point, they're highlighted as special tokens. However, they
                        // should probably be marked as errors since the handling is browser-
                        // specific. E.g., in Firefox 2 they seem to be equivalent to "(?!)", while
                        // in IE 7 they match the literal characters "8" and "9", which is correct
                        // handling. I don't mark them as errors because it would seem inconsistent
                        // to users who don't understand the highlighting rules for octals, etc. In
                        // fact, octals are not included in ECMA-262v3, but since all the big
                        // browsers support them and RegexPal does not implement its own regex
                        // engine, it needs to highlight the regex as the browsers interpret them.
                        var nonBackrefDigits = "",
                            num = +m.slice(1);
                        while (num > capturingGroupCount) {
                            nonBackrefDigits = /[0-9]$/.exec(num)[0] + nonBackrefDigits;
                            num = Math.floor(num / 10); // Drop the last digit
                        }
                        if (num > 0) {
                            output += "<b>\\" + num + "</b>" + nonBackrefDigits;
                        } else {
                            var parts = /^\\([0-3][0-7]{0,2}|[4-7][0-7]?|[89])([0-9]*)/.exec(m);
                            output += "<b>\\" + parts[1] + "</b>" + parts[2];
                        }
                    // Metasequence
                    } else if (/^[0bBcdDfnrsStuvwWx]/.test(m.charAt(1))) {
                        // Browsers differ on how they handle:
                        //   - "\c", when not followed by A-Z or a-z.
                        //   - "\x", when not followed by two hex characters.
                        //   - "\u", when not followed by four hex characters.
                        // Hence, such metasequences are flagged as errors.
                        if (/^\\[cux]$/.test(m)) {
                            output += errorStr(m, error.INCOMPLETE_METASEQUENCE);
                            lastToken = {quantifiable: false};
                            break;
                        }
                        output += "<b>" + m + "</b>";
                        // Non-quantifiable metasequence
                        if ("bB".indexOf(m.charAt(1)) > -1) {
                            lastToken = {quantifiable: false};
                            break;
                        }
                    // Unescaped "\" at the end of the regex
                    } else if (m === "\\") {
                        output += errorStr(m, error.TRAILING_BACKSLASH);
                    // Escaped literal character
                    } else {
                        output += expandHtmlEntities(m);
                    }
                    lastToken = {quantifiable: true};
                    break;
                // Not a character class, group opening/closing, escape sequence, or backreference
                default:
                    // Quantifier
                    if (quantifier.test(m)) {
                        if (lastToken.quantifiable) {
                            var interval = /^\{([0-9]+)(?:,([0-9]*))?/.exec(m);
                            // Interval quantifier out of range for Firefox
                            if (interval && (+interval[1] > 65535 || (interval[2] && +interval[2] > 65535))) {
                                output += errorStr(m, error.INTERVAL_OVERFLOW);
                            // Interval quantifier in reverse numeric order
                            } else if (interval && interval[2] && (+interval[1] > +interval[2])) {
                                output += errorStr(m, error.INTERVAL_REVERSED);
                            } else {
                                // Quantifiers for groups are shown in the style of the (preceeding) group's depth
                                output += (lastToken.style ? '<b class="' + lastToken.style + '">' : '<b>') + m + '</b>';
                            }
                        } else {
                            output += errorStr(m, error.UNQUANTIFIABLE);
                        }
                        lastToken = {quantifiable: false};
                    // Vertical bar (alternator)
                    } else if (m === "|") {
                        // If there is a vertical bar at the very start of the regex, flag it as an
                        // error since it effectively truncates the regex at that point. If two
                        // top-level vertical bars are next to each other, flag it as an error for
                        // similar reasons. These behaviors copied from RegexBuddy.
                        if (lastToken.type === type.NONE || (lastToken.type === type.ALTERNATOR && !openGroups.length)) {
                            output += errorStr(m, error.IMPROPER_EMPTY_ALTERNATIVE);
                        } else {
                            // Alternators within groups are shown in the style of the (containing) group's depth
                            output += openGroups.length ? groupStr("|", groupStyleDepth) : "<b>|</b>";
                        }
                        lastToken = {
                            quantifiable: false,
                            type: type.ALTERNATOR
                        };
                    // ^ or $ anchor
                    } else if ("^$".indexOf(m) > -1) {
                        output += "<b>" + m + "</b>";
                        lastToken = {quantifiable: false};
                    // Dot (.)
                    } else if (m === ".") {
                        output += "<b>.</b>";
                        lastToken = {quantifiable: true};
                    // Literal character sequence
                    } else {
                        output += expandHtmlEntities(m);
                        lastToken = {quantifiable: true};
                    }
                // End default case
            } // End switch m.charAt(0)
        } // End regexToken loop

        // Mark the opening character sequence for each unclosed grouping as invalid
        var numCharsAdded = 0, errorIndex, i;
        for (i = 0; i < openGroups.length; i++) {
            errorIndex = openGroups[i].index + numCharsAdded;
            output = (
                output.slice(0, errorIndex) +
                errorStr(openGroups[i].opening, error.UNBALANCED_LEFT_PAREN) +
                output.slice(errorIndex + openGroups[i].opening.length)
            );
            numCharsAdded += errorStr("", error.UNBALANCED_LEFT_PAREN).length;
        }

        return output;
    };

    self.colorizeAll = function (cls) {
        cls = cls || "regex";
        var els = elsByClass(cls),
            len = els.length,
            el, i;
        for (i = 0; i < len; i++) {
            el = els[i];
            el.innerHTML = self.colorizeText(el.textContent || el.innerText);
        }
    };

    self.addDefaultStyle = function () {
        var ss = document.createElement("style"),
            rules =
                ".regex       {font-family: Monospace;} " +
                ".regex b     {background: #aad1f7;} " + // metasequence
                ".regex i     {background: #f9ca69;} " + // char class
                ".regex i b   {background: #f7a700;} " + // char class: metasequence
                ".regex i u   {background: #efba4a;} " + // char class: range-hyphen
                ".regex b.g1  {background: #d2f854;} " + // group: depth 1
                ".regex b.g2  {background: #9ec70c;} " + // group: depth 2
                ".regex b.g3  {background: #ecc9f7;} " + // group: depth 3
                ".regex b.g4  {background: #54b70b;} " + // group: depth 4
                ".regex b.g5  {background: #b688cf;} " + // group: depth 5
                ".regex b.err {background: #ff4300;} " + // error
                ".regex b, .regex i, .regex u {font-weight: normal; font-style: normal; text-decoration: none;}";
        // Needs to come first for IE < 9
        document.getElementsByTagName("head")[0].appendChild(ss);
        // Can't use innerHTML or innerText for stylesheets in IE < 9
        if (ss.styleSheet) {
            ss.styleSheet.cssText = rules;
        } else {
            ss.innerHTML = rules;
        }
    };

    return self;

}());

