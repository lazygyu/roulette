export interface KeywordEntry {
  sprite: number;
  x: number;
  y: number;
  width: number;
  height: number;
  expires_at: string;
}

export interface KeywordsData {
  generated_at: string;
  keywords: Record<string, KeywordEntry>;
}
