export interface AdCreative {
  id: string;
  wide: string;
  square: string;
  advertiser: string;
  qrImage?: string;
  house?: boolean;
}

export interface AdResponse {
  ads: AdCreative[];
}
