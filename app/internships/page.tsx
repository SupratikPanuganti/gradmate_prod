"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Briefcase, Building, Calendar, Loader2, Mail, Plus, Search, CheckCircle2, Clock } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ProfileData {
  name: string
  school: string
  major: string
  minor: string
  gpa: string
  projects: string
}

interface Company {
  id: string
  name: string
  industry: string
  location: string
  website: string
  description: string
}

interface Application {
  id: string
  company: string
  position: string
  status: "applied" | "interview" | "offer" | "rejected" | "draft"
  dateApplied: string
  notes: string
}

export default function InternshipsPage() {
  const [activeTab, setActiveTab] = useState("email-generator")
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [position, setPosition] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [customDetails, setCustomDetails] = useState("")
  const [emailContent, setEmailContent] = useState("")
  const [generating, setGenerating] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  // Mock companies data
  const companies: Company[] = [
    {
      id: "c1",
      name: "TechInnovate",
      industry: "Technology",
      location: "San Francisco, CA",
      website: "techinnovate.example.com",
      description: "Leading software development company specializing in AI and machine learning solutions.",
    },
    {
      id: "c2",
      name: "BioGenetics",
      industry: "Biotechnology",
      location: "Boston, MA",
      website: "biogenetics.example.com",
      description: "Research-focused biotech firm developing cutting-edge genetic therapies.",
    },
    {
      id: "c3",
      name: "GreenEnergy Solutions",
      industry: "Renewable Energy",
      location: "Austin, TX",
      website: "greenenergy.example.com",
      description: "Sustainable energy company focused on solar and wind power technologies.",
    },
    {
      id: "c4",
      name: "FinanceForward",
      industry: "Finance",
      location: "New York, NY",
      website: "financeforward.example.com",
      description: "Financial technology company revolutionizing personal and business banking.",
    },
    {
      id: "c5",
      name: "MediaVision",
      industry: "Media",
      location: "Los Angeles, CA",
      website: "mediavision.example.com",
      description: "Digital media company creating innovative content across multiple platforms.",
    },
  ]

  // Load profile data and applications from localStorage on component mount
  useEffect(() => {
    const savedProfile = localStorage.getItem("gradmate-profile")
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile)
        setProfileData(parsed)
      } catch (error) {
        console.error("Error parsing profile data:", error)
      }
    }

    const savedApplications = localStorage.getItem("gradmate-applications")
    if (savedApplications) {
      try {
        const parsed = JSON.parse(savedApplications)
        setApplications(parsed)
      } catch (error) {
        console.error("Error parsing applications data:", error)
      }
    } else {
      // Set some mock applications if none exist
      const mockApplications: Application[] = [
        {
          id: "app1",
          company: "TechInnovate",
          position: "Software Engineering Intern",
          status: "interview",
          dateApplied: "2023-05-15",
          notes: "First interview scheduled for next week",
        },
        {
          id: "app2",
          company: "BioGenetics",
          position: "Research Assistant Intern",
          status: "applied",
          dateApplied: "2023-05-10",
          notes: "Application submitted through their careers portal",
        },
        {
          id: "app3",
          company: "FinanceForward",
          position: "Data Analysis Intern",
          status: "rejected",
          dateApplied: "2023-04-28",
          notes: "Received rejection email on May 12",
        },
      ]
      setApplications(mockApplications)
      localStorage.setItem("gradmate-applications", JSON.stringify(mockApplications))
    }
  }, [])

  const generateEmail = () => {
    if (!companyName || !position) return

    setGenerating(true)

    // Mock API call - in a real app, this would send the data to your AI service
    setTimeout(() => {
      const name = profileData?.name || "[Your Name]"
      const school = profileData?.school || "[Your University]"
      const major = profileData?.major || "[Your Major]"

      const mockEmail = `Subject: ${position} Opportunity at ${companyName}\n\nDear ${contactName || "Hiring Manager"},\n\nI hope this email finds you well. My name is ${name}, and I am a student at ${school} majoring in ${major}. I am writing to express my interest in the ${position} position at ${companyName}.\n\n${customDetails ? `${customDetails}\n\n` : ""}Through my coursework and projects, I have developed skills in [relevant skills] that I believe would make me a strong candidate for this role. ${profileData?.projects ? `Some of my relevant projects include ${profileData.projects.split("\n")[0]}.` : ""}\n\nI am particularly interested in ${companyName} because of [specific reason about the company]. I am impressed by your work in [specific area or project] and would be excited to contribute to your team.\n\nI have attached my resume for your review. I would welcome the opportunity to discuss how my skills and experiences align with your needs for this position.\n\nThank you for considering my application. I look forward to the possibility of working with ${companyName}.\n\nSincerely,\n${name}\n${contactEmail || "[Your Email]"}\n${profileData?.school || "[Your University]"}`

      setEmailContent(mockEmail)
      setGenerating(false)
    }, 1500)
  }

  const addApplication = () => {
    if (!companyName || !position) return

    const newApplication: Application = {
      id: `app${Date.now()}`,
      company: companyName,
      position: position,
      status: "draft",
      dateApplied: new Date().toISOString().split("T")[0],
      notes: customDetails || "",
    }

    const updatedApplications = [...applications, newApplication]
    setApplications(updatedApplications)
    localStorage.setItem("gradmate-applications", JSON.stringify(updatedApplications))

    // Clear form
    setCompanyName("")
    setPosition("")
    setContactName("")
    setContactEmail("")
    setCustomDetails("")
    setEmailContent("")
  }

  const updateApplicationStatus = (id: string, status: Application["status"]) => {
    const updatedApplications = applications.map((app) => (app.id === id ? { ...app, status } : app))
    setApplications(updatedApplications)
    localStorage.setItem("gradmate-applications", JSON.stringify(updatedApplications))
  }

  const filteredApplications = applications.filter(
    (app) =>
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.position.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusBadge = (status: Application["status"]) => {
    switch (status) {
      case "applied":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            Applied
          </Badge>
        )
      case "interview":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            Interview
          </Badge>
        )
      case "offer":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Offer
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Rejected
          </Badge>
        )
      case "draft":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
            Draft
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Briefcase className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Internship Application Helper</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email-generator">Email Generator</TabsTrigger>
          <TabsTrigger value="application-tracker">Application Tracker</TabsTrigger>
        </TabsList>

        <TabsContent value="email-generator" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Internship Email Generator</CardTitle>
              <CardDescription>Create personalized emails for internship applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Select value={companyName} onValueChange={setCompanyName}>
                    <SelectTrigger id="company">
                      <SelectValue placeholder="Select or type a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.name}>
                          {company.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other (Type Below)</SelectItem>
                    </SelectContent>
                  </Select>
                  {companyName === "other" && (
                    <Input
                      placeholder="Enter company name"
                      value={companyName === "other" ? "" : companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    placeholder="e.g., Software Engineering Intern"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contact Name (Optional)</Label>
                  <Input
                    id="contact-name"
                    placeholder="e.g., Dr. Jane Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Your Email</Label>
                  <Input
                    id="contact-email"
                    placeholder="your.email@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-details">Custom Details (Optional)</Label>
                <Textarea
                  id="custom-details"
                  placeholder="Add any specific details about your interest in this company or position..."
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={generateEmail} disabled={generating || !companyName || !position} className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Email...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Generate Email
                  </>
                )}
              </Button>

              {emailContent && (
                <div className="space-y-4">
                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-content">Generated Email</Label>
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(emailContent)}>
                        Copy to Clipboard
                      </Button>
                    </div>
                    <Textarea
                      id="email-content"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={addApplication}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add to Application Tracker
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application-tracker" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Tracker</CardTitle>
              <CardDescription>Track and manage your internship applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.length > 0 ? (
                      filteredApplications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-medium">{app.company}</TableCell>
                          <TableCell>{app.position}</TableCell>
                          <TableCell>{getStatusBadge(app.status)}</TableCell>
                          <TableCell>{app.dateApplied}</TableCell>
                          <TableCell>
                            <Select
                              value={app.status}
                              onValueChange={(value) => updateApplicationStatus(app.id, value as Application["status"])}
                            >
                              <SelectTrigger className="h-8 w-[130px]">
                                <SelectValue placeholder="Update status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="applied">Applied</SelectItem>
                                <SelectItem value="interview">Interview</SelectItem>
                                <SelectItem value="offer">Offer</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No applications found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{applications.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Interviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {applications.filter((app) => app.status === "interview").length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Offers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {applications.filter((app) => app.status === "offer").length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Application Timeline</h3>
                <div className="space-y-4">
                  {applications.length > 0 ? (
                    applications
                      .sort((a, b) => new Date(b.dateApplied).getTime() - new Date(a.dateApplied).getTime())
                      .slice(0, 5)
                      .map((app) => (
                        <div key={app.id} className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            {app.status === "applied" && <Mail className="h-5 w-5 text-primary" />}
                            {app.status === "interview" && <Calendar className="h-5 w-5 text-primary" />}
                            {app.status === "offer" && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            {app.status === "rejected" && <Clock className="h-5 w-5 text-primary" />}
                            {app.status === "draft" && <Building className="h-5 w-5 text-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {app.status === "applied" && "Applied to"}
                              {app.status === "interview" && "Interview with"}
                              {app.status === "offer" && "Received offer from"}
                              {app.status === "rejected" && "Rejected by"}
                              {app.status === "draft" && "Draft application for"}{" "}
                              <span className="font-semibold">{app.company}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">{app.position}</p>
                            <p className="text-xs text-muted-foreground mt-1">{app.dateApplied}</p>
                            {app.notes && <p className="text-xs mt-1 italic">{app.notes}</p>}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No applications yet</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setActiveTab("email-generator")}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Application
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
