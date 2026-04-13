const ISO_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDayKey(input: string): Date | null {
    if (!ISO_DAY_KEY_REGEX.test(input)) return null;
    const [yearRaw, monthRaw, dayRaw] = input.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }
    return parsed;
}

export function toUtcDayStart(input?: string | Date): Date {
    const parsed = typeof input === 'string'
        ? (parseIsoDayKey(input) ?? new Date(input))
        : (input ? new Date(input) : new Date());
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date');
    }
    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
}

export function shiftUtcDays(base: Date, deltaDays: number): Date {
    const shifted = new Date(base);
    shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
    return shifted;
}

export function getUtcDayRange(input?: string | Date): { start: Date; end: Date } {
    const start = toUtcDayStart(input);
    const end = shiftUtcDays(start, 1);
    return { start, end };
}

export function getUtcDayKey(input: Date): string {
    return toUtcDayStart(input).toISOString().slice(0, 10);
}
