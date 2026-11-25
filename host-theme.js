// Keep a small selector bridge alive while the extension is enabled. The
// native theme name remains untouched; only the visible selector has an extra
// option for the extension's CSS and JavaScript theme.
export function initHostTheme({ isActive, onSelect }) {
  const optionValue = '__manbei_shoutie_extension__';
  const actionIds = [
    'ui_preset_import_button', 'ui_preset_export_button',
    'ui-preset-delete-button', 'ui-preset-update-button',
    'ui-preset-save-button'
  ];
  const suppressedStyles = new Map();
  const actionAria = new Map();
  let select = null;
  let originalSelectDisabled = false;
  let lastNativeTheme = '';
  let customCssInput = null;
  let originalInputDisabled = false;
  let alive = true;

  function suppressCustomCss() {
    const style = document.getElementById('custom-style');
    if (!style) return;
    if (!suppressedStyles.has(style)) suppressedStyles.set(style, style.getAttribute('media'));
    if (style.getAttribute('media') !== 'not all') style.setAttribute('media', 'not all');
  }
  function restoreCustomCss() {
    for (const [style, media] of suppressedStyles) {
      if (media == null) style.removeAttribute('media');
      else style.setAttribute('media', media);
    }
    suppressedStyles.clear();
  }
  function setActionState(owned) {
    const input = document.getElementById('customCSS');
    if (input && input !== customCssInput) {
      customCssInput = input;
      originalInputDisabled = input.disabled;
    }
    if (customCssInput) customCssInput.disabled = owned || originalInputDisabled;
    for (const id of actionIds) {
      const action = document.getElementById(id);
      if (!action) continue;
      if (owned) {
        if (!actionAria.has(action)) actionAria.set(action, action.getAttribute('aria-disabled'));
        action.setAttribute('aria-disabled', 'true');
      } else if (actionAria.has(action)) {
        const old = actionAria.get(action);
        if (old == null) action.removeAttribute('aria-disabled');
        else action.setAttribute('aria-disabled', old);
        actionAria.delete(action);
      }
    }
  }
  function guardNativeActions(event) {
    if (!alive || !isActive()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(actionIds.map(id => '#' + id).join(','))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onThemeChange(event) {
    if (!alive || event.currentTarget !== select) return;
    const chosen = select.value;
    if (chosen === optionValue) {
      // The native handler only knows saved JSON themes. Keep its actual theme
      // name intact while showing the extension's option in the selector.
      event.stopImmediatePropagation();
      if (!isActive()) onSelect(true);
      sync();
      return;
    }
    if (chosen) lastNativeTheme = chosen;
    if (isActive()) onSelect(false);
    restoreCustomCss();
    setActionState(false);
    // Let SillyTavern's own change handler apply and save the chosen theme.
  }
  function bindSelect() {
    const next = document.getElementById('themes');
    if (!next || !next.options.length) return;
    if (next !== select) {
      select?.removeEventListener('change', onThemeChange, true);
      select = next;
      originalSelectDisabled = next.disabled;
      if (next.value && next.value !== optionValue) lastNativeTheme = next.value;
      next.addEventListener('change', onThemeChange, true);
    }
    if (!select.querySelector('option[value="' + optionValue + '"]')) {
      select.append(new Option('60度', optionValue));
    }
    select.disabled = false;
    if (isActive() && select.value !== optionValue) select.value = optionValue;
  }
  function sync() {
    if (!alive) return;
    bindSelect();
    if (isActive()) suppressCustomCss();
    else restoreCustomCss();
    setActionState(isActive());
  }

  document.addEventListener('click', guardNativeActions, true);
  const headObserver = new MutationObserver(sync);
  headObserver.observe(document.head, { childList: true, subtree: true });
  const retry = setInterval(sync, 1200);
  sync();

  return () => {
    alive = false;
    headObserver.disconnect();
    clearInterval(retry);
    document.removeEventListener('click', guardNativeActions, true);
    restoreCustomCss();
    setActionState(false);
    select?.removeEventListener('change', onThemeChange, true);
    if (select) {
      if (select.value === optionValue) {
        const fallback = [...select.options].find(option => option.value === lastNativeTheme)
          || [...select.options].find(option => option.value !== optionValue);
        if (fallback) select.value = fallback.value;
      }
      select.querySelector('option[value="' + optionValue + '"]')?.remove();
      select.disabled = originalSelectDisabled;
    }
  };
}
