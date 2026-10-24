<script lang="ts">
	import { onMount } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import Header from '$lib/components/Header.svelte';
	import JourneyRail from '$lib/components/JourneyRail.svelte';
	import Explorer from '$lib/components/Explorer.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import AgentPanel from '$lib/components/AgentPanel.svelte';
	import DashboardView from '$lib/components/DashboardView.svelte';
	import AnalysisDashboard from '$lib/components/AnalysisDashboard.svelte';
	import BookPreview from '$lib/components/BookPreview.svelte';
	import NewProjectModal from '$lib/components/NewProjectModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import DedicatedInterviewView from '$lib/components/DedicatedInterviewView.svelte';
	import { pickFolder, openSettingsWindow, closeWindow, inTauri } from '$lib/tauri';

	let showNewModal = $state(false);
	let showSettingsModal = $state(false);
	let showPalette = $state(false);
	let activeHash = $state('');

	onMount(async () => {
		activeHash = typeof window !== 'undefined' ? window.location.hash : '';
		const handleHash = () => {
			activeHash = window.location.hash;
		};
		window.addEventListener('hashchange', handleHash);

		await settings.init();
		// If recent project exists, try to open most recent
		if (settings.value.recentProjects.length > 0 && !project.root && !activeHash) {
			const mostRecent = settings.value.recentProjects[0];
			try {
				await project.open(mostRecent.path);
			} catch (e) {
				console.warn('Could not auto-open recent project:', e);
			}
		}

		return () => {
			window.removeEventListener('hashchange', handleHash);
		};
	});

	async function openFolderDialog() {
		const selected = await pickFolder();
		if (selected) {
			await project.open(selected);
			settings.addRecent(selected, project.title);
		}
	}

	async function handleOpenSettings() {
		if (inTauri()) {
			try {
				await openSettingsWindow();
				return;
			} catch (e) {
				console.warn('Could not open separate settings window, using dialog overlay:', e);
			}
		}
		showSettingsModal = true;
	}

	function onKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			showPalette = !showPalette;
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

{#if activeHash === '#settings'}
	<SettingsModal onClose={() => closeWindow('settings')} isDedicatedWindow={true} />
{:else if activeHash === '#interview'}
	<DedicatedInterviewView />
{:else}
	<div class="novelstudio-app">
		<Header
			onNewProject={() => (showNewModal = true)}
			onOpenProject={openFolderDialog}
			onOpenSettings={handleOpenSettings}
			onOpenPalette={() => (showPalette = true)}
		/>

		{#if project.root}
			<JourneyRail />

			<main class="workspace-main">
				<Explorer />

				<div class="workspace-center">
					{#if project.view.kind === 'dashboard'}
						<DashboardView />
					{:else if project.view.kind === 'file'}
						<Editor
							path={project.view.path}
							targetLine={project.view.line}
							targetId={project.view.id}
						/>
					{:else if project.view.kind === 'analysis'}
						<AnalysisDashboard />
					{:else if project.view.kind === 'book'}
						<BookPreview />
					{/if}
				</div>

				<AgentPanel />
			</main>
		{:else}
			<!-- Welcome Screen when no project is loaded -->
			<div class="welcome-screen">
				<div class="welcome-hero card">
					<span class="welcome-icon">❦</span>
					<h1 class="welcome-title">Welcome to NovelStudio</h1>
					<p class="welcome-tagline">
						A professional desktop studio for specification-driven novel writing powered by AI agents.
					</p>

					<div class="welcome-actions">
						<button class="btn primary" onclick={() => (showNewModal = true)}>
							+ Create New Novel
						</button>
						<button class="btn" onclick={openFolderDialog}>
							Open Existing Project...
						</button>
					</div>

					{#if settings.value.recentProjects.length > 0}
						<div class="recent-projects">
							<span class="label">Recent Projects</span>
							<div class="recent-list">
								{#each settings.value.recentProjects as r}
									<div class="recent-item" onclick={() => project.open(r.path)}>
										<span class="recent-title">{r.title}</span>
										<span class="recent-path">{r.path}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if showNewModal}
		<NewProjectModal onClose={() => (showNewModal = false)} />
	{/if}

	{#if showSettingsModal}
		<SettingsModal onClose={() => (showSettingsModal = false)} />
	{/if}

	{#if showPalette}
		<CommandPalette onClose={() => (showPalette = false)} />
	{/if}
{/if}

<style>
	.novelstudio-app {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		max-height: 100%;
		max-width: 100%;
		overflow: hidden;
		background: var(--bg);
	}

	.workspace-main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.workspace-center {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.welcome-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		padding: 20px;
	}

	.welcome-hero {
		width: min(600px, 94vw);
		padding: 40px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.welcome-icon {
		font-size: 48px;
		color: var(--accent);
		margin-bottom: 12px;
	}

	.welcome-title {
		font-size: 28px;
		margin: 0 0 10px;
	}

	.welcome-tagline {
		font-size: 15px;
		color: var(--ink-soft);
		margin: 0 0 28px;
		max-width: 440px;
		line-height: 1.5;
	}

	.welcome-actions {
		display: flex;
		gap: 14px;
		margin-bottom: 32px;
	}

	.recent-projects {
		width: 100%;
		text-align: left;
		border-top: 1px solid var(--line);
		padding-top: 20px;
	}

	.recent-list {
		margin-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.recent-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-radius: var(--radius);
		background: var(--bg-sunken);
		cursor: pointer;
		font-size: 13px;
	}
	.recent-item:hover {
		background: var(--accent-soft);
	}

	.recent-title {
		font-weight: 600;
	}
	.recent-path {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-faint);
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
