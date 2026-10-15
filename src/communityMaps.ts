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
  if (v.progress !== undefined) {
    if (!isObj(v.progress)) return false;
    const oneWays = v.progress.oneWays;
    if (
      oneWays !== undefined &&
      (!Array.isArray(oneWays) || !oneWays.every((l) => isObj(l) && isPoint(l.from) && isPoint(l.to)))
    ) {
      return false;
    }
  }
  if (v.zoomZones !== undefined && !isZoneList(v.zoomZones)) return false;
  if (v.cameraZones !== undefined && !isZoneList(v.cameraZones)) return false;
  return true;
}

function isZoneList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((z) => isObj(z) && isNum(z.x) && isNum(z.y) && isNum(z.w) && isNum(z.h) && z.w > 0 && z.h > 0)
  );
}

function isPoint(v: unknown): boolean {
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
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
    () => {}
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

// === 맵 브라우저 ===

/** 서버(/api/external/maps) 목록 항목 */
export interface CommunityMapListItem {
  slug: string;
  title: string;
  authorName: string;
  version: number;
  downloadCount: number;
  playCount: number;
  recentPlayCount: number;
}

export type CommunityMapSort = 'popular' | 'latest' | 'downloads';

export interface CommunityMapListPage {
  items: CommunityMapListItem[];
  total: number;
}

function isListItem(v: unknown): v is CommunityMapListItem {
  return (
    isObj(v) &&
    typeof v.slug === 'string' &&
    COMMUNITY_MAP_ID.test(v.slug) &&
    typeof v.title === 'string' &&
    typeof v.authorName === 'string' &&
    isNum(v.version) &&
    isNum(v.downloadCount) &&
    isNum(v.playCount) &&
    isNum(v.recentPlayCount)
  );
}

export async function fetchCommunityMapList(
  apiBase: string,
  query: { sort: CommunityMapSort; q: string; page: number; limit: number },
  signal?: AbortSignal
): Promise<CommunityMapListPage | null> {
  const params = new URLSearchParams({ sort: query.sort, page: String(query.page), limit: String(query.limit) });
  if (query.q) params.set('q', query.q);
  const res = await fetch(`${apiBase}/api/external/maps?${params}`, { signal });
  if (!res.ok) return null;
  const body = await res.json();
  if (!isObj(body) || !Array.isArray(body.items) || !isNum(body.total)) return null;
  return { items: body.items.filter(isListItem), total: body.total };
}

export function communityMapThumbnailUrl(apiBase: string, id: string) {
  return `${apiBase}/api/maps/${id}/thumbnail.svg`;
}

// === 받은 맵의 업데이트 확인 ===
//
// 게임을 열 때 하루 한 번만 서버에 묻고 결과를 저장해 둔다. 업데이트는 사용자가 맵 브라우저에서 직접 한다.
// 진행 중인 판의 맵이 바뀌면 안 되므로 자동으로 바꾸지 않는다.

export const MAP_UPDATES_STORAGE_KEY = 'mbr_map_updates';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface RemoteMapState {
  /** 서버의 최신 승인 버전. 삭제된 맵이면 null */
  version: number | null;
  /** 지금 받을 수 있는지. 숨김/삭제된 맵은 false */
  available: boolean;
}

interface MapUpdatesStore {
  checkedAt: number;
  maps: Record<string, RemoteMapState>;
}

function readUpdates(): MapUpdatesStore | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(MAP_UPDATES_STORAGE_KEY) ?? 'null');
    if (!isObj(parsed) || !isNum(parsed.checkedAt) || !isObj(parsed.maps)) return null;
    return parsed as unknown as MapUpdatesStore;
  } catch {
    return null;
  }
}

/** 마지막으로 확인한 서버 상태. 확인한 적 없는 맵은 빠져 있다 */
export function getRemoteMapStates(): Record<string, RemoteMapState> {
  return readUpdates()?.maps ?? {};
}

/** 받은 맵 중 서버에 더 높은 버전이 있는 맵 id */
export function getUpdatableMapIds(maps = getDownloadedMaps()): string[] {
  const states = getRemoteMapStates();
  return maps
    .filter((m) => {
      const state = states[m.id];
      return state?.available === true && state.version !== null && state.version > m.version;
    })
    .map((m) => m.id);
}

/**
 * 하루가 지났으면 서버에 받은 맵의 최신 버전을 묻는다. 확인했으면 true.
 * 실패해도 게임에는 영향이 없으므로 조용히 넘어간다 (다음 방문에 다시 묻는다)
 */
export async function checkMapUpdates(apiBase: string, now = Date.now()): Promise<boolean> {
  const ids = getDownloadedMaps().map((m) => m.id);
  if (ids.length === 0) return false;
  const last = readUpdates();
  if (last && now - last.checkedAt >= 0 && now - last.checkedAt < UPDATE_CHECK_INTERVAL_MS) return false;
  try {
    const res = await fetch(`${apiBase}/api/external/maps/versions?ids=${ids.join(',')}`);
    if (!res.ok) return false;
    const body = await res.json();
    if (!isObj(body) || !Array.isArray(body.maps)) return false;
    const maps: Record<string, RemoteMapState> = {};
    for (const m of body.maps) {
      if (!isObj(m) || typeof m.id !== 'string' || !COMMUNITY_MAP_ID.test(m.id)) continue;
      maps[m.id] = { version: isNum(m.version) ? m.version : null, available: m.available === true };
    }
    localStorage.setItem(MAP_UPDATES_STORAGE_KEY, JSON.stringify({ checkedAt: now, maps } satisfies MapUpdatesStore));
    return true;
  } catch {
    return false;
  }
}

/** 설치/업데이트로 최신 상태를 알게 됐을 때 기록한다. 하루 한 번 확인을 기다리지 않고 표시를 맞추기 위해서다 */
export function rememberRemoteMapState(id: string, state: RemoteMapState) {
  const last = readUpdates();
  if (!last) return;
  try {
    localStorage.setItem(
      MAP_UPDATES_STORAGE_KEY,
      JSON.stringify({ ...last, maps: { ...last.maps, [id]: state } } satisfies MapUpdatesStore)
    );
  } catch {
    // 다음 확인 때 맞춰진다
  }
}
