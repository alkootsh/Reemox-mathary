import { apiFetch } from './firestoreService';

export async function getRuntimeConfig() {
    const data = await apiFetch<any>('/api/config/runtime');
    if (data && data.success) {
        return data.data;
    }
    return null;
}
