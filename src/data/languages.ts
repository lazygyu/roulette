export const Translations = {
  en: {
    'Enter names below': 'Enter names below',
    Shuffle: 'Shuffle',
    Start: 'Start',
    Map: 'Map',
    Recording: 'Recording',
    'The winner is': 'The winner is',
    'Using skills': 'Using skills',
    'Buy me a coffee': 'Buy me a coffee',
    First: 'First',
    Last: 'Last',
    'Wheel of fortune': 'Wheel of fortune',
    BubblePop: 'BubblePop',
    'Pot of greed': 'Pot of greed',
    'Shake!': 'Shake!',
    'Input names separated by commas or line feed here':
      'Input names separated by commas or line feed here',
    'This program is freeware and may be used freely anywhere, including in broadcasts and videos.': 'This program is freeware and may be used freely anywhere, including in broadcasts and videos.',
    'Close': 'Close',
  },
  ko: {
    'Enter names below': '이름들을 입력하세요',
    Shuffle: '섞기',
    Start: '시작',
    Map: '맵',
    Recording: '녹화',
    'The winner is': '당첨 순위',
    'Using skills': '스킬 활성화',
    'Buy me a coffee': '개발자에게 커피 사주기',
    First: '첫번째',
    Last: '마지막',
    'Wheel of fortune': '운명의 수레바퀴',
    BubblePop: '버블팝',
    'Pot of greed': '욕망의 항아리',
    'Shake!': '흔들기!',
    'Input names separated by commas or line feed here':
      '이름들을 쉼표나 엔터로 구분해서 넣어주세요',
    'This program is freeware and may be used freely anywhere, including in broadcasts and videos.': '이 프로그램은 프리웨어이며 방송이나 영상 등을 포함한 어떤 용도로든 자유롭게 사용하는 것이 허용되어있습니다.',
    'Close': '닫기',
  },
} as const;

export type TranslatedLanguages = keyof typeof Translations;

export type TranslationKeys = keyof (typeof Translations)[TranslatedLanguages];
