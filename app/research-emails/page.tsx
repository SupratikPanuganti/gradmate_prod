"use client"

import { useState } from "react"
import { Loader2, ExternalLink, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

interface LabArea {
  id: string
  name: string
  description: string
  professors: string[]
  lab_url?: string
  professorEmails?: { [name: string]: string }
  matchScore?: number
}

export default function ResearchEmails() {
  const [college, setCollege] = useState("")
  const [major, setMajor] = useState("")
  const [labAreas, setLabAreas] = useState<LabArea[]>([])
  const [selectedLab, setSelectedLab] = useState<string>("")
  const [currentLab, setCurrentLab] = useState<LabArea | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [emailDraft, setEmailDraft] = useState("")
  const [profSelections, setProfSelections] = useState<Record<string, { checked: boolean; email: string }>>({})
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual")

  const ENDPOINT = process.env.NEXT_PUBLIC_AI_DISCOVER_ENDPOINT || "/api/discover-labs"
  const LAMBDA_URL = "https://53dhwuhsl8.execute-api.us-east-2.amazonaws.com/default/gradmate-ai-service"

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
    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1&tf=1" +
      (toEmails ? `&to=${encodeURIComponent(toEmails)}` : "") +
      (subject ? `&su=${encodeURIComponent(subject)}` : "") +
      (body ? `&body=${encodeURIComponent(body)}` : "")
    window.open(gmailUrl, "_blank")
  }

  const discoverLabs = async () => {
    if (!college.trim()) return
    setDiscovering(true)
    setLabAreas([])
    setCurrentLab(null)
    setEmailDraft("")
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ college, major }),
      })
      if (!res.ok) throw new Error(`Discovery failed ${res.status}`)
      const json = await res.json()
      const researchUrl: string | undefined = json.research_url

      // quick text-overlap match
      let profileTxt = ""
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          const { data: profile } = await supabase.from("profiles").select("major,interests,skills").eq("id", user.id).single()
          profileTxt = JSON.stringify(profile || "").toLowerCase()
        }
      } catch {}

      const score = (d: string) => {
        if (!profileTxt) return 0
        const words = new Set(d.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3))
        let h = 0
        words.forEach(w => {
          if (profileTxt.includes(w)) h++
        })
        return words.size ? h / words.size : 0
      }

      const labs: LabArea[] = (json.labs || []).map((l: any, idx: number) => ({
        id: `${idx}`,
        name: l.name,
        description: l.description,
        professors: Array.isArray(l.professors) ? l.professors : [],
        lab_url: l.lab_url || researchUrl,
        professorEmails: l.professor_emails || {},
        matchScore: score(l.description || "")
      }))
      setLabAreas(labs)
    } catch (err) {
      console.error(err)
    } finally {
      setDiscovering(false)
    }
  }

  const onSelectLab = (id: string) => {
    setSelectedLab(id)
    const lab = labAreas.find((l) => l.id === id) || null
    setCurrentLab(lab)
    setEmailDraft("")
    if (lab) {
      const init: Record<string, { checked: boolean; email: string }> = {}
      lab.professors.forEach((p) => (init[p] = { checked: false, email: lab.professorEmails?.[p] || "" }))
      setProfSelections(init)
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
        professors: currentLab.professors,
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
      }
      const res = await fetch(LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey || "" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Lambda error ${res.status}`)
      const json = await res.json()
      setEmailDraft(json.email)
    } catch (err: any) {
      console.error(err)
      setEmailDraft(`Error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Research Email Generator</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" className="flex items-center justify-center gap-2">
            <Search className="h-4 w-4" /> Manual Selection
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          {/* Step 1 */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1 – Enter College & Major</CardTitle>
              <CardDescription>We will find the research areas automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="college">College / University</label>
                  <Input id="college" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="University of Georgia" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="major">Major (optional)</label>
                  <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" />
                </div>
              </div>
              <Button onClick={discoverLabs} disabled={!college.trim() || discovering} className="w-full">
                {discovering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Discovering…</> : "Find Research Areas"}
              </Button>
            </CardContent>
          </Card>

          {/* Step 2 */}
          {activeTab === "manual" && labAreas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2 – Select Research Area</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="lab" className="text-sm font-medium">Research Area</label>
                  <Select value={selectedLab} onValueChange={onSelectLab}>
                    <SelectTrigger id="lab">
                      <SelectValue placeholder="Select a research area" />
                    </SelectTrigger>
                    <SelectContent>
                      {labAreas.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name} {typeof lab.matchScore === 'number' && <span className="text-xs text-muted-foreground">({Math.round(lab.matchScore * 100)}%)</span>}
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
                      style={{ pointerEvents: currentLab.lab_url ? "auto" : "none" }}>
                      Go to lab <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                <Button onClick={generateEmail} disabled={!currentLab || generating} className="w-full">
                  {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : "Generate Email"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step3 card will show after generation */}
          {activeTab === "manual" && emailDraft && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Step 3 – Send Emails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="draft" className="text-sm font-medium">Email Draft</label>
                  <Textarea id="draft" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="min-h-[300px] font-mono text-sm" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Professors</h4>
                  {Object.keys(profSelections).length === 0 && (
                    <p className="text-sm text-muted-foreground">No professors found. Add one below.</p>
                  )}
                  {Object.entries(profSelections).map(([prof, values]) => (
                    <div key={prof} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={values.checked}
                        onChange={(e) =>
                          setProfSelections({
                            ...profSelections,
                            [prof]: { ...values, checked: e.target.checked },
                          })
                        }
                      />
                      <Input
                        placeholder="Professor name"
                        value={prof}
                        onChange={(e) => {
                          const newName = e.target.value
                          const updated: any = { ...profSelections }
                          updated[newName] = { ...values }
                          delete updated[prof]
                          setProfSelections(updated)
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="professor email"
                        value={values.email}
                        onChange={(e) =>
                          setProfSelections({
                            ...profSelections,
                            [prof]: { ...values, email: e.target.value },
                          })
                        }
                        className="flex-1"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      let name = prompt("Professor name") || ""
                      name = name.trim()
                      if (!name) return
                      setProfSelections({
                        ...profSelections,
                        [name]: { checked: true, email: "" },
                      })
                    }}
                  >
                    + Add Professor
                  </Button>
                </div>
                <div className="pt-4">
                  <Button onClick={draftToGmail} className="w-full">Save to Gmail Drafts</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Suggestions (coming soon)</CardTitle>
              <CardDescription>We'll automatically find and rank labs that best match your profile.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
