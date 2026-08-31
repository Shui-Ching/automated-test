import type { Reporter, FullResult, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 派工單產生器：測試全部跑完後，把失敗的測試轉成一份 Markdown 派工單
 * （AC 編號／情境／預期／實得／負責單位／截圖），寫到 test-results/dispatch.md。
 *
 * 契約檢查失敗（tests/contract/）與功能測試失敗分開標註負責單位，理由見
 * tests/contract/contract-check.spec.ts 檔頭：前者是前端沒照契約實作或契約過期，不是 bug，
 * 混在一起會讓 triage 成本比人工測試還高。
 *
 * Phase 1 只有登入頁一個功能，派工單全部落在「前端」。這裡先用最簡單的路徑判斷，
 * 待 Phase 0.5 的 ac-coverage.json（AC → 負責單位）到位後，resolveUnit 改成查那份表。
 */

interface DispatchRow {
    acId: string;
    scenario: string;
    expected: string;
    actual: string;
    unit: string;
    screenshot: string | null;
}

function isContractTest(filePath: string): boolean {
    return filePath.split(path.sep).join('/').includes('/tests/contract/');
}

function resolveUnit(filePath: string): string {
    return isContractTest(filePath) ? '前端（契約不符，非 bug）' : '前端';
}

function extractAcId(title: string, filePath: string): string {
    const match = title.match(/AC-[A-Za-z0-9]+/);
    if (match) return match[0];
    return isContractTest(filePath) ? '（契約檢查，無對應 AC）' : '（非 AC 測試）';
}

/** Playwright 的錯誤訊息預設帶 ANSI 顏色碼，直接寫進 Markdown 表格會混進亂碼字元。 */
function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function formatActual(result: TestResult): string {
    if (result.status === 'timedOut') return `逾時（timedOut）`;
    if (result.errors.length === 0) return result.status;
    const firstLine = stripAnsi(result.errors[0].message ?? String(result.errors[0])).split('\n')[0];
    return `${result.status} — ${firstLine}`;
}

/** Markdown 表格儲存格：跳脫 `|`，換行改空格，避免破壞表格結構。 */
function escapeCell(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

class DispatchReporter implements Reporter {
    private rows: DispatchRow[] = [];

    onTestEnd(test: TestCase, result: TestResult): void {
        if (result.status === 'passed') return;

        const screenshot = result.attachments.find((a) => a.name === 'screenshot');

        this.rows.push({
            acId: extractAcId(test.title, test.location.file),
            scenario: test.title,
            expected: test.expectedStatus,
            actual: formatActual(result),
            unit: resolveUnit(test.location.file),
            screenshot: screenshot?.path ?? null,
        });
    }

    onEnd(result: FullResult): void {
        const outDir = path.join(process.cwd(), 'test-results');
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, 'dispatch.md');

        if (this.rows.length === 0) {
            fs.writeFileSync(
                outPath,
                `# 派工單\n\n本次執行結果：${result.status}。沒有需要派工的失敗項目。\n`,
                'utf-8'
            );
            return;
        }

        const lines = [
            '# 派工單',
            '',
            `本次執行結果：${result.status}，共 ${this.rows.length} 項需要處理。`,
            '',
            '| AC 編號 | 情境 | 預期 | 實得 | 負責單位 | 截圖 |',
            '| :--- | :--- | :--- | :--- | :--- | :--- |',
            ...this.rows.map(
                (row) =>
                    `| ${escapeCell(row.acId)} | ${escapeCell(row.scenario)} | ${escapeCell(row.expected)} | ${escapeCell(row.actual)} | ${escapeCell(row.unit)} | ${row.screenshot ? escapeCell(row.screenshot) : '（無）'} |`
            ),
        ];

        fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
    }
}

export default DispatchReporter;
