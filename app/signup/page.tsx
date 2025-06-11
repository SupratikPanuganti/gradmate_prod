"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function SignUp() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Debug: Log the input values
      console.log("Debug - Form Values:", { email, password })

      // Step 1: Create user
      console.log("Debug - Attempting to create user...")
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (signUpError) {
        console.log("Debug - Sign Up Error:", signUpError)
        throw signUpError
      }

      console.log("Debug - Sign Up Response:", signUpData)
      
      if (!signUpData?.user?.id) {
        console.log("Debug - No user ID in response:", signUpData)
        throw new Error("No user ID returned")
      }

      // Step 2: Sign in immediately after sign up
      console.log("Debug - Attempting to sign in...")
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.log("Debug - Sign In Error:", signInError)
        throw signInError
      }

      console.log("Debug - Sign In Response:", signInData)

      // Step 3: Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.log("Debug - Session Error:", sessionError)
        throw sessionError
      }

      console.log("Debug - Session:", session)

      if (!session) {
        throw new Error("No session after sign in")
      }

      // Step 4: Create or update profile
      console.log("Debug - Attempting to create/update profile for user:", signUpData.user.id)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: signUpData.user.id,
          email: email,
          full_name: "Test User",
          current_school: "Test University",
          graduation_year: "2024",
          gpa: "3.8",
          major: "Computer Science",
          minor: "Mathematics",
          interests: "AI, ML, Data Science"
        }, {
          onConflict: 'id'
        })
        .select()

      if (profileError) {
        console.log("Debug - Profile Error:", profileError)
        throw profileError
      }

      console.log("Debug - Profile created/updated successfully")

      // Step 5: Redirect
      router.push("/profile")
    } catch (error) {
      console.error("Error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to GradMate</CardTitle>
          <CardDescription>
            Create an account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  console.log("Debug - Email changed:", e.target.value)
                  setEmail(e.target.value)
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  console.log("Debug - Password changed:", e.target.value)
                  setPassword(e.target.value)
                }}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-sm text-center">
              Already have an account?{" "}
              <Link href="/signin" className="text-blue-500 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 