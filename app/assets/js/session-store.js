/**
 * 後台登入狀態的唯一存取入口。掛在 window.AdminSession 底下。
 *
 * 刻意寫成傳統 script（非 ES module）而不是 export：
 * <script type="module"> 一律是 defer 的，會等 HTML 解析完才執行，
 * 那時候後台版型已經畫出來了——[NFR-001] 要求「不得於任何時點顯示版面骨架」，
 * 用 module 寫的登入守衛必定會失敗這條。傳統 script 放在 <head> 才會在第一次繪製前執行。
 *
 * 逾時秒數做成可注入的設定值，而不是寫死 30 分鐘：
 * [NFR-002] 要求「連續 30 分鐘無操作後失效」，但沒有任何自動化測試會等 30 分鐘。
 * 不留這個注入點，這條需求就永遠只能人工測——而人工測正是這個專案要消滅的東西。
 * 注入方式：網址帶 ?sessionTimeout=2（單位為秒）。正式值 1800 秒。
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'admin-session';
    var DEFAULT_TIMEOUT_SECONDS = 1800;

    function resolveTimeoutSeconds() {
        var injected = new URLSearchParams(window.location.search).get('sessionTimeout');
        var parsed = Number(injected);
        return isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_SECONDS;
    }

    function read() {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch (error) {
            // 內容被外部改壞時視同未登入，並清掉殘值，避免每次載入都重複解析失敗
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    window.AdminSession = {
        create: function (account) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                account: account,
                lastActiveAt: Date.now(),
                timeoutSeconds: resolveTimeoutSeconds()
            }));
        },

        clear: function () {
            sessionStorage.removeItem(STORAGE_KEY);
        },

        read: read,

        /** 'active' | 'none' | 'expired'。分成三種而非布林，是因為「沒登入」與「逾時」的提示文案不同。 */
        check: function () {
            var session = read();
            if (!session) return 'none';

            var idleSeconds = (Date.now() - session.lastActiveAt) / 1000;
            if (idleSeconds > session.timeoutSeconds) {
                sessionStorage.removeItem(STORAGE_KEY);
                return 'expired';
            }

            return 'active';
        },

        /** 有操作就延長。呼叫時機由各後台頁面決定。 */
        touch: function () {
            var session = read();
            if (!session) return;

            session.lastActiveAt = Date.now();
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        }
    };
})();
