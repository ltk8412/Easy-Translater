// ═══════════════════════════════════════════════════
//  自定义 Prompt 管理
// ═══════════════════════════════════════════════════

let customPrompts = {};

const pt = (k) => window.i18nGet ? window.i18nGet(k) : k;

function loadPrompts(saved, activeId) {
  customPrompts = saved || {};
  const sel = document.getElementById('promptSelector');
  if (!sel) return;

  sel.innerHTML = '<option value="default">' + pt('promptDefault') + '</option>';

  Object.entries(customPrompts).forEach(([id, p]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  sel.value = activeId || 'default';
  updatePromptText();
}

function updatePromptText() {
  const sel = document.getElementById('promptSelector');
  const text = document.getElementById('promptText');
  const updateBtn = document.getElementById('updatePrompt');
  const deleteBtn = document.getElementById('deletePrompt');
  if (!sel || !text) return;

  const id = sel.value;
  if (id === 'default') {
    text.value = '';
    text.placeholder = pt('promptDefaultPlaceholder');
    if (updateBtn) updateBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
  } else {
    const p = customPrompts[id];
    text.value = p?.template || '';
    text.placeholder = '';
    if (updateBtn) updateBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
  }
}

function getCustomPrompts() {
  return customPrompts;
}

function initPromptManager(showStatusFn) {
  const sel = document.getElementById('promptSelector');
  const saveBtn = document.getElementById('savePrompt');
  const updateBtn = document.getElementById('updatePrompt');
  const deleteBtn = document.getElementById('deletePrompt');
  const text = document.getElementById('promptText');

  if (!sel) return;

  sel.addEventListener('change', updatePromptText);

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!text) return;
      const content = text.value.trim();
      if (!content) {
        showStatusFn(pt('errorPromptEmpty'), 'error');
        return;
      }
      const defaultName = pt('promptDefaultName') + ' ' + (Object.keys(customPrompts).length + 1);
      const name = prompt(pt('promptNameLabel'), defaultName);
      if (!name) return;

      const id = 'custom_' + Date.now();
      customPrompts[id] = { name, template: content };
      loadPrompts(customPrompts, id);
      showStatusFn(pt('statusPromptSaved'), 'success');
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      const id = sel.value;
      if (id === 'default') return;
      if (!text) return;
      const content = text.value.trim();
      if (!content) {
        showStatusFn(pt('errorPromptEmpty'), 'error');
        return;
      }
      customPrompts[id].template = content;
      showStatusFn(pt('statusPromptUpdated'), 'success');
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const id = sel.value;
      if (id === 'default') return;
      if (!confirm(pt('confirmPromptDelete'))) return;
      delete customPrompts[id];
      loadPrompts(customPrompts, 'default');
      showStatusFn(pt('statusPromptDeleted'), 'success');
    });
  }
}

window.PromptManager = {
  load: loadPrompts,
  init: initPromptManager,
  getPrompts: getCustomPrompts
};
