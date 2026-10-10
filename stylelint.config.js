/**
 * Station and @bar/ui CSS may use only role tokens: no raw colors, no
 * material tokens (docs/design-system.md, "Tokens").
 */
const roleTokensOnly = {
  plugins: ['@bar/tokens/stylelint-plugin'],
  rules: {
    'bar/no-material-tokens': true,
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
    ],
  },
};

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'custom-property-pattern': '^[a-z][a-z0-9-]*$',
    'selector-class-pattern': null,
    'keyframes-name-pattern': null,
    // Modifier and state selectors read best next to their base rule.
    'no-descending-specificity': null,
  },
  overrides: [
    {
      files: ['**/*.astro'],
      customSyntax: 'postcss-html',
      rules: {
        // Astro's scoped-style escape hatch.
        'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
      },
    },
    {
      files: ['stations/**/*.{css,astro}', 'packages/ui/**/*.{css,astro}'],
      ...roleTokensOnly,
    },
  ],
};
