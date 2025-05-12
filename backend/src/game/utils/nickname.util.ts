/**
 * 클라이언트 ID를 기반으로 익명 닉네임을 생성합니다.
 * @param clientId - 소켓 클라이언트의 고유 ID
 * @returns 생성된 익명 닉네임 (예: "User_abcd")
 */
export function generateAnonymousNickname(clientId: string): string {
  // ID의 첫 4자리를 사용하여 닉네임 생성
  const shortId = clientId.slice(0, 4);
  return `User_${shortId}`;
}
