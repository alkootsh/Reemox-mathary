import { safeParse } from './json';

export interface ActivityLogItem {
    action: string;
    date: string;
}

export const logActivity = (action: string) => {
    let logs = safeParse(localStorage.getItem('activityLog'), []);
    logs.unshift({ action, date: new Date().toISOString() });
    localStorage.setItem('activityLog', JSON.stringify(logs.slice(0, 20)));
};

export const getActivityLogs = (): ActivityLogItem[] => {
    return safeParse(localStorage.getItem('activityLog'), []);
};
