import type { UserConfig } from '@commitlint/types'
import { RuleConfigSeverity } from '@commitlint/types'

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      [
        'feat', // new feature
        'fix', // bug fix
        'docs', // documentation only
        'style', // code style/ formatting (no logic changes)
        'refactor', // code refactoring (no behavior changes)
        'perf', // performance improvements
        'test', // add or update tests
        'build', // build process or dependency changes
        'ci', // CI/CD configuration changes
        'chore', // general tasks, no production code impact
        'revert', // revert a previous commit
      ],
    ],
  },
  'scope-enum': [
    RuleConfigSeverity.Error,
    'always',
    [
      'route', // page route
      'proxy', // next.js proxy
      'api', // api route
      'style', // global styles
      'layout', // page layout
      'cmp', // app components
      'form', // form components
      'animation', // GSAP, framer motion, D3...
      'server', // server side logic
      'auth', // authentication and authorization
      'config', // configuration files
      'env', // environment variables
      'dep', // dependencies (package.json changes)
      'type', // type and schemas
    ],
  ],
}

export default Configuration
