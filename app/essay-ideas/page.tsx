"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Lightbulb, User, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface ProfileData {
  name: string
  school: string
  major: string
  minor: string
  gpa: string
  certifications: string[]
  projects: string
}

interface EssayIdea {
  title: string
  description: string
  personalConnection: string
  keyPoints: string[]
  approach: string
}

export default function EssayIdeas() {
  const [prompt, setPrompt] = useState("")
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [ideas, setIdeas] = useState<EssayIdea[]>([])
  const [generating, setGenerating] = useState(false)

  // Load profile data from localStorage on component mount
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
  }, [])

  const generateIdeas = async () => {
    if (!prompt.trim()) return

    setGenerating(true)

    // Mock API call - in a real app, this would send the prompt and profile data to your AI service
    setTimeout(() => {
      const mockIdeas: EssayIdea[] = [
        {
          title: "The Research That Changed My Perspective",
          description:
            "Write about a specific research project or academic experience that fundamentally shifted your worldview or career aspirations.",
          personalConnection: profileData?.projects
            ? `Based on your projects: "${profileData.projects.split("\n")[0] || "your documented projects"}", you could explore how this work opened new intellectual pathways.`
            : "Connect this to any research experience, class project, or independent study you've undertaken.",
          keyPoints: [
            "Describe the initial hypothesis or question that intrigued you",
            "Detail the moment of discovery or realization",
            "Explain how this experience influenced your academic/career goals",
            "Connect to your future aspirations in " + (profileData?.major || "your field"),
          ],
          approach:
            "Use a narrative structure with a clear before/after transformation. Start with your initial understanding, build tension through the research process, and conclude with your evolved perspective.",
        },
        {
          title: "Bridging Two Worlds",
          description:
            "Explore how your unique combination of interests creates a distinctive perspective that you'll bring to college.",
          personalConnection:
            profileData?.major && profileData?.minor
              ? `Your combination of ${profileData.major} and ${profileData.minor} creates a unique interdisciplinary perspective.`
              : profileData?.major
                ? `Your focus in ${profileData.major} combined with your other interests creates a unique perspective.`
                : "Consider how your academic interests combine with your personal passions or background.",
          keyPoints: [
            "Identify the two 'worlds' or areas of interest you're bridging",
            "Provide specific examples of how you've already combined these interests",
            "Explain the value of this interdisciplinary approach",
            "Describe how you'll continue this integration in college",
          ],
          approach:
            "Use concrete examples and avoid abstract language. Show, don't tell, how your unique combination of interests has led to innovative thinking or problem-solving.",
        },
        {
          title: "The Challenge That Defined My Growth",
          description:
            "Reflect on a significant obstacle you've overcome and how it shaped your character and resilience.",
          personalConnection: profileData?.gpa
            ? `Consider academic challenges you've faced while maintaining your ${profileData.gpa} GPA, or personal obstacles that tested your determination.`
            : "Think about academic, personal, or extracurricular challenges that pushed you to grow.",
          keyPoints: [
            "Set the scene: what was the challenge and why was it significant?",
            "Detail your response: what actions did you take?",
            "Reflect on growth: what did you learn about yourself?",
            "Connect to future: how will this resilience serve you in college?",
          ],
          approach:
            "Focus on your internal journey and growth rather than just the external challenge. Admissions officers want to see self-reflection and maturity.",
        },
        {
          title: "Innovation in Action",
          description:
            "Showcase a time when you identified a problem and created a solution, demonstrating your initiative and creativity.",
          personalConnection: profileData?.projects
            ? `Draw from your project experience: "${profileData.projects.split("\n")[0] || "your documented projects"}" or similar innovative work.`
            : "Consider any time you've created something new, improved a process, or solved a problem creatively.",
          keyPoints: [
            "Identify the problem: what gap or need did you notice?",
            "Describe your solution: what did you create or implement?",
            "Explain your process: how did you develop and refine your idea?",
            "Discuss impact: what changed as a result of your innovation?",
          ],
          approach:
            "Use specific details and metrics where possible. Show your problem-solving process and don't be afraid to mention failures or iterations that led to success.",
        },
        {
          title: "Learning Beyond the Classroom",
          description:
            "Explore how your self-directed learning or extracurricular pursuits have shaped your intellectual curiosity.",
          personalConnection:
            profileData?.certifications && profileData.certifications.filter((cert) => cert.trim()).length > 0
              ? `Your certifications in ${profileData.certifications.filter((cert) => cert.trim()).join(", ")} show your commitment to learning beyond formal requirements.`
              : "Consider any skills you've taught yourself, online courses you've taken, or independent projects you've pursued.",
          keyPoints: [
            "Describe what motivated you to learn independently",
            "Detail the learning process and any obstacles you overcame",
            "Explain how this knowledge has been applied or will be useful",
            "Connect to your academic goals and how you'll continue this self-directed learning in college",
          ],
          approach:
            "Emphasize your intrinsic motivation and curiosity. Show how you take ownership of your education and aren't just a passive recipient of knowledge.",
        },
      ]

      setIdeas(mockIdeas)
      setGenerating(false)
    }, 2000)
  }

  const hasProfileData =
    profileData &&
    (profileData.name ||
      profileData.school ||
      profileData.major ||
      profileData.minor ||
      profileData.gpa ||
      profileData.projects ||
      (profileData.certifications && profileData.certifications.some((cert) => cert.trim())))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Essay Idea Generator</h1>
      </div>

      {!hasProfileData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Complete your{" "}
            <Link href="/profile" className="font-medium text-primary hover:underline">
              profile
            </Link>{" "}
            to get more personalized essay ideas based on your background and experiences.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Personalized Essay Brainstorming</CardTitle>
          <CardDescription>
            Enter your essay prompt and get tailored ideas based on your profile and experiences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">Essay Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste your college essay prompt here... For example: 'Tell us about a time when you had to think or act quickly to overcome a challenge.'"
              className="min-h-[120px]"
            />
          </div>

          {hasProfileData && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4" />
                <span className="font-medium text-sm">Your Profile Information</span>
              </div>
              <div className="grid gap-2 text-sm">
                {profileData?.name && (
                  <div>
                    <span className="font-medium">Name:</span> {profileData.name}
                  </div>
                )}
                {profileData?.school && (
                  <div>
                    <span className="font-medium">School:</span> {profileData.school}
                  </div>
                )}
                {profileData?.major && (
                  <div>
                    <span className="font-medium">Major:</span> {profileData.major}
                    {profileData?.minor && <span> | Minor: {profileData.minor}</span>}
                  </div>
                )}
                {profileData?.gpa && (
                  <div>
                    <span className="font-medium">GPA:</span> {profileData.gpa}
                  </div>
                )}
                {profileData?.certifications && profileData.certifications.filter((cert) => cert.trim()).length > 0 && (
                  <div>
                    <span className="font-medium">Certifications:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profileData.certifications
                        .filter((cert) => cert.trim())
                        .map((cert, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {cert}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
                {profileData?.projects && (
                  <div>
                    <span className="font-medium">Projects:</span>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {profileData.projects.length > 100
                        ? `${profileData.projects.substring(0, 100)}...`
                        : profileData.projects}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={generateIdeas} disabled={!prompt.trim() || generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Personalized Ideas...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Generate Essay Ideas
              </>
            )}
          </Button>

          {ideas.length > 0 && (
            <div className="space-y-6">
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4">Personalized Essay Ideas</h3>
                <div className="space-y-6">
                  {ideas.map((idea, index) => (
                    <Card key={index} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <CardTitle className="text-lg">{idea.title}</CardTitle>
                        <CardDescription>{idea.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3">
                          <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
                            Personal Connection
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200">{idea.personalConnection}</p>
                        </div>

                        <div>
                          <h4 className="font-medium text-sm mb-2">Key Points to Address</h4>
                          <ul className="space-y-1">
                            {idea.keyPoints.map((point, pointIndex) => (
                              <li key={pointIndex} className="flex items-start gap-2 text-sm">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary font-medium">
                                  {pointIndex + 1}
                                </span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-3">
                          <h4 className="font-medium text-sm mb-2 text-green-900 dark:text-green-100">
                            Recommended Approach
                          </h4>
                          <p className="text-sm text-green-800 dark:text-green-200">{idea.approach}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
