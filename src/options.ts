export type WinnerRange = { start: number; end: number };

class Options {
  useSkills: boolean = true;
  /** 0-based, 양끝 포함. 1명 추첨은 start === end */
  winnerRange: WinnerRange = { start: 0, end: 0 };
  autoRecording: boolean = true;
}

const options = new Options();
export default options;
