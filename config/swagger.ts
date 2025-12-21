import path from 'node:path'
import url from 'node:url'

export default {
    path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../',
    title: 'Invade API',
    version: '1.0.0',
    tagIndex: 2,
    ignore: ['/swagger', '/docs'],
    preferredPutPatch: 'PUT',
    common: {
        parameters: {},
        headers: {},
    },
    securitySchemes: {},
    authMiddlewares: ['auth', 'auth:api'],
    defaultSecurityScheme: 'BearerAuth',
    persistAuthorization: true,
    showFullPath: false,
    snakeCase: true,
}
