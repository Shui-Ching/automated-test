#!/usr/bin/env node
'use strict';

/**
 * 讀取 test-results/dispatch.md 的派工單表格，轉成 JSON 陣列輸出到 stdout，
 * 供 e2e.yml 在 workflow_dispatch 手動觸發時建立 GitHub Issue 使用。
 * 不隨每次 push/PR 自動執行。
 */

const fs = require('fs');
const path = require('path');

const DISPATCH_PATH = path.join(process.cwd(), 'test-results', 'dispatch.md');
const COLUMN_COUNT = 7; // AC 編號｜情境｜預期｜實得｜負責單位｜截圖｜trace

function unitToLabel(unit) {
    if (unit.includes('契約不符')) return 'owner:frontend-contract';
    if (unit.includes('未登記')) return 'owner:needs-triage';
    if (unit.includes('設計')) return 'owner:design';
    if (unit.includes('前端')) return 'owner:frontend';
    if (unit.includes('後端')) return 'owner:backend';
    return 'owner:unassigned';
}

/**
 * dispatch-reporter.ts 的 escapeCell() 把儲存格內容的 `|` 轉義成 `\|` 才寫進表格，
 * 錯誤訊息（locator 字串、toHaveText 差異）常常帶 `|`，直接用 `line.split('|')` 切
 * 會把這種儲存格切成多段，欄位數對不上就被 parseRow 整列丟棄，等於失敗的測試
 * 沒有變成 Issue。要用「非跳脫的 `|`」切，再把 `\|` 還原成 `|`。
 */
function splitRow(line) {
    return line.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseRow(line) {
    const cells = splitRow(line).slice(1, -1);
    if (cells.length !== COLUMN_COUNT) return null;
    const [acId, scenario, expected, actual, unit, screenshot, trace] = cells;
    return { acId, scenario, expected, actual, unit, screenshot, trace };
}

function runLink() {
    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
    if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return null;
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

function main() {
    if (!fs.existsSync(DISPATCH_PATH)) {
        process.stdout.write('[]\n');
        return;
    }

    const content = fs.readFileSync(DISPATCH_PATH, 'utf-8');
    const lines = content.split('\n');
    const tableStart = lines.findIndex((line) => line.trim().startsWith('| AC 編號'));
    if (tableStart === -1) {
        process.stdout.write('[]\n');
        return;
    }

    const rows = [];
    for (let i = tableStart + 2; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.trim().startsWith('|')) break;
        const row = parseRow(line);
        if (row) rows.push(row);
    }

    const link = runLink();

    const issues = rows.map((row) => ({
        dispatchId: `${row.acId}::${row.scenario}`,
        title: `[派工] ${row.acId} ${row.scenario}`.slice(0, 120),
        label: unitToLabel(row.unit),
        body: [
            `**情境**：${row.scenario}`,
            `**AC 編號**：${row.acId}`,
            `**預期**：${row.expected}`,
            `**實得**：${row.actual}`,
            `**負責單位**：${row.unit}`,
            row.screenshot && row.screenshot !== '（無）' ? `**截圖**：${row.screenshot}` : null,
            row.trace && row.trace !== '（無）' ? `**trace**：${row.trace}` : null,
            link ? `**執行紀錄**：${link}` : null,
            '',
            `<!-- dispatch-id: ${row.acId}::${row.scenario} -->`,
        ]
            .filter((line) => line !== null)
            .join('\n'),
    }));

    process.stdout.write(`${JSON.stringify(issues)}\n`);
}

main();
