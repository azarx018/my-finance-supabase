import { writable } from 'svelte/store';

export const fabHandler = writable<(() => void) | null>(null);
