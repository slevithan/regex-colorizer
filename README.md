# Regex Colorizer 1.0.0

Regex Colorizer adds syntax highlighting to your regular expressions in blogs, docs, regex testers, and other tools. Supports the **JavaScript regex flavor** ([ES2022](https://github.com/slevithan/awesome-regex#javascript-regex-evolution)) with **web reality**. In other words, it highlights regexes as web browsers actually interpret them.

The API is simple. Just give the elements that contain your regexes (`pre`, `code`, or whatever) the class `regex`, and call `RegexColorizer.colorizeAll()`. See more usage examples below.

Errors are highlighted, along with some edge cases that can cause cross-browser grief. Hover over errors for a description of the problem.

[5 KB min/gzip, no dependencies.]

## Themes

Several themes are available as stylesheets, but you don't need to add a stylesheet to your page to use the default theme. Just run `RegexColorizer.loadStyles()`.

## Usage

```js
// Don't run this line if you provide your own stylesheet
RegexColorizer.loadStyles();

// Highlight all elements with class 'regex'
RegexColorizer.colorizeAll();

// Or provide a querySelectorAll value for elements to highlight
RegexColorizer.colorizeAll({
  selector: '.regex',
});

// Optionally provide flags
RegexColorizer.colorizeAll({
  // Flags provided in data-flags attributes will override this
  flags: 'u',
});

// You can also just get the highlighting HTML for a specific pattern
const pattern = '(?<=\\d)';
someElement.innerHTML = RegexColorizer.colorizePattern(pattern, {
  flags: 'u',
});
```

In your HTML:

```html
<p>
  This regex is highlighted inline:
  <code class="regex">(?&lt;=\d)\p{L}\8</code>.

  And here's the same regex but with different rules from flag u:
  <code class="regex" data-flags="u">(?&lt;=\d)\p{L}\8</code>.
</p>
<!-- Can include any valid flags. Ex: data-flags="gimsuyd" -->
```

## Demo

See the [demo page](https://slevithan.github.io/regex-colorizer/demo/) for more details.
