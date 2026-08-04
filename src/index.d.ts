/*!
Regex Colorizer
(c) 2007-2026 Steven Levithan
MIT License
*/
/**
 * Returns HTML for displaying the given regex with syntax highlighting.
 * @param {string} pattern Regex pattern to be colorized.
 * @param {Object} [options]
 * @param {string} [options.flags] Any combination of valid flags.
 * @returns {string} HTML with highlighting.
 */
declare function colorizePattern(pattern: string, { flags, }?: {
    flags?: string;
}): string;
/**
 * Applies highlighting to all regex elements on the page, replacing their content with HTML.
 * @param {Object} [options]
 * @param {string} [options.selector='.regex'] `querySelectorAll` value: elements to highlight.
 * @param {string} [options.flags] Any combination of valid flags. Overridden by `data-flags`
 * attribute.
 */
declare function colorizeAll({ selector, flags, }?: {
    selector?: string;
    flags?: string;
}): void;
/**
 * Adds the default theme styles to the page. Don't run this if you provide your own stylesheet.
 */
declare function loadStyles(): void;
export { colorizeAll, colorizePattern, loadStyles, };
//# sourceMappingURL=index.d.ts.map