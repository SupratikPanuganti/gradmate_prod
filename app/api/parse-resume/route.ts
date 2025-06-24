export async function POST(request: Request) {
  try {
    // Basic validation – ensure we received JSON with a path (not strictly required for the stub).
    const { path } = await request.json();

    if (!path || typeof path !== "string") {
      return new Response(JSON.stringify({ error: "`path` missing from body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const LAMBDA_URL =
      "https://53dhwuhsl8.execute-api.us-east-2.amazonaws.com/default/gradmate-parse-resume"
    const apiKey = process.env.AI_SERVICE_KEY || process.env.NEXT_PUBLIC_AI_SERVICE_KEY || ""

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service API key not configured on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const lambdaRes = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ path }),
    })

    const text = await lambdaRes.text()

    return new Response(text, {
      status: lambdaRes.status,
      headers: { "Content-Type": lambdaRes.headers.get("content-type") || "application/json" },
    })
  } catch (error) {
    console.error("/api/parse-resume proxy error", error)

    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
} 