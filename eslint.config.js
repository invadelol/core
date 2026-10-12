import { configApp } from '@adonisjs/eslint-config'

// vendor/: a built copy of @invadelol/ui (see docs/design.md), not our source.
export default configApp({ ignores: ['vendor/'] })
