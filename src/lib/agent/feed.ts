/**
 * Feed grouping utilities for agent activity feed.
 * @spec AGT-006 (Issue #2)
 */
import type { FeedItem, FeedItemType } from './types';

export type FeedGroup =
	| { kind: 'item'; item: FeedItem }
	| { kind: 'work'; id: string; items: FeedItem[]; isBusy: boolean };

export function isWorkItemType(type: FeedItemType): boolean {
	return type === 'tool_start' || type === 'tool_end' || type === 'thought';
}

export function groupFeedItems(feed: FeedItem[], isRunning: boolean): FeedGroup[] {
	const groups: FeedGroup[] = [];
	let currentWork: FeedItem[] = [];
	let workGroupId = 1;

	function flushWork() {
		if (currentWork.length > 0) {
			groups.push({
				kind: 'work',
				id: `work_group_${workGroupId++}`,
				items: [...currentWork],
				isBusy: false
			});
			currentWork = [];
		}
	}

	for (const item of feed) {
		if (isWorkItemType(item.type)) {
			currentWork.push(item);
		} else {
			flushWork();
			groups.push({ kind: 'item', item });
		}
	}

	if (currentWork.length > 0) {
		groups.push({
			kind: 'work',
			id: `work_group_${workGroupId++}`,
			items: [...currentWork],
			isBusy: isRunning
		});
	} else if (isRunning) {
		// When busy and no pending work items in current cluster, always render an active work card at the bottom
		groups.push({
			kind: 'work',
			id: `work_group_active`,
			items: [],
			isBusy: true
		});
	}

	return groups;
}
