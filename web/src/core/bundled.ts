// Баланс общий с iOS: читаем те же JSON-файлы, не копию.
import jobs from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/jobs.json' with { type: 'json' }
import milestones from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/milestones.json' with { type: 'json' }
import config from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/config.json' with { type: 'json' }
import upgrades from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/upgrades.json' with { type: 'json' }
import perks from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/perks.json' with { type: 'json' }
import items from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/items.json' with { type: 'json' }
import chests from '../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/chests.json' with { type: 'json' }
import { GameContent } from './content.ts'
import type { ChestDefinition, GameConfig, ItemDefinition, JobDefinition, Milestone, PerkDefinition, UpgradeDefinition } from './content.ts'

export const bundledContent = new GameContent(
  jobs as JobDefinition[],
  milestones as Milestone[],
  config as GameConfig,
  upgrades as UpgradeDefinition[],
  perks as PerkDefinition[],
  items as ItemDefinition[],
  chests as ChestDefinition[],
)
