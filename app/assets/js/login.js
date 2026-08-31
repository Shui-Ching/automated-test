import { MOCK_ACCOUNT, MOCK_PASSWORD } from './mock-credentials.js';

const form = document.querySelector('.js-login-form');
const accountInput = document.querySelector('.js-login-account');
const passwordInput = document.querySelector('.js-login-password');
const submitButton = document.querySelector('.js-login-submit');
const formAlert = document.querySelector('.js-login-alert');

// 文案集中在一處，避免同一句話在驗證與提示兩邊各寫一份而逐漸不一致。
// 來源：[AUT-ADM-FN-001] 欄位驗證表與商業邏輯表異常流程
const MESSAGES = {
    accountRequired: '請輸入帳號',
    passwordRequired: '請輸入密碼',
    credentialMismatch: '帳號或密碼錯誤',
    sessionExpired: '登入狀態已逾時，請重新登入',
};

function showFieldError(input, message) {
    const errorElement = document.querySelector(`[data-error-for="${input.id}"]`);
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    errorElement.textContent = message;
    errorElement.hidden = false;
}

function clearFieldError(input) {
    const errorElement = document.querySelector(`[data-error-for="${input.id}"]`);
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    errorElement.textContent = '';
    errorElement.hidden = true;
}

function showFormAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
}

function clearFormAlert() {
    formAlert.textContent = '';
    formAlert.hidden = true;
}

/** 回傳是否通過。兩個欄位都要檢查完才回傳，不要一遇到錯誤就中斷——否則第二個欄位的錯誤要送出兩次才看得到。 */
function validateRequiredFields() {
    let valid = true;

    if (accountInput.value.trim() === '') {
        showFieldError(accountInput, MESSAGES.accountRequired);
        valid = false;
    }

    if (passwordInput.value === '') {
        showFieldError(passwordInput, MESSAGES.passwordRequired);
        valid = false;
    }

    return valid;
}

form.addEventListener('submit', (event) => {
    event.preventDefault();

    clearFieldError(accountInput);
    clearFieldError(passwordInput);
    clearFormAlert();

    if (!validateRequiredFields()) return;

    submitButton.disabled = true;

    const matched =
        accountInput.value === MOCK_ACCOUNT && passwordInput.value === MOCK_PASSWORD;

    if (!matched) {
        // 異常流程 1：密碼欄清空、帳號欄保留輸入值。
        // 錯誤文案不區分「帳號不存在」與「密碼錯誤」（特殊規則 3）。
        showFormAlert(MESSAGES.credentialMismatch);
        passwordInput.value = '';
        submitButton.disabled = false;
        accountInput.focus();
        return;
    }

    window.AdminSession.create(MOCK_ACCOUNT);
    window.location.href = 'page-list.html';
});

// 逾時導回時顯示提示。導頁網址由 auth-guard.js 帶上 ?reason=expired
if (new URLSearchParams(window.location.search).get('reason') === 'expired') {
    showFormAlert(MESSAGES.sessionExpired);
}

// 進入登入頁代表本次登入流程重新開始，清掉任何殘留狀態
window.AdminSession.clear();
