/**
 * Intelligent skill routing for agent feed user messages.
 * @spec AGT-007
 */
import { SKILLS, type SkillName } from '$lib/stages';

/**
 * Evaluates an author's prompt to select the most appropriate SpecNovelist skill.
 * Defaults to 'novel-author' for general creative, worldbuilding, or ambiguous requests.
 * @spec AGT-007
 */
export function routeUserPrompt(prompt: string): SkillName {
	const trimmed = prompt.trim();
	if (!trimmed) {
		return 'novel-author';
	}

	// 1. Direct explicit skill command, e.g. "/skill novel-research" or "/run novel-outline"
	const explicitMatch = trimmed.match(/^\/(?:skill|run)\s+([a-z0-9_-]+)/i);
	if (explicitMatch) {
		const requested = explicitMatch[1].toLowerCase() as SkillName;
		if (SKILLS.includes(requested)) {
			return requested;
		}
	}

	// 2. Explicit ID prefixes
	if (/\b(?:RQ|FCT|SRC)-\d+\b/i.test(trimmed)) {
		return 'novel-research';
	}
	if (/\b(?:PRT|CHP|SCN)-\d+\b/i.test(trimmed)) {
		return 'novel-outline';
	}
	if (/\b(?:CHR|PLC|ORG|OBJ|PLT|THM|WLD|TML|GFX|GLS)-\d+\b/i.test(trimmed)) {
		return 'novel-author';
	}

	// 3. Research & Real-World Facts
	if (
		/\b(?:research|fact[- ]check|citation|cite|sources?|historical|scientific|real[- ]world|verify (?:date|fact)|is it true that|look up)\b/i.test(
			trimmed
		)
	) {
		return 'novel-research';
	}

	// 4. Publishing & Compilation
	if (/\b(?:publish|compile|export (?:to )?(?:epub|pdf|docx)|build book|generate epub)\b/i.test(trimmed)) {
		return 'novel-publish';
	}

	// 5. Verification & Pacing Analysis
	if (/\b(?:verify consistency|check consistency|chekhov|pacing waveform|radar chart|analyze story)\b/i.test(trimmed)) {
		return 'novel-verify';
	}

	// 6. Outline & Scene Sequencing / DAG
	if (
		/\b(?:outline|story dag|scene sequence|chapter sequence|scene order|reorder scenes?|add (?:a )?chapter|add (?:a )?scene|scene prerequisites|act structure|plot structure)\b/i.test(
			trimmed
		)
	) {
		return 'novel-outline';
	}

	// 7. Abridged Drafting
	if (/\b(?:abridge|abridged|condensed draft|pacing draft|quick draft)\b/i.test(trimmed)) {
		return 'novel-abridge';
	}

	// 8. Manuscript / Prose Writing
	if (
		/\b(?:write (?:the )?prose|draft (?:the )?prose|render (?:the )?prose|write (?:the )?scene|write (?:the )?chapter|manuscript|prose rendering|draft narrative|write dialogue)\b/i.test(
			trimmed
		)
	) {
		return 'novel-write';
	}

	// 9. Syncing & Graphic Rendering
	if (
		/\b(?:sync(?:hronize)?|render (?:active )?graphics|render assets|regenerate scenes|impacted scenes)\b/i.test(
			trimmed
		)
	) {
		return 'novel-sync';
	}

	// 10. Default fallback: novel-author for all creative story bible, lore, and conversational authoring
	return 'novel-author';
}
