/**
 * Intelligent skill routing for agent feed user messages.
 * @spec AGT-007
 */
import { SKILLS, type SkillName } from '$lib/stages';

/**
 * Evaluates an author's prompt to select the most appropriate SpecNovelist skill
 * across the 5 canonical skills:
 * - `novel-feedback`: Freeform author feedback, world/character/beat/scene edits, and directives (DIR)
 * - `novel-generate`: Initial generation / scaffolding / first-time drafting of a stage
 * - `novel-sync`: Incremental synchronization of a stage from upstream changes
 * - `novel-verify`: Consistency, continuity, DAG, and placeholder verification
 * - `novel-analyze`: Quantitative narrative pacing waveform and developmental telemetry reports
 * @spec AGT-007
 */
export function routeUserPrompt(prompt: string): SkillName {
	const trimmed = prompt.trim();
	if (!trimmed) {
		return 'novel-feedback';
	}

	// 1. Direct explicit skill command, e.g. "/skill novel-sync" or "/run novel-generate"
	const explicitMatch = trimmed.match(/^\/(?:skill|run)\s+([a-z0-9_-]+)/i);
	if (explicitMatch) {
		const requested = explicitMatch[1].toLowerCase() as SkillName;
		if (SKILLS.includes(requested)) {
			return requested;
		}
	}

	// 2. Quantitative Telemetry & Analysis Reports -> novel-analyze
	if (
		/\b(?:pacing waveform|radar chart|cadence entropy|dialogue ratio|screen[- ]time|telemetry|developmental report|analyze (?:the )?(?:story|pacing|novel|manuscript)|audit --report)\b/i.test(
			trimmed
		)
	) {
		return 'novel-analyze';
	}

	// 3. Quality, Continuity & Consistency Verification -> novel-verify
	if (
		/\b(?:verify (?:consistency|continuity|story|dag|novel)|check (?:consistency|continuity|placeholders)|audit placeholders|chekhov|continuity check)\b/i.test(
			trimmed
		)
	) {
		return 'novel-verify';
	}

	// 4. Incremental Synchronization -> novel-sync
	if (
		/\b(?:sync(?:hronize)?|regenerate (?:impacted )?scenes|update impacted|upstream changes|render (?:active |pending )?(?:graphics|illustrations|assets))\b/i.test(
			trimmed
		)
	) {
		return 'novel-sync';
	}

	// 5. Initial Stage Generation / Scaffolding / Full Stage Drafting -> novel-generate
	if (
		/\b(?:generate (?:the )?(?:initial|setup|research|world|narrative|structure|abridged|manuscript|publishable)|discovery interview|initialize (?:the )?(?:project|brief|setup)|formulate research questions|draft (?:the )?(?:prose|abridged|manuscript|chapters?)|write (?:the )?(?:prose|scene|chapter|manuscript)|render (?:the )?(?:prose|manuscript)|compile (?:the )?book|export (?:to )?(?:epub|pdf|docx)|build book|generate epub)\b/i.test(
			trimmed
		)
	) {
		return 'novel-generate';
	}

	// 6. Default: novel-feedback for all author feedback, worldbuilding/character/beat/scene edits, and directives (DIR)
	return 'novel-feedback';
}
