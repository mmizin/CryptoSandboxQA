import { readFile } from "node:fs/promises";
import path from "node:path";

/** Paths relative to `process.cwd()` are resolved; absolute paths are unchanged. */
export function resolveProjectPath(relativeOrAbsolute: string): string {
    return path.isAbsolute(relativeOrAbsolute)
        ? relativeOrAbsolute
        : path.resolve(process.cwd(), relativeOrAbsolute);
}

export async function readJsonFile<T>(relativeOrAbsolutePath: string): Promise<T> {
    const resolved = resolveProjectPath(relativeOrAbsolutePath);
    const raw = await readFile(resolved, "utf-8");
    return JSON.parse(raw) as T;
}
