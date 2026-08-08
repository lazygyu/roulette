export type AdSlotKey = 'preroll' | 'goal' | 'result';

export interface AdCreative {
  id: string;
  slots: AdSlotKey[];
  wide: string;
  square: string;
  advertiser: string;
  qrImage?: string;
  linkUrl?: string;
  house?: boolean;
}

export interface AdResponse {
  ads: AdCreative[];
}
