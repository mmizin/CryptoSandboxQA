/**
 * Same semantics as `@dnd-kit/sortable` `arrayMove` (used in `DashboardCharts` `onDragEnd`).
 */
export function arrayMove<T>(items: T[], from: number, to: number): T[] {
    const next = items.slice();
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    return next;
}
