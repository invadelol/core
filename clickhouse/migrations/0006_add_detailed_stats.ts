import { BaseSchema } from 'adonisjs-clickhouse/schema'

export default class extends BaseSchema {
    async up() {
        await this.client.command({
            query: `
        ALTER TABLE participants
        ADD COLUMN IF NOT EXISTS dmg_to_turrets UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS dmg_to_objectives UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS physical_dmg_dealt UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS magic_dmg_dealt UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS true_dmg_dealt UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS physical_dmg_to_champ UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS magic_dmg_to_champ UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS true_dmg_to_champ UInt32 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS neutral_minions_killed UInt16 DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vision_wards_bought UInt16 DEFAULT 0
      `,
        })
    }

    async down() {
        await this.client.command({
            query: `
        ALTER TABLE participants
        DROP COLUMN IF EXISTS dmg_to_turrets,
        DROP COLUMN IF EXISTS dmg_to_objectives,
        DROP COLUMN IF EXISTS physical_dmg_dealt,
        DROP COLUMN IF EXISTS magic_dmg_dealt,
        DROP COLUMN IF EXISTS true_dmg_dealt,
        DROP COLUMN IF EXISTS physical_dmg_to_champ,
        DROP COLUMN IF EXISTS magic_dmg_to_champ,
        DROP COLUMN IF EXISTS true_dmg_to_champ,
        DROP COLUMN IF EXISTS neutral_minions_killed,
        DROP COLUMN IF EXISTS vision_wards_bought
      `,
        })
    }
}
