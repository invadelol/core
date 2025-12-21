import { test } from '@japa/runner'

test.group('Health Check', () => {
    test('health check returns ok', async ({ client }) => {
        const response = await client.get('/health')

        response.assertStatus(200)
        response.assertBodyContains({
            isHealthy: true,
            status: 'ok',
        })
    })
})
