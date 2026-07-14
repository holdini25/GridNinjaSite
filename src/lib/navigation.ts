export function isNavPathActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
}

export function getMostSpecificActiveHref(
  pathname: string,
  hrefs: readonly string[]
) {
  return hrefs
    .filter((href) => isNavPathActive(pathname, href))
    .sort((left, right) => right.length - left.length)[0]
}
