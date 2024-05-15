# Regex Colorizer 1.0.0-pre

Add fancy syntax highlighting to your regexes in blogs, docs, and regex testers. Supports the **JavaScript regex flavor** ([ES2024](https://github.com/slevithan/awesome-regex#javascript-regex-evolution)) with **web reality**. In other words, it highlights regexes as web browsers actually interpret them. Syntax changes activated by flags `u` and `v` are not yet supported.

The API is simple. Just give the elements that contain your regexes (`pre`, `code`, or whatever) the class `regex`, and call a couple functions (see below).

Errors are highlighted, along with some edge cases that can cause cross-browser grief. Hover over errors for a description of the problem.

**Size:** 3.9 KB min/gzip (no dependencies).

## Themes

Several themes are available as stylesheets, but you don't need to add a stylesheet to your page to use the default theme. Just run `RegexColorizer.loadStyles()`.

## Usage

```js
// Don't run this line if you provide your own stylesheet
RegexColorizer.loadStyles();

// Defaults to highlighting all elements with class 'regex'
RegexColorizer.colorizeAll();

// Alternatively, provide a querySelectorAll value for elements to highlight
RegexColorizer.colorizeAll({selector: '.regex'});
```

There is also `RegexColorizer.colorizePattern()` that returns HTML with highlighting for the provided regex pattern string.

## Demo

See the [demo page](https://slevithan.github.io/regex-colorizer/demo/) for more details.
