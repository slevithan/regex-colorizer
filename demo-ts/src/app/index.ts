// import '../styles/global.scss';
import '../styles/global.scss';

import { colorizeAll, colorizePattern } from 'regex-colorizer-ts';

const octalsRegexID = 'octals-regex';

const Theme = {
  Default: 'default',
  NoBg: 'nobg',
  Regexpal: 'regexpal',
  Regexbuddy: 'regexbuddy'
} as const;

type Theme = (typeof Theme)[keyof typeof Theme];

type ThemeElements = {
  button: HTMLButtonElement;
  infoText: HTMLElement;
  link: HTMLLinkElement;
}

const loadElementsForTheme = (theme: Theme): ThemeElements => {
  const button = document.getElementById(`${theme}-btn`) as HTMLButtonElement;
  const infoText = document.getElementById(`info-theme-${theme}`)!;
  const link = document.getElementById(`${theme}-ss`) as HTMLLinkElement;
  return { button, infoText, link };
}

const allThemes = Object.values(Theme);
const themeElementsMap: Record<Theme, ThemeElements> = {} as Record<Theme, ThemeElements>;

const getElementsForTheme = (theme: Theme): ThemeElements => {
  if (!themeElementsMap[theme]) {
    themeElementsMap[theme] = loadElementsForTheme(theme);
  }
  return themeElementsMap[theme];
}


function setTheme(targetTheme: Theme) {
  const { link: selectedThemeLink } = getElementsForTheme(targetTheme);

  allThemes.forEach(theme => {
    const { button: themeButton, infoText, link } = getElementsForTheme(theme);

    themeButton.disabled = theme === targetTheme;
    infoText.classList.toggle('hidden', theme !== targetTheme);
    // Need to disable all stylesheets before enabling the active one
    link.disabled = true;
  });
  selectedThemeLink.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  for (const theme of allThemes) {
    getElementsForTheme(theme);
  }

  colorizeAll();

  const inputElem = document.getElementById('input') as HTMLTextAreaElement;
  const outputElem = document.getElementById('output')!;
  const checkBoxElem = document.getElementById('flag-u-checkbox')!;
  // const octalsRegexElem = document.getElementById(octalsRegexID) as HTMLTextAreaElement;

  for (const theme of allThemes) {
    const { button: btn } = getElementsForTheme(theme);
    btn.addEventListener('click', () => {
      console.log('Switching to theme:', theme);
      setTheme(theme);
      showOutput(outputElem.innerHTML);
    });
  }

  function showOutput(pattern: string) {
    outputElem.innerHTML = pattern;
    // Alternatively, could use `colorizePattern` and assign to `innerHTML`
    const colorized = colorizePattern(pattern);
    console.log('Colorized output:', colorized);
    colorizeAll({
      selector: '#output'
    });
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = '0';
    el.style.height = el.scrollHeight + 5 + 'px';
  }

  function setFlagsFor(id: string, flags: string) {
    document.getElementById(id)!.dataset.flags = flags;
    colorizeAll({
      selector: `#${id}`
      // Alternatively, if not using the `data-flags` attribute:
      // flags,
    });
  }

  const renderFromInput = (el: HTMLTextAreaElement) => {
    console.log('Rendering from input:', el.value);
    showOutput(el.value || el.placeholder);
    autoGrow(el);
  };

  console.log('INPUT_ELEM', inputElem);
  inputElem.addEventListener('input', (e) => {
    renderFromInput(e.currentTarget as HTMLTextAreaElement);
  });
  checkBoxElem.addEventListener('change', (e) => {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    setFlagsFor(octalsRegexID, checked ? 'u' : '');
  })
});
