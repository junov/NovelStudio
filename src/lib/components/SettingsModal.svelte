<script lang="ts">
	import { onMount } from 'svelte';
	import { settings, PROVIDERS, type ProviderId } from '$lib/stores/settings.svelte';
	import { secretGet, secretSet, secretDelete } from '$lib/tauri';
	import { PIPELINE } from '$lib/stages';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let apiKeys = $state<Record<ProviderId, string>>({
		anthropic: '',
		openai: '',
		gemini: ''
	});
	let isSaving = $state(false);

	onMount(async () => {
		for (const pid of ['anthropic', 'openai', 'gemini'] as ProviderId[]) {
			const val = await secretGet(PROVIDERS[pid].keyName);
			if (val) apiKeys[pid] = val;
		}
	});

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

<div class="modal-backdrop" onclick={onClose}>
	<div class="modal card" onclick={(e) => e.stopPropagation()}>
		<h2>Settings & AI Model Configuration</h2>

		<!-- OS Keychain API Keys -->
		<div class="section">
			<h3 class="section-title">API Keys (Stored Securely in OS Keychain)</h3>
			<p class="muted font-small">
				Your credentials are saved into the OS Credential Manager / Keychain, never in plain project text.
			</p>

			{#each Object.entries(PROVIDERS) as [pid, meta]}
				{@const pId = pid as ProviderId}
				<div class="form-group">
					<div class="label-row">
						<label for="key-{pid}">{meta.label}</label>
						<a href={meta.keyUrl} target="_blank" class="external-link">Get API Key ↗</a>
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
			<h3 class="section-title">Default AI Model</h3>
			<div class="form-row">
				<div class="form-group flex-1">
					<label for="default-provider">Provider</label>
					<select
						id="default-provider"
						bind:value={settings.value.defaultModel.provider}
						onchange={() => {
							const p = settings.value.defaultModel.provider;
							settings.value.defaultModel.model = PROVIDERS[p].suggested[0];
						}}
					>
						{#each Object.entries(PROVIDERS) as [pid, meta]}
							<option value={pid}>{meta.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group flex-1">
					<label for="default-model">Model</label>
					<select id="default-model" bind:value={settings.value.defaultModel.model}>
						{#each PROVIDERS[settings.value.defaultModel.provider].suggested as m}
							<option value={m}>{m}</option>
						{/each}
					</select>
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
		margin: 0 0 4px;
		font-size: 14px;
	}
	.font-small {
		font-size: 11.5px;
		margin-top: 0;
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

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
</style>
