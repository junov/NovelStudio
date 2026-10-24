<script lang="ts">
	import { onMount } from 'svelte';
	import { settings, PROVIDERS, type ProviderId } from '$lib/stores/settings.svelte';
	import { secretGet, secretSet, secretDelete } from '$lib/tauri';
	import { fetchAvailableModels, formatModelLabel } from '$lib/agent/providers';

	interface Props {
		onClose: () => void;
		isDedicatedWindow?: boolean;
	}

	let { onClose, isDedicatedWindow = false }: Props = $props();

	let apiKeys = $state<Record<ProviderId, string>>({
		anthropic: '',
		openai: '',
		gemini: ''
	});
	let isSaving = $state(false);
	let isQuerying = $state<Record<ProviderId, boolean>>({
		anthropic: false,
		openai: false,
		gemini: false
	});
	let queryMessage = $state<string | null>(null);
	let queryError = $state<string | null>(null);

	let isCustomModel = $state(false);
	let availableModels = $derived(settings.modelsForProvider(settings.value.defaultModel.provider));

	$effect(() => {
		const curr = settings.value.defaultModel.model;
		const list = availableModels;
		if (curr && !list.includes(curr)) {
			isCustomModel = true;
		}
	});

	onMount(async () => {
		for (const pid of ['anthropic', 'openai', 'gemini'] as ProviderId[]) {
			const val = await secretGet(PROVIDERS[pid].keyName);
			if (val) apiKeys[pid] = val;
		}

		// Auto-query models if an API key is configured and cache is empty
		const currentProv = settings.value.defaultModel.provider;
		if (apiKeys[currentProv] && (!settings.value.modelCache[currentProv] || settings.value.modelCache[currentProv]!.length === 0)) {
			queryModels(currentProv);
		}
	});

	async function queryModels(pid: ProviderId) {
		const key = apiKeys[pid]?.trim();
		if (!key) {
			queryError = `Please enter an API key for ${PROVIDERS[pid].label} first.`;
			queryMessage = null;
			return;
		}

		isQuerying[pid] = true;
		queryError = null;
		queryMessage = `Querying available models from ${PROVIDERS[pid].label}...`;

		try {
			const models = await fetchAvailableModels(pid, key);
			if (models.length > 0) {
				settings.updateModelCache(pid, models);
				queryMessage = `✓ Retrieved ${models.length} available models from ${PROVIDERS[pid].label}.`;
				// If current model is not in list, select the flagship/top one
				if (!models.includes(settings.value.defaultModel.model) && settings.value.defaultModel.provider === pid) {
					settings.value.defaultModel.model = models[0];
					isCustomModel = false;
				}
			} else {
				queryMessage = `No chat models returned from ${PROVIDERS[pid].label}.`;
			}
		} catch (e) {
			queryError = e instanceof Error ? e.message : String(e);
			queryMessage = null;
		} finally {
			isQuerying[pid] = false;
		}
	}

	async function saveKeys() {
		isSaving = true;
		try {
			for (const pid of ['anthropic', 'openai', 'gemini'] as ProviderId[]) {
				const keyName = PROVIDERS[pid].keyName;
				const val = apiKeys[pid]?.trim();
				if (val) {
					await secretSet(keyName, val);
				} else {
					await secretDelete(keyName);
				}
			}
			await settings.save();
			onClose();
		} catch (e) {
			console.error(e);
		} finally {
			isSaving = false;
		}
	}
</script>

<div class={isDedicatedWindow ? 'dedicated-window-view' : 'modal-backdrop'} onclick={isDedicatedWindow ? undefined : onClose}>
	<div class={isDedicatedWindow ? 'dedicated-settings-card card' : 'modal card'} onclick={(e) => e.stopPropagation()}>
		<h2>Settings & AI Model Configuration</h2>

		<!-- Feedback Messages -->
		{#if queryMessage}
			<div class="info-banner ok">
				<span>{queryMessage}</span>
			</div>
		{/if}
		{#if queryError}
			<div class="info-banner err">
				<span>⚠ {queryError}</span>
			</div>
		{/if}

		<!-- OS Keychain API Keys -->
		<div class="section">
			<h3 class="section-title">API Keys (Stored Securely in OS Keychain)</h3>
			<p class="muted font-small">
				Your credentials are saved directly into the OS Credential Manager / Keychain, never in plain project files.
			</p>

			{#each Object.entries(PROVIDERS) as [pid, meta]}
				{@const pId = pid as ProviderId}
				<div class="form-group">
					<div class="label-row">
						<label for="key-{pid}">{meta.label}</label>
						<div class="label-actions">
							<button
								class="btn small ghost text-btn"
								onclick={() => queryModels(pId)}
								disabled={isQuerying[pId] || !apiKeys[pId]}
								title="Query backend to list all available models for this key"
							>
								{isQuerying[pId] ? 'Querying...' : '↻ Query Models'}
							</button>
							<a href={meta.keyUrl} target="_blank" class="external-link">Get Key ↗</a>
						</div>
					</div>
					<input
						id="key-{pid}"
						type="password"
						placeholder="sk-..."
						bind:value={apiKeys[pId]}
					/>
				</div>
			{/each}
		</div>

		<!-- Model Selection -->
		<div class="section">
			<div class="section-header-row">
				<h3 class="section-title">AI Model Selection</h3>
				<button
					class="btn small ghost"
					onclick={() => queryModels(settings.value.defaultModel.provider)}
					disabled={isQuerying[settings.value.defaultModel.provider] || !apiKeys[settings.value.defaultModel.provider]}
				>
					{isQuerying[settings.value.defaultModel.provider] ? 'Refreshing...' : '↻ Fetch Models from Provider'}
				</button>
			</div>

			<div class="form-row">
				<div class="form-group flex-1">
					<label for="default-provider">Provider</label>
					<select
						id="default-provider"
						bind:value={settings.value.defaultModel.provider}
						onchange={() => {
							const p = settings.value.defaultModel.provider;
							const available = settings.modelsForProvider(p);
							if (available.length > 0) {
								settings.value.defaultModel.model = available[0];
								isCustomModel = false;
							}
							if (apiKeys[p]) {
								queryModels(p);
							}
						}}
					>
						{#each Object.entries(PROVIDERS) as [pid, meta]}
							<option value={pid}>{meta.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group flex-2">
					<label for="default-model">
						Model Selection
						<span class="muted font-normal">({availableModels.length} models)</span>
					</label>
					<select
						id="default-model"
						value={isCustomModel ? '__custom__' : settings.value.defaultModel.model}
						onchange={(e) => {
							const val = e.currentTarget.value;
							if (val === '__custom__') {
								isCustomModel = true;
							} else {
								isCustomModel = false;
								settings.value.defaultModel.model = val;
							}
						}}
					>
						{#each availableModels as m}
							<option value={m}>
								{formatModelLabel(m)} ({m})
							</option>
						{/each}
						<option value="__custom__">⚙ Custom Model ID...</option>
					</select>

					{#if isCustomModel}
						<div class="custom-model-wrapper">
							<input
								type="text"
								placeholder="Enter custom model identifier..."
								bind:value={settings.value.defaultModel.model}
							/>
							<button
								type="button"
								class="btn small ghost"
								onclick={() => {
									isCustomModel = false;
									if (availableModels.length > 0) {
										settings.value.defaultModel.model = availableModels[0];
									}
								}}
							>
								Cancel
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Appearance & Font Size -->
		<div class="section">
			<h3 class="section-title">Reading Appearance & Theme</h3>
			<div class="form-row">
				<div class="form-group flex-1">
					<label for="theme-select">Theme</label>
					<select
						id="theme-select"
						bind:value={settings.value.theme}
						onchange={() => settings.applyTheme()}
					>
						<option value="system">System Default</option>
						<option value="light">Paper Light (Warm)</option>
						<option value="dark">Ink Dark</option>
					</select>
				</div>

				<div class="form-group flex-1">
					<label for="prose-size">Prose Font Size ({settings.value.proseFontSize}px)</label>
					<input
						id="prose-size"
						type="range"
						min="15"
						max="26"
						step="1"
						bind:value={settings.value.proseFontSize}
						oninput={() => settings.applyTheme()}
					/>
				</div>
			</div>
		</div>

		<div class="modal-actions">
			<button class="btn ghost" onclick={onClose} disabled={isSaving}>Cancel</button>
			<button class="btn primary" onclick={saveKeys} disabled={isSaving}>
				{isSaving ? 'Saving...' : 'Save Settings'}
			</button>
		</div>
	</div>
</div>

<style>
	.section {
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}
	.section:last-of-type {
		border-bottom: none;
		margin-bottom: 12px;
	}
	.section-title {
		margin: 0;
		font-size: 14px;
	}
	.section-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	.font-small {
		font-size: 11.5px;
		margin: 4px 0 10px;
	}
	.font-normal {
		font-weight: 400;
	}

	.info-banner {
		padding: 8px 12px;
		border-radius: var(--radius);
		font-size: 12.5px;
		margin-bottom: 14px;
	}
	.info-banner.ok {
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
	}
	.info-banner.err {
		background: color-mix(in srgb, var(--err) 15%, transparent);
		color: var(--err);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.form-group label {
		font-size: 12px;
		font-weight: 600;
	}
	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.label-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.text-btn {
		padding: 0 4px;
		font-size: 11px;
		color: var(--accent);
	}
	.external-link {
		font-size: 11px;
		text-decoration: none;
	}

	.form-row {
		display: flex;
		gap: 12px;
	}
	.flex-1 {
		flex: 1;
	}
	.flex-2 {
		flex: 2;
	}

	.custom-model-wrapper {
		display: flex;
		gap: 8px;
		margin-top: 6px;
	}
	.custom-model-wrapper input {
		flex: 1;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.dedicated-window-view {
		width: 100%;
		height: 100vh;
		overflow-y: auto;
		background: var(--bg);
		padding: 24px;
		display: flex;
		justify-content: center;
	}

	.dedicated-settings-card {
		width: 100%;
		max-width: 680px;
		height: fit-content;
		padding: 24px 28px;
		box-shadow: none;
		border: 1px solid var(--line);
	}
</style>
