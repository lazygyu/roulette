export type AdSlotKey = 'preroll' | 'goal' | 'result';

/** 슬롯별 소재. 프리롤에는 로고, 결과 화면에는 광고 소재가 들어가는 식으로 서로 다르다 */
export type AdCreativeMap<T> = Partial<Record<AdSlotKey, T>>;

export interface AdCreative {
  id: string;
  slots: AdSlotKey[];
  /** 슬롯마다 여러 장일 수 있고, 구동마다 돌아가며 노출된다 */
  creatives: AdCreativeMap<string[]>;
  advertiser: string;
  tagline?: string;
  qrImage?: string;
  linkUrl?: string;
  house?: boolean;
}

export interface RoundAd {
  id: string;
  slots: AdSlotKey[];
  /** 이번 구동에서 슬롯마다 뽑힌 소재 한 장 */
  creatives: AdCreativeMap<string>;
  advertiser: string;
  tagline?: string;
  qrImage?: string;
  linkUrl?: string;
  house?: boolean;
}

/**
 * 서버 응답.
 *
 * `wide`/`square` 는 소재를 슬롯별로 나누기 전의 형식이다. 게임이 먼저 배포되고
 * 서버가 뒤따르는 동안 옛 서버를 만날 수 있어 폴백으로만 읽는다.
 * 서버에서 두 필드가 사라지면 여기서도 지운다.
 */
export interface AdResponse {
  ads: (Omit<AdCreative, 'creatives'> & {
    creatives?: AdCreativeMap<string[]>;
    /** @deprecated */
    wide?: string[];
    /** @deprecated */
    square?: string[];
  })[];
}
