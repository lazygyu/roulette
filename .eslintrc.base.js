// .eslintrc.base.js
// @ts-check

module.exports = {
  // 기본 파서 설정: TypeScript 파서 사용
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest', // 최신 ECMAScript 기능 지원
    sourceType: 'module', // ES 모듈 사용
  },

  // 플러그인 설정: TypeScript 및 Prettier 플러그인 활성화
  plugins: ['@typescript-eslint', 'prettier'],

  // 확장 설정: 추천 규칙 세트 및 Prettier 통합 적용
  extends: [
    'eslint:recommended', // ESLint 기본 추천 규칙
    'plugin:@typescript-eslint/recommended', // TypeScript ESLint 추천 규칙
    'plugin:prettier/recommended', // Prettier 추천 규칙 및 충돌 규칙 비활성화
  ],

  // 기본 규칙 설정 (워크스페이스에서 재정의 가능)
  rules: {
    'prettier/prettier': 'error', // Prettier 규칙 위반 시 에러 발생
    // 필요에 따라 다른 전역 규칙 추가 가능
  },

  // 전역 무시 패턴 설정 (워크스페이스에서 추가 가능)
  ignorePatterns: [
    '**/node_modules/**', // node_modules 디렉토리 무시
    '**/dist/**', // 빌드 출력 디렉토리 무시
    '**/coverage/**', // 커버리지 리포트 디렉토리 무시
    '.eslintrc.js', // ESLint 설정 파일 자체는 린트 대상에서 제외
    '*.config.js', // 각종 설정 파일 제외 (vite, tailwind 등)
    '*.config.mjs', // Flat config 파일 제외
  ],
};
