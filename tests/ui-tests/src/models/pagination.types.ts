/** Shared list envelopes returned by several REST endpoints. */

export type PaginatedMeta = {
    total: number;
    limit: number;
    offset: number;
};

export type Paginated<T> = {
    data: T[];
    total: number;
    meta: PaginatedMeta;
};
