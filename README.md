# Regex Colorizer 0.4

Add fancy syntax highlighting to your regexes in blogs, docs, and regex testers. Supports the **JavaScript regex flavor** ([ES2024](https://github.com/slevithan/awesome-regex#javascript-regex-evolution)) with **web reality**. In other words, it highlights regexes as web browsers actually interpret them. Syntax changes activated by flags `u` and `v` are not yet supported.

The API is simple. Just give the elements that contain your regexes (`pre`, `code`, or whatever) the class `regex`, and call a couple functions (see below).

Errors are highlighted, along with some edge cases that can cause cross-browser grief. Hover over errors for a description of the problem.

**Size:** 3.4 KB min/gzip, with no dependencies.

## Themes

Several themes are available as stylesheets, and you can easily create your own. If you want to use the default theme, you don't need to manually add any styles to your page. The default styles can be loaded using `RegexColorizer.addStyleSheet()`.

## Usage

```js
// Don't run this line if you provide your own stylesheet
RegexColorizer.addStyleSheet();

// Can provide a class name for elements to process (defaults to 'regex')
RegexColorizer.colorizeAll();
```

There is also `RegexColorizer.colorizeText()` that returns HTML with highlighting for the provided regex pattern string.

## Demo

See the [demo page](https://slevithan.github.io/regex-colorizer/demo/) for more details.
