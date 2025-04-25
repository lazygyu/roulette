// backend/.eslintrc.js
// @ts-check

module.exports = {
  // 루트 설정 파일 상속
  extends: ['../.eslintrc.base.js'],

  // 백엔드 환경 설정
  env: {
    node: true, // Node.js 전역 변수 및 스코프 활성화
    jest: true, // Jest 테스트 전역 변수 활성화
    es2021: true, // ES2021 전역 변수 및 구문 지원
  },

  // 파일 타입별 설정 오버라이드
  overrides: [
    {
      files: ['*.ts'], // TypeScript 파일에만 적용
      // 타입 검사 기반 규칙 확장
      extends: ['plugin:@typescript-eslint/recommended-type-checked'],
      parserOptions: {
        // TypeScript 파서 옵션: 프로젝트의 tsconfig.json 경로 지정
        // 타입 정보를 활용하는 린트 규칙 활성화에 필요
        project: true, // 현재 디렉토리의 tsconfig.json 사용
        tsconfigRootDir: __dirname, // tsconfig.json 검색 시작 디렉토리
      },
      rules: {
        // 백엔드 특정 규칙 오버라이드
        '@typescript-eslint/no-explicit-any': 'off', // 'any' 타입 사용 허용
        '@typescript-eslint/no-floating-promises': 'warn', // 부동 Promise 경고
        '@typescript-eslint/no-unsafe-argument': 'warn', // 안전하지 않은 인수 사용 경고
        // 필요에 따라 다른 백엔드 관련 규칙 추가
      },
    },
    {
      // 테스트 파일에 대한 특정 규칙 (선택 사항)
      files: ['test/**/*.ts'],
      rules: {
        // 테스트 관련 규칙 오버라이드 (예: 특정 목(mock) 사용 허용)
      },
    },
  ],

  // 백엔드 프로젝트 루트 지정 (하위 디렉토리에서 .eslintrc 파일을 찾지 않도록 함)
  root: true,
};
