import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCanvasLayoutToFlowVersion1775000000000 implements MigrationInterface {
    name = 'AddCanvasLayoutToFlowVersion1775000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version"
            ADD "canvasLayout" jsonb
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version" DROP COLUMN "canvasLayout"
        `)
    }

}
