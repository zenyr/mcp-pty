/**
 * Commitlint configuration
 * Enforces Conventional Commits with English-only commit messages
 * @see https://commitlint.js.org
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce English-only commit messages (no Korean, Chinese, etc.)
    'subject-case': [2, 'never', ['upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
  plugins: [
    {
      rules: {
        'english-only': ({ subject, body }) => {
          // Check for non-ASCII characters (Korean, Chinese, Japanese, etc.)
          const nonAsciiRegex = /[^\x00-\x7F]/;
          const fullText = `${subject || ''} ${body || ''}`;
          
          if (nonAsciiRegex.test(fullText)) {
            return [
              false,
              'Commit message MUST be in English only. Non-ASCII characters detected. Please rewrite in English.',
            ];
          }
          
          return [true];
        },
      },
    },
  ],
  // Enable custom rule
  extends: ['@commitlint/config-conventional'],
  rules: {
    ...{
      'subject-case': [2, 'never', ['upper-case']],
      'subject-empty': [2, 'never'],
      'subject-full-stop': [2, 'never', '.'],
      'type-enum': [
        2,
        'always',
        [
          'feat',
          'fix',
          'docs',
          'style',
          'refactor',
          'perf',
          'test',
          'build',
          'ci',
          'chore',
          'revert',
        ],
      ],
      'type-case': [2, 'always', 'lower-case'],
      'type-empty': [2, 'never'],
      'scope-case': [2, 'always', 'lower-case'],
      'header-max-length': [2, 'always', 100],
      'body-leading-blank': [1, 'always'],
      'footer-leading-blank': [1, 'always'],
      'english-only': [2, 'always'],
    },
  },
};
