/**
 * Site footer.
 *
 * The global footer (trust/legal links and risk disclaimer) has been removed
 * per product direction: it no longer renders on any page. The component is
 * kept as a stable call-site so AppLayout does not need to change, and it
 * returns nothing so no footer markup is emitted anywhere.
 */
export function SiteFooter() {
  return null;
}
