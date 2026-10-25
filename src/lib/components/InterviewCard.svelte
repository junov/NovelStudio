<script module lang="ts">
	import type { AskUserQuestion, AskUserRequest, UserAnswer } from '$lib/agent/types';

	export function initAnswers(req: AskUserRequest): Record<string, { selected: string[]; text: string; skipped: boolean }> {
		const map: Record<string, { selected: string[]; text: string; skipped: boolean }> = {};
		for (const q of req?.questions || []) {
			const initialSelected: string[] = [];
			if (q.options && q.recommendedIndex !== undefined && q.options[q.recommendedIndex]) {
				initialSelected.push(q.options[q.recommendedIndex].label);
			} else if (q.defaultValue) {
				initialSelected.push(q.defaultValue);
			}
			map[q.id] = {
				selected: initialSelected,
				text: '',
				skipped: false
			};
		}
		return map;
	}
</script>

<script lang="ts">
	/**
	 * Inline author interview question card component.
	 * @spec AGT-002, AGT-005
	 */
	import { renderMarkdown } from '$lib/markdown';
	import { wikiLinks } from '$lib/actions';

	interface Props {
		request: AskUserRequest;
	}

	let { request }: Props = $props();

	// Initialize synchronously so initial render cycle is never undefined
	let answers = $state<Record<string, { selected: string[]; text: string; skipped: boolean }>>(initAnswers(request));
	let currentRequestId = $state(request?.id);

	$effect(() => {
		if (request && request.id !== currentRequestId) {
			currentRequestId = request.id;
			answers = initAnswers(request);
		}
	});

	function toggleOption(q: AskUserQuestion, optLabel: string) {
		if (!answers[q.id]) {
			answers[q.id] = { selected: [], text: '', skipped: false };
		}
		const current = answers[q.id].selected || [];
		if (q.isMultiSelect) {
			if (current.includes(optLabel)) {
				answers[q.id].selected = current.filter((x) => x !== optLabel);
			} else {
				answers[q.id].selected = [...current, optLabel];
			}
		} else {
			answers[q.id].selected = [optLabel];
		}
		answers[q.id].skipped = false;
	}

	function skipQuestion(qid: string) {
		if (!answers[qid]) {
			answers[qid] = { selected: [], text: '', skipped: true };
		} else {
			answers[qid].skipped = true;
			answers[qid].selected = [];
			answers[qid].text = '';
		}
	}

	function submitAll() {
		const result: UserAnswer[] = request.questions.map((q) => {
			const a = answers[q.id];
			return {
				questionId: q.id,
				selected: a?.selected,
				text: a?.text?.trim() || undefined,
				skipped: a?.skipped
			};
		});
		request.resolve(result);
	}
</script>

<div class="interview-card card">
	<div class="card-header">
		<span class="card-icon">✦</span>
		<h3 class="card-title">{request.title || 'Discovery Interview'}</h3>
	</div>

	<div class="card-body">
		{#each request.questions as q, i}
			{@const ans = answers[q.id] || { selected: [], text: '', skipped: false }}
			<div class="question-block" class:is-skipped={ans.skipped}>
				<div class="question-head">
					<span class="q-num">Q{i + 1}</span>
					<span class="q-prompt">{q.prompt}</span>
					{#if q.allowSkip !== false}
						<button
							class="skip-btn"
							class:active={ans.skipped}
							onclick={() => skipQuestion(q.id)}
						>
							{ans.skipped ? 'Skipped ✓' : 'Skip / Decide later'}
						</button>
					{/if}
				</div>

				{#if q.details}
					<div class="q-details markdown-details" use:wikiLinks>
						{@html renderMarkdown(q.details)}
					</div>
				{/if}

				{#if !ans.skipped}
					{#if q.options && q.options.length > 0}
						<div class="options-grid">
							{#each q.options as opt}
								{@const isSelected = Boolean(ans.selected?.includes(opt.label))}
								<button
									class="option-pill"
									class:selected={isSelected}
									onclick={() => toggleOption(q, opt.label)}
								>
									<span class="opt-check">{isSelected ? '●' : '○'}</span>
									<div class="opt-body">
										<span class="opt-label">{opt.label}</span>
										{#if opt.description}
											<span class="opt-desc">{opt.description}</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}

					{#if q.allowFreeform !== false && answers[q.id]}
						<div class="write-in-row">
							<input
								type="text"
								placeholder="Or specify custom input / nuances..."
								bind:value={answers[q.id].text}
								oninput={() => {
									if (answers[q.id]) answers[q.id].skipped = false;
								}}
							/>
						</div>
					{/if}
				{/if}
			</div>
		{/each}
	</div>

	<div class="card-footer">
		<button class="btn primary" onclick={submitAll}>
			Confirm & Proceed →
		</button>
	</div>
</div>

<style>
	.interview-card {
		margin: 8px 0 12px 0;
		border: 1px solid var(--accent);
		background: var(--paper);
		box-shadow: var(--shadow);
		overflow: hidden;
		border-radius: var(--radius);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--accent-soft);
		border-bottom: 1px solid var(--line);
	}
	.card-icon {
		color: var(--accent);
		font-size: 16px;
	}
	.card-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
	}

	.card-body {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.question-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}
	.question-block:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}
	.question-block.is-skipped {
		opacity: 0.6;
	}

	.question-head {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.q-num {
		font-weight: 700;
		font-size: 11px;
		background: var(--bg-sunken);
		padding: 2px 6px;
		border-radius: 4px;
		color: var(--ink-faint);
		margin-top: 2px;
	}
	.q-prompt {
		font-weight: 600;
		font-size: 13.5px;
		flex: 1;
		color: var(--ink);
		line-height: 1.35;
	}
	.skip-btn {
		background: none;
		border: none;
		font-size: 11px;
		color: var(--ink-faint);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
		white-space: nowrap;
	}
	.skip-btn:hover {
		background: var(--bg-sunken);
		color: var(--ink);
	}
	.skip-btn.active {
		color: var(--accent);
		font-weight: 600;
	}

	.q-details {
		font-size: 12px;
		color: var(--ink-soft);
		margin: 0 0 4px 0;
		line-height: 1.45;
	}

	.markdown-details :global(p) {
		margin: 0 0 6px 0;
	}
	.markdown-details :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-details :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.markdown-details :global(strong) {
		color: var(--ink);
	}

	.options-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.option-pill {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 8px 12px;
		background: var(--bg-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		cursor: pointer;
		text-align: left;
		font-size: 12.5px;
		transition: all 0.12s;
	}
	.option-pill:hover {
		border-color: var(--line-strong);
	}
	.option-pill.selected {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--ink);
	}
	.opt-check {
		font-size: 12px;
		color: var(--accent);
		margin-top: 1px;
		flex-shrink: 0;
	}
	.opt-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.opt-label {
		font-weight: 600;
		line-height: 1.35;
		color: var(--ink);
	}
	.opt-desc {
		font-size: 11.5px;
		color: var(--ink-soft);
		line-height: 1.4;
	}

	.write-in-row input {
		width: 100%;
		font-size: 12px;
		padding: 6px 10px;
	}

	.card-footer {
		padding: 10px 16px;
		background: var(--bg-elev);
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: flex-end;
	}
</style>
