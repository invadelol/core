import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { writeFile } from 'node:fs/promises'

export default class DocsGenerate extends BaseCommand {
    static commandName = 'docs:generate'
    static description = 'Generate swagger.yml documentation for production'

    static options: CommandOptions = {
        startApp: true,
    }

    async run() {
        // Dynamically import all to avoid command validation issues
        const AutoSwagger = (await import('adonis-autoswagger')).default.default
        const swagger = (await import('../config/swagger.js')).default

        const router = await this.app.container.make('router')
        router.commit()

        const spec = await AutoSwagger.docs(router.toJSON(), swagger)

        await writeFile('swagger.yml', JSON.stringify(spec, null, 2))

        this.logger.success('Generated swagger.yml successfully')
    }
}