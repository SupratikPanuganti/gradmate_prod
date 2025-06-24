import logging
import requests
import re
import json
from urllib.parse import urljoin, urlparse, quote_plus
from typing import Dict, Any, List
import os
import time

from bs4 import BeautifulSoup

# Optional Google Gemini integration
try:
    import google.generativeai as genai  # type: ignore
    _GEMINI_ENABLED = True
except Exception:  # pragma: no cover
    genai = None  # type: ignore
    _GEMINI_ENABLED = False

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Configuration & session setup
# ---------------------------------------------------------------------------

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; ResearchURLBot/1.0; +https://example.com/bot)"
})

_RESEARCH_WORDS = re.compile(r"research|labs?|groups?", re.I)

# Regex to detect "Firstname Lastname" patterns (optionally with middle initial)
PROF_NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)\b")

# ---------------------------------------------------------------------------
# Helper wrappers
# ---------------------------------------------------------------------------

def fetch(url: str, timeout: int = 10) -> str:
    """Return the HTML of *url* (raise if request fails)."""
    r = SESSION.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def _domain_live(domain: str) -> bool:
    """Check if a domain is reachable."""
    try:
        SESSION.get(f"https://{domain}", timeout=5)
        return True
    except requests.RequestException:
        return False


def _scrape_duckduckgo_html(query: str, max_results: int = 10):
    """Fallback HTML scraper for DuckDuckGo search results."""
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}&kl=us-en"
    try:
        html = fetch(url)
    except Exception:
        return []
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for a in soup.select("a.result__a")[:max_results]:
        href = a.get("href", "")
        if href:
            results.append({"href": href})
    return results


def safe_text_search(query: str, max_results: int = 10):
    """Search DuckDuckGo with automatic fallback if API call is rate-limited."""
    try:
        # Try DuckDuckGo HTML scraping directly
        return _scrape_duckduckgo_html(query, max_results=max_results)
    except Exception as e:
        logger.warning("DuckDuckGo search failed: %s", e)
        return []

# ---------------------------------------------------------------------------
# Google Gemini helper
# ---------------------------------------------------------------------------

# After _GEMINI_ENABLED definition add cache globals
_GEMINI_CACHE: dict[tuple[str, str], tuple[str | None, float]] = {}
# Default cache TTL (seconds). Overridable via env var GEMINI_CACHE_TTL_SECS
_GEMINI_CACHE_TTL = int(os.getenv("GEMINI_CACHE_TTL_SECS", "21600"))  # 6 hours

def _gemini_suggest_research_url(college: str, major: str, root_domain: str | None = None) -> str | None:
    """Ask Gemini (if configured) to return the canonical research/labs URL for the department.

    Returns None if Gemini not enabled or no confident answer produced.
    """

    if not _GEMINI_ENABLED:
        return None

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        genai.configure(api_key=api_key)
        prompt = (
            "You are a highly precise web knowledge assistant. "
            "Task: provide the SINGLE canonical HTTPS URL that lists research labs, research groups, or active research areas "
            "for the specified department. This is usually a page titled 'Research', 'Research Areas', 'Groups & Labs', or similar.\n"
            "Guidelines:\n"
            "1. Return ONLY the URL, nothing else.\n"
            "2. Prefer pages hosted on the department or school sub-domain (e.g. scs.gatech.edu) over legacy or external mirrors.\n"
            "3. Do NOT return menu, navigation, PDF, or announcement pages.\n"
            "4. If no suitable page exists or you are not confident, answer with 'unknown'.\n\n"
            f"College/University: {college}\nMajor/Department: {major}\nURL:"
        )

        # Pick model – allow override via env, default to the fast Gemini-1.5 Flash
        gemini_model_id = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        model = genai.GenerativeModel(gemini_model_id)
        chat = model.generate_content(
            prompt,
            generation_config={"temperature": 0.2, "max_output_tokens": 64},
        )
        # 'text' attribute can differ by version; fall back to .candidates[0].content if missing
        if hasattr(chat, "text"):
            text = chat.text.strip()
        else:
            text = chat.candidates[0].content.strip() if getattr(chat, "candidates", None) else ""

        # Extract first URL from Gemini answer
        m = re.search(r"https?://[\w./\-_%]+", text)
        if not m:
            return None
        url = m.group(0)

        if root_domain and root_domain not in url:
            # likely wrong university
            return None

        # ensure it looks like research/labs page
        if any(token in url.lower() for token in ("research", "labs", "groups")):
            logger.info("Gemini suggested research URL: %s", url)
            # Before return of valid url (inside try success path) store into cache
            key = (college.strip().lower(), major.strip().lower())
            now = time.time()
            _GEMINI_CACHE[key] = (url, now)
            return url
    except Exception as e:
        logger.warning("Gemini API failed: %s", e)

    # Cache negative result to avoid repeated slow calls during the TTL window
    key = (college.strip().lower(), major.strip().lower())
    _GEMINI_CACHE[key] = (None, time.time())

    return None

def _gemini_extract_professors(lab_url: str, college: str | None = None) -> tuple[list[str], dict[str, str]]:
    """Use Gemini to list professors + email for a given lab page URL.

    Returns (names_list, email_map). Empty list/map if not available or Gemini disabled.
    """

    if not _GEMINI_ENABLED:
        return [], {}

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        return [], {}

    try:
        genai.configure(api_key=api_key)
        gemini_model_id = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        model = genai.GenerativeModel(gemini_model_id)

        prompt = (
            "You are an expert assistant specialised in analysing university lab webpages. "
            "Given the URL of a research lab, identify the faculty (professors / PIs) associated with it.\n"
            "Return ONLY valid results in strict JSON format as an array of objects with exactly two keys: 'name' and 'email'. "
            "If an e-mail address is not visible, set 'email' to an empty string.\n"
            "Example output: [{\"name\": \"Jane Doe\", \"email\": \"jdoe@university.edu\"}]\n\n"
            f"Lab URL: {lab_url}\n" + (f"University: {college}\n" if college else "") +
            "Respond now:" 
        )

        chat = model.generate_content(prompt, generation_config={"temperature": 0.2, "max_output_tokens": 256})
        text = chat.text if hasattr(chat, "text") else chat.candidates[0].content

        # ---------------------------------------------------------------
        # Helper: parse plaintext lists (fallback when JSON not returned)
        # ---------------------------------------------------------------
        def _parse_plain(text_str: str) -> tuple[list[str], dict[str, str]]:
            """Extract professor names (& optional e-mails) from free-form text."""
            names_local: list[str] = []
            emails_local: dict[str, str] = {}

            for line in text_str.splitlines():
                line = line.strip().lstrip("-•* ").strip()
                if not line:
                    continue
                # simple e-mail capture
                em_match = re.search(r"[\w.-]+@[\w.-]+\.\w+", line)
                email_val = em_match.group(0) if em_match else ""
                # remove email from line to leave name portion
                name_part = line.replace(email_val, "").strip(" ():,;-")
                # crude name detection: at least two capitalized words
                mname = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", name_part)
                if mname:
                    name_val = mname.group(1).strip()
                    if name_val and name_val not in names_local:
                        names_local.append(name_val)
                    if email_val:
                        emails_local[name_val] = email_val
            return names_local, emails_local

        names: list[str] = []
        emails: dict[str, str] = {}
        try:
            data = json.loads(text)
            if isinstance(data, list):
                for obj in data:
                    if isinstance(obj, dict) and "name" in obj:
                        name = str(obj["name"]).strip()
                        email = str(obj.get("email", "")).strip()
                        if name and name not in names:
                            names.append(name)
                        if name and email:
                            emails[name] = email
        except Exception:
            # Fallback plain-text parsing
            names, emails = _parse_plain(text)

        if names:
            logger.info("Gemini extracted %d professors from %s", len(names), lab_url)
            return names, emails

        # If no names, try again by providing page text to Gemini
        try:
            resp = requests.get(lab_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            text_content = soup.get_text(" ", strip=True)
            snippet = text_content[:7000]

            prompt2 = (
                "The following text was scraped from a university research lab web page. "
                "Identify all faculty (professors / principal investigators) mentioned along with any e-mail addresses.\n"
                "Return ONLY a JSON array of objects with 'name' and 'email' keys. If e-mail not present, set email to ''.\n\n"
                f"TEXT:\n{snippet}\n\nRespond with JSON now:"
            )

            chat2 = model.generate_content(prompt2, generation_config={"temperature":0.2, "max_output_tokens":256})
            text2 = chat2.text if hasattr(chat2, "text") else chat2.candidates[0].content

            names2: list[str] = []
            emails2: dict[str, str] = {}
            try:
                data2 = json.loads(text2)
                if isinstance(data2, list):
                    for obj in data2:
                        if isinstance(obj, dict) and "name" in obj:
                            n = str(obj["name"]).strip()
                            em = str(obj.get("email", "")).strip()
                            if n and n not in names2:
                                names2.append(n)
                            if n and em:
                                emails2[n] = em
            except Exception:
                names2, emails2 = _parse_plain(text2)

            if names2:
                logger.info("Gemini (text) extracted %d professors from %s", len(names2), lab_url)
            return names2, emails2
        except Exception as subexc:
            logger.warning("Gemini text extraction failed for %s: %s", lab_url, subexc)
        return [], {}
    except Exception as exc:
        logger.warning("Gemini personnel extraction failed for %s: %s", lab_url, exc)
        return [], {}

# ---------------------------------------------------------------------------
# Step-1 – canonical institutional domain
# ---------------------------------------------------------------------------

def get_root_domain(college: str) -> str:
    logger.info("Resolving domain for: %s", college)
    
    # Search results - robust search approach
    search_queries = [
        f"{college} official website",
        f"{college} .edu domain",
        f"{college} university website",
    ]
    
    # -------------------------------------------------------------------
    # Quick override for well-known Institute of Technology domains
    # -------------------------------------------------------------------
    known_domains = {
        "georgia institute of technology": "gatech.edu",
        "georgia tech": "gatech.edu",
        "massachusetts institute of technology": "mit.edu",
        "california institute of technology": "caltech.edu",
        "illinois institute of technology": "iit.edu",
    }

    key = college.strip().lower()
    if key in known_domains:
        dom = known_domains[key]
        if _domain_live(dom):
            logger.info("Using known domain mapping: %s -> %s", college, dom)
            return dom
        else:
            logger.info("Known domain %s for %s is not live, falling back to search", dom, college)

    for query in search_queries:
        try:
            hits = safe_text_search(query, max_results=5)
            for hit in hits:
                url = hit.get("href", "") if isinstance(hit, dict) else hit
                if not url:
                    continue
                host = urlparse(url).netloc
                if host.endswith(".edu") and _domain_live(host):
                    logger.info("Found domain via search: %s", host)
                    return host
        except Exception as e:
            logger.warning("Search failed for %s: %s", query, e)
            continue
            
    # ---------------------------------------------------------------------------
    # Fallback – construct abbreviation-based candidate domains
    # ---------------------------------------------------------------------------

    def _guess_domain_from_tokens(college: str) -> str | None:
        """Try to guess a .edu domain based on initial letters of college tokens.

        e.g. "University of Georgia" -> uga.edu  (ug + a from 'georgia' state code)"""
        tokens = [t.lower() for t in re.sub(r"[^a-zA-Z ]", " ", college).split() if t.lower() not in {"of", "the", "at", "for", "and", "in"}]
        if not tokens:
            return None

        abbr = "".join(token[0] for token in tokens)
        # also try abbr + first letter of last token (covers UGA)
        candidates = [
            f"{abbr}.edu",                    # ug.edu
            f"{abbr}{tokens[-1][0]}.edu",     # ugg.edu
            f"{abbr}a.edu",                   # uga.edu  (common pattern adding 'a')
            f"{abbr}u.edu",                   # ugu.edu
            f"{tokens[-1]}.edu",              # georgia.edu
        ]

        # Handle direct abbreviation provided by user (e.g., 'uga' → uga.edu)
        if len(college) <= 5 and ' ' not in college:
            candidates.insert(0, f"{college.lower()}.edu")

        for dom in candidates:
            if _domain_live(dom):
                logger.info("Guessed live domain: %s", dom)
                return dom
        return None

    # Try abbreviation-based guess
    guess = _guess_domain_from_tokens(college)
    if guess:
        return guess

    # -------------------------------------------------------------------
    # FINAL ATTEMPT – Ask an LLM (OpenAI) to suggest the official domain
    # -------------------------------------------------------------------
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            openai.api_key = api_key
            prompt = (
                "You are a knowledge base of US universities. "
                "Given the college name delimited by triple backticks, return only its primary .edu domain. "
                "Respond with just the domain, nothing else.\n\nCollege: ```%s```" % college
            )
            completion = openai.ChatCompletion.create(
                model="gpt-3.5-turbo-0125",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0.0,
            )
            dom = completion.choices[0].message.content.strip().lower()
            if dom.endswith(".edu") and _domain_live(dom):
                logger.info("LLM provided domain: %s", dom)
                return dom
    except Exception as e:
        logger.warning("LLM domain resolution failed: %s", e)

    raise RuntimeError(f"Could not resolve root domain for {college}")

# ---------------------------------------------------------------------------
# Step-2 – department homepage
# ---------------------------------------------------------------------------

def get_department_url(root_domain: str, major: str) -> str:
    logger.info("Finding department URL for %s at %s", major, root_domain)

    # Try common URL patterns first
    common_patterns = [
        f"https://www.cs.{root_domain}",
        f"https://cs.{root_domain}",
        f"https://www.{root_domain}/cs",
        f"https://{root_domain}/cs",
        f"https://scs.{root_domain}",
        f"https://www.scs.{root_domain}",
        f"https://www.{root_domain}/computer-science",
        f"https://{root_domain}/computer-science",
    ]
    
    for pattern in common_patterns:
        try:
            logger.info("Testing department pattern: %s", pattern)
            # Perform a lightweight HEAD request to ensure the full path exists
            resp = SESSION.head(pattern, allow_redirects=True, timeout=6)
            if resp.status_code < 400:
                dept_url = resp.url  # final resolved URL after redirects
                logger.info("Found department URL: %s (status %s)", dept_url, resp.status_code)
                return dept_url
        except Exception as e:
            logger.debug("Dept pattern failed: %s", e)
            continue

    # Fallback to search
    logger.info("Trying search-based approach...")
    queries = [
        f'"{major}" department {root_domain}',
        f'"{major}" school {root_domain}',
        f'computer science {root_domain}',
        f'cs department {root_domain}',
    ]

    for query in queries:
        logger.info("Trying query: %s", query)
        try:
            hits = safe_text_search(query, max_results=5)
            logger.info("Got %d hits", len(hits))
            for hit in hits:
                url = hit.get("href", "") if isinstance(hit, dict) else hit
                logger.info("Checking URL: %s", url)
                if not url or root_domain not in url:
                    continue
                path = urlparse(url).path.lower()
                if "cs" in path or "computer" in path or "computing" in path:
                    logger.info("Found via search: %s", url)
                    return url
        except Exception as e:
            logger.warning("Search failed for %s: %s", query, e)
            continue

    raise RuntimeError(f"Department page not found for {root_domain} {major}")

# ---------------------------------------------------------------------------
# Step-3 – collect + score internal links
# ---------------------------------------------------------------------------

def score_links(base_url: str, html: str, top_n: int = 5) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    host = urlparse(base_url).netloc

    scores: Dict[str, int] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        full = urljoin(base_url, href)
        p = urlparse(full)
        if p.netloc != host:
            continue
        depth = len([seg for seg in p.path.split("/") if seg])
        if depth > 3:
            continue
        score = 0
        if _RESEARCH_WORDS.search(p.path):
            score += 2
        if _RESEARCH_WORDS.search(a.get_text(" ")):
            score += 1
        scores[full] = scores.get(full, 0) + score

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [url for url, _ in ranked[:top_n]]

# ---------------------------------------------------------------------------
# Step-4 – simple research page detection
# ---------------------------------------------------------------------------

def is_research_page(url: str) -> bool:
    """Simple heuristic to check if a page is a research listing."""
    try:
        html = fetch(url)
        # Quick heuristic success
        if re.search(r"<h[1-4][^>]*>[^<]*research", html, re.I):
            return True
        if re.search(r"<h[1-4][^>]*>[^<]*lab", html, re.I):
            return True
        if re.search(r"<h[1-4][^>]*>[^<]*group", html, re.I):
            return True
        return False
    except Exception:
        return False

# ---------------------------------------------------------------------------
# Main discovery function
# ---------------------------------------------------------------------------

def find_research_url(college: str, major: str = "computer science") -> str:
    """Return URL of the department research/labs page for (*college*, *major*)."""

    logger.info("Finding research URL for %s %s", college, major)
    
    # 1) Get the institutional domain
    root = get_root_domain(college)
    logger.info("Resolved domain: %s", root)
    
    # 2) First attempt – let Gemini give us the exact research page
    gemini_url = _gemini_suggest_research_url(college, major, root)
    if gemini_url:
        # Prefer Gemini's answer as long as the page exists (status < 400)
        try:
            resp = SESSION.head(gemini_url, allow_redirects=True, timeout=6)
            if resp.status_code < 400:
                logger.info("Using Gemini research URL: %s", resp.url)
                return resp.url
        except Exception as e:
            logger.warning("Gemini URL unreachable, falling back: %s", e)

    # 3) Heuristic approach – try common department URL patterns first (fast, reliable)
    logger.info("Trying common department URL patterns...")
    dept_patterns = [
        f"https://www.cs.{root}",
        f"https://cs.{root}",
        f"https://www.{root}/cs",
        f"https://{root}/cs",
        f"https://scs.{root}",
        f"https://www.scs.{root}",
        f"https://www.{root}/computer-science",
        f"https://{root}/computer-science",
    ]
    
    dept_url = None
    for pattern in dept_patterns:
        try:
            logger.info("Testing department pattern: %s", pattern)
            # Perform a lightweight HEAD request to ensure the full path exists
            resp = SESSION.head(pattern, allow_redirects=True, timeout=6)
            if resp.status_code < 400:
                dept_url = resp.url  # final resolved URL after redirects
                logger.info("Found department URL: %s (status %s)", dept_url, resp.status_code)
                break
        except Exception as e:
            logger.debug("Dept pattern failed: %s", e)
            continue
    
    # 4) If no pattern worked, search for department
    if not dept_url:
        logger.info("No pattern found, searching for department...")
        dept_url = get_department_url(root, major)
    
    # 5) Now find the research page from the department
    logger.info("Looking for research page from: %s", dept_url)
    dept_html = fetch(dept_url)
    
    # 6) Try common research URL patterns first
    research_patterns = [
        f"{dept_url}/research",
        f"{dept_url}/research/",
        f"{dept_url}/labs",
        f"{dept_url}/labs/",
        f"{dept_url}/groups",
        f"{dept_url}/groups/",
        f"{dept_url}/groups-labs",
        f"{dept_url}/groups-labs/",
    ]
    
    for pattern in research_patterns:
        try:
            logger.info("Testing research pattern: %s", pattern)
            if is_research_page(pattern):
                logger.info("Found research URL: %s", pattern)
                return pattern
        except Exception:
            continue
    
    # 7) Fallback to link scoring
    logger.info("Trying link scoring approach...")
    for candidate in score_links(dept_url, dept_html):
        try:
            if is_research_page(candidate):
                logger.info("Found research URL via scoring: %s", candidate)
                return candidate
        except Exception:
            continue
    
    # 8) Final fallback: return department URL if nothing else works
    logger.info("No research page found, returning department URL: %s", dept_url)
    return dept_url

# ---------------------------------------------------------------------------
# Lab extraction (unchanged from original)
# ---------------------------------------------------------------------------

def _extract_lab_areas(url: str) -> List[dict]:
    """Scrape the research/labs page and return a list of lab dicts.

    The parser is intentionally tolerant of different CMS structures:
    • Looks at h2-h4 headings as potential lab titles.
    • Walks through subsequent elements (text, lists, divs) until the next
      heading of equal/higher rank.
    • If no paragraph is found, falls back to the first 150-chars snippet.
    """

    try:
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        logger.warning("Failed to fetch research page %s: %s", url, exc)
        return []

    labs: list[dict] = []
    headings = soup.find_all(["h2", "h3", "h4"])

    for h in headings:
        title = h.get_text(" ", strip=True)
        if not title or len(title) < 4:
            continue

        # Skip generic or nav headings
        generic = {"research", "overview", "contact", "news", "groups & labs", "main menu", "mini menu", "support us", "home", "slideshow"}
        if title.lower().strip() in generic:
            continue

        description_parts: list[str] = []
        professors: list[str] = []
        professor_emails: dict[str, str] = {}

        # Link detection — support both absolute and relative URLs
        lab_url = None

        # 1) Anchor wrapping the heading (common in Drupal views rows)
        parent_anchor = h.find_parent('a', href=True)
        if parent_anchor:
            lab_url = urljoin(url, parent_anchor['href'])
        else:
            # 2) Direct anchor inside the heading element
            link_tag = h.find('a', href=True)
            if link_tag:
                lab_url = urljoin(url, link_tag['href'])

        # 3) Anchor immediately after the heading (fallback)
        if not lab_url:
            nxt = h.find_next('a', href=True)
            if nxt:
                lab_url = urljoin(url, nxt['href'])

        # Normalise and discard invalid anchor values
        if lab_url and (lab_url.endswith('#') or lab_url.lower().startswith('javascript')):
            lab_url = None

        # Check if heading contains 'Faculty:' pattern directly
        m = re.search(r"(?:Faculty|Professors?)[:\s]+(.+)", title, re.I)
        if m:
            professors = [p.strip() for p in re.split(r",|;", m.group(1)) if p.strip()]

        # Collect professor names & emails within same row container (Drupal pattern)
        row_container = h.find_parent(lambda tag: tag.name == 'div' and 'views-row' in (tag.get('class') or []))
        if row_container:
            for a in row_container.find_all('a'):
                text = a.get_text(" ", strip=True)
                href = a.get('href', '')
                if href.startswith('mailto:'):
                    email = href.replace('mailto:', '').strip()
                    name = text or email.split('@')[0]
                    if name not in professors:
                        professors.append(name)
                    professor_emails[name] = email
                else:
                    # Potential faculty link – detect proper name via regex
                    mname2 = PROF_NAME_RE.search(text)
                    if mname2:
                        cand = mname2.group(1).strip()
                        if cand not in professors:
                            professors.append(cand)

        for el in h.next_elements:
            if isinstance(el, str):
                continue
            if el in headings:
                break  # reached the next heading
            tag = getattr(el, "name", "")
            if tag in {"h2", "h3", "h4"}:  # any headline encountered
                break
            if tag in {"p", "div", "span", "li"}:
                txt = el.get_text(" ", strip=True)
                if txt and len(txt) > 40:
                    description_parts.append(txt)
                    # also capture first anchor inside this element for url if not yet set
                    if not lab_url:
                        inner_link = el.find('a', href=True)
                        if inner_link:
                            link_href = inner_link['href']
                            if link_href and not link_href.startswith('#') and not link_href.lower().startswith('javascript'):
                                if link_href.startswith('mailto:'):
                                    email = link_href.replace('mailto:', '').strip()
                                    anchor_text = inner_link.get_text(' ', strip=True)
                                    name = anchor_text or email.split('@')[0]
                                    if name not in professors:
                                        professors.append(name)
                                    professor_emails[name] = email
                                else:
                                    lab_url = urljoin(url, link_href)
                    # capture professors if not yet found
                    if not professors:
                        pm = re.search(r"(?:Faculty|Professors?)[:\s]+(.+)", txt, re.I)
                        if pm:
                            professors = [p.strip() for p in re.split(r",|;", pm.group(1)) if p.strip()]
            if len(" ".join(description_parts)) > 400:
                break

        # Fallback: take first 150 chars of immediate sibling text
        if not description_parts:
            sib_text = h.find_next(string=True)
            if sib_text:
                description_parts.append(sib_text.strip()[:150])

        if not description_parts:
            continue

        # Deduplicate lines inside description
        deduped: list[str] = []
        seen_line: set[str] = set()
        for line in description_parts:
            if line not in seen_line:
                seen_line.add(line)
                deduped.append(line)

        description = "\n".join(deduped[:3])
        labs.append({
            "name": title,
            "description": description,
            "professors": professors,
            "professor_emails": professor_emails,
            "lab_url": lab_url,
        })

    # Deduplicate by name
    seen: set[str] = set()
    unique_labs = []
    for lab in labs:
        if lab["name"] not in seen:
            seen.add(lab["name"])
            unique_labs.append(lab)

    return unique_labs[:40]

# ---------------------------------------------------------------------------
# Public entry point (for Lambda)
# ---------------------------------------------------------------------------

def discover_labs_data(body: Dict[str, Any]) -> Dict[str, Any]:
    college = body.get("college") or body.get("university")
    major = body.get("major") or "Computer Science"
    if not college or not isinstance(college, str):
        raise ValueError("Missing required field 'college'")

    logger.info("Discovering labs for %s | %s", college, major)

    try:
        research_url = find_research_url(college, major)
        logger.info("Research page URL: %s", research_url)
        
        labs = _extract_lab_areas(research_url)

        # Guarantee every lab has a URL to link to – fall back to the research page itself
        for lab in labs:
            if not lab.get("lab_url"):
                lab["lab_url"] = research_url

            # ------------------------------------------------------------------
            # Enrich professor list via Gemini (optional)
            # ------------------------------------------------------------------
            if not lab.get("professors"):
                # 1) Local quick scrape of 'Personnel' section
                names, emails, roles = _scrape_personnel_section(lab["lab_url"])
                # 2) Gemini fallback only if still empty
                if not names:
                    names, emails = _gemini_extract_professors(lab["lab_url"], college)
                if names:
                    lab["professors"] = names
                    lab["professor_emails"] = emails or {}
                    lab["professor_roles"] = roles or {}

            # ------------------------------------------------------------------
            # Build uniform faculty list structure for front-end (name, role, email)
            # ------------------------------------------------------------------
            if "faculty" not in lab:
                fac_list: list[dict] = []
                for n in lab.get("professors", []):
                    email_val = (lab.get("professor_emails") or {}).get(n, "")
                    if not email_val:
                        email_val = _guess_email_for_name(n, urlparse(lab["lab_url"]).netloc)
                    fac_list.append({
                        "name": n,
                        "role": (lab.get("professor_roles") or {}).get(n, "Professor"),
                        "email": email_val,
                    })
                lab["faculty"] = fac_list

        logger.info("Extracted %d lab areas from %s", len(labs), research_url)
        
        if not labs:
            raise ValueError("Unable to extract research areas from discovered page")

        return {"research_url": research_url, "labs": labs}
        
    except Exception as e:
        logger.error("Discovery failed: %s", e)
        raise ValueError(f"Could not find research information for {college}. Error: {str(e)}")

def _scrape_personnel_section(lab_url: str) -> tuple[list[str], dict[str, str], dict[str, str]]:
    """Attempt to parse a 'Personnel' or 'People' section in the lab page locally.

    Returns (names, email_map, role_map)."""
    try:
        html = fetch(lab_url, timeout=10)
        soup = BeautifulSoup(html, "html.parser")

        heading = soup.find(lambda tag: tag and tag.name in {"h2", "h3", "h4"} and any(word in tag.get_text(" ", strip=True).lower() for word in ("personnel", "people", "members", "faculty")))
        if not heading:
            return [], {}, {}

        names: list[str] = []
        emails: dict[str, str] = {}
        roles: dict[str, str] = {}
        profile_links: dict[str, str] = {}

        for el in heading.next_elements:
            if getattr(el, "name", "") in {"h2", "h3", "h4"}:
                break  # new section reached
            if isinstance(el, str):
                continue

            # capture anchors
            if el.name == "a":
                anchor_text = el.get_text(" ", strip=True)
                href = el.get("href", "")
                # extract email if mailto
                if href.startswith("mailto:"):
                    email_val = href.replace("mailto:", "").strip()
                else:
                    email_val = ""

                # detect name via regex
                m = PROF_NAME_RE.search(anchor_text)
                name_val = m.group(1).strip() if m else anchor_text

                if name_val and name_val not in names:
                    names.append(name_val)
                if name_val and href and not href.startswith("mailto:") and href.startswith("/"):
                    profile_links[name_val] = urljoin(lab_url, href)

            # also check plain text list items
            if el.name in {"li", "p", "div", "span"}:
                txt = el.get_text(" ", strip=True)
                if not txt:
                    continue
                # emails inside
                m_mail = re.search(r"[\w.-]+@[\w.-]+\.\w+", txt)
                email_val = m_mail.group(0) if m_mail else ""
                m_name = PROF_NAME_RE.search(txt)
                if m_name:
                    name_val = m_name.group(1).strip()
                    if name_val and name_val not in names:
                        names.append(name_val)
                    if name_val and email_val:
                        emails[name_val] = email_val
                        # role detection: leftover text after removing name & email
                        rem = txt.replace(name_val, "").replace(email_val, "").strip(" ,;:-")
                        if rem and len(rem) < 60:
                            roles[name_val] = rem
                    if name_val and not email_val:
                        # try to capture link inside element
                        link_tag = el.find('a', href=True)
                        if link_tag and not link_tag['href'].startswith('mailto:'):
                            profile_links[name_val] = urljoin(lab_url, link_tag['href'])

        # ------------------------------------------------------------------
        # Follow profile links to fetch missing e-mails
        # ------------------------------------------------------------------
        def _extract_email_from_page(u: str) -> str | None:
            try:
                html2 = fetch(u, timeout=10)
                m_mail = re.search(r"[\w.-]+@[\w.-]+\.\w+", html2)
                return m_mail.group(0) if m_mail else None
            except Exception:
                return None

        for nm in names:
            if nm not in emails and nm in profile_links:
                em = _extract_email_from_page(profile_links[nm])
                if em:
                    emails[nm] = em

        return names, emails, roles
    except Exception as exc:
        logger.debug("Local personnel scrape failed for %s: %s", lab_url, exc)
        return [], {}, {}

# Simple heuristic email guesser
def _guess_email_for_name(name: str, lab_netloc: str) -> str:
    """Return a best‐guess e-mail like jdoe@cs.example.edu based on name + lab host."""
    try:
        name_parts = name.lower().split()
        if len(name_parts) < 2:
            return ""
        first, last = name_parts[0], name_parts[-1]
        user_candidates = [
            f"{first[0]}{last}",        # jdoe
            f"{first}.{last}",           # john.doe
            f"{first}{last[0]}",         # johnd
        ]
        host = lab_netloc
        # strip www.
        if host.startswith("www."):
            host = host[4:]
        return f"{user_candidates[0]}@{host}"
    except Exception:
        return "" 