"use client"

import { useState } from "react"
import { Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/lib/supabase"

// --------------------
// Types
// --------------------
interface FacultyMember {
  name: string
  role?: string
  email?: string
}

interface LabArea {
  id: string // generated client-side for React keys
  name: string
  description: string
  faculty: FacultyMember[]
  lab_url?: string
}

export default function ResearchAgentPage() {
  // Form inputs
  const [college, setCollege] = useState("")
  const [major, setMajor] = useState("")

  // Discovered labs
  const [labAreas, setLabAreas] = useState<LabArea[]>([])
  const [selectedLabId, setSelectedLabId] = useState<string>("")
  const [currentLab, setCurrentLab] = useState<LabArea | null>(null)

  // Email generation
  const [emailDraft, setEmailDraft] = useState("")
  const [profSelections, setProfSelections] = useState<Record<string, { checked: boolean; email: string }>>({})
  const [generating, setGenerating] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>("")

  // Lambda endpoints (stub)
  const DISCOVER_URL = process.env.NEXT_PUBLIC_AI_DISCOVER_ENDPOINT || "/api/discover-labs"
  const GENERATE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_KEY
    ? "https://53dhwuhsl8.execute-api.us-east-2.amazonaws.com/default/gradmate-ai-service"
    : ""

  // --------------------
  // Handlers
  // --------------------
  const discoverLabs = async () => {
    if (!college.trim()) return

    setDiscovering(true)
    setLabAreas([])
    setSelectedLabId("")
    setCurrentLab(null)
    setEmailDraft("")
    setErrorMsg("")

    try {
      const payload = { college, major }

      const res = await fetch(DISCOVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let message = `Failed to discover labs (${res.status})`
        try {
          const errJson = await res.json()
          if (errJson && errJson.error) message = errJson.error
        } catch (_) {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }

      const json = await res.json()
      // Expecting { labs: [{ name, description }] }
      const researchUrl: string | undefined = json.research_url
      const labs: LabArea[] = (json.labs || []).map((l: any, idx: number) => ({
        id: `${idx}`,
        name: l.name,
        description: l.description,
        faculty: Array.isArray(l.faculty) ? l.faculty : [],
        lab_url: l.lab_url || researchUrl,
      }))
      setLabAreas(labs)
    } catch (err: any) {
      console.error("Lab discovery failed", err)
      setErrorMsg(err.message || "Unexpected error while discovering labs")
    } finally {
      setDiscovering(false)
    }
  }

  const generateEmail = async () => {
    if (!currentLab) return
    setGenerating(true)

    try {
      const apiKey = process.env.NEXT_PUBLIC_AI_SERVICE_KEY
      const { data: { user } } = await supabase.auth.getUser()

      const body: Record<string, any> = {
        lab_title: currentLab.name,
        school: college,
        professors: currentLab.faculty.map((f) => f.name),
        lab_description: currentLab.description,
        lab_url: currentLab.lab_url,
      }

      if (user?.id) {
        body.user_id = user.id
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, school, major")
          .eq("id", user.id)
          .single()
        body.student_name = profile?.name || undefined
        body.student_major = profile?.major || undefined
        if (profile?.school) body.school = profile.school
      }

      const res = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey || "",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Email generation failed (${res.status})`)
      const json = await res.json()
      setEmailDraft(json.email)
    } catch (err: any) {
      console.error(err)
      setEmailDraft(`Error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // Keep currentLab in sync with selectedLabId
  const onSelectLab = (labId: string) => {
    setSelectedLabId(labId)
    const found = labAreas.find((l) => l.id === labId) || null
    setCurrentLab(found)
    setEmailDraft("")
    // reset selections
    if (found) {
      const init: Record<string, { checked: boolean; email: string }> = {}
      found.faculty.forEach((f) => (init[f.name] = { checked: false, email: f.email || "" }))
      setProfSelections(init)
    }
  }

  const parseEmail = (text: string) => {
    const lines = text.split("\n")
    let subject = ""
    const bodyLines: string[] = []
    for (const line of lines) {
      if (!subject && line.toLowerCase().startsWith("subject:")) {
        subject = line.substring(8).trim()
      } else {
        bodyLines.push(line)
      }
    }
    return { subject, body: bodyLines.join("\n") }
  }

  const draftToGmail = () => {
    if (!emailDraft) return
    const { subject, body } = parseEmail(emailDraft)
    const toEmails = Object.values(profSelections)
      .filter((v) => v.checked && v.email.trim())
      .map((v) => v.email.trim())
      .join(",")
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1&tf=1" +
      (toEmails ? `&to=${encodeURIComponent(toEmails)}` : "") +
      (subject ? `&su=${encodeURIComponent(subject)}` : "") +
      (body ? `&body=${encodeURIComponent(body)}` : "")
    window.open(url, "_blank")
  }

  // --------------------
  // Render
  // --------------------
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Research Email Agent</h1>

      <Card>
        <CardHeader>
          <CardTitle>Step 1 – Tell us where you study</CardTitle>
          <CardDescription>Enter your college and (optionally) your major</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="college" className="text-sm font-medium">
                College / University
              </label>
              <Input id="college" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="University of Georgia" />
            </div>

            <div className="space-y-2">
              <label htmlFor="major" className="text-sm font-medium">
                Major (optional)
              </label>
              <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" />
            </div>
          </div>

          <Button onClick={discoverLabs} disabled={!college.trim() || discovering} className="w-full">
            {discovering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Discovering Labs…
              </>
            ) : (
              "Find Research Areas"
            )}
          </Button>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="rounded-md bg-red-100 text-red-700 p-4 border border-red-300">
          {errorMsg}
        </div>
      )}

      {labAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 – Select a Research Area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="lab" className="text-sm font-medium">
                Research Area / Lab
              </label>
              <Select value={selectedLabId} onValueChange={onSelectLab}>
                <SelectTrigger id="lab">
                  <SelectValue placeholder="Select a research area" />
                </SelectTrigger>
                <SelectContent>
                  {labAreas.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentLab && (
              <div className="rounded-md bg-muted p-4 space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{currentLab.description}</p>
                </div>
                <a
                  href={currentLab.lab_url || "#"}
                  target={currentLab.lab_url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`inline-flex items-center text-sm ${currentLab.lab_url ? "text-blue-600 hover:underline" : "text-gray-400 cursor-not-allowed"}`}
                  style={{ pointerEvents: currentLab.lab_url ? "auto" : "none" }}
                >
                  Go to lab <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <Button onClick={generateEmail} disabled={!currentLab || generating} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Email…
                </>
              ) : (
                "Generate Email"
              )}
            </Button>

            {/* Email draft moved to Step 3 */}
          </CardContent>
        </Card>
      )}

      {emailDraft && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 – Review & Choose Faculty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email-draft" className="text-sm font-medium">
                Email Draft
              </label>
              <Textarea
                id="email-draft"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            {currentLab?.faculty?.length ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Faculty</h4>
                {currentLab.faculty.map((fac) => (
                  <div key={fac.name} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={profSelections[fac.name]?.checked}
                      onChange={(e) =>
                        setProfSelections({
                          ...profSelections,
                          [fac.name]: { ...(profSelections[fac.name] || { email: "" }), checked: e.target.checked },
                        })
                      }
                    />
                    <span className="text-sm w-40">{fac.name}{fac.role ? ` – ${fac.role}` : ""}</span>
                    <Input
                      placeholder="faculty email"
                      value={profSelections[fac.name]?.email || fac.email || ""}
                      onChange={(e) =>
                        setProfSelections({
                          ...profSelections,
                          [fac.name]: { ...(profSelections[fac.name] || { checked: false }), email: e.target.value },
                        })
                      }
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="pt-4">
              <Button onClick={draftToGmail} className="w-full">Save to Gmail Drafts</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 