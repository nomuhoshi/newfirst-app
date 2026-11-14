// 离线支持诊断只报告注册失败和固定异常类别，不复制可能带网址、参数或凭据的 message。
const REGISTRATION_ERROR_NAMES = new Set([
  "Error", "TypeError", "SyntaxError", "SecurityError", "InvalidStateError", "AbortError",
  "NotAllowedError", "UnknownError", "NetworkError", "NotSupportedError", "TimeoutError", "QuotaExceededError",
]);
export function swRegistrationError(error) {
  let name;
  try { name = error?.name; } catch { /* 自定义 name getter 也可能抛错，按未知类型处理 */ }
  return `注册失败（${REGISTRATION_ERROR_NAMES.has(name) ? name : "未知类型"}）`;
}
