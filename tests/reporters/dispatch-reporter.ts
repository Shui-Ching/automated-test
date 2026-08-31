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
 * 負責單位依 tests/contract/ac-coverage.json 的 test_title 精確比對取得，
 * 該表由 PM 端維護，分類規則見 docs/project-plan.md 第 179～186 行。
 */

interface DispatchRow {
    acId: string;
    scenario: string;
    expected: string;
    actual: string;
    unit: string;
    screenshot: string | null;
}

interface CoverageRow {
    unit: string;
    test_title: string | null;
}

function isContractTest(filePath: string): boolean {
    return filePath.split(path.sep).join('/').includes('/tests/contract/');
}

function loadCoverageMap(): Map<string, string> {
    const coveragePath = path.join(process.cwd(), 'tests', 'contract', 'ac-coverage.json');
    const map = new Map<string, string>();
    if (!fs.existsSync(coveragePath)) return map;

    const parsed = JSON.parse(fs.readFileSync(coveragePath, 'utf-8')) as { rows: CoverageRow[] };
    for (const row of parsed.rows) {
        if (row.test_title) map.set(row.test_title, row.unit);
    }
    return map;
}

const coverageMap = loadCoverageMap();

function resolveUnit(title: string, filePath: string): string {
    if (isContractTest(filePath)) return '前端（契約不符，非 bug）';
    return coverageMap.get(title) ?? '前端（未登記於 ac-coverage.json，請補登記）';
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
            unit: resolveUnit(test.title, test.location.file),
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
