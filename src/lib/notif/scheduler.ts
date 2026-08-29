import { get } from 'svelte/store';
import { notifEnabled, notifTime } from '$lib/stores/notif';
import { todayStr } from '$lib/data/format';

let timerId: ReturnType<typeof setInterval> | null = null;

export function scheduleNotif(): void {
  if (timerId) clearInterval(timerId);
  if (!get(notifEnabled) || typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'default') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') startNotifLoop();
      else notifEnabled.set(false);
    });
  } else if (Notification.permission === 'granted') {
    startNotifLoop();
  }
}

function startNotifLoop(): void {
  const check = () => {
    const now = new Date();
    const [h, m] = get(notifTime).split(':').map(Number);
    // >= rather than an exact minute match — background tabs / mobile
    // browsers can throttle timers so the precise minute is sometimes
    // skipped. "Have we passed the target time today AND not already
    // notified today" means a late check still catches up.
    const targetMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= targetMinutes) {
      const key = 'mf_notif_last';
      const last = localStorage.getItem(key);
      if (last !== todayStr()) {
        new Notification('My Finance 💰', { body: 'Jangan lupa catat pengeluaran hari ini!', icon: '/icon-192.svg' });
        localStorage.setItem(key, todayStr());
      }
    }
  };
  timerId = setInterval(check, 60000);
  check();
}
