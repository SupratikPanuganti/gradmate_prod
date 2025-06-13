import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// IMPORTANT: Ensure OPENAI_API_KEY exists in env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      labName,
      researchArea,
      labDescription,
      userProfile, // { name, year, university, major }
    } = body as {
      labName: string
      researchArea: string
      labDescription: string
      userProfile: {
        name: string
        year: string
        university: string
        major: string
      }
    }

    if (!labName || !userProfile?.name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Build a minimal prompt – adjust later
    const prompt = `Write a concise outreach email (subject and body) from ${userProfile.name}, a ${userProfile.year} studying ${userProfile.major} at ${userProfile.university}, to the ${labName} at Georgia Tech regarding potential undergraduate research opportunities in ${researchArea}. The lab description is: \n\n${labDescription}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    })

    const emailText = completion.choices[0].message.content?.trim()

    return NextResponse.json({ email: emailText ?? "" })
  } catch (err: any) {
    console.error("/api/generate-email error", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
} 