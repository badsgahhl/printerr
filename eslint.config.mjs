import tsParser from '@typescript-eslint/parser'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import pluginVue from 'eslint-plugin-vue'

// Intentionally slim, same split as meridian/ui: Oxlint only sees the <script>
// block of an SFC, so eslint-plugin-vue is kept around purely for <template>
// rules. All JS/TS logic linting lives in .oxlintrc.json.
export default [
  {
    name: 'app/vue-script-parser',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue']
      }
    }
  },

  {
    name: 'app/block-order',
    files: ['**/*.vue'],
    rules: {
      'vue/block-order': [
        'error',
        {
          order: ['template', 'script', 'style', 'customBlocks']
        }
      ]
    }
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/coverage/**', '**/beispiele/**']
  },

  ...pluginVue.configs['flat/recommended'],
  skipFormatting
]
