# Regex Colorizer 🎨

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]

Regex Colorizer is a lightweight library (3.8 kB, with no dependencies) for adding syntax highlighting to your regular expressions in blogs, docs, regex testers, and other tools. It supports the **JavaScript regex flavor** ([ES2022](https://github.com/slevithan/awesome-regex#javascript-regex-evolution)) with **web reality**. In other words, it highlights regexes as web browsers actually interpret them.

The API is simple. Just give the elements that contain your regexes (`pre`, `code`, or whatever) the class `regex`, and call `colorizeAll()`. See more usage examples below.

Errors are highlighted, along with some edge cases that can cause cross-browser grief. Hover over errors for a description of the problem.

## 🧪 Demo

Try it out on the [**demo page**](https://slevithan.github.io/regex-colorizer/demo/), which also includes more details.

## 🕹️ Install and use

```sh
npm install regex-colorizer
```

```js
import {colorizeAll, loadStyles} from 'regex-colorizer';
```

<details>
  <summary>Using a CDN and global name</summary>

```html
<script src="https://cdn.jsdelivr.net/npm/regex-colorizer/dist/regex-colorizer.min.js"></script>
<script>
  const {colorizeAll, loadStyles} = RegexColorizer;
</script>
```
</details>

## 🪧 Examples

```js
import {colorizeAll, colorizePattern, loadStyles} from 'regex-colorizer';

// Don't run this line if you provide your own stylesheet
loadStyles();

// Highlight all elements with class `regex`
colorizeAll();

// Or provide a `querySelectorAll` value for elements to highlight
colorizeAll({
  selector: '.regex',
});

// Optionally provide flags
colorizeAll({
  // Flags provided in `data-flags` attributes will override this
  flags: 'u',
});

// You can also just get the highlighting HTML for a specific pattern
element.innerHTML = colorizePattern('(?<=\\d)', {
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
  <!-- Can include any valid flags. Ex: data-flags="gimsuyd" -->
</p>
```

## 👗 Themes

Several themes are available as stylesheets, but you don't need to add a stylesheet to your page to use the default theme. Just run `loadStyles()`.

## 🏷️ About

Regex Colorizer was created by [Steven Levithan](https://github.com/slevithan). It started in 2007 as part of [RegexPal](https://stevenlevithan.com/regexpal/), the first web-based regex tester with regex syntax highlighting. It was first extracted into a standalone library in 2010.

If you want to support this project, I'd love your help by contributing improvements, sharing it with others, or [sponsoring](https://github.com/sponsors/slevithan) ongoing development.

© 2007–present. MIT License.

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/regex-colorizer?color=78C372
[npm-version-href]: https://npmjs.com/package/regex-colorizer
[bundle-src]: https://img.shields.io/bundlejs/size/regex-colorizer?color=78C372&label=minzip
[bundle-href]: https://bundlejs.com/?q=regex-colorizer&treeshake=[*]
