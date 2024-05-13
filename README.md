# Regex Colorizer 0.4

Adds syntax highlighting to regular expressions for readability. Supports the **JavaScript regex flavor**, with extensions for **web reality**. Unsupported regex features are marked as errors, along with some edge cases that can cause cross-browser grief. Syntax changes activated by flags `u` and `v` are not yet supported.

The API is simple. Just give elements that contain your regexes class `regex`, and call a couple functions (see below). The syntax highlighting, however, is quite advanced, and is contextually aware of things that happen forward or backward in the regex.

**Size:** 3.4 KB min/gzip, with no dependencies.

## Usage

```js
// Don't run this line if you provide your own stylesheet
RegexColorizer.addStyleSheet();

// Can provide a class name for elements to process (defaults to 'regex')
RegexColorizer.colorizeAll();
```

There is also `RegexColorizer.colorizeText()` that returns HTML with highlighting for the provided regex pattern string.

Try the [demo](https://slevithan.github.io/regex-colorizer/demo/).
