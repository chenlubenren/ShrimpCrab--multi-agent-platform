const PROFILE_AVATAR_FILENAMES = [
  '01.png',
  '02.png',
  '03.png',
  '04.png',
  'babyshark-executor-blue.png',
  'clam-cache-lavender.png',
  'crab-approver.png',
  'crab-compliance-teal.png',
  'crab-guard.png',
  'crab-librarian-steel.png',
  'crab-qa.png',
  'crab-risk-plum.png',
  'dolphin-monitor-sky.png',
  'hermitcrab-archive-sand.png',
  'jellyfish-brainstorm-lime.png',
  'jellyfish-concierge-sky.png',
  'jellyfish-guide.png',
  'jellyfish-notes-lilac.png',
  'jellyfish-pm.png',
  'lobster-captain-coral.png',
  'lobster-ops-maroon.png',
  'manta-search-navy.png',
  'octopus-builder-teal.png',
  'octopus-devops.png',
  'octopus-orchestrator.png',
  'octopus-router-rose.png',
  'octopus-scheduler-indigo.png',
  'pufferfish-security-olive.png',
  'seahorse-messenger-gold.png',
  'seahorse-reminder-mint.png',
  'shrimp-analyst-peach.png',
  'shrimp-backend-indigo.png',
  'shrimp-dev.png',
  'shrimp-docs.png',
  'shrimp-frontend-mint.png',
  'shrimp-notifier-yellow.png',
  'shrimp-runner.png',
  'shrimp-scout-ghost.png',
  'squid-research-silver.png',
  'squid-writer-periwinkle.png',
  'starfish-helper-pink.png',
  'turtle-carrier-green.png',
] as const;

export const PROFILE_AVATAR_URLS = PROFILE_AVATAR_FILENAMES.map((filename) => `/claw_profile/${filename}`);

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

export function pickProfileAvatar(seed: number, name = 'agent'): string {
  const rand = seededRandom(Math.abs(seed + hashText(name || 'agent')) || 1);
  const index = Math.floor(rand() * PROFILE_AVATAR_URLS.length);
  return PROFILE_AVATAR_URLS[index] || '/claw_profile/03.png';
}
