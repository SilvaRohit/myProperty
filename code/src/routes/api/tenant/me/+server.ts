import database from "$lib/server/database/database";
import { requireRole } from "$lib/server/auth/requireRole";
import { MaintenanceRequest } from "$lib/server/models/entity/maintenance_request/MaintenanceRequest";
import { MaintenanceRequestStatus } from "$lib/server/models/entity/maintenance_request_status/MaintenanceRequestStatus";
import { Tenant } from "$lib/server/models/entity/Tenant/Tenant";
import { Unit } from "$lib/server/models/entity/unit/Unit";
import { json } from "@sveltejs/kit";
import { In } from "typeorm";
import { processAPIRequest } from "../../../../middleware/apiResponse";

const tenantRepository = database.getRepository(Tenant);
const maintenanceRequestRepository = database.getRepository(MaintenanceRequest);
const maintenanceRequestStatusRepository = database.getRepository(MaintenanceRequestStatus);
const unitRepository = database.getRepository(Unit);

function findTenantLeases(tenantId: string) {
	return tenantRepository.find({
		where: { tenant: { id: tenantId } },
		relations: { property: true, unit: { property: true } },
		order: { createdAt: "DESC" }
	});
}

export const GET = processAPIRequest(async ({ request }) => {
	const tenant = requireRole(request, "tenant");
	const leases = await findTenantLeases(tenant.id);
	const rentalsByUnit = new Map();

	for (const lease of leases) {
		if (!lease.unit) continue;
		const property = lease.unit.property ?? lease.property;
		if (!property || rentalsByUnit.has(lease.unit.id)) continue;

		rentalsByUnit.set(lease.unit.id, {
			id: lease.id,
			unitId: lease.unit.id,
			unitNumber: lease.unit.number,
			startDate: lease.startDate,
			endDate: lease.endDate,
			property: {
				name: property.name,
				addressLine1: property.address_line1,
				addressLine2: property.address_line2,
				city: property.city,
				state: property.state,
				zip: property.zip
			}
		});
	}

	const requests = await maintenanceRequestRepository.find({
		where: { userRequestedId: tenant.id },
		order: { createdAt: "DESC" }
	});
	const statuses = requests.length
		? await maintenanceRequestStatusRepository.find({
				where: { maintenanceRequestId: In(requests.map((item) => item.id)) },
				relations: { status: true },
				order: { createdAt: "DESC" }
			})
		: [];
	const latestStatusByRequest = new Map();
	for (const status of statuses) {
		if (!latestStatusByRequest.has(status.maintenanceRequestId)) {
			latestStatusByRequest.set(status.maintenanceRequestId, status.status?.name);
		}
	}
	const requestedUnits = requests.length
		? await unitRepository.find({
				where: { id: In([...new Set(requests.map((item) => item.unitId))]) }
			})
		: [];
	const unitNumbers = new Map(requestedUnits.map((unit) => [unit.id, unit.number]));

	return json({
		status: 200,
		rentals: [...rentalsByUnit.values()],
		maintenanceRequests: requests.map((item) => ({
			id: item.id,
			unitNumber: unitNumbers.get(item.unitId),
			description: item.description,
			createdAt: item.createdAt,
			status: latestStatusByRequest.get(item.id) ?? "submitted"
		}))
	});
});

export const POST = processAPIRequest(async ({ request }) => {
	const tenant = requireRole(request, "tenant");
	const data = await request.json();
	const unitId = typeof data.unitId === "string" ? data.unitId : "";
	const description = typeof data.description === "string" ? data.description.trim() : "";
	if (!unitId || !description) {
		return json({ status: 400, error: "A rental unit and description are required" }, { status: 400 });
	}

	const leases = await findTenantLeases(tenant.id);
	if (!leases.some((lease) => lease.unit?.id === unitId)) {
		return json({ status: 403, error: "You can only request maintenance for your rented units" }, { status: 403 });
	}

	const maintenanceRequest = await maintenanceRequestRepository.save({
		userRequestedId: tenant.id,
		unitId,
		description
	});

	return json({ status: 201, maintenanceRequest }, { status: 201 });
});