export function isNavPathActive(pathname: string, href: string) {
  const path = href.split(/[?#]/, 1)[0]
  return path === "/"
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`)
}

export function getMostSpecificActiveHref(
  pathname: string,
  hrefs: readonly string[]
) {
  return hrefs
    .filter((href) => isNavPathActive(pathname, href))
    .sort((left, right) => {
      const leftPath = left.split(/[?#]/, 1)[0]
      const rightPath = right.split(/[?#]/, 1)[0]
      // A fragment or attribution query does not make a page more specific.
      // Prefer its canonical link when the matching path is otherwise equal.
      return rightPath.length - leftPath.length || Number(left !== leftPath) - Number(right !== rightPath)
    })[0]
}
