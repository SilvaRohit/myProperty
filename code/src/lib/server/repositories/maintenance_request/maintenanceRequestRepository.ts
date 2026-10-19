import type { IMaintenanceRequest } from '$lib/server/models/entity/maintenance_request/IMaintenanceRequest';
import { MaintenanceRequest } from '$lib/server/models/entity/maintenance_request/MaintenanceRequest';
import { Unit } from '$lib/server/models/entity/unit/Unit';
import { Repository, type QueryRunner } from 'typeorm';

export class MaintenanceRequestRepository extends Repository<IMaintenanceRequest> {
    constructor(queryRunner: QueryRunner) {
        super(MaintenanceRequest, queryRunner.manager);
    }

    async getAllMaintenanceRequestByOwnerId(
        ownerId: string
    ): Promise<IMaintenanceRequest[]> {
        return await this
            .createQueryBuilder('request')
            .innerJoin(
                Unit,
                'unit',
                'unit.id = request.unit_id'
            )
            .innerJoin('unit.property', 'property')
            .innerJoin('property.owner', 'owner')
            .where('owner.id = :ownerId', { ownerId })
            .orderBy('request.createdAt', 'DESC')
            .getMany();
    }

    async getAllMaintenanceRequestByOperatorId(
        operatorId: string
    ): Promise<IMaintenanceRequest[]> {
        return await this
            .createQueryBuilder('request')
            .innerJoin(
                'maintenance_request_status',
                'status',
                'status.maintenance_request_id = request.id'
            )
            .addSelect('status.operator_id', 'status_operator_id')
            .where('status.operator_id = :operatorId', { operatorId })
            .getRawMany();
    }
}