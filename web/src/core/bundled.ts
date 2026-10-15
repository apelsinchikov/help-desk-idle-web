// Баланс общий с iOS: читаем те же JSON-файлы, не копию.
import jobs from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/jobs.json' with { type: 'json' }
import milestones from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/milestones.json' with { type: 'json' }
import config from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/config.json' with { type: 'json' }
import { GameContent } from './content.ts'
import type { GameConfig, JobDefinition, Milestone } from './content.ts'

export const bundledContent = new GameContent(
  jobs as JobDefinition[],
  milestones as Milestone[],
  config as GameConfig,
)
