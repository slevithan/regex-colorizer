# Regex Colorizer v0.3.1-next

Adds syntax highlighting to regular expressions for readability. Currently, only the JavaScript (ES5) regex flavor is supported, with extensions for web reality. Any regex features not supported by JavaScript are marked as errors, along with some edge cases that cause cross-browser grief.

Use the following code to run Regex Colorizer for all elements on a page with class `regex`:

```js
// Don't run this line if you provide your own stylesheet
RegexColorizer.addStyleSheet();

// Can provide a class name for elements to process (defaults to 'regex')
RegexColorizer.colorizeAll();
```

There is also a `RegexColorizer.colorizeText()` method that returns HTML with highlighting for the provided regex pattern string.

See [Regex Colorizer's website](https://stevenlevithan.com/regex/colorizer/) for examples and more details.
