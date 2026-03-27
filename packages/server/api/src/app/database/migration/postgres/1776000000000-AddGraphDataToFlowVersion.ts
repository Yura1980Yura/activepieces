import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGraphDataToFlowVersion1776000000000 implements MigrationInterface {
    name = 'AddGraphDataToFlowVersion1776000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version"
            ADD "graphData" jsonb
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "flow_version" DROP COLUMN "graphData"
        `)
    }

}
