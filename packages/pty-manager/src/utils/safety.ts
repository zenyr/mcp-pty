/**
 * 루트 권한 실행에 대한 안전장치 유틸리티
 *
 * MCP-PTY에서 PTY 프로세스가 루트 권한으로 실행되는 것을 방지하기 위한
 * 사용자 동의 기반 안전장치입니다.
 *
 * @remarks
 * 이 모듈은 Prisma의 ai-safety.ts 구현을 참고하여 루트 권한 감지 및
 * 사용자 동의 강제를 제공합니다.
 */

const rootConsentEnvVar = "MCP_PTY_ALLOW_ROOT";

/**
 * 루트 권한 실행 금지 오류 메시지
 *
 * MCP-PTY가 루트 권한으로 실행되는 것을 감지했을 때 표시되는 메시지입니다.
 * 사용자가 명시적으로 동의할 경우 MCP_PTY_ALLOW_ROOT 환경 변수를 설정하도록 안내합니다.
 */
const rootPermissionErrorPrompt = `\
MCP-PTY detected that it is running with root privileges.

This is a highly dangerous configuration that can lead to security vulnerabilities \
and potential system compromise. Root access should be avoided unless absolutely necessary.

If you are certain that running MCP-PTY with root privileges is required for your use case \
and you understand the security implications, you may explicitly consent by setting the \
${rootConsentEnvVar} environment variable with a clear consent message.

Example:
export ${rootConsentEnvVar}="I understand the risks and explicitly allow MCP-PTY to run with root privileges"

Please ensure you have reviewed the security implications and consider running with \
reduced privileges or using process isolation mechanisms instead.`;

/**
 * 루트 권한 실행에 대한 안전장치 체크포인트
 *
 * 프로세스가 루트 권한으로 실행되고 있는지 확인하고,
 * 사용자 동의(MCP_PTY_ALLOW_ROOT 환경 변수)가 없는 경우 오류를 발생시킵니다.
 *
 * @throws {Error} 루트 권한으로 실행되지만 동의가 없는 경우
 *
 * @example
 * ```ts
 * import { checkRootPermission } from './utils/safety'
 *
 * // PTY 생성 전에 호출
 * checkRootPermission()
 * ```
 */
export const checkRootPermission = (): void => {
  // 루트 권한인지 확인 (geteuid가 0이면 루트)
  if (process.geteuid && process.geteuid() === 0) {
    // 환경 변수로 사용자 동의 확인
    const userConsent = process.env[rootConsentEnvVar];

    if (userConsent && userConsent.trim().length > 0) {
      console.warn(
        `⚠️  MCP-PTY is running with root privileges by explicit user consent: "${userConsent}"`
      );
      return;
    }

    throw new Error(rootPermissionErrorPrompt);
  }
};
