// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone, at the export size the query
// names. window.__shotReady is set once the scene has painted. The lettering
// fonts are loaded explicitly first: canvas text must be drawn with Anton and
// Pacifico, not with a fallback that happens to be ready.
export async function runShot(shot, query, applyShot) {
  const layout = query.get('layout') || 'hero3';
  const grade = query.get('grade') || 'neon';
  const photo = query.get('photo') || 'pier';
  const caption = query.get('caption') || 'Neon Shore';
  const subcaption = query.get('subcaption') || 'a night in Neon Bay';
  const size = query.get('size') || 'wide';
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyShot({ shot, layout, grade, photo, caption, subcaption, size });
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    await document.fonts.ready;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
