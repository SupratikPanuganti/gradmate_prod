import json
import os
import logging
import difflib
import base64
from urllib.parse import quote_plus
from typing import Dict, Any, Optional, List

import requests
from bs4 import BeautifulSoup

import openai
from openai import OpenAI
from supabase import create_client

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
#  Supabase client (global, lazy-initialised once per container)
# ---------------------------------------------------------------------------
_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
_supabase_client = None
if _SUPABASE_URL and _SUPABASE_SERVICE_ROLE_KEY:
    try:
        _supabase_client = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialised successfully [handlers.email]")
    except Exception as exc:
        logger.error("Failed to initialise Supabase client: %s", exc)

# ---------------------------------------------------------------------------
#  Helper functions (DB look-ups, scraping, summarisation, etc.)
# ---------------------------------------------------------------------------

def fetch_user_profile(user_id: str) -> dict:
    """Fetch a user's profile from Supabase or return {} if unavailable."""
    if not user_id or not _supabase_client:
        return {}
    try:
        res = (
            _supabase_client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return res.data or {}
    except Exception as exc:
        logger.warning("Unable to fetch profile for user %s: %s", user_id, exc)
        return {}


def fetch_lab_from_db(lab_title: str, school_name: Optional[str] | None = None):
    """Return first lab record that fuzzy-matches the given title (and school)."""
    if not _supabase_client:
        return None
    try:
        q = _supabase_client.table("labs").select("id, description, lab_url, school_id, name").ilike(
            "name", f"%{lab_title}%"
        )
        if school_name:
            school_res = (
                _supabase_client.table("schools")
                .select("id")
                .ilike("name", f"%{school_name}%")
                .single()
                .execute()
            )
            school_id = school_res.data["id"] if school_res and school_res.data else None
            if school_id:
                q = q.eq("school_id", school_id)
        res = q.execute()
        if res.data:
            return res.data[0]
    except Exception as exc:
        logger.warning("Unable to fetch lab record: %s", exc)
    return None


def scrape_lab_description(url: str) -> str | None:
    """Scrape textual content from a lab / research page in a robust way."""
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        content_area = (
            soup.find("main")
            or soup.find("article")
            or soup.find(id="main")
            or soup.find(id="content")
            or soup.find(class_="content")
            or soup.find(role="main")
        )
        search_context = content_area if content_area else soup.body
        if not search_context:
            return None

        tags_to_search = ["p", "h1", "h2", "h3", "h4", "li", "div"]
        text_parts: list[str] = []
        for element in search_context.find_all(tags_to_search):
            if element.find_parent("nav") or element.find_parent("footer"):
                continue
            text = element.get_text(" ", strip=True)
            if len(text) > 30 and "copyright" not in text.lower():
                text_parts.append(text)

        unique_parts: list[str] = []
        seen: set[str] = set()
        for part in text_parts:
            if part not in seen:
                seen.add(part)
                unique_parts.append(part)

        full_text = "\n\n".join(unique_parts)
        return full_text or None
    except Exception as exc:
        logger.warning("Error scraping %s: %s", url, exc)
        return None


def summarise_lab(text: str, title: str, client: OpenAI) -> str:
    """Condense raw lab page text into a structured summary for email generation."""
    prompt = (
        "You are an expert research analyst. You have been given the raw text scraped from the website of a research group "
        f"called '{title}'. Your task is to analyze this text and extract the most salient points that a prospective student "
        "could use to personalize an outreach email.\n\n"
        "From the text provided, please identify and list the following:\n"
        "1.  **Core Research Questions:** What are the 1-3 fundamental questions or key problems the lab is trying to solve?\n"
        "2.  **Key Technologies & Methods:** What specific tools, software, hardware, or scientific methods are explicitly mentioned (e.g., 'LLVM', 'PyTorch', 'FPGA prototyping', 'formal methods')?\n"
        "3.  **Specific Project Names:** List any named projects, systems, or initiatives (e.g., 'Project Phoenix', 'ZEBRA architecture').\n\n"
        "Present these points as a structured summary. This output will be used to draft a compelling email, so be concise and focus on concrete details."
    )

    chat = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt + "\n\nLab content:\n\n" + text}],
        temperature=0.5,
        max_tokens=200,
    )
    return chat.choices[0].message.content.strip()


def summarise_profile(profile: dict) -> str:
    """Convert a user profile dict into newline-separated bullet points for the prompt."""
    if not profile:
        return "(no additional profile information provided)"

    lines: list[str] = []

    def add(label: str, key: str):
        val = profile.get(key)
        if val:
            lines.append(f"• {label}: {val}")

    name_val = profile.get("name") or profile.get("full_name")
    if name_val:
        lines.append(f"• Name: {name_val}")

    add("School", "school")
    add("Major", "major")
    add("Minor", "minor")
    add("GPA", "gpa")

    if interests := profile.get("interests"):
        joined = ", ".join(interests) if isinstance(interests, list) else str(interests)
        lines.append(f"• Professional Interests: {joined}")

    if skills := profile.get("skills"):
        joined = ", ".join(skills) if isinstance(skills, list) else str(skills)
        lines.append(f"• Skills: {joined}")

    if certs := profile.get("certifications"):
        joined = ", ".join(certs) if isinstance(certs, list) else str(certs)
        lines.append(f"• Certifications: {joined}")

    if projects := profile.get("projects"):
        if isinstance(projects, list):
            titles = [p.get("title") or str(p) for p in projects][:2]
            lines.append("• Projects: " + ", ".join(titles))
        else:
            lines.append("• Projects: " + str(projects))

    return "\n".join(lines)


def find_closest_lab_in_db(
    lab_title: str, school_name: Optional[str] | None = None, threshold: float = 0.7
):
    """Fuzzy-match helper when exact lab lookup fails."""
    if not _supabase_client:
        return None
    try:
        q = _supabase_client.table("labs").select("id, description, lab_url, school_id, name")
        if school_name:
            school_res = (
                _supabase_client.table("schools")
                .select("id")
                .ilike("name", f"%{school_name}%")
                .single()
                .execute()
            )
            school_id = school_res.data["id"] if school_res and school_res.data else None
            if school_id:
                q = q.eq("school_id", school_id)
        res = q.execute()
        if not res.data:
            return None
        best, best_score = None, 0.0
        for row in res.data:
            score = difflib.SequenceMatcher(None, lab_title.lower(), row["name"].lower()).ratio()
            if score > best_score:
                best, best_score = row, score
        if best_score >= threshold:
            logger.info("Fuzzy match succeeded with score %.2f for lab '%s'", best_score, best["name"])
            return best
    except Exception as exc:
        logger.warning("Fuzzy DB search failed: %s", exc)
    return None


def search_lab_online(lab_title: str, school_name: Optional[str] | None = None) -> dict | None:
    """Use DuckDuckGo to discover a potential lab URL and scrape it."""
    query = f"{lab_title} {school_name or ''} research lab".strip()
    logger.info("Attempting web search for lab via DuckDuckGo: %s", query)
    try:
        search_url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
        resp = requests.get(search_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        first_link = soup.select_one("a.result__a")
        if not first_link:
            return None
        lab_url = first_link["href"]
        description = scrape_lab_description(lab_url)
        return {"lab_url": lab_url, "description": description} if description else None
    except Exception as exc:
        logger.warning("Online lab search failed: %s", exc)
        return None


def extract_professors_from_text(text: str, client: OpenAI) -> List[str]:
    """Try LLM extraction first; fallback to regex."""
    if not text:
        return []
    prompt = (
        "You will be given raw text extracted from a university research lab web page. "
        "Identify the names of faculty members (professors, principal investigators, research faculty). "
        "Return ONLY a JSON array of full names with no duplicates and no additional keys."
    )
    try:
        chat = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text[:12000]},
            ],
            temperature=0.0,
            max_tokens=150,
            response_format={"type": "json_object"},
        )
        names = json.loads(chat.choices[0].message.content.strip())
        cleaned = [n.strip() for n in names if n and n[0].isupper() and len(n.split()) <= 4]
        return cleaned[:10]
    except Exception as exc:
        logger.warning("OpenAI professor extraction failed: %s", exc)

    import re

    pattern = re.compile(r"\b(?:Prof(?:\.?)|Professor|Dr\.?)+\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b")
    matches = pattern.findall(text)
    unique: list[str] = []
    for m in matches:
        if m not in unique:
            unique.append(m)
    return unique[:10]

# ---------------------------------------------------------------------------
#  Request validation & main entry
# ---------------------------------------------------------------------------

def validate_email_request(body: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    if "lab_title" not in body or not isinstance(body["lab_title"], str) or not body["lab_title"].strip():
        return False, "Missing or invalid field: lab_title"
    if "professors" in body and not isinstance(body["professors"], list):
        return False, "Invalid type for professors: expected list"
    return True, None


def generate_email_data(body: Dict[str, Any]) -> Dict[str, Any]:
    """Core email-generation routine with no AWS-event coupling."""

    # Validate early
    is_valid, err = validate_email_request(body)
    if not is_valid:
        raise ValueError(f"Invalid request: {err}")

    # ------------------------------------------------------------------
    # 0.  Pull profile (optional)
    # ------------------------------------------------------------------
    profile = fetch_user_profile(body.get("user_id")) if body.get("user_id") else {}

    # ------------------------------------------------------------------
    # 1.  Resolve lab description (DB → fuzzy → web search → scraping)
    # ------------------------------------------------------------------
    lab_title = body["lab_title"].strip()
    school_name = body.get("school")

    lab_record = fetch_lab_from_db(lab_title, school_name) or find_closest_lab_in_db(lab_title, school_name)
    lab_url = lab_record.get("lab_url") if lab_record else None
    lab_description = lab_record.get("description") if lab_record else None

    if not lab_description and body.get("lab_description"):
        lab_description = body["lab_description"]

    if body.get("lab_url") and not lab_description:
        lab_description = scrape_lab_description(body["lab_url"])
        lab_url = body["lab_url"]

    newly_found_url = None
    if not lab_url:
        online = search_lab_online(lab_title, school_name)
        if online:
            newly_found_url = online["lab_url"]
            lab_url = newly_found_url
            if not lab_description and online.get("description"):
                lab_description = online["description"]

    fresh_text = scrape_lab_description(lab_url) if lab_url else None
    if fresh_text:
        lab_description = fresh_text
        if lab_record and lab_record.get("id") and _supabase_client:
            try:
                update_payload = {"description": fresh_text}
                if newly_found_url:
                    update_payload["lab_url"] = newly_found_url
                _supabase_client.table("labs").update(update_payload).eq("id", lab_record["id"]).execute()
            except Exception as exc:
                logger.warning("Failed to update lab description: %s", exc)

    # ------------------------------------------------------------------
    # 2.  OpenAI initialisation
    # ------------------------------------------------------------------
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")
    client = OpenAI(api_key=api_key)

    lab_summary = summarise_lab(lab_description, lab_title, client) if lab_description else None

    # ------------------------------------------------------------------
    # 3.  Professor list derivation
    # ------------------------------------------------------------------
    professors: list[str] = body.get("professors", [])
    if not professors and lab_description:
        professors = extract_professors_from_text(lab_description, client)
    if not professors:
        professors = ["Dr. [Last Name]"]

    # ------------------------------------------------------------------
    # 4.  Personalisation parameters
    # ------------------------------------------------------------------
    school = body.get("school") or profile.get("school") or "Unknown University"
    student_name = (
        body.get("student_name")
        or profile.get("name")
        or profile.get("full_name")
        or "Student"
    )
    student_major = body.get("student_major") or profile.get("major") or "Undeclared"

    profile_text = summarise_profile(profile)

    # ------------------------------------------------------------------
    # 5.  Prompt engineering & LLM call
    # ------------------------------------------------------------------
    system_prompt = f"""
You are an expert career advisor for computer science students at a top-tier university like Georgia Tech.
You are helping a student named {student_name} craft the perfect research outreach email to a professor.
Your goal is to generate a complete email (Subject + Body) that is professional, strategic, and highly personalized, making it stand out in a professor's inbox.

First, take a deep breath and analyze the provided context step-by-step. This is your internal thought process.
1.  Carefully read the STUDENT PROFILE and the LAB SUMMARY.
2.  Identify the 2-3 strongest, most specific points of alignment. What skill or project from the student directly maps onto a specific project, technology, or research question from the lab?
3.  Formulate a "unique value proposition" for the student. What can they *specifically* bring to *this* lab that another student might not?

Now, using your analysis, write the email. The output should be ONLY the email, starting with "Subject:".

---

**STUDENT PROFILE:**
{profile_text}
---
**LAB URL:** {lab_url or 'N/A'}
**LAB SUMMARY:**
{lab_summary or '(No lab summary was available.)'}
---
Now, generate the complete email for {professors[0]}.
"""

    user_prompt = f"Please generate the complete outreach email to {professors[0]}, including the subject line."

    completion = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
    )
    email_text = completion.choices[0].message.content

    return {"email": email_text, "lab_summary": lab_summary} 