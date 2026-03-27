import {
    FlowVersion,
    isNil,
} from '@activepieces/shared'
import { Migration } from '.'

export const migrateV18AddCanvasLayout: Migration = {
    targetSchemaVersion: '18',
    migrate: async (flowVersion: FlowVersion): Promise<FlowVersion> => {
        return {
            ...flowVersion,
            canvasLayout: isNil(flowVersion.canvasLayout) ? null : flowVersion.canvasLayout,
            schemaVersion: '19',
        }
    },
}
