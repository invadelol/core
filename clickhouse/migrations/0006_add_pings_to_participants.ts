import { BaseSchema } from 'adonisjs-clickhouse/schema'

export default class extends BaseSchema {
    async up() {
        await this.client.command({
            query: `
        ALTER TABLE participants
          ADD COLUMN IF NOT EXISTS all_in_pings         UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS assist_pings         UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS command_pings        UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS danger_pings         UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS enemy_missing_pings  UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS enemy_vision_pings   UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS get_back_pings       UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS need_vision_pings    UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS on_my_way_pings      UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS push_pings           UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS vision_cleared_pings UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS bait_pings           UInt16 DEFAULT 0,
          ADD COLUMN IF NOT EXISTS hold_pings           UInt16 DEFAULT 0
      `,
        })
    }

    async down() {
        await this.client.command({
            query: `
        ALTER TABLE participants
          DROP COLUMN IF EXISTS all_in_pings,
          DROP COLUMN IF EXISTS assist_pings,
          DROP COLUMN IF EXISTS command_pings,
          DROP COLUMN IF EXISTS danger_pings,
          DROP COLUMN IF EXISTS enemy_missing_pings,
          DROP COLUMN IF EXISTS enemy_vision_pings,
          DROP COLUMN IF EXISTS get_back_pings,
          DROP COLUMN IF EXISTS need_vision_pings,
          DROP COLUMN IF EXISTS on_my_way_pings,
          DROP COLUMN IF EXISTS push_pings,
          DROP COLUMN IF EXISTS vision_cleared_pings,
          DROP COLUMN IF EXISTS bait_pings,
          DROP COLUMN IF EXISTS hold_pings
      `,
        })
    }
}
