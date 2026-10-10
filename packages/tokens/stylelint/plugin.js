// @ts-check
import stylelint from 'stylelint';
import materials from '../src/materials.json' with { type: 'json' };

const ruleName = 'bar/no-material-tokens';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (/** @type {string} */ token) =>
    `Use a room-role token (--room-*, --signature…) instead of the material token "--${token}". ` +
    'See docs/design-system.md.',
});

const materialReference = new RegExp(`var\\(\\s*--(${materials.join('|')})\\s*[,)]`, 'g');

/** Station and @bar/ui CSS may only use room-role tokens, never material tokens. */
const rule = /** @type {import('stylelint').Rule} */ (
  (primary) => (root, result) => {
    const valid = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!valid) return;

    root.walkDecls((decl) => {
      for (const match of decl.value.matchAll(materialReference)) {
        const token = match[1] ?? '';
        stylelint.utils.report({
          ruleName,
          result,
          node: decl,
          message: messages.rejected(token),
          word: `--${token}`,
        });
      }
    });
  }
);

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: 'https://github.com/listening-bar/docs/design-system.md' };

export default stylelint.createPlugin(ruleName, rule);
