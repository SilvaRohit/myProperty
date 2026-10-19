<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    let properties = [];
    let units = [];
    let users = [];
    let userInfo = null;
    let token = '';

    let selectedPropertyId = '';
    let selectedUnitId = '';
    let selectedUserId = '';
    let startDate = '';
    let endDate = '';

    let loading = true;
    let loadingUnits = false;
    let submitting = false;
    let errorMessage = '';
    let successMessage = '';

    function decodeJWT(value) {
        const payload = value.split('.')[1];
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

        return JSON.parse(atob(padded));
    }

    async function readResponse(response) {
        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error || `Request failed (${response.status}).`
            );
        }

        return data;
    }

    onMount(async () => {
        token = localStorage.getItem('token') || '';

        if (!token) {
            goto('/');
            return;
        }

        try {
            userInfo = decodeJWT(token);

            if (!userInfo.id) {
                throw new Error('Invalid login session.');
            }
        } catch {
            goto('/');
            return;
        }

        try {
            const headers = {
                Authorization: `Bearer ${token}`
            };

            const [propertiesResponse, usersResponse] = await Promise.all([
                fetch(`/api/property/owner/${userInfo.id}`, { headers }),
                fetch('/api/user', { headers })
            ]);

            const [propertiesData, usersData] = await Promise.all([
                readResponse(propertiesResponse),
                readResponse(usersResponse)
            ]);

            properties = propertiesData.properties || [];
            users = usersData.users || [];
        } catch (error) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Could not load properties and users.';
        } finally {
            loading = false;
        }
    });

    async function fetchUnits(propertyId) {
        units = [];
        selectedUnitId = '';
        successMessage = '';

        if (!propertyId) {
            loadingUnits = false;
            return;
        }

        loadingUnits = true;
        errorMessage = '';

        try {
            const response = await fetch(
                `/api/unit/property/${propertyId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await readResponse(response);

            // Ignore a response if another property was selected meanwhile.
            if (selectedPropertyId !== propertyId) return;

            units = data.units || [];
        } catch (error) {
            if (selectedPropertyId !== propertyId) return;

            errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Could not load units.';
        } finally {
            if (selectedPropertyId === propertyId) {
                loadingUnits = false;
            }
        }
    }

    $: fetchUnits(selectedPropertyId);

    async function assignTenant() {
        if (submitting) return;

        errorMessage = '';
        successMessage = '';

        if (
            !selectedPropertyId ||
            !selectedUnitId ||
            !selectedUserId ||
            !startDate ||
            !endDate
        ) {
            errorMessage = 'Please fill in all fields.';
            return;
        }

        if (endDate <= startDate) {
            errorMessage = 'End date must be after start date.';
            return;
        }

        const selectedTenant = users.find(
            (user) => user.id === selectedUserId
        );

        if (!selectedTenant || !selectedTenant.username) {
            errorMessage = 'Please select a valid tenant account.';
            return;
        }

        if (!units.some((unit) => unit.id === selectedUnitId)) {
            errorMessage = 'Please select a unit from this property.';
            return;
        }

        const payload = {
            tenant: {
                id: selectedTenant.id,
                username: selectedTenant.username
            },
            unit: {
                id: selectedUnitId
            },
            startDate,
            endDate
        };

        submitting = true;

        try {
            const response = await fetch(
                `/api/unit/property/${selectedPropertyId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            const result = await readResponse(response);

            successMessage =
                result.message || 'Tenant assigned successfully!';
        } catch (error) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Could not assign the tenant.';
        } finally {
            submitting = false;
        }
    }
</script>

<div id="body">
    <div id="class-box">
        <h2>Assign Tenant</h2>

        {#if errorMessage}
            <p class="message error" role="alert">{errorMessage}</p>
        {/if}

        {#if successMessage}
            <p class="message success" role="status">{successMessage}</p>
        {/if}

        {#if loading}
            <p>Loading properties and users...</p>
        {:else}
            <div id="partition1">
                <div class="partition2">
                    <label for="property">Property</label>
                    <select
                        id="property"
                        bind:value={selectedPropertyId}
                        disabled={submitting}
                    >
                        <option value="">Select a property</option>
                        {#each properties as property}
                            <option value={property.id}>
                                {property.name}
                            </option>
                        {/each}
                    </select>
                </div>

                {#if selectedPropertyId}
                    <div class="partition2">
                        <label for="unit">Unit</label>
                        <select
                            id="unit"
                            bind:value={selectedUnitId}
                            disabled={loadingUnits || submitting}
                        >
                            <option value="">
                                {loadingUnits ? 'Loading units...' : 'Select a unit'}
                            </option>
                            {#each units as unit}
                                <option value={unit.id}>{unit.number}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <div class="partition2">
                    <label for="tenant">Tenant account</label>
                    <select
                        id="tenant"
                        bind:value={selectedUserId}
                        disabled={submitting}
                    >
                        <option value="">Select a tenant account</option>
                        {#each users as user}
                            <option value={user.id}>
                                {user.firstName} {user.lastName}
                                ({user.username})
                            </option>
                        {/each}
                    </select>
                </div>

                <div class="partition2">
                    <label for="start-date">Start date</label>
                    <input
                        id="start-date"
                        type="date"
                        bind:value={startDate}
                        disabled={submitting}
                    />

                    <label for="end-date">End date</label>
                    <input
                        id="end-date"
                        type="date"
                        bind:value={endDate}
                        min={startDate}
                        disabled={submitting}
                    />
                </div>

                <button
                    type="button"
                    on:click={assignTenant}
                    disabled={submitting || loadingUnits}
                >
                    {submitting ? 'Assigning...' : 'Assign Tenant'}
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    #body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        position: relative;
        z-index: 10;
    }

    #class-box {
        box-sizing: border-box;
        width: 60vw;
        max-width: 800px;
        background-color: rgb(50, 50, 50);
        border: 0.5rem solid #5f0f40;
        border-top-right-radius: 5rem;
        border-bottom-left-radius: 5rem;
        padding: 2rem;
        text-align: center;
        color: whitesmoke;
    }

    #partition1 {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 1.25rem;
    }

    .partition2 {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
    }

    select,
    input {
        box-sizing: border-box;
        max-width: 100%;
        padding: 0.5rem;
        border-radius: 0.4rem;
    }

    button {
        align-self: center;
        border-radius: 15px;
        background: #73ad21;
        color: #111;
        padding: 0.75rem 1.5rem;
        border: none;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.6;
        cursor: wait;
    }

    .message {
        padding: 0.75rem;
        border-radius: 0.5rem;
        overflow-wrap: anywhere;
    }

    .error {
        background: #5c2020;
        color: #fff;
    }

    .success {
        background: #244b24;
        color: #fff;
    }

    @media (max-width: 768px) {
        #class-box {
            width: 95%;
            padding: 1.25rem;
            border-top-right-radius: 2rem;
            border-bottom-left-radius: 2rem;
        }

        .partition2 {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>