// 맵 공유마당(marblerouletteshop.com/maps) 에서 받은 맵을 localStorage 에 보관한다.
//
// 샵(커스텀 룰렛 설치) 도 같은 키와 스키마를 쓴다. 바꿀 때는 샵의
// packages/common/src/map/downloadedMap.type.ts 와 함께 바꾸고 schemaVersion 을 올려야 한다.
//
// 서버가 검증한 승인 맵만 받지만, localStorage 는 사용자가 손댈 수 있으므로 읽을 때마다 형태를 다시 확인한다.

import type { StageDef } from './data/maps';
import type { MapEntity } from './types/MapEntity.type';

export const DOWNLOADED_MAPS_STORAGE_KEY = 'mbr_downloaded_maps';
export const SELECTED_MAP_STORAGE_KEY = 'mbr_selected_map';
export const DOWNLOADED_MAPS_SCHEMA_VERSION = 1;
export const MAX_DOWNLOADED_MAPS = 30;

/** 형태 확인에서 쓰는 상한. 서버 상한(500) 보다 넉넉히 둔다. 게임이 멈추지 않을 정도만 막으면 된다 */
const MAX_ENTITIES = 1000;
const MAX_POINTS = 1000;

export interface DownloadedMap {
  /** 서버의 맵 slug */
  id: string;
  /** 서버 승인 버전 */
  version: number;
  title: string;
  author: string;
  installedAt: number;
  updatedAt: number;
  stage: StageDef;
}

interface DownloadedMapsStore {
  schemaVersion: number;
  maps: DownloadedMap[];
}

/** 서버(/api/external/maps/:id) 응답 */
export interface CommunityMapPackage {
  id: string;
  version: number;
  title: string;
  author: string;
  stage: StageDef;
}

export type InstallResult =
  | { result: 'installed' | 'updated' | 'already'; map: DownloadedMap }
  | { result: 'limit' | 'quota' | 'corrupt' | 'unavailable' };

export const COMMUNITY_MAP_ID = /^[0-9a-f]{8}$/;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isEntity(v: unknown): v is MapEntity {
  if (!isObj(v) || (v.type !== 'static' && v.type !== 'kinematic')) return false;
  const { position, shape, props } = v;
  if (!isObj(position) || !isNum(position.x) || !isNum(position.y)) return false;
  if (!isObj(props) || !isNum(props.density) || !isNum(props.restitution) || !isNum(props.angularVelocity)) {
    return false;
  }
  if (props.life !== undefined && !isNum(props.life)) return false;
  if (!isObj(shape)) return false;
  switch (shape.type) {
    case 'box':
      return isNum(shape.width) && isNum(shape.height) && isNum(shape.rotation);
    case 'circle':
      return isNum(shape.radius) && shape.radius > 0;
    case 'polyline':
      return (
        Array.isArray(shape.points) &&
        shape.points.length >= 2 &&
        shape.points.length <= MAX_POINTS &&
        shape.points.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))
      );
    default:
      return false;
  }
}

/** 게임이 돌릴 수 있는 형태인지만 본다. 상세 규칙은 서버가 검증한다 */
export function isPlayableStage(v: unknown): v is StageDef {
  if (!isObj(v) || typeof v.title !== 'string' || !isNum(v.goalY) || !isNum(v.zoomY)) return false;
  if (!Array.isArray(v.entities) || v.entities.length === 0 || v.entities.length > MAX_ENTITIES) return false;
  if (!v.entities.every(isEntity)) return false;
  if (v.adBoards !== undefined) {
    if (!Array.isArray(v.adBoards) || !v.adBoards.every((b) => isObj(b) && isNum(b.x) && isNum(b.y))) return false;
  }
  return true;
}

function isDownloadedMap(v: unknown): v is DownloadedMap {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    COMMUNITY_MAP_ID.test(v.id) &&
    isNum(v.version) &&
    typeof v.title === 'string' &&
    typeof v.author === 'string' &&
    isPlayableStage(v.stage)
  );
}

type ReadResult = { ok: true; store: DownloadedMapsStore } | { ok: false; reason: 'corrupt' | 'unavailable' };

function readStore(): ReadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DOWNLOADED_MAPS_STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (raw === null) return { ok: true, store: { schemaVersion: DOWNLOADED_MAPS_SCHEMA_VERSION, maps: [] } };
  try {
    const parsed = JSON.parse(raw);
    if (!isObj(parsed) || parsed.schemaVersion !== DOWNLOADED_MAPS_SCHEMA_VERSION || !Array.isArray(parsed.maps)) {
      return { ok: false, reason: 'corrupt' };
    }
    return { ok: true, store: parsed as unknown as DownloadedMapsStore };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

function writeStore(store: DownloadedMapsStore): 'ok' | 'quota' | 'unavailable' {
  try {
    localStorage.setItem(DOWNLOADED_MAPS_STORAGE_KEY, JSON.stringify(store));
    return 'ok';
  } catch (e) {
    return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22) ? 'quota' : 'unavailable';
  }
}

/**
 * 쓸 수 있는 다운로드 맵 목록 (설치 순서).
 * 저장 데이터 전체가 깨졌으면 빈 목록이고, 맵 하나가 깨졌으면 그 맵만 뺀다. 어느 경우든 저장소를 고치지 않는다.
 */
export function getDownloadedMaps(): DownloadedMap[] {
  const read = readStore();
  if (!read.ok) return [];
  return read.store.maps.filter(isDownloadedMap);
}

export function installDownloadedMap(pkg: CommunityMapPackage, now = Date.now()): InstallResult {
  const read = readStore();
  // 깨진 데이터를 덮어쓰면 사용자가 받아둔 다른 맵까지 사라진다
  if (!read.ok) return { result: read.reason };
  const { store } = read;
  const index = store.maps.findIndex((m) => isObj(m) && m.id === pkg.id);
  const existing = index >= 0 && isDownloadedMap(store.maps[index]) ? store.maps[index] : undefined;

  if (existing && existing.version >= pkg.version) return { result: 'already', map: existing };

  let map: DownloadedMap;
  if (index >= 0) {
    map = { ...pkg, installedAt: existing?.installedAt ?? now, updatedAt: now };
    store.maps[index] = map;
  } else {
    if (store.maps.length >= MAX_DOWNLOADED_MAPS) return { result: 'limit' };
    map = { ...pkg, installedAt: now, updatedAt: now };
    store.maps.push(map);
  }
  const written = writeStore(store);
  if (written !== 'ok') return { result: written };
  return { result: existing ? 'updated' : 'installed', map };
}

export function removeDownloadedMap(id: string): boolean {
  const read = readStore();
  if (!read.ok) return false;
  const maps = read.store.maps.filter((m) => !(isObj(m) && m.id === id));
  if (maps.length === read.store.maps.length) return false;
  return writeStore({ ...read.store, maps }) === 'ok';
}

export function getSelectedMapId(): string | null {
  try {
    return localStorage.getItem(SELECTED_MAP_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSelectedMapId(id: string) {
  try {
    localStorage.setItem(SELECTED_MAP_STORAGE_KEY, id);
  } catch {
    // 저장하지 못하면 다음 방문에 첫 맵으로 돌아갈 뿐이다
  }
}

/**
 * 받은 맵으로 게임을 시작했다고 알린다. 맵 공유마당의 인기순(최근 7일 플레이) 에 쓰인다.
 * 광고 노출 집계처럼 결과를 기다리지 않는다. 본문과 헤더가 없는 POST 라 CORS 프리플라이트도 생기지 않는다
 */
export function reportCommunityMapPlay(apiBase: string, mapId: string) {
  if (!mapId.startsWith('community:')) return;
  const id = mapId.slice('community:'.length);
  if (!COMMUNITY_MAP_ID.test(id)) return;
  fetch(`${apiBase}/api/external/maps/${id}/play`, { method: 'POST', credentials: 'omit', keepalive: true }).catch(
    () => {},
  );
}

export async function fetchCommunityMap(apiBase: string, id: string): Promise<CommunityMapPackage | null> {
  const res = await fetch(`${apiBase}/api/external/maps/${id}`);
  if (!res.ok) return null;
  const pkg = await res.json();
  if (!isObj(pkg) || pkg.id !== id || !isNum(pkg.version) || typeof pkg.title !== 'string') return null;
  if (typeof pkg.author !== 'string' || !isPlayableStage(pkg.stage)) return null;
  return pkg as unknown as CommunityMapPackage;
}
