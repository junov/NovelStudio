<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="app-error-screen">
	<div class="app-error-card card">
		<span class="error-mark">❦</span>
		<h2>Application Error ({page.status || 500})</h2>
		<p class="error-msg">{page.error?.message || 'An unexpected error occurred.'}</p>
		{#if page.error?.stack}
			<pre class="error-stack">{page.error.stack}</pre>
		{/if}
		<div class="error-actions">
			<button class="btn primary" onclick={() => window.location.reload()}>Reload NovelStudio</button>
			<a href="/" class="btn ghost">Return to Workspace</a>
		</div>
	</div>
</div>

<style>
	.app-error-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg);
		padding: 24px;
	}
	.app-error-card {
		max-width: 640px;
		width: 100%;
		text-align: center;
		padding: 32px;
	}
	.error-mark {
		font-size: 36px;
		color: var(--err);
		display: block;
		margin-bottom: 12px;
	}
	.error-msg {
		margin: 12px 0;
		color: var(--ink-soft);
	}
	.error-stack {
		text-align: left;
		background: var(--bg-sunken);
		padding: 12px;
		border-radius: var(--radius);
		font-size: 11px;
		font-family: var(--font-mono);
		max-height: 200px;
		overflow: auto;
		margin: 16px 0;
		white-space: pre-wrap;
	}
	.error-actions {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 20px;
	}
</style>
