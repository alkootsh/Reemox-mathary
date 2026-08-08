export const safeParse = (stored: string | null, defaultValue: any) => {
    if (!stored || stored === 'undefined' || stored.trim() === 'undefined') return defaultValue;
    try {
        return JSON.parse(stored);
    } catch {
        return defaultValue;
    }
}
