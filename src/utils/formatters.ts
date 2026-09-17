export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getGreeting(): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { title: 'Good morning ☀️', subtitle: 'Start your day with your favorite tracks' };
  } else if (hour >= 12 && hour < 17) {
    return { title: 'Good afternoon 🌤️', subtitle: 'Tune into your afternoon rhythm' };
  } else if (hour >= 17 && hour < 22) {
    return { title: 'Good evening 👋', subtitle: 'Unwind and relax with your personal collection' };
  } else {
    return { title: 'Late night vibes 🌙', subtitle: 'Music for the night hours' };
  }
}
