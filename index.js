import { initTopbar } from './topbar.js';
import { initLetter, registerLetterChatSurface } from './letter.js';
import { initTeaHome } from './tea-home.js';
import { initReception } from './reception.js';
import { initHostTheme } from './host-theme.js';

const KEY = 'manbei_shoutie';
const IMAGE_KEY = 'manbei_shoutie_night_image';
const DEFAULT = Object.freeze({
  themeActive: true, night: false, font: 100, scope: 'global',
  focus: { x: 50, y: 25, scale: 100 }, characters: {},
  background: 'none', blur: 0, darkness: 55,
  backgroundFocus: { x: 50, y: 50 }, backgroundFocusByCharacter: {},
  shortcuts: ['preset', 'api', 'world']
});
const TARGETS = {
  preset: ['预设', 'ai-config-button'],
  api: ['API', 'sys-settings-button'],
  world: ['世界书', 'WI-SP-button'],
  formatting: ['格式', 'advanced-formatting-button'],
  user: ['用户设置', 'user-settings-button'],
  background: ['背景设置', 'backgrounds-button'],
  extensions: ['扩展', 'extensions-settings-button'],
  persona: ['用户角色', 'persona-management-button'],
  characters: ['角色管理', 'rightNavHolder']
};
let cleanupTopbar = () => {};
let cleanupLetter = () => {};
let cleanupTeaHome = () => {};
let cleanupReception = () => {};
let cleanupThemeBridge = null;
let barObserver;
let started = false;
let startupTimer;
let bridgeTimer;
let listenChat;
let imageData = '';

function context() { return globalThis.SillyTavern?.getContext?.(); }
function settings() {
  const ctx = context();
  if (!ctx?.extensionSettings) return null;
  const value = ctx.extensionSettings[KEY] ??= structuredClone(DEFAULT);
  for (const [key, def] of Object.entries(DEFAULT)) {
    if (value[key] === undefined) value[key] = structuredClone(def);
  }
  return value;
}
function save() { context()?.saveSettingsDebounced?.(); }
function character() {
  const ctx = context();
  if (!ctx || ctx.groupId != null || ctx.characterId == null) return null;
  const data = ctx.characters?.[ctx.characterId];
  if (!data?.avatar) return null;
  const avatar = String(data.avatar);
  return {
    key: avatar,
    name: data.name || '',
    avatarUrl: '/characters/' + encodeURIComponent(avatar)
  };
}
function imageStore() { return globalThis.SillyTavern?.libs?.localforage; }
async function loadImage() {
  try { imageData = (await imageStore()?.getItem(IMAGE_KEY)) || ''; }
  catch (error) { console.warn('[慢焙手帖] 背景图读取失败', error); imageData = ''; }
  apply();
}
function cssUrl(url) { return 'url("' + String(url).replaceAll('"', '%22').replaceAll('\\', '%5C') + '")'; }
function backgroundFocus(s, current) {
  return s.background === 'character' && current
    ? s.backgroundFocusByCharacter?.[current.key] || s.backgroundFocus
    : s.backgroundFocus;
}
function apply() {
  const s = settings();
  if (!started || !s) return;
  const body = document.body;
  body.classList.toggle('mist-night', !!s.night);
  const current = character();
  const focus = s.characters?.[current?.key] || s.focus;
  body.style.setProperty('--mist-focus-x', Math.max(0, Math.min(100, Number(focus.x) || 0)) + '%');
  body.style.setProperty('--mist-focus-y', Math.max(0, Math.min(100, Number(focus.y) || 0)) + '%');
  body.style.setProperty('--mist-focus-scale', String(Math.max(0.8, Math.min(2, Number(focus.scale) / 100 || 1))));
  body.style.setProperty('--mist-font-size', String(Math.max(0.8, Math.min(1.4, Number(s.font) / 100 || 1))) + 'em');
  body.style.setProperty('--mist-blur', Math.max(0, Math.min(24, Number(s.blur) || 0)) + 'px');
  body.style.setProperty('--mist-darkness', String(Math.max(0, Math.min(.9, Number(s.darkness) / 100 || 0))));
  const bgFocus = backgroundFocus(s, current);
  body.style.setProperty('--mist-bg-position-x', Math.max(0, Math.min(100, Number(bgFocus.x) || 0)) + '%');
  body.style.setProperty('--mist-bg-position-y', Math.max(0, Math.min(100, Number(bgFocus.y) || 0)) + '%');
  const url = s.background === 'upload' ? imageData : s.background === 'character' ? current?.avatarUrl : '';
  body.classList.toggle('mist-chat-image', !!s.night && !!url);
  if (url && s.night) body.style.setProperty('--mist-chat-image', cssUrl(url));
  else body.style.removeProperty('--mist-chat-image');
  document.querySelectorAll('#mist-shortcuts [data-shortcut]').forEach((button, index) => {
    const item = TARGETS[s.shortcuts[index]] || TARGETS.preset;
    button.title = item[0];
    button.setAttribute('aria-label', item[0]);
  });
  const panel = document.getElementById('mist-panel');
  if (panel) {
    panel.querySelector('[name="night"]').checked = !!s.night;
    panel.querySelector('[name="scope"]').value = s.scope;
    panel.querySelector('[name="font"]').value = s.font;
    panel.querySelector('[name="background"]').value = s.background;
    panel.querySelector('[name="blur"]').value = s.blur;
    panel.querySelector('[name="darkness"]').value = s.darkness;
    panel.querySelector('[name="backgroundX"]').value = bgFocus.x;
    panel.querySelector('[name="backgroundY"]').value = bgFocus.y;
    panel.querySelectorAll('[name="shortcut"]').forEach((el, i) => { el.value = s.shortcuts[i]; });
    for (const key of ['x', 'y', 'scale']) panel.querySelector('[name="' + key + '"]').value = focus[key];
    panel.querySelector('.mist-night-only').hidden = !s.night;
    panel.querySelector('.mist-character-note').textContent = current ? current.name : '当前没有选中的角色';
    panel.querySelector('[name="scope"] option[value="character"]').disabled = !current;
    panel.querySelector('.mist-focus-clear').disabled = !current || !s.characters?.[current.key];
  }
}
function updateFocus(key, value) {
  const s = settings();
  const current = character();
  if (s.scope === 'character' && current) {
    s.characters[current.key] ??= { ...s.focus };
    s.characters[current.key][key] = Number(value);
  } else s.focus[key] = Number(value);
  save(); apply();
}
function updateBackgroundFocus(key, value) {
  const s = settings();
  const current = character();
  const target = s.background === 'character' && current
    ? (s.backgroundFocusByCharacter[current.key] ??= { ...s.backgroundFocus })
    : s.backgroundFocus;
  target[key] = Number(value);
  save(); apply();
}
function nativeOpen(key) {
  const item = TARGETS[key];
  const button = item && document.querySelector('#' + item[1] + ' > .drawer-toggle');
  if (!button) {
    alert('当前版本未找到“' + (item?.[0] || key) + '”的原生入口。');
    return;
  }
  button.click();
}
function makeRange(name, label, min, max) {
  return '<label class="mist-control"><span>' + label + '</span><input type="range" name="' + name +
    '" min="' + min + '" max="' + max + '"></label>';
}
function makePanel() {
  const root = document.createElement('div');
  root.id = 'mist-shortcuts';
  root.innerHTML = '<div class="mist-bars" role="toolbar" aria-label="60度快捷入口">' +
    [0, 1, 2].map(i => '<button type="button" data-shortcut="' + i + '"><span></span></button>').join('') +
    '<button type="button" class="mist-settings-toggle" aria-label="主题设置" title="主题设置" aria-expanded="false"><span></span></button></div>' +
    '<section id="mist-panel" aria-label="60度设置" hidden>' +
    '<header><strong>60度</strong><button type="button" class="mist-close" aria-label="关闭设置">×</button></header>' +
    '<label class="mist-switch"><span>夜间模式</span><input type="checkbox" name="night"></label>' +
    '<div class="mist-section"><strong>角色横幅</strong><small class="mist-character-note"></small>' +
    '<select name="scope"><option value="global">全角色适用</option><option value="character">仅当前角色</option></select>' +
    makeRange('x', '左右', 0, 100) + makeRange('y', '上下', 0, 100) +
    makeRange('scale', '图片比例', 80, 200) +
    '<button type="button" class="mist-focus-clear">删除当前角色设置</button></div>' +
    '<div class="mist-section"><strong>正文字号</strong>' + makeRange('font', '字号', 80, 140) + '</div>' +
    '<div class="mist-section mist-night-only"><strong>夜间正文背景</strong>' +
    '<select name="background"><option value="none">纯色</option><option value="upload">上传图片</option><option value="character">当前角色图片</option></select>' +
    '<label class="mist-upload">选择图片<input type="file" accept="image/*" name="image"></label>' +
    '<small class="mist-background-note">角色图片位置按角色保存；上传图片位置全局保存。原图像素偏小时，铺满画布可能变软。</small>' +
    makeRange('backgroundX', '背景左右', 0, 100) + makeRange('backgroundY', '背景上下', 0, 100) +
    makeRange('blur', '模糊', 0, 24) + makeRange('darkness', '暗度', 0, 90) + '</div>' +
    '<div class="mist-section"><strong>三条快捷入口</strong><div class="mist-shortcut-options"></div></div>' +
    '<button type="button" class="mist-reset">恢复默认</button></section>';
  const options = Object.entries(TARGETS).map(([value, item]) =>
    '<option value="' + value + '">' + item[0] + '</option>').join('');
  root.querySelector('.mist-shortcut-options').innerHTML = [0, 1, 2].map(i =>
    '<label>第' + ['一', '二', '三'][i] + '条 <select name="shortcut" data-index="' + i + '">' +
    options + '</select></label>').join('');
  document.getElementById('top-settings-holder').append(root);
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-shortcut')) nativeOpen(settings().shortcuts[Number(button.dataset.shortcut)]);
    else if (button.classList.contains('mist-settings-toggle')) togglePanel();
    else if (button.classList.contains('mist-close')) togglePanel(false);
    else if (button.classList.contains('mist-focus-clear')) {
      const current = character(); if (current) delete settings().characters[current.key];
      save(); apply();
    } else if (button.classList.contains('mist-reset')) {
      context().extensionSettings[KEY] = structuredClone(DEFAULT);
      imageData = '';
      imageStore()?.removeItem(IMAGE_KEY).catch(error => console.warn('[慢焙手帖] 背景图清理失败', error));
      save(); apply();
    }
  });
  root.addEventListener('input', event => {
    const el = event.target, s = settings();
    if (['x', 'y', 'scale'].includes(el.name)) updateFocus(el.name, el.value);
    else if (el.name === 'backgroundX') updateBackgroundFocus('x', el.value);
    else if (el.name === 'backgroundY') updateBackgroundFocus('y', el.value);
    else if (['font', 'blur', 'darkness'].includes(el.name)) { s[el.name] = Number(el.value); save(); apply(); }
  });
  root.addEventListener('change', async event => {
    const el = event.target, s = settings();
    if (el.name === 'night') s.night = el.checked;
    else if (el.name === 'scope') s.scope = el.value;
    else if (el.name === 'background') s.background = el.value;
    else if (el.name === 'shortcut') {
      const index = Number(el.dataset.index), previous = s.shortcuts[index];
      const other = s.shortcuts.indexOf(el.value);
      s.shortcuts[index] = el.value;
      if (other !== -1 && other !== index) s.shortcuts[other] = previous;
    } else if (el.name === 'image' && el.files?.[0]) {
      const file = el.files[0];
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        alert('请选择不超过 8 MB 的图片。'); el.value = ''; return;
      }
      const reader = new FileReader();
      imageData = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      try {
        if (!imageStore()) throw new Error('localforage unavailable');
        await imageStore().setItem(IMAGE_KEY, imageData);
      } catch (error) {
        console.warn('[慢焙手帖] 背景图保存失败', error);
        alert('背景图保存失败，请重试。');
        imageData = '';
        return;
      }
      s.background = 'upload';
      el.value = '';
    } else return;
    save(); apply();
  });
  document.addEventListener('pointerdown', outsideClick);
  document.addEventListener('keydown', escapeKey);
}
function togglePanel(force) {
  const panel = document.getElementById('mist-panel');
  if (!panel) return;
  panel.hidden = force === undefined ? !panel.hidden : !force;
  document.querySelector('.mist-settings-toggle')?.setAttribute('aria-expanded', String(!panel.hidden));
}
function outsideClick(event) {
  if (!event.target.closest('#mist-shortcuts')) togglePanel(false);
}
function escapeKey(event) { if (event.key === 'Escape') togglePanel(false); }
function begin() {
  if (started) return;
  if (!document.body || !document.querySelector('#top-settings-holder') || !context()?.extensionSettings) {
    startupTimer = setTimeout(begin, 250); return;
  }
  started = true;
  const link = document.createElement('link');
  link.id = 'mist-theme-link'; link.rel = 'stylesheet';
  link.href = new URL('./theme.css?v=0.4.1', import.meta.url).href;
  document.head.append(link);
  cleanupTopbar = initTopbar(character, apply);
  cleanupTeaHome = initTeaHome();
  cleanupReception = initReception();
  cleanupLetter = initLetter();
  makePanel();
  const bar = document.getElementById('top-settings-holder');
  barObserver = new MutationObserver(() => {
    if (!bar.classList.contains('mist-collapsed')) togglePanel(false);
  });
  barObserver.observe(bar, { attributes: true, attributeFilter: ['class'] });
  const { eventSource, event_types, eventTypes } = context();
  const chatChanged = (event_types || eventTypes)?.CHAT_CHANGED;
  listenChat = () => { apply(); cleanupLetter(); cleanupLetter = initLetter(); };
  if (eventSource && chatChanged) eventSource.on(chatChanged, listenChat);
  loadImage();
  apply();
}
function stop() {
  clearTimeout(startupTimer);
  if (!started) return;
  started = false;
  const { eventSource, event_types, eventTypes } = context() || {};
  const chatChanged = (event_types || eventTypes)?.CHAT_CHANGED;
  if (eventSource && chatChanged) eventSource.removeListener?.(chatChanged, listenChat);
  cleanupLetter();
  cleanupReception();
  cleanupTeaHome();
  cleanupTopbar();
  barObserver?.disconnect();
  document.removeEventListener('pointerdown', outsideClick);
  document.removeEventListener('keydown', escapeKey);
  document.getElementById('mist-shortcuts')?.remove();
  document.getElementById('mist-theme-link')?.remove();
  document.body.classList.remove('mist-night', 'mist-chat-image', 'mist-ui-ready');
  for (const name of ['--mist-focus-x','--mist-focus-y','--mist-focus-scale','--mist-font-size','--mist-blur','--mist-darkness','--mist-chat-image','--mist-bg-position-x','--mist-bg-position-y'])
    document.body.style.removeProperty(name);
}
function startBridge(forceTheme = false) {
  if (cleanupThemeBridge) return;
  const s = settings();
  if (!document.body || !s) {
    bridgeTimer = setTimeout(() => startBridge(forceTheme), 250);
    return;
  }
  if (forceTheme) {
    s.themeActive = true;
    save();
  }
  cleanupThemeBridge = initHostTheme({
    isActive: () => settings()?.themeActive !== false,
    onSelect: selected => {
      settings().themeActive = selected;
      save();
      if (selected) begin();
      else stop();
    }
  });
  if (s.themeActive) begin();
}
export function onActivate() { startBridge(); }
export function onEnable() { startBridge(true); }
export function registerChatSurface() { registerLetterChatSurface(); }
export function onDisable() {
  clearTimeout(bridgeTimer);
  stop();
  cleanupThemeBridge?.();
  cleanupThemeBridge = null;
}
