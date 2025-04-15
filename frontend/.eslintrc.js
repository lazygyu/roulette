// frontend/.eslintrc.js
// @ts-check

module.exports = {
  // 루트 설정 파일 상속
  extends: ['../.eslintrc.base.js'],

  // 프론트엔드 환경 설정
  env: {
    browser: true, // 브라우저 전역 변수 활성화 (window, document 등)
    es2021: true, // ES2021 전역 변수 및 구문 지원
  },

  // 파일 타입별 설정 오버라이드
  overrides: [
    {
      files: ['*.ts'], // TypeScript 파일에만 적용
      parserOptions: {
        // TypeScript 파서 옵션: 프로젝트의 tsconfig.json 경로 지정
        // 타입 정보를 활용하는 린트 규칙 활성화에 필요
        project: ['./tsconfig.json'],
      },
      rules: {
        // 프론트엔드 특정 규칙 오버라이드
        '@typescript-eslint/no-unsafe-function-type': 'off', // 특정 규칙 비활성화
        // 필요에 따라 다른 프론트엔드 관련 규칙 추가
      },
    },
  ],

  // 프론트엔드 프로젝트 루트 지정 (하위 디렉토리에서 .eslintrc 파일을 찾지 않도록 함)
  root: true,
};
