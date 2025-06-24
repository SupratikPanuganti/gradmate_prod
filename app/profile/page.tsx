"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, X, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"

interface ProfileData {
  name: string
  school: string
  major: string
  minor: string
  gpa: string
  resumePath: string | null
  certifications: string[]
  projects: string
  interests: string
}

export default function Profile() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    school: "",
    major: "",
    minor: "",
    gpa: "",
    resumePath: null,
    certifications: [""],
    projects: "",
    interests: "",
  })

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Signed URL preview for private résumé bucket
  const [resumePreview, setResumePreview] = useState<string | null>(null)

  const handleCertificationsChange = (value: string) => {
    // Split the comma-separated string into an array
    const certs = value.split(",").map((cert) => cert.trim())
    setProfileData((prev) => ({ ...prev, certifications: certs }))
  }

  // Refresh signed URL whenever resumePath changes
  useEffect(() => {
    const getSigned = async () => {
      if (profileData.resumePath) {
        const { data } = await supabase.storage
          .from("resumes")
          .createSignedUrl(profileData.resumePath, 60 * 60)
        setResumePreview(data?.signedUrl || null)
      } else {
        setResumePreview(null)
      }
    }
    getSigned()
  }, [profileData.resumePath])

  // Handle upload + autofill
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const file = e.target.files[0]

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const filePath = `${user.id}/resume.pdf`

    const { error } = await supabase.storage
      .from("resumes")
      .upload(filePath, file, { upsert: true, contentType: "application/pdf" })
    if (error) {
      console.error("Resume upload error", error)
      return
    }

    setProfileData((prev) => ({ ...prev, resumePath: filePath }))

    // Call parsing stub – you can swap with Doc-IO later
    try {
      const resp = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      })
      if (resp.ok) {
        const parsed = await resp.json()
        console.log("Parsed resume data", parsed)
        if (parsed.error) {
          console.error("Resume parse error", parsed)
          return
        }
        const normalised: Partial<ProfileData> = { ...parsed }
        // Ensure certifications array shape
        if (Array.isArray(parsed.certifications)) {
          normalised.certifications = parsed.certifications.length ? parsed.certifications : [""]
        }

        // Convert projects array -> newline string if needed
        if (Array.isArray(parsed.projects)) {
          normalised.projects = parsed.projects.join("\n")
        }

        setProfileData((prev) => ({
          ...prev,
          ...normalised,
        }))
      } else {
        const errText = await resp.text()
        console.error("Resume parse request failed", resp.status, errText)
      }
    } catch (err) {
      console.warn("Resume parse failed", err)
    }
  }

  // Check auth and fetch profile from Supabase
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/sign-in")
        return
      }

      setUserId(user.id)
      setIsLoggedIn(true)

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, school, major, minor, gpa, resume_path, projects, interests, certifications")
          .eq("id", user.id)
          .single()

        if (error) {
          console.error("Error fetching profile:", error)
        } else if (data) {
          setProfileData((prev) => ({
            ...prev,
            name: data.name || "",
            school: data.school || "",
            major: data.major || "",
            minor: data.minor || "",
            gpa: data.gpa || "",
            resumePath: data.resume_path || null,
            projects: data.projects || "",
            interests: data.interests || "",
            // Ensure certifications is always an array, even if null/empty in DB
            certifications: Array.isArray(data.certifications) ? data.certifications : [""],
          }))

          // Update localStorage user name for navbar display
          const userData = localStorage.getItem("gradmate-user")
          if (userData) {
            try {
              const parsed = JSON.parse(userData)
              parsed.name = data.name || parsed.name
              localStorage.setItem("gradmate-user", JSON.stringify(parsed))
            } catch (err) {
              console.error("Error updating local user cache:", err)
            }
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        name: profileData.name,
        school: profileData.school,
        major: profileData.major,
        minor: profileData.minor,
        gpa: profileData.gpa,
        resume_path: profileData.resumePath,
        projects: profileData.projects,
        interests: profileData.interests,
        certifications: profileData.certifications.filter((c) => c), // Filter out empty strings
        updated_at: new Date().toISOString(),
      })

      if (error) throw error

      // Update local username cache for navbar
      const userCache = localStorage.getItem("gradmate-user")
      if (userCache) {
        try {
          const parsed = JSON.parse(userCache)
          parsed.name = profileData.name
          localStorage.setItem("gradmate-user", JSON.stringify(parsed))
        } catch (_) {}
      }

      router.push("/")
    } catch (err) {
      console.error("Error saving profile:", err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Alert>
          <AlertDescription>Please sign in to access your profile.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Your Profile</h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Upload your résumé to auto-fill or edit fields manually</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="resume-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleResumeUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("resume-upload")?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {profileData.resumePath ? "Replace résumé" : "Upload résumé & autofill"}
              </Button>
            </div>
          </CardHeader>

          {profileData.resumePath && (
            <Alert className="mx-6 mb-4 bg-muted/50">
              Résumé uploaded –
              {resumePreview && (
                <a href={resumePreview} target="_blank" rel="noopener" className="underline ml-1">
                  preview
                </a>
              )}
            </Alert>
          )}

          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  value={profileData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school">School</Label>
                <Input
                  id="school"
                  name="school"
                  placeholder="University of Example"
                  value={profileData.school}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Major & Minor */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  name="major"
                  placeholder="e.g., Computer Science"
                  value={profileData.major}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minor">Minor</Label>
                <Input
                  id="minor"
                  name="minor"
                  placeholder="e.g., Mathematics"
                  value={profileData.minor}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* GPA & Interests */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gpa">GPA</Label>
                <Input
                  id="gpa"
                  name="gpa"
                  placeholder="e.g., 4.0"
                  value={profileData.gpa}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interests">Professional Interests</Label>
                <Input
                  id="interests"
                  name="interests"
                  placeholder="e.g., Machine Learning, AI Ethics"
                  value={profileData.interests}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Certifications */}
            <div className="space-y-2">
              <Label htmlFor="certifications">Certifications</Label>
              <Input
                id="certifications"
                name="certifications"
                placeholder="e.g., PCAP, OCI Foundations (comma-separated)"
                value={
                  Array.isArray(profileData.certifications) ? profileData.certifications.join(", ") : ""
                }
                onChange={(e) => handleCertificationsChange(e.target.value)}
              />
            </div>

            {/* Projects */}
            <div className="space-y-2">
              <Label htmlFor="projects">Key Projects</Label>
              <Textarea
                id="projects"
                name="projects"
                placeholder="Describe 1-3 of your most relevant projects, each on a new line."
                value={profileData.projects}
                onChange={handleInputChange}
                rows={4}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Profile
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
