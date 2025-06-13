"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  resume: File | null
  certifications: string[]
  projects: string
}

export default function Profile() {
  const router = useRouter()
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    school: "",
    major: "",
    minor: "",
    gpa: "",
    resume: null,
    certifications: [""],
    projects: "",
  })

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

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
          .select("name, school, major, minor, gpa")
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

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProfileData((prev) => ({ ...prev, resume: e.target.files![0] }))
    }
  }

  const handleCertificationChange = (index: number, value: string) => {
    const updatedCertifications = [...profileData.certifications]
    updatedCertifications[index] = value
    setProfileData((prev) => ({ ...prev, certifications: updatedCertifications }))
  }

  const addCertification = () => {
    setProfileData((prev) => ({
      ...prev,
      certifications: [...prev.certifications, ""],
    }))
  }

  const removeCertification = (index: number) => {
    const updatedCertifications = [...profileData.certifications]
    updatedCertifications.splice(index, 1)
    setProfileData((prev) => ({
      ...prev,
      certifications: updatedCertifications,
    }))
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
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile information to personalize your experience</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => alert("Import from LinkedIn coming soon!")}>Import from LinkedIn</Button>
          </CardHeader>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  name="major"
                  placeholder="Computer Science"
                  value={profileData.major}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minor">Minor (Optional)</Label>
                <Input
                  id="minor"
                  name="minor"
                  placeholder="Mathematics"
                  value={profileData.minor}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gpa">GPA</Label>
                <Input id="gpa" name="gpa" placeholder="3.8" value={profileData.gpa} onChange={handleInputChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">Resume</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById("resume-upload")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {profileData.resume ? "Change Resume" : "Upload Resume"}
                  </Button>
                  <input
                    id="resume-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleResumeChange}
                  />
                </div>
                {profileData.resume && (
                  <div className="mt-2 flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                    <span className="truncate">{profileData.resume.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setProfileData((prev) => ({ ...prev, resume: null }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Certifications</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCertification}>
                  Add Certification
                </Button>
              </div>
              <div className="space-y-2">
                {profileData.certifications.map((cert, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={cert}
                      onChange={(e) => handleCertificationChange(index, e.target.value)}
                      placeholder="e.g., AWS Certified Developer"
                    />
                    {profileData.certifications.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCertification(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projects">Projects</Label>
              <Textarea
                id="projects"
                name="projects"
                placeholder="Describe your projects, one per line"
                className="min-h-[120px]"
                value={profileData.projects}
                onChange={handleInputChange}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
