// PDF 翻译脚本 - 注入到 Chrome PDF 查看器
(function () {
  'use strict';

  function __(key, vars) {
    try {
      let s = chrome.i18n.getMessage(key) || key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
      return s;
    } catch { return key; }
  }

  const isPDFViewer = document.querySelector('embed[type="application/pdf"]') ||
                       document.querySelector('#content') ||
                       document.documentElement.getAttribute('pdf-viewer') === 'true' ||
                       window.location.pathname.toLowerCase().endsWith('.pdf') ||
                       !!document.querySelector('pdf-viewer');

  if (!isPDFViewer) return;

  window.translatePDFFile = () => {
    waitForPDF().then(() => translatePDF());
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translateFile') {
      waitForPDF().then(() => {
        translatePDF();
        sendResponse({ success: true });
      });
      return true;
    }
  });

  waitForPDF().then(setupPDFToolbar);

  function waitForPDF() {
    return new Promise((resolve) => {
      const check = () => {
        const textLayer = document.querySelector('.textLayer') ||
                         document.querySelector('pdf-viewer')?.shadowRoot?.querySelector('.textLayer') ||
                         document.querySelector('iframe')?.contentDocument?.querySelector('.textLayer');
        if (textLayer || document.querySelector('embed')) resolve();
        else setTimeout(check, 500);
      };
      setTimeout(check, 1000);
    });
  }

  function setupPDFToolbar() {
    const toolbar = document.querySelector('#toolbar') ||
                    document.querySelector('pdf-viewer')?.shadowRoot?.querySelector('#toolbar');
    if (toolbar) addToolbarButton(toolbar);
    else addFloatingButton();
  }

  function addToolbarButton(toolbar) {
    const btn = document.createElement('button');
    btn.textContent = '🌐 ' + __('btnTranslatePDF');
    Object.assign(btn.style, {
      padding: '4px 12px', margin: '0 8px', background: '#667eea', color: '#fff',
      border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
    });
    btn.addEventListener('click', translatePDF);
    toolbar.appendChild(btn);
  }

  function addFloatingButton() {
    const btn = document.createElement('div');
    btn.textContent = '🌐 ' + __('btnTranslateThisPDF');
    Object.assign(btn.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '99999',
      padding: '8px 16px', background: '#667eea', color: '#fff',
      border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
      fontWeight: '500', boxShadow: '0 4px 12px rgba(102,126,234,.4)',
      fontFamily: '-apple-system, sans-serif'
    });
    btn.addEventListener('click', translatePDF);
    document.body.appendChild(btn);
  }

  async function translatePDF() {
    const text = extractPDFText();
    if (!text || text.trim().length < 10) {
      alert(__('errorPDFNoText'));
      return;
    }

    const overlay = createOverlay(text);
    document.body.appendChild(overlay);

    const settings = await getSettings();
    const paragraphs = text.split('\n').filter(p => p.trim().length > 10);

    const translated = [];
    for (let i = 0; i < paragraphs.length; i += 3) {
      const batch = paragraphs.slice(i, i + 3);
      try {
        const result = await translateBatch(batch, settings);
        translated.push(...result);
      } catch (err) {
        translated.push(...batch.map(() => __('textTranslationFailedShort')));
      }
      const progress = overlay.querySelector('.pdf-progress');
      if (progress) {
        progress.textContent = __('statusTranslationProgress', {
          done: Math.min(i + 3, paragraphs.length),
          total: paragraphs.length
        });
      }
    }

    const content = overlay.querySelector('.pdf-content');
    if (content) {
      content.innerHTML = '';
      paragraphs.forEach((p, i) => {
        if (translated[i]) {
          const pEl = document.createElement('div');
          pEl.className = 'pdf-paragraph';
          pEl.innerHTML = `
            <div class="pdf-original" style="color:#666;font-size:13px;margin-bottom:4px">${escapeHtml(p)}</div>
            <div class="pdf-translated" style="color:#1a1a2e;font-size:15px;font-weight:500;margin-bottom:16px;padding:8px 12px;background:#f0f4ff;border-radius:6px">${escapeHtml(translated[i])}</div>
          `;
          content.appendChild(pEl);
        }
      });
    }

    const progress = overlay.querySelector('.pdf-progress');
    if (progress) progress.textContent = '✅ ' + __('statusTranslationComplete');
  }

  function extractPDFText() {
    const textLayers = document.querySelectorAll('.textLayer span, .textLayer div');
    if (textLayers.length > 0) {
      return Array.from(textLayers).map(el => el.textContent).join(' ');
    }
    const viewer = document.querySelector('pdf-viewer');
    if (viewer?.shadowRoot) {
      const spans = viewer.shadowRoot.querySelectorAll('.textLayer span');
      if (spans.length > 0) return Array.from(spans).map(el => el.textContent).join(' ');
    }
    const iframe = document.querySelector('iframe');
    if (iframe?.contentDocument) {
      const spans = iframe.contentDocument.querySelectorAll('.textLayer span');
      if (spans.length > 0) return Array.from(spans).map(el => el.textContent).join(' ');
    }
    return document.body.innerText?.trim() || '';
  }

  function createOverlay(text) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 999999; background: rgba(0,0,0,0.5);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 40px 20px; overflow-y: auto;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #fff; border-radius: 16px; padding: 24px;
      max-width: 800px; width: 100%; max-height: 85vh;
      overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;color:#667eea">📄 ${__('panelTitlePDFTranslation')}</h2>
        <div class="pdf-progress" style="font-size:13px;color:#666">${__('statusPreparing')}</div>
        <button class="pdf-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999">✕</button>
      </div>
      <div class="pdf-content" style="font-size:14px;line-height:1.8"></div>
    `;

    panel.querySelector('.pdf-close').addEventListener('click', () => overlay.remove());
    overlay.appendChild(panel);
    return overlay;
  }

  async function getSettings() {
    try { const res = await chrome.runtime.sendMessage({ action: 'getSettings' }); return res?.settings || {}; }
    catch { return {}; }
  }

  async function translateBatch(texts, settings) {
    const results = [];
    for (const text of texts) {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'translate', text, settings });
        results.push(res.success ? res.text : __('textTranslationFailedShort'));
      } catch {
        results.push(__('textTranslationFailedShort'));
      }
    }
    return results;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
