import typescriptEslint from 'typescript-eslint';
import eslintCongigPrettier from 'eslint-config-prettier';

export default typescriptEslint.config(typescriptEslint.configs.recommended, {
  files: ['**/*.ts'],
  // Prettier 규칙을 ESLint 통합
  plugins: ['prettier'],
  extends: [
    eslintCongigPrettier, // ESLint와 Prettier 충돌 방지
  ],
  rules: {
    '@typescript-eslint/no-unsafe-function-type': 'off',
    // Prettier 규칙을 ESLint 에러로 표시
    'prettier/prettier': 'error',
  },
});
