"""Read-only public HTTP inventory and released-media identity check."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent
ORIGIN = "https://gridninja.ai"
SOURCE = pathlib.Path("/Users/holdenchung/.codex/worktrees/cinematic-release/GridNinjaSite")
MAX_REDIRECTS = 5


class NoAutomaticRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


class RedirectPolicyError(RuntimeError):
    def __init__(self, message, chain):
        super().__init__(message)
        self.chain = chain


def same_origin(url):
    target = urllib.parse.urlsplit(url)
    return (target.scheme == "https" and target.hostname == "gridninja.ai"
            and target.port in (None, 443)
            and target.username is None and target.password is None)

def fetch(path):
    url = ORIGIN + path
    opener = urllib.request.build_opener(NoAutomaticRedirects())
    chain, visited = [], set()
    for hop in range(MAX_REDIRECTS + 1):
        if url in visited:
            raise RedirectPolicyError("Redirect loop", chain)
        visited.add(url)
        try:
            request = urllib.request.Request(url, method="GET")
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status, headers = response.status, dict(response.headers)
            data = response.read()
            location = response.headers.get("Location")
            if status not in (301, 302, 303, 307, 308) or not location:
                return status, url, headers, data, chain
            destination = urllib.parse.urldefrag(urllib.parse.urljoin(url, location))[0]
            item = {"fromUrl": url, "status": status, "location": location,
                    "toUrl": destination, "followed": False}
            chain.append(item)
            if not same_origin(destination):
                raise RedirectPolicyError("Refused cross-origin or non-HTTPS redirect", chain)
            if destination in visited:
                raise RedirectPolicyError("Redirect loop", chain)
            if hop == MAX_REDIRECTS:
                raise RedirectPolicyError("Exceeded five same-origin redirects", chain)
            item["followed"] = True
            url = destination

def inspect(route):
    path = route["path"]
    try:
        status, url, headers, data, redirects = fetch(path)
        content = data.decode("utf-8", errors="replace")
        def match(pattern):
            found = re.search(pattern, content, re.I)
            return found.group(1) if found else None
        return {"path": path, "status": status, "finalUrl": url, "redirectChain": redirects,
                "title": match(r"<title>(.*?)</title>"),
                "canonical": match(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)'),
                "robots": match(r'<meta[^>]+name="robots"[^>]+content="([^"]+)'),
                "h1Count": len(re.findall(r"<h1(?:\s|>)", content)),
                "htmlBytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                "xRobotsTag": next((v for k,v in headers.items() if k.lower()=="x-robots-tag"), None),
                "expectedIndexable": route.get("indexable")}
    except RedirectPolicyError as error:
        return {"path": path, "error": str(error), "redirectChain": error.chain}
    except Exception as error:
        return {"path": path, "error": str(error)}

routes = json.loads((ROOT / "routes.json").read_text())["routes"]
extras = [{"path": "/roi"}, {"path": "/evidence/releases/v1.0.0/README.md"},
          {"path": "/evidence/assessments/demo-01-b/v99.0.0"}]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    checks = list(pool.map(inspect, routes + extras))
sitemap_status, sitemap_url, _, sitemap_bytes, sitemap_redirects = fetch("/sitemap.xml")
sitemap = [node.text for node in ET.fromstring(sitemap_bytes).iter()
           if node.tag.endswith("}loc")]
home_status, home_url, _, home, home_redirects = fetch("/")
builds = re.findall(r'\\"b\\":\\"([^"\\]+)', home.decode())
manifest_path = SOURCE / "src/content/cinematic-releases/cinematic-v1/manifest.json"
manifest = json.loads(manifest_path.read_text())
media = []
for name in ["poster-desktop.webp", "poster-mobile.webp", "still-construction.webp", "still-cooling.webp", "desktop.mp4", "mobile.mp4"]:
    status, final_url, _, data, redirects = fetch("/assets/cinematic/cinematic-v1/" + name)
    local = manifest_path.parent / name
    digest = hashlib.sha256(data).hexdigest()
    media.append({"file":name,"status":status,"finalUrl":final_url,"redirectChain":redirects,"bytes":len(data),"sha256":digest,
                  "matchesSourceFile":digest == hashlib.sha256(local.read_bytes()).hexdigest()})
report = {"fetchedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "origin":ORIGIN,"method":"GET only; at most five explicit HTTPS same-origin redirects per request; no inquiry submission",
          "redirectPolicy":{"maximumHops":MAX_REDIRECTS,"allowedOrigin":ORIGIN,"crossOrigin":"refused","loops":"refused"},
          "sitemapRequest":{"status":sitemap_status,"finalUrl":sitemap_url,"redirectChain":sitemap_redirects},
          "homeRequest":{"status":home_status,"finalUrl":home_url,"redirectChain":home_redirects},
          "buildIds":sorted(set(builds)),"sitemap":sitemap,"routes":checks,
          "cinematicRelease":"cinematic-v1", "sourceManifestSha256":hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
          "media":media}
(ROOT / "http-baseline.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"routes":len(checks),"sitemap":len(sitemap),"builds":report["buildIds"],
                  "mediaMatch":all(x["matchesSourceFile"] for x in media),
                  "errors":[x for x in checks if "error" in x],
                  "statusCounts":{str(code):sum(x.get("status")==code for x in checks) for code in sorted({x["status"] for x in checks if "status" in x})}},indent=2))
