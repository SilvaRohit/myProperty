import database from '$lib/server/database/database';
import { UnitRepository } from '$lib/server/repositories/unit/unitRepository';
import { PropertyRepository } from '$lib/server/repositories/property/propertyRepository';
import { UnitService } from '$lib/server/services/unitService';
import { PropertyService } from '$lib/server/services/propertyService';
import { processAPIRequest } from '$middleware/apiResponse';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = processAPIRequest(
    async ({ request }: RequestEvent) => {
        const data = await request.json();
        const runner = database.createQueryRunner();

        try {
            await runner.connect();

            // Share one connection for this request.
            const propertyRepository = new PropertyRepository(runner);
            const propertyService = new PropertyService(propertyRepository);

            const unitRepository = new UnitRepository(runner);
            const unitService = new UnitService(
                unitRepository,
                propertyService
            );

            const unit = await unitService.create(data);

            return json({ status: 200, unit });
        } finally {
            // Return the connection even if the request fails.
            await runner.release();
        }
    }
);
