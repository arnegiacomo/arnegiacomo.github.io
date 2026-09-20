// Refreshes the numbers on a project card from the GitHub REST API. The API is
// CORS-enabled and public endpoints need no token, but unauthenticated calls are
// capped at 60/hour per IP - hence the cache. Anything that fails leaves the
// values baked into the HTML in place.
const STATS_TTL = 6 * 60 * 60 * 1000;

function formatCount(n) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
}

// The contributors list has no count, so ask for one per page and read the page
// number that the Link header's last-page URL carries.
async function countContributors(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contributors?per_page=1&anon=0`);
  if (!res.ok) throw new Error(res.status);

  const last = /[?&]page=(\d+)>; rel="last"/.exec(res.headers.get('link') || '');
  if (last) return Number(last[1]);

  return (await res.json()).length;
}

async function fetchStats(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`);
  if (!res.ok) throw new Error(res.status);
  const info = await res.json();

  return {
    stars: info.stargazers_count,
    forks: info.forks_count,
    contributors: await countContributors(repo)
  };
}

function readCache(key) {
  try {
    const { at, stats } = JSON.parse(localStorage.getItem(key));
    return Date.now() - at < STATS_TTL ? stats : null;
  } catch {
    return null;
  }
}

function render(list, stats) {
  for (const [name, value] of Object.entries(stats)) {
    const slot = list.querySelector(`[data-stat="${name}"] span`);
    if (slot && Number.isFinite(value)) slot.textContent = formatCount(value);
  }
}

document.querySelectorAll('.repo-stats[data-repo]').forEach(async list => {
  const repo = list.dataset.repo;
  const key = `repo-stats:${repo}`;

  const cached = readCache(key);
  if (cached) return render(list, cached);

  try {
    const stats = await fetchStats(repo);
    render(list, stats);
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), stats }));
  } catch {
    /* Rate limited or offline - the markup already holds sane numbers. */
  }
});
