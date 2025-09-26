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

const dangerousConsentEnvVar = "MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS";

/**
 * 안전장치 동의 유효성 검사 헬퍼
 *
 * 지정된 환경 변수로 사용자 동의를 확인하고, 유효한 경우 경고를 출력합니다.
 *
 * @param envVar - 동의 확인을 위한 환경 변수 이름
 * @param action - 동작 설명 (경고 메시지용)
 * @returns 동의가 유효한 경우 true, 그렇지 않으면 false
 */
export const validateConsent = (envVar: string, action: string): boolean => {
  const userConsent = process.env[envVar];
  if (userConsent?.trim()) {
    console.warn(
      `⚠️  ${action} allowed by explicit user consent: "${userConsent}"`
    );
    return true;
  }
  return false;
};

/**
 * 루트 권한 실행 금지 오류 메시지
 *
 * MCP-PTY가 루트 권한으로 실행되는 것을 감지했을 때 표시되는 메시지입니다.
 * 사용자가 명시적으로 동의할 경우 MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 설정하도록 안내합니다.
 */
const rootPermissionErrorPrompt = `\
MCP-PTY detected that it is running with root privileges.

This is a highly dangerous configuration that can lead to security vulnerabilities \
and potential system compromise. Root access should be avoided unless absolutely necessary.

If you are certain that running MCP-PTY with root privileges is required for your use case \
and you understand the security implications, you may explicitly consent by setting the \
${dangerousConsentEnvVar} environment variable with a clear consent message.

Example:
export ${dangerousConsentEnvVar}="I understand the risks and explicitly allow dangerous actions in MCP-PTY"

Please ensure you have reviewed the security implications and consider running with \
reduced privileges or using process isolation mechanisms instead.`;

/**
 * sudo 명령 실행 금지 오류 메시지
 *
 * MCP-PTY가 sudo 명령 실행 시도를 감지했을 때 표시되는 메시지입니다.
 * 사용자가 명시적으로 동의할 경우 MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 설정하도록 안내합니다.
 */
const sudoPermissionErrorPrompt = `\
MCP-PTY detected an attempt to execute a sudo command in the PTY session.

This is a dangerous operation as it attempts to escalate privileges within the isolated PTY environment, \
which can lead to unintended system modifications or security risks.

If you are certain that sudo access is required for your use case and you understand the security implications, \
you may explicitly consent by setting the ${dangerousConsentEnvVar} environment variable with a clear consent message.

Example:
export ${dangerousConsentEnvVar}="I understand the risks and explicitly allow dangerous actions in MCP-PTY"

Please ensure you have reviewed the security implications and consider using alternative methods \
for privilege escalation outside of PTY sessions.`;

/**
 * 루트 권한 실행에 대한 안전장치 체크포인트
 *
 * 프로세스가 루트 권한으로 실행되고 있는지 확인하고,
 * 사용자 동의(MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수)가 없는 경우 오류를 발생시킵니다.
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
    if (
      !validateConsent(
        dangerousConsentEnvVar,
        "MCP-PTY running with root privileges"
      )
    ) {
      throw new Error(rootPermissionErrorPrompt);
    }
  }
};

/**
 * sudo 명령 실행 시도 감지 유틸리티
 *
 * PTY에서 sudo로 시작하는 명령 실행을 감지하고,
 * 사용자 동의(MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수)가 없는 경우 오류를 발생시킵니다.
 *
 * @param command - 실행할 명령어 문자열
 * @throws {Error} sudo 명령이지만 동의가 없는 경우
 */
export const checkSudoPermission = (command: string): void => {
  if (command.trim().startsWith("sudo ")) {
    if (
      !validateConsent(dangerousConsentEnvVar, "Executing sudo command in PTY")
    ) {
      throw new Error(sudoPermissionErrorPrompt);
    }
  }
};

/**
 * 실행 파일 권한 감지 유틸리티
 *
 * PTY에서 실행할 파일 이름에 sudo가 포함된 경우,
 * 사용자 동의(MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수)가 없는 경우 오류를 발생시킵니다.
 *
 * @param executable - 실행할 파일 이름
 * @throws {Error} sudo 관련 파일이지만 동의가 없는 경우
 */
export const checkExecutablePermission = (executable: string): void => {
  if (executable.toLowerCase().includes("sudo")) {
    if (
      !validateConsent(
        dangerousConsentEnvVar,
        "Executing sudo-related executable in PTY"
      )
    ) {
      throw new Error(sudoPermissionErrorPrompt);
    }
  }
};
