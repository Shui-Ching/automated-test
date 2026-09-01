/**
 * 前台頁面內容以 HTML 原樣渲染（PUB-WEB-FN-002 AC-P4），照字面實作等於把使用者輸入
 * 直接塞進 innerHTML，是一個 XSS 注入點（見 docs/project-plan.md 風險 R-3）。
 * 這裡做白名單消毒：允許清單對齊編輯器工具列（粗體、斜體、項目清單、超連結、圖片）
 * 與 Quill 預設的段落／換行包裹，移除白名單外的標籤（保留其文字節點，不整段砍掉），
 * 危險標籤（script/style/iframe/object/embed）連內容一併移除，並清掉所有 on* 事件屬性
 * 與 javascript: 開頭的連結／圖片來源。
 */

const ALLOWED_TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'A', 'IMG']);
const DROP_ENTIRELY = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);
const URL_ATTR_BY_TAG = { A: 'href', IMG: 'src' };

function isSafeUrl(value) {
    return !/^\s*javascript:/i.test(value || '');
}

function sanitizeChildren(parent) {
    Array.from(parent.childNodes).forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // 先處理子節點，避免砍掉外層包裝時漏掉巢狀的危險標籤
        sanitizeChildren(node);

        if (DROP_ENTIRELY.has(node.tagName)) {
            node.remove();
            return;
        }

        Array.from(node.attributes).forEach((attr) => {
            if (attr.name.toLowerCase().startsWith('on')) {
                node.removeAttribute(attr.name);
            }
        });

        const urlAttr = URL_ATTR_BY_TAG[node.tagName];
        if (urlAttr && !isSafeUrl(node.getAttribute(urlAttr))) {
            node.removeAttribute(urlAttr);
        }

        if (!ALLOWED_TAGS.has(node.tagName)) {
            // 不在白名單的標籤只拆掉外層包裝，內部文字與已消毒過的子元素原樣保留
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            node.remove();
            return;
        }

        if (node.tagName === 'A') {
            const href = node.getAttribute('href');
            const target = node.getAttribute('target');
            Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
            if (href) node.setAttribute('href', href);
            if (target === '_blank') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        } else if (node.tagName === 'IMG') {
            const src = node.getAttribute('src');
            const alt = node.getAttribute('alt');
            Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
            if (src) node.setAttribute('src', src);
            if (alt) node.setAttribute('alt', alt);
        } else {
            Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
        }
    });
}

export function sanitizeHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    sanitizeChildren(container);
    return container.innerHTML;
}
