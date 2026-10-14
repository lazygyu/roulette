// 맵 공유마당 브라우저. 설정창의 "맵 더 받기"(+) 버튼으로 연다.
//
// - 공유마당 목록(인기/최신/다운로드순) 을 찾아보고 바로 설치한다. 넘김은 "더 보기" 버튼.
// - "받은 맵" 탭에서 업데이트/삭제한다. 업데이트 여부는 하루 한 번 확인한 결과(checkMapUpdates) 를 쓴다.
// - 맵 설명과 만들기는 샵으로 넘긴다.
// - 커스텀 룰렛 페이지(custom.html) 를 따로 고치지 않도록 대화상자는 여기서 만든다.
// - 맵 제목과 저작자는 사용자가 입력한 문자열이라 textContent 로만 넣는다.

import {
  type CommunityMapListItem,
  type CommunityMapSort,
  communityMapThumbnailUrl,
  type DownloadedMap,
  fetchCommunityMapList,
  getDownloadedMaps,
  getRemoteMapStates,
  getUpdatableMapIds,
  MAX_DOWNLOADED_MAPS,
} from './communityMaps';
import { translate } from './localization';

export interface MapBrowserOptions {
  /** 맵 API 서버. 샵 페이지 링크도 같은 주소다 */
  apiBase: string;
  /** 지금 선택된 맵 ('builtin:0', 'community:{id}') */
  getSelectedId: () => string;
  /** 받아서 설치하고 선택한다. 결과 안내(토스트) 도 맡는다. 설치됐으면 true */
  install: (id: string) => Promise<boolean>;
  /** 받은 맵을 선택한다 */
  use: (id: string) => void;
  /** 받은 맵을 지운다. 사용자가 취소하면 false */
  remove: (id: string) => boolean;
}

type Tab = CommunityMapSort | 'mine';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'popular', label: 'Popular' },
  { tab: 'latest', label: 'Latest' },
  { tab: 'downloads', label: 'Most downloaded' },
  { tab: 'mine', label: 'My maps' },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatCount(n: number) {
  return n >= 10000 ? `${Math.floor(n / 1000)}k` : n.toLocaleString();
}

export function createMapBrowser({ apiBase, getSelectedId, install, use, remove }: MapBrowserOptions) {
  let dialog: HTMLDialogElement | null = null;
  let tabButtons = new Map<Tab, HTMLButtonElement>();
  let searchInput: HTMLInputElement;
  let list: HTMLElement;
  let status: HTMLElement;
  let moreButton: HTMLButtonElement;

  let tab: Tab = 'popular';
  let query = '';
  let page = 0;
  let total = 0;
  let items: CommunityMapListItem[] = [];
  let loading = false;
  let failed = false;
  let request: AbortController | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** 설치 중인 맵. 같은 버튼을 두 번 눌러 두 번 받지 않도록 */
  const installing = new Set<string>();

  function build() {
    const d = el('dialog', 'map-browser');
    dialog = d;
    d.setAttribute('aria-label', translate('Map Share'));
    const panel = el('div', 'mb-panel');

    const header = el('div', 'mb-header');
    const title = el('h2', 'mb-title', translate('Map Share'));
    const close = el('button', 'mb-close', '✕');
    close.type = 'button';
    close.title = translate('Close');
    close.addEventListener('click', () => d.close());
    header.append(title, close);

    const tabs = el('div', 'mb-tabs');
    tabs.setAttribute('role', 'tablist');
    tabButtons = new Map();
    for (const t of TABS) {
      const button = el('button', 'mb-tab');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => selectTab(t.tab));
      tabButtons.set(t.tab, button);
      tabs.append(button);
    }

    searchInput = el('input', 'mb-search');
    searchInput.type = 'search';
    searchInput.maxLength = 50;
    searchInput.placeholder = translate('Search by title or author');
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const next = searchInput.value.trim();
        if (next === query) return;
        query = next;
        reload();
      }, SEARCH_DEBOUNCE_MS);
    });

    list = el('div', 'mb-list');
    status = el('div', 'mb-status');
    moreButton = el('button', 'mb-more', translate('Load more'));
    moreButton.type = 'button';
    moreButton.addEventListener('click', () => void loadPage(page + 1));

    const body = el('div', 'mb-body');
    body.append(list, status, moreButton);

    const footer = el('div', 'mb-footer');
    const shopLink = el('a', undefined, translate('View on Map Share'));
    shopLink.href = `${apiBase}/maps`;
    const editorLink = el('a', undefined, translate('Make a map'));
    editorLink.href = `${apiBase}/map-editor`;
    for (const a of [shopLink, editorLink]) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    footer.append(shopLink, editorLink);

    panel.append(header, tabs, searchInput, body, footer);
    d.append(panel);
    // 바깥(배경) 을 누르면 닫는다. 패널이 대화상자를 꽉 채우므로 target 이 dialog 면 배경이다
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    d.addEventListener('close', () => request?.abort());
    document.body.append(d);
  }

  function renderTabs() {
    const downloaded = getDownloadedMaps();
    const hasUpdate = getUpdatableMapIds(downloaded).length > 0;
    for (const t of TABS) {
      const button = tabButtons.get(t.tab)!;
      button.textContent =
        t.tab === 'mine' ? `${translate(t.label)} ${downloaded.length}/${MAX_DOWNLOADED_MAPS}` : translate(t.label);
      button.classList.toggle('active', t.tab === tab);
      button.classList.toggle('has-update', t.tab === 'mine' && hasUpdate);
      button.setAttribute('aria-selected', String(t.tab === tab));
    }
    searchInput.hidden = tab === 'mine';
  }

  function selectTab(next: Tab) {
    if (next === tab) return;
    tab = next;
    reload();
  }

  function reload() {
    request?.abort();
    items = [];
    total = 0;
    page = 0;
    failed = false;
    loading = false;
    list.scrollTop = 0;
    renderTabs();
    if (tab === 'mine') {
      render();
    } else {
      void loadPage(1);
    }
  }

  async function loadPage(next: number) {
    if (tab === 'mine') return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    loading = true;
    failed = false;
    render();
    try {
      const result = await fetchCommunityMapList(
        apiBase,
        { sort: tab, q: query, page: next, limit: PAGE_SIZE },
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!result) {
        failed = true;
      } else {
        // 넘기는 사이 새 맵이 올라와 같은 맵이 두 번 올 수 있다
        const seen = new Set(items.map((m) => m.slug));
        items = items.concat(result.items.filter((m) => !seen.has(m.slug)));
        total = result.total;
        page = next;
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error('[maps] 맵 목록을 받지 못했습니다', e);
      failed = true;
    }
    loading = false;
    render();
  }

  function thumbnail(id: string) {
    const box = el('div', 'mb-thumb');
    const img = el('img');
    img.src = communityMapThumbnailUrl(apiBase, id);
    img.alt = '';
    img.loading = 'lazy';
    // 공유가 중단된 맵은 썸네일이 없다
    img.addEventListener('error', () => img.remove());
    box.append(img);
    return box;
  }

  function titleLink(id: string, title: string) {
    const a = el('a', 'mb-card-title', title);
    a.href = `${apiBase}/maps/${id}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = title;
    return a;
  }

  function actionButton(label: string, onClick?: () => void, className = '') {
    const button = el('button', `mb-action ${className}`.trim(), translate(label));
    button.type = 'button';
    if (onClick) {
      button.addEventListener('click', onClick);
    } else {
      button.disabled = true;
    }
    return button;
  }

  async function runInstall(id: string) {
    if (installing.has(id)) return;
    installing.add(id);
    render();
    try {
      await install(id);
    } finally {
      installing.delete(id);
      renderTabs();
      render();
    }
  }

  /** 받은 맵과 서버 목록 항목을 함께 보고 버튼을 정한다 */
  function primaryAction(id: string, local: DownloadedMap | undefined, latestVersion: number | null) {
    if (installing.has(id)) return actionButton('Installing...');
    if (local && latestVersion !== null && latestVersion > local.version) {
      return actionButton('Update', () => void runInstall(id), 'mb-action-update');
    }
    if (!local) return actionButton('Install', () => void runInstall(id), 'mb-action-install');
    if (getSelectedId() === `community:${id}`) return actionButton('In use');
    return actionButton('Use', () => {
      use(id);
      render();
    });
  }

  function remoteCard(item: CommunityMapListItem, local: DownloadedMap | undefined) {
    const card = el('div', 'mb-card');
    const info = el('div', 'mb-card-info');
    const stats = el(
      'div',
      'mb-card-stats',
      `${translate('Plays')} ${formatCount(item.playCount)} · ${translate('Downloads')} ${formatCount(item.downloadCount)}`
    );
    info.append(titleLink(item.slug, item.title), el('div', 'mb-card-author', `by ${item.authorName}`), stats);
    card.append(thumbnail(item.slug), info, primaryAction(item.slug, local, item.version));
    return card;
  }

  function localCard(map: DownloadedMap) {
    const remote = getRemoteMapStates()[map.id];
    const card = el('div', 'mb-card');
    const info = el('div', 'mb-card-info');
    info.append(titleLink(map.id, map.title), el('div', 'mb-card-author', `by ${map.author}`));
    if (remote && !remote.available) {
      info.append(el('div', 'mb-card-badge mb-badge-gone', translate('No longer shared')));
    } else if (remote?.version != null && remote.version > map.version) {
      info.append(el('div', 'mb-card-badge mb-badge-update', translate('Update available')));
    }
    const actions = el('div', 'mb-card-actions');
    actions.append(
      primaryAction(map.id, map, remote?.available ? remote.version : null),
      actionButton(
        'Remove',
        () => {
          if (remove(map.id)) {
            renderTabs();
            render();
          }
        },
        'mb-action-remove'
      )
    );
    card.append(thumbnail(map.id), info, actions);
    return card;
  }

  function render() {
    const downloaded = getDownloadedMaps();
    const byId = new Map(downloaded.map((m) => [m.id, m]));
    status.replaceChildren();
    moreButton.hidden = true;

    if (tab === 'mine') {
      list.replaceChildren(...downloaded.map(localCard));
      if (downloaded.length === 0) status.textContent = translate('No downloaded maps yet');
      return;
    }

    list.replaceChildren(...items.map((item) => remoteCard(item, byId.get(item.slug))));
    if (loading) {
      status.textContent = translate('Loading...');
    } else if (failed) {
      status.append(el('span', undefined, translate('Failed to load maps')));
      const retry = actionButton('Retry', () => void loadPage(page + 1));
      status.append(retry);
    } else if (items.length === 0) {
      status.textContent = translate('No maps found');
    } else {
      moreButton.hidden = items.length >= total;
    }
  }

  return {
    open() {
      if (!dialog) build();
      // 업데이트할 맵이 있으면 받은 맵부터 보여준다
      const next: Tab = getUpdatableMapIds().length > 0 ? 'mine' : tab;
      tab = next;
      if (tab === 'mine' || items.length === 0 || failed) {
        reload();
      } else {
        // 다른 곳(맵 선택 상자) 에서 바뀐 선택과 받은 맵을 반영한다
        renderTabs();
        render();
      }
      dialog!.showModal();
    },
    /** 받은 맵이 바뀌었을 때 (설정창에서 삭제 등). 열려 있을 때만 다시 그린다 */
    refresh() {
      if (!dialog?.open) return;
      renderTabs();
      render();
    },
  };
}
