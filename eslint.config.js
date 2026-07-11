// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // 全角空白除去など日本語アプリで意図的に不可視文字を扱うコードがあるため無効化
      'no-irregular-whitespace': 'off',
    },
  },
  // features → core → shared の一方向依存（CLAUDE.md/ARCHITECTURE.md規約）をlintで機械強制する。
  // src/app 直下のファイル（app.config.ts等、DI配線やルーティングでfeatureを参照する）は対象外。
  {
    files: ['src/app/{core,shared,features}/**/*.ts'],
    plugins: { boundaries },
    settings: {
      // @core/* @shared/* @features/* のパスエイリアス(tsconfig.json)をboundariesが解決できるようにする。
      // これが無いと import 先が「unknown」扱いになり、層違反があっても検知されない。
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/app/shared/**' },
        { type: 'core', pattern: 'src/app/core/**' },
        { type: 'feature', pattern: 'src/app/features/*', capture: ['featureName'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'core' } },
              allow: { to: { element: { types: { anyOf: ['core', 'shared'] } } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  { element: { types: { anyOf: ['core', 'shared'] } } },
                  {
                    element: {
                      type: 'feature',
                      captured: { featureName: '{{ from.element.captured.featureName }}' },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'src/test-setup.ts'],
    rules: {
      // テストダブル(モック/スパイ)の空実装・ダミージェネレータを許容
      '@typescript-eslint/no-empty-function': 'off',
      'require-yield': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // TODO: アクセシビリティ改善は別タスクで対応するため一時的に無効化
      '@angular-eslint/template/label-has-associated-control': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
    },
  },
]);
