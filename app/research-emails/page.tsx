"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface Lab {
  id: string
  name: string
  researchArea: string
  description: string
  professors: Professor[]
}

interface Professor {
  name: string
  email: string
  title: string
}

export default function ResearchEmails() {
  const [selectedSchool, setSelectedSchool] = useState("gt")
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLab, setSelectedLab] = useState("")
  const [currentLab, setCurrentLab] = useState<Lab | null>(null)
  const [emailDraft, setEmailDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Fetch labs when school changes
  useEffect(() => {
    const fetchLabs = async () => {
      setLoading(true)
      try {
        // In a real app, this would be an actual API call
        // const response = await fetch(`/api/labs?school=${selectedSchool}`)
        // const data = await response.json()

        // Mock data for demonstration
        const mockLabs: Lab[] = [
          {
            id: "lab1",
            name: "Machine Learning Lab",
            researchArea: "Artificial Intelligence",
            description: "Focused on developing novel machine learning algorithms for real-world applications.",
            professors: [
              { name: "Dr. Jane Smith", email: "jsmith@gatech.edu", title: "Associate Professor" },
              { name: "Dr. Robert Chen", email: "rchen@gatech.edu", title: "Assistant Professor" },
            ],
          },
          {
            id: "lab2",
            name: "Biomedical Engineering Lab",
            researchArea: "Medical Devices",
            description: "Researching innovative medical devices and technologies for healthcare applications.",
            professors: [{ name: "Dr. Michael Johnson", email: "mjohnson@gatech.edu", title: "Professor" }],
          },
          {
            id: "lab3",
            name: "Robotics and Autonomous Systems Lab",
            researchArea: "Robotics",
            description: "Developing next-generation robotics and autonomous systems for various industries.",
            professors: [
              { name: "Dr. Sarah Williams", email: "swilliams@gatech.edu", title: "Professor" },
              { name: "Dr. David Lee", email: "dlee@gatech.edu", title: "Research Scientist" },
            ],
          },
        ]

        setLabs(mockLabs)
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

  const generateEmail = async () => {
    if (!currentLab) return

    setGenerating(true)
    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labName: currentLab.name,
          researchArea: currentLab.researchArea,
          labDescription: currentLab.description,
          userProfile: {
            name: "Test User", // replace with real user data later
            year: "Junior",
            university: "Georgia Tech",
            major: "Computer Science",
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setEmailDraft(data.email)
      } else {
        console.error("API error:", data.error)
      }
      setGenerating(false)
    } catch (error) {
      console.error("Error generating email:", error)
      setGenerating(false)
    }
  }

  const schools = [
    { value: "gt", label: "Georgia Tech" },
    { value: "mit", label: "MIT" },
    { value: "stanford", label: "Stanford University" },
    { value: "harvard", label: "Harvard University" },
  ]

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
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger id="school">
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.value} value={school.value}>
                      {school.label}
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
                Research Area: <span className="font-normal">{currentLab.researchArea}</span>
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
                      <TableRow key={professor.email}>
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
