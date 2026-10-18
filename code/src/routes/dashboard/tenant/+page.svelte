<script lang="ts">
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	type Rental = {
		unitId: string;
		unitNumber: number;
		startDate: string;
		endDate: string;
		property: {
			name: string;
			addressLine1: string;
			addressLine2: string | null;
			city: string;
			state: string;
			zip: string;
		};
	};

	type MaintenanceRequest = {
		id: string;
		unitNumber?: number;
		description: string;
		createdAt: string;
		status: string;
	};

	let rentals: Rental[] = [];
	let maintenanceRequests: MaintenanceRequest[] = [];
	let selectedUnitId = "";
	let description = "";
	let loading = true;
	let submitting = false;
	let errorMessage = "";
	let successMessage = "";
	let token = "";

	onMount(async () => {
		token = localStorage.getItem("token") ?? "";
		if (!token) {
			goto("/");
			return;
		}

		try {
			const response = await fetch("/api/tenant/me", {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await response.json();
			if (response.status === 401 || response.status === 403) {
				goto("/");
				return;
			}
			if (!response.ok) throw new Error(data.error ?? "Could not load your rental information");

			rentals = data.rentals ?? [];
			maintenanceRequests = data.maintenanceRequests ?? [];
			selectedUnitId = rentals[0]?.unitId ?? "";
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not load your dashboard";
		} finally {
			loading = false;
		}
	});

	async function submitMaintenanceRequest(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = "";
		successMessage = "";
		submitting = true;

		try {
			const response = await fetch("/api/tenant/me", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ unitId: selectedUnitId, description })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Could not submit the request");

			maintenanceRequests = [
				{
					...data.maintenanceRequest,
					unitNumber: rentals.find((rental) => rental.unitId === selectedUnitId)?.unitNumber,
					status: "submitted"
				},
				...maintenanceRequests
			];
			description = "";
			successMessage = "Maintenance request submitted.";
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not submit the request";
		} finally {
			submitting = false;
		}
	}

	function statusLabel(status: string) {
		const labels: Record<string, string> = {
			new: "New",
			update: "In progress",
			completed: "Completed",
			unassigned: "Unassigned",
			submitted: "Submitted"
		};
		return labels[status] ?? status;
	}
</script>

<svelte:head>
	<title>Tenant Dashboard</title>
</svelte:head>

<main class="tenant-dashboard">
	<header class="page-heading">
		<div>
			<p class="eyebrow">TENANT PORTAL</p>
			<h2>My rental</h2>
		</div>
	</header>

	{#if loading}
		<p role="status">Loading your rental information...</p>
	{:else if errorMessage && rentals.length === 0}
		<p class="message error" role="alert">{errorMessage}</p>
	{:else if rentals.length === 0}
		<p>No rental is currently linked to your account. Contact your property manager.</p>
	{:else}
		<section class="rentals" aria-label="Your rental units">
			{#each rentals as rental (rental.unitId)}
				<article class="rental">
					<div>
						<h3>{rental.property.name}</h3>
						<p>{rental.property.addressLine1}{rental.property.addressLine2 ? `, ${rental.property.addressLine2}` : ""}</p>
						<p>{rental.property.city}, {rental.property.state} {rental.property.zip}</p>
					</div>
					<strong class="unit-number">Unit {rental.unitNumber}</strong>
					<p class="lease-dates">Lease: {new Date(rental.startDate).toLocaleDateString()} – {new Date(rental.endDate).toLocaleDateString()}</p>
				</article>
			{/each}
		</section>

		<section class="requests" aria-labelledby="request-heading">
			<h2 id="request-heading">Maintenance</h2>
			<form on:submit={submitMaintenanceRequest}>
				<label for="unit">Rental unit</label>
				<select id="unit" bind:value={selectedUnitId} required>
					{#each rentals as rental (rental.unitId)}
						<option value={rental.unitId}>{rental.property.name} · Unit {rental.unitNumber}</option>
					{/each}
				</select>
				<label for="description">Describe the issue</label>
				<textarea id="description" bind:value={description} rows="3" required maxlength="2000"></textarea>
				<button type="submit" disabled={submitting || !description.trim()}>
					{submitting ? "Submitting..." : "Submit request"}
				</button>
			</form>

			{#if successMessage}<p class="message success" role="status">{successMessage}</p>{/if}
			{#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}

			<h3>Request history</h3>
			{#if maintenanceRequests.length === 0}
				<p>No maintenance requests yet.</p>
			{:else}
				<ul class="request-list">
					{#each maintenanceRequests as request (request.id)}
						<li>
							<div>
								<strong>Unit {request.unitNumber ?? "-"}</strong>
								<p>{request.description}</p>
								<small>{new Date(request.createdAt).toLocaleDateString()}</small>
							</div>
							<span class="status">{statusLabel(request.status)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<style>
	.tenant-dashboard {
		position: relative;
		z-index: 2;
		box-sizing: border-box;
		width: min(900px, calc(100vw - 32px));
		max-height: calc(100vh - 130px);
		overflow-y: auto;
		margin: 1.25rem auto;
		padding: 1.5rem 2rem;
		background: #292929;
		border: 1px solid #74a942;
		color: #f4f4f0;
	}

	.page-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #5e5e5e;
		margin-bottom: 1.25rem;
	}

	.eyebrow {
		margin: 0;
		color: #a9d77c;
		font-size: 0.75rem;
		font-weight: 700;
	}

	h2, h3 { margin: 0.35rem 0 0.75rem; }

	.rentals { display: grid; gap: 0.75rem; }

	.rental {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 1rem;
		padding: 1rem;
		border-left: 4px solid #74a942;
		background: #373737;
	}

	.rental h3, .rental p { margin: 0 0 0.3rem; }
	.unit-number { align-self: center; white-space: nowrap; }
	.lease-dates { grid-column: 1 / -1; color: #c9c9c9; font-size: 0.875rem; }
	.requests { margin-top: 1.5rem; }

	form { display: grid; gap: 0.55rem; max-width: 640px; }
	select, textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 0.65rem;
		border: 1px solid #858585;
		border-radius: 3px;
		background: #fff;
		color: #202020;
		font: inherit;
	}

	button {
		justify-self: start;
		padding: 0.65rem 1rem;
		border: 0;
		border-radius: 3px;
		background: #74a942;
		color: #111;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:disabled { opacity: 0.6; cursor: not-allowed; }
	.request-list { list-style: none; padding: 0; margin: 0; }
	.request-list li {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0;
		border-top: 1px solid #5e5e5e;
	}
	.request-list p { margin: 0.35rem 0; white-space: pre-wrap; }
	.request-list small, .status { color: #c9c9c9; }
	.status { white-space: nowrap; }
	.message { margin: 0.5rem 0; }
	.error { color: #ffaaa2; }
	.success { color: #b8e08f; }

	@media (max-width: 600px) {
		.tenant-dashboard { padding: 1rem; }
		.rental { grid-template-columns: 1fr; }
		.unit-number { justify-self: start; }
	}
</style>