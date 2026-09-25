// Nav click -> scrollIntoView with a two-rAF retry, ported from the old
// app's Sidebar.jsx (real bug fix worth keeping: a just-mounted section
// isn't always in the DOM yet on the first lookup).
export async function scrollToSection(id) {
  let el = document.getElementById(`section-${id}`);
  if (!el) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    el = document.getElementById(`section-${id}`);
  }
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
