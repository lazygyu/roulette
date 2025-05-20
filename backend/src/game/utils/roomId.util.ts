const ROOM_ID_PREFIX = 'ROOM_';

/**
 * 숫자 Room ID에 접두사를 붙여 문자열 ID를 생성합니다.
 * @param id - 숫자 Room ID
 * @returns 접두사가 붙은 문자열 Room ID (예: "ROOM_123")
 */
export function prefixRoomId(id: number): string {
  return `${ROOM_ID_PREFIX}${id}`;
}

/**
 * 접두사가 붙은 문자열 Room ID에서 접두사를 제거하고 숫자 ID를 반환합니다.
 * 유효하지 않은 ID 형식일 경우 에러를 발생시킵니다.
 * @param prefixedId - 접두사가 붙은 문자열 Room ID
 * @returns 숫자 Room ID
 * @throws Error - ID 형식이 유효하지 않을 경우
 */
export function unprefixRoomId(prefixedId: string): number {
  if (!prefixedId || !prefixedId.startsWith(ROOM_ID_PREFIX)) {
    throw new Error(`Invalid room ID format: ${prefixedId}. Must start with "${ROOM_ID_PREFIX}".`);
  }
  const idString = prefixedId.substring(ROOM_ID_PREFIX.length);
  const id = parseInt(idString, 10);
  if (isNaN(id)) {
    throw new Error(`Invalid room ID format: ${prefixedId}. Numeric part is not a valid number.`);
  }
  return id;
}
