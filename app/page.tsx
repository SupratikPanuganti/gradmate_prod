"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Book, Mail, Lightbulb, BookOpen, Briefcase } from "lucide-react"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("gradmate-user")
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setIsLoggedIn(parsedUser.isLoggedIn)
      } catch (error) {
        console.error("Error parsing user data:", error)
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <section className="py-12 md:py-16 lg:py-20">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                GradMate
              </span>
            </h1>
            <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
              Your one stop shop for automated academic success and career preparation
            </p>
            {!isLoggedIn && (
              <div className="flex gap-4 mt-4">
                <Button asChild size="lg">
                  <Link href="/sign-up">Get Started</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Research Email Generator
            </CardTitle>
            <CardDescription>Create professional emails to reach out to research labs</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col grow">
            <p className="mb-4 text-sm text-muted-foreground flex-grow">
              Select your target school and lab to generate a personalized email template for research opportunities.
            </p>
            <Button asChild className="w-full">
              <Link href="/research-emails">Get Started</Link>
            </Button>
            {!isLoggedIn && (
              <p className="mt-2 text-xs text-muted-foreground italic">Sign in for personalized results</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Essay Idea Generator
            </CardTitle>
            <CardDescription>Get personalized essay topic suggestions based on your profile</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col grow">
            <p className="mb-4 text-sm text-muted-foreground flex-grow">
              Input your essay prompt and get tailored brainstorming ideas based on your experiences and background.
            </p>
            <Button asChild className="w-full">
              <Link href="/essay-ideas">Get Started</Link>
            </Button>
            {!isLoggedIn && (
              <p className="mt-2 text-xs text-muted-foreground italic">Sign in for personalized results</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              College Essay Grader
            </CardTitle>
            <CardDescription>Get AI-powered feedback on your college essays</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col grow">
            <p className="mb-4 text-sm text-muted-foreground flex-grow">
              Upload your essay and receive detailed feedback on structure, clarity, style, and emotional impact.
            </p>
            <Button asChild className="w-full">
              <Link href="/essay-review">Get Started</Link>
            </Button>
            {!isLoggedIn && (
              <p className="mt-2 text-xs text-muted-foreground italic">Sign in for personalized results</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              SAT/ACT Practice Analysis
            </CardTitle>
            <CardDescription>Upload your practice tests and get personalized improvement strategies</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col grow">
            <p className="mb-4 text-sm text-muted-foreground flex-grow">
              Submit your answer key or full test to receive detailed analysis and targeted study recommendations.
            </p>
            <Button asChild className="w-full">
              <Link href="/sat-act">Get Started</Link>
            </Button>
            {!isLoggedIn && (
              <p className="mt-2 text-xs text-muted-foreground italic">Sign in for personalized results</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Internship Application Helper
            </CardTitle>
            <CardDescription>Generate personalized internship emails and track applications</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col grow">
            <p className="mb-4 text-sm text-muted-foreground flex-grow">
              Create professional outreach emails and manage your internship application process efficiently.
            </p>
            <Button asChild className="w-full">
              <Link href="/internships">Get Started</Link>
            </Button>
            {!isLoggedIn && (
              <p className="mt-2 text-xs text-muted-foreground italic">Sign in for personalized results</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
