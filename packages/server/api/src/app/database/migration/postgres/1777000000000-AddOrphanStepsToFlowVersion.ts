import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOrphanStepsToFlowVersion1777000000000 implements MigrationInterface {
    name = 'AddOrphanStepsToFlowVersion1777000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version"
            ADD "orphanSteps" jsonb
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version" DROP COLUMN "orphanSteps"
        `)
    }
}
