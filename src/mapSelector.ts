// 설정창의 맵 선택. 기본 맵과 맵 공유마당에서 받은 맵을 함께 보여준다.
//
// - 선택한 맵은 localStorage 에 기억해서 다음 방문에도 유지한다.
// - ?installMap={id} 로 들어오면 맵을 받아 설치하고 바로 선택한다 (맵 공유마당의 "마블룰렛에 설치" 버튼).
// - 받은 맵의 제목과 저작자는 사용자가 입력한 문자열이라 innerHTML 에 넣지 않는다.

import {
  COMMUNITY_MAP_ID,
  fetchCommunityMap,
  getDownloadedMaps,
  getSelectedMapId,
  type InstallResult,
  installDownloadedMap,
  removeDownloadedMap,
  setSelectedMapId,
} from './communityMaps';
import { stages } from './data/maps';
import { translate } from './localization';
import type { Roulette } from './roulette';

export interface MapSelectorOptions {
  roulette: Roulette;
  /** 맵 API 서버 (https://marblerouletteshop.com) */
  apiBase: string;
  /** 맵을 바꾼 뒤 이름 입력창에서 구슬을 다시 채운다 */
  onMapChange: () => void;
  /** 번역 키를 받아 토스트로 띄운다 */
  toast: (key: string) => void;
}

const DEFAULT_MAP_ID = 'builtin:0';

const INSTALL_MESSAGES: Record<InstallResult['result'], string> = {
  installed: 'Map installed',
  updated: 'Map updated',
  already: 'This map is already installed',
  limit: 'You can keep up to 30 downloaded maps. Remove some maps first.',
  quota: 'Not enough storage. Remove some downloaded maps first.',
  corrupt: 'Failed to install the map',
  unavailable: 'Cannot save maps in this browser',
};

export function initMapSelector({ roulette, apiBase, onMapChange, toast }: MapSelectorOptions) {
  const select = document.querySelector<HTMLSelectElement>('#sltMap');
  if (!select) return;
  const removeButton = document.querySelector<HTMLButtonElement>('#btnRemoveMap');

  function option(value: string, text: string) {
    const el = document.createElement('option');
    el.value = value;
    el.textContent = text;
    return el;
  }

  function group(label: string, options: HTMLOptionElement[]) {
    const el = document.createElement('optgroup');
    el.label = translate(label);
    el.append(...options);
    return el;
  }

  function hasOption(id: string) {
    return Array.from(select!.options).some((o) => o.value === id);
  }

  function render() {
    const builtin = stages.map((stage, index) => option(`builtin:${index}`, translate(stage.title)));
    const downloaded = getDownloadedMaps().map((map) => option(`community:${map.id}`, `${map.title} (by ${map.author})`));
    select!.replaceChildren();
    if (downloaded.length === 0) {
      select!.append(...builtin);
    } else {
      select!.append(group('Default maps', builtin), group('Downloaded maps', downloaded));
    }
  }

  function syncControls(id: string) {
    select!.value = id;
    if (removeButton) removeButton.hidden = !id.startsWith('community:');
  }

  /** 맵을 바꾼다. 없는 맵이면 false */
  function apply(id: string): boolean {
    if (id.startsWith('builtin:')) {
      const index = Number(id.slice('builtin:'.length));
      if (!Number.isInteger(index) || index < 0 || index >= stages.length) return false;
      roulette.setMap(index);
    } else if (id.startsWith('community:')) {
      const map = getDownloadedMaps().find((m) => `community:${m.id}` === id);
      if (!map) return false;
      roulette.setStage(map.stage, id);
    } else {
      return false;
    }
    setSelectedMapId(id);
    syncControls(id);
    onMapChange();
    return true;
  }

  select.addEventListener('change', () => {
    if (!apply(select.value)) {
      // 다른 탭에서 지운 맵일 수 있다. 목록을 새로 그리고 기본 맵으로
      render();
      apply(DEFAULT_MAP_ID);
    }
  });

  removeButton?.addEventListener('click', () => {
    const id = select.value;
    if (!id.startsWith('community:')) return;
    if (!window.confirm(translate('Remove this downloaded map?'))) return;
    removeDownloadedMap(id.slice('community:'.length));
    render();
    apply(DEFAULT_MAP_ID);
  });

  async function installFromUrl(id: string) {
    let pkg = null;
    try {
      pkg = await fetchCommunityMap(apiBase, id);
    } catch (e) {
      console.error('[maps] 맵을 받지 못했습니다', e);
    }
    if (!pkg) {
      toast('Failed to install the map');
      return;
    }
    const result = installDownloadedMap(pkg);
    toast(INSTALL_MESSAGES[result.result]);
    if (result.result === 'installed' || result.result === 'updated' || result.result === 'already') {
      render();
      apply(`community:${pkg.id}`);
    }
  }

  // 처음 그리기: 기억해 둔 맵이 있으면 그 맵으로
  render();
  const saved = getSelectedMapId();
  if (saved && saved !== DEFAULT_MAP_ID && hasOption(saved) && apply(saved)) {
    // apply 가 선택까지 맞췄다
  } else {
    syncControls(roulette.getCurrentMap()?.id ?? DEFAULT_MAP_ID);
  }

  // 맵 공유마당의 "마블룰렛에 설치"
  const params = new URLSearchParams(location.search);
  const installId = params.get('installMap');
  if (installId !== null) {
    // 새로고침할 때마다 다시 설치하지 않도록 주소에서 뺀다
    params.delete('installMap');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    if (COMMUNITY_MAP_ID.test(installId)) {
      void installFromUrl(installId);
    } else {
      toast('Failed to install the map');
    }
  }
}
