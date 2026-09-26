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
    .sort((left, right) => right.length - left.length)[0]
}
