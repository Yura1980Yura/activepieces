import path from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest конфигурация для E2E тестов graph engine.
 * Аналогична packages/server/engine/vitest.config.ts — запускает engine
 * в UNSANDBOXED режиме с test resources для CODE actions.
 */

// CWD = корень репозитория (для совместимости с piece-loader)
const repoRoot = path.resolve(__dirname, '../../..')
process.chdir(repoRoot)

process.env.AP_EXECUTION_MODE = 'UNSANDBOXED'
process.env.AP_BASE_CODE_DIRECTORY = 'packages/server/engine/test/resources/codes'
process.env.AP_TEST_MODE = 'true'
process.env.AP_DEV_PIECES = 'http,data-mapper,approval,webhook'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 30000,
        include: [path.resolve(__dirname, '**/*.test.ts').replace(/\\/g, '/')],
    },
    resolve: {
        alias: {
            '@activepieces/shared': path.resolve(repoRoot, 'packages/shared/src/index.ts'),
            '@activepieces/pieces-framework': path.resolve(repoRoot, 'packages/pieces/framework/src/index.ts'),
            '@activepieces/pieces-common': path.resolve(repoRoot, 'packages/pieces/common/src/index.ts'),
        },
    },
})
