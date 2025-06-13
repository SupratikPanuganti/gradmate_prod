"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { User, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface UserData {
  name: string
  email: string
  isLoggedIn: boolean
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)

  // This effect runs on component mount and when the path changes
  // to ensure the navbar always reflects the current auth state
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("gradmate-user")
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (error) {
        console.error("Error parsing user data:", error)
      }
    } else {
      setUser(null)
    }
  }, [pathname]) // Re-check when pathname changes

  const handleSignOut = () => {
    localStorage.removeItem("gradmate-user")
    setUser(null)
    router.push("/sign-in")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GradMate</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          {user?.isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{user.name ? getInitials(user.name) : "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuItem disabled>{user.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/research-emails">Research Emails</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/essay-ideas">Essay Ideas</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/essay-review">Essay Review</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sat-act">SAT/ACT Help</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/internships">Internships</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">
                <User className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
