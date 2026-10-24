<script lang="ts">
	import type { AskUserQuestion, AskUserRequest, UserAnswer } from '$lib/agent/types';

	interface Props {
		request: AskUserRequest;
	}

	let { request }: Props = $props();

	// Store answers per question id
	let answers = $state<Record<string, { selected: string[]; text: string; skipped: boolean }>>({});

	// Initialize defaults
	$effect(() => {
		const map: Record<string, { selected: string[]; text: string; skipped: boolean }> = {};
		for (const q of request.questions) {
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
		answers = map;
	});

	function toggleOption(q: AskUserQuestion, optLabel: string) {
		const current = answers[q.id]?.selected || [];
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
		answers[qid].skipped = true;
		answers[qid].selected = [];
		answers[qid].text = '';
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
			{@const ans = answers[q.id]}
			<div class="question-block" class:is-skipped={ans?.skipped}>
				<div class="question-head">
					<span class="q-num">Q{i + 1}</span>
					<span class="q-prompt">{q.prompt}</span>
					{#if q.allowSkip !== false}
						<button
							class="skip-btn"
							class:active={ans?.skipped}
							onclick={() => skipQuestion(q.id)}
						>
							{ans?.skipped ? 'Skipped ✓' : 'Skip / Decide later'}
						</button>
					{/if}
				</div>

				{#if q.details}
					<p class="q-details">{q.details}</p>
				{/if}

				{#if !ans?.skipped}
					{#if q.options && q.options.length > 0}
						<div class="options-grid">
							{#each q.options as opt}
								{@const isSelected = ans?.selected.includes(opt.label)}
								<button
									class="option-pill"
									class:selected={isSelected}
									onclick={() => toggleOption(q, opt.label)}
								>
									<span class="opt-check">{isSelected ? '●' : '○'}</span>
									<span class="opt-label">{opt.label}</span>
									{#if opt.description}
										<span class="opt-desc">{opt.description}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					{#if q.allowFreeform !== false}
						<div class="write-in-row">
							<input
								type="text"
								placeholder="Or specify custom input / nuances..."
								bind:value={answers[q.id].text}
								oninput={() => {
									answers[q.id].skipped = false;
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
		margin: 12px 0;
		border: 1px solid var(--accent);
		background: var(--paper);
		box-shadow: var(--shadow);
		overflow: hidden;
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
	}
	.skip-btn {
		background: none;
		border: none;
		font-size: 11px;
		color: var(--ink-faint);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
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

	.options-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.option-pill {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
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
		font-weight: 500;
	}
	.opt-check {
		font-size: 12px;
		color: var(--accent);
	}
	.opt-label {
		flex: 1;
	}
	.opt-desc {
		font-size: 11px;
		color: var(--ink-faint);
	}

	.write-in-row input {
		width: 100%;
		font-size: 12px;
		padding: 5px 10px;
	}

	.card-footer {
		padding: 10px 16px;
		background: var(--bg-elev);
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: flex-end;
	}
</style>
