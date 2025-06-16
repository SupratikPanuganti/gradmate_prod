import json
import os
import logging
from openai import OpenAI
from typing import Dict, Any, Optional
import openai as openai_pkg
from supabase import create_client
import requests
from bs4 import BeautifulSoup

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Supabase Setup (global so it cold-starts only once) ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase_client = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialised successfully")
    except Exception as e:
        logger.error("Failed to initialise Supabase client: %s", str(e))

def fetch_user_profile(user_id: str) -> dict:
    """Fetch a user's profile from Supabase. Returns empty dict if not found."""
    if not supabase_client:
        return {}
    try:
        res = (
            supabase_client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return res.data or {}
    except Exception as e:
        logger.warning("Unable to fetch profile for user %s: %s", user_id, str(e))
        return {}

def fetch_lab_from_db(lab_title: str, school_name: str | None = None):
    """Return (lab_record dict) matching name (and optionally school)."""
    if not supabase_client:
        return None

    try:
        q = supabase_client.table("labs").select("id, description, lab_url, school_id, name")
        q = q.ilike("name", f"%{lab_title}%")

        # Restrict by school if provided
        if school_name:
            # get matching school id
            school_res = supabase_client.table("schools").select("id").ilike("name", f"%{school_name}%").single().execute()
            school_id = school_res.data["id"] if school_res and school_res.data else None
            if school_id:
                q = q.eq("school_id", school_id)

        res = q.execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.warning("Unable to fetch lab record: %s", str(e))
    return None

def scrape_lab_description(url: str) -> str | None:
    """Simple scraper: pull all meaningful paragraphs (> 50 chars)"""
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        long_paras = [p for p in paragraphs if len(p) > 50]
        text = "\n\n".join(long_paras)
        return text if text else None
    except Exception as e:
        logger.warning("Error scraping %s: %s", url, str(e))
        return None

def summarise_lab(text: str, title: str, client: OpenAI) -> str:
    prompt = (
        f"You are an academic writing assistant. Summarise the lab/ research group '"+title+"' description "
        "into 3-4 concise sentences that highlight the group's main goals, distinctive techniques and why it would "
        "appeal to a motivated undergraduate researcher. Use plain language, avoid jargon." 
    )

    chat = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": prompt + "\n\nLab content:\n\n" + text}
        ],
        temperature=0.5,
        max_tokens=200,
    )
    return chat.choices[0].message.content.strip()

def summarise_profile(profile: dict) -> str:
    """Format a profile dict into bullet-point text for the prompt."""
    if not profile:
        return "(no additional profile information provided)"

    lines = []
    def add(label, key):
        val = profile.get(key)
        if val:
            lines.append(f"• {label}: {val}")

    # Prefer the field names used by the Next.js app ("name") but still support legacy
    # "full_name" to remain backwards-compatible.
    name_val = profile.get("name") or profile.get("full_name")
    if name_val:
        lines.append(f"• Name: {name_val}")

    add("School", "school")
    add("Major", "major")
    add("Minor", "minor")
    add("GPA", "gpa")

    # skills, certifications, projects could be arrays / JSON
    if skills := profile.get("skills"):
        joined = ", ".join(skills) if isinstance(skills, list) else str(skills)
        lines.append(f"• Skills: {joined}")

    if certs := profile.get("certifications"):
        joined = ", ".join(certs) if isinstance(certs, list) else str(certs)
        lines.append(f"• Certifications: {joined}")

    if projects := profile.get("projects"):
        # projects may be list of dict; take first 2 titles
        if isinstance(projects, list):
            titles = [p.get("title") or str(p) for p in projects][:2]
            lines.append("• Projects: " + ", ".join(titles))
        else:
            lines.append("• Projects: " + str(projects))

    return "\n".join(lines)

def validate_email_request(body: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Validate the email generation request body"""
    # Only lab context is strictly required; student fields can come from profile
    required_fields = {
        "lab_title": str,
        "professors": list,
    }
    
    for field, field_type in required_fields.items():
        if field not in body:
            return False, f"Missing required field: {field}"
        if not isinstance(body[field], field_type):
            return False, f"Invalid type for {field}: expected {field_type.__name__}"
        if field_type == str and not body[field].strip():
            return False, f"{field} cannot be empty"
        if field_type == list and not body[field]:
            return False, f"{field} cannot be empty"
    
    return True, None

def generate_email(event):
    """Handle email generation request"""
    try:
        # Parse request body
        body = json.loads(event.get("body") or "{}")
        logger.info("Received email generation request: %s", json.dumps(body))

        # Validate request
        is_valid, error_message = validate_email_request(body)
        if not is_valid:
            logger.warning("Invalid request: %s", error_message)
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS"
                },
                "body": json.dumps({
                    "error": "Invalid request",
                    "message": error_message
                })
            }

        # Fetch profile first (may override fields)
        user_id = body.get("user_id")
        profile = fetch_user_profile(user_id) if user_id else {}

        # -----------------------
        # Resolve lab record & description
        lab_record = fetch_lab_from_db(body["lab_title"], body.get("school"))
        lab_description = lab_record.get("description") if lab_record else None

        # Always attempt to scrape fresh content when we have a URL.
        if lab_record:
            lab_url = lab_record.get("lab_url")
            fresh_text: str | None = None
            if lab_url:
                fresh_text = scrape_lab_description(lab_url)

            # If scraping succeeded use that; otherwise fall back to stored description
            if fresh_text:
                lab_description = fresh_text
                # Persist latest version for next time (fire & forget)
                try:
                    supabase_client.table("labs").update({"description": fresh_text}).eq("id", lab_record["id"]).execute()
                    logger.info("Updated lab description in DB for %s", lab_record["id"])
                except Exception as e:
                    logger.warning("Failed to update lab description: %s", str(e))
            else:
                # scraping failed; keep DB description (may be None)
                lab_description = lab_description

        # Initialise OpenAI client earlier (we need it for summary too)
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        client = OpenAI(api_key=api_key)

        lab_summary: str | None = None
        if lab_description:
            try:
                lab_summary = summarise_lab(lab_description, body["lab_title"], client)
            except Exception as e:
                logger.warning("Failed to summarise lab description: %s", str(e))

        # -----------------------
        # Use body values, but fall back to profile, then defaults
        lab_title = body["lab_title"]
        professors = body["professors"]

        school = body.get("school") or profile.get("school") or "Unknown University"
        # Try new field name "name", then fallback to "full_name"
        student_name = body.get("student_name") or profile.get("name") or profile.get("full_name") or "Student"
        student_major = body.get("student_major") or profile.get("major") or "Undeclared"

        profile_text = summarise_profile(profile)

        # Log openai version for debugging
        logger.info(f"Using openai python version: {openai_pkg.__version__}")
        
        # Generate email using OpenAI with improved prompt
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an AI assistant helping students write professional emails to professors. 
                    Follow these guidelines:
                    1. Keep the email concise (150-200 words)
                    2. Show genuine interest in the professor's research
                    3. Mention specific details about the lab/research
                    4. Include the student's background naturally
                    5. Maintain a professional but warm tone
                    6. Format with proper paragraphs and line breaks
                    7. End with a clear call to action
                    8. Use a professional signature
                    
                    Structure:
                    - Professional greeting
                    - Introduction with context
                    - Expression of interest
                    - Relevant background
                    - Call to action
                    - Professional closing
                    - Signature

                    Below is the student's profile information to personalise the email:
                    {profile_text}
                    \nLab summary: {lab_summary or '(no additional lab summary found)'}
                    """
                },
                {
                    "role": "user",
                    "content": f"""Generate a professional email to {professors[0]} at {school} for the {lab_title}.
                    
                    Student Information:
                    - Name: {student_name}
                    - Major: {student_major}
                    - School: {school}
                    
                    The email should express interest in joining their research lab and contributing to their work."""
                }
            ],
            temperature=0.7,
            max_tokens=300,
            presence_penalty=0.6,
            frequency_penalty=0.3
        )

        email = completion.choices[0].message.content
        logger.info("Successfully generated email using OpenAI")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "email": email,
                "metadata": {
                    "lab": {
                        "lab_title": lab_title,
                        "professors": professors,
                        "school": school
                    },
                    "student": {
                        "name": student_name,
                        "major": student_major
                    },
                    "generation": {
                        "model": "gpt-3.5-turbo",
                        "timestamp": "2024-03-14T00:00:00Z"  # TODO: Add actual timestamp
                    }
                }
            })
        }
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in request body: %s", str(e))
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "error": "Invalid JSON",
                "message": "The request body must be valid JSON"
            })
        }
    except ValueError as e:
        logger.error("Configuration error: %s", str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "error": "Configuration error",
                "message": str(e)
            })
        }
    except Exception as e:
        logger.error("Unexpected error in email generation: %s", str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "error": "Internal server error",
                "message": "An unexpected error occurred while generating the email"
            })
        }

def handle_health_check(event):
    """Handle health check request"""
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps({
            "status": "healthy",
            "timestamp": "2024-03-14T00:00:00Z"
        })
    }

def lambda_handler(event, context):
    """Main Lambda handler that routes requests to appropriate functions"""
    logger.info("Received event: %s", json.dumps(event))
    
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Max-Age": "86400"
            },
            "body": ""
        }

    # Route the request based on the path.  Support both proxy and non-proxy integrations.
    method = event.get("httpMethod") or event.get("http", {}).get("method") or "POST"
    path = event.get("path") or event.get("resource") or "/gradmate-ai-service"

    if path == "/gradmate-ai-service/health" and method == "GET":
        return handle_health_check(event)
    elif path == "/gradmate-ai-service" and method == "POST":
        return generate_email(event)
    else:
        return {
            "statusCode": 404,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "error": "Not Found",
                "message": f"No handler for {method} {path}"
            })
        }