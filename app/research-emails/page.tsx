"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Professor {
  id: string
  name: string
  email: string | null
  title: string | null
}

interface Lab {
  id: string
  name: string
  research_area: string | null
  description: string | null
  lab_url: string | null
  professors: Professor[]
}

interface School {
  id: string
  name: string
  slug: string | null
  college: string | null
}

export default function ResearchEmails() {
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string>("")
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLab, setSelectedLab] = useState("")
  const [currentLab, setCurrentLab] = useState<Lab | null>(null)
  const [emailDraft, setEmailDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const { data, error } = await supabase.from("schools").select("id, name, slug, college")
        if (error) throw error
        setSchools(data as School[])

        // Preselect first school if none chosen
        if (!selectedSchool && data && data.length) setSelectedSchool(data[0].id)
      } catch (err) {
        console.error("Error loading schools:", err)
      }
    }
    loadSchools()
  }, [])

  // Fetch labs (with professors) when school changes
  useEffect(() => {
    if (!selectedSchool) {
      setLabs([])
      return
    }

    // Supabase query: labs plus nested professors
    const fetchLabs = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("labs")
          .select("id, name, research_area, description, lab_url, professors(id, name, email, title)")
          .eq("school_id", selectedSchool)

        if (error) throw error

        // Cast to strong type
        setLabs((data as any) as Lab[])
      } catch (error) {
        console.error("Error fetching labs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLabs()
  }, [selectedSchool])

  // Update current lab when selected lab changes
  useEffect(() => {
    if (selectedLab) {
      const lab = labs.find((lab) => lab.id === selectedLab)
      setCurrentLab(lab || null)
      setEmailDraft("") // Clear previous email draft
    } else {
      setCurrentLab(null)
      setEmailDraft("")
    }
  }, [selectedLab, labs])

  const LAMBDA_URL = "https://53dhwuhsl8.execute-api.us-east-2.amazonaws.com/default/gradmate-ai-service"

  const generateEmail = async () => {
    if (!currentLab) return

    setGenerating(true)

    try {
      const apiKey = process.env.NEXT_PUBLIC_AI_SERVICE_KEY

      // Fetch logged-in user info
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Request payload
      const body: Record<string, any> = {
        lab_title: currentLab.name,
        professors: currentLab.professors.map((p) => p.name),
        school: schools.find((s) => s.id === selectedSchool)?.name || "",
      }

      if (user?.id) {
        body.user_id = user.id

        // Pull profile for enriched context
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, school, major")
          .eq("id", user.id)
          .single()

        body.student_name = profile?.name || undefined
        body.student_major = profile?.major || undefined
        // school already set but override if profile has one
        if (profile?.school) body.school = profile.school
      }

      console.log("Lambda payload", body)

      const res = await fetch(LAMBDA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey || "",
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Lambda error ${res.status}: ${errText}`)
      }

      const data = await res.json()
      setEmailDraft(data.email)
    } catch (error: any) {
      console.error("Error generating email:", error)
      setEmailDraft(`Error: ${error.message || "Unknown"}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Research Email Generator</h1>

      <Card>
        <CardHeader>
          <CardTitle>Automated Research Email Builder</CardTitle>
          <CardDescription>Generate professional emails to reach out to research labs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="school" className="text-sm font-medium">
                Select School
              </label>
              <Select
                value={selectedSchool}
                onValueChange={(val) => setSelectedSchool(val)}
                disabled={schools.length === 0}
              >
                <SelectTrigger id="school">
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="lab" className="text-sm font-medium">
                Select Lab
              </label>
              <Select value={selectedLab} onValueChange={setSelectedLab} disabled={loading || labs.length === 0}>
                <SelectTrigger id="lab">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading labs...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Select a lab" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {labs.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentLab && (
            <div className="rounded-md bg-muted p-4">
              <h3 className="font-medium mb-2">Lab Information</h3>
              <p className="text-sm font-medium">
                Research Area: <span className="font-normal">{currentLab.research_area}</span>
              </p>
              <p className="text-sm font-medium mt-2">
                Description: <span className="font-normal">{currentLab.description}</span>
              </p>
            </div>
          )}

          <Button onClick={generateEmail} disabled={!currentLab || generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Email...
              </>
            ) : (
              "Generate Email"
            )}
          </Button>

          {emailDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email-draft" className="text-sm font-medium">
                  Email Draft
                </label>
                <Textarea
                  id="email-draft"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Your generated email will appear here..."
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Professor Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Title</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLab?.professors.map((professor) => (
                      <TableRow key={professor.id}>
                        <TableCell>{professor.name}</TableCell>
                        <TableCell>{professor.email}</TableCell>
                        <TableCell>{professor.title}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
