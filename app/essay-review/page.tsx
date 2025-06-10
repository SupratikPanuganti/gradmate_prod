"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, Upload } from "lucide-react"

interface FeedbackScore {
  category: string
  score: number
  description: string
}

interface EssayFeedback {
  scores: FeedbackScore[]
  suggestions: string[]
}

export default function EssayReview() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [feedback, setFeedback] = useState<EssayFeedback | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      handleFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      handleFile(selectedFile)
    }
  }

  const handleFile = (selectedFile: File) => {
    const validTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/pdf",
    ]

    if (validTypes.includes(selectedFile.type)) {
      setFile(selectedFile)
      setFeedback(null)
    } else {
      alert("Please upload a .doc, .docx, .txt, or .pdf file")
    }
  }

  const analyzeEssay = () => {
    if (!file) return

    setAnalyzing(true)

    // Mock API call - in a real app, you would send the file to your backend
    setTimeout(() => {
      // Mock feedback data
      const mockFeedback: EssayFeedback = {
        scores: [
          {
            category: "Structure",
            score: 8,
            description:
              "Your essay has a clear introduction, body, and conclusion. Consider strengthening transitions between paragraphs.",
          },
          {
            category: "Clarity",
            score: 7,
            description: "Your ideas are generally well-expressed, but some sentences could be more concise.",
          },
          {
            category: "Style",
            score: 9,
            description: "Excellent use of vocabulary and varied sentence structure. Your voice comes through clearly.",
          },
          {
            category: "Emotional Impact",
            score: 6,
            description: "The essay could benefit from more personal anecdotes to create emotional connection.",
          },
        ],
        suggestions: [
          "Consider adding a more compelling hook in your introduction.",
          "Paragraph 3 could be strengthened with a specific example.",
          "The conclusion would benefit from connecting back to your opening theme.",
          "Try varying sentence length more to create rhythm in your writing.",
          "Add more sensory details when describing your experiences.",
        ],
      }

      setFeedback(mockFeedback)
      setAnalyzing(false)
    }, 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">College Essay Grader</h1>

      <Card>
        <CardHeader>
          <CardTitle>AI Essay Review</CardTitle>
          <CardDescription>Upload your essay and get detailed feedback to improve your writing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <h3 className="text-lg font-medium">Upload your essay</h3>
              <p className="text-sm text-muted-foreground mb-2">Drag and drop your file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports .doc, .docx, .txt, and .pdf files</p>
              <div className="mt-4">
                <label htmlFor="file-upload">
                  <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                    Select File
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".doc,.docx,.txt,.pdf"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md bg-muted p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-background p-2">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setFile(null)
                  setFeedback(null)
                }}
                variant="ghost"
                size="sm"
              >
                Remove
              </Button>
            </div>
          )}

          <Button onClick={analyzeEssay} disabled={!file || analyzing} className="w-full">
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Essay...
              </>
            ) : (
              "Analyze Essay"
            )}
          </Button>

          {feedback && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Essay Feedback</h3>

                <div className="space-y-4">
                  {feedback.scores.map((score) => (
                    <div key={score.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{score.category}</span>
                        <span className="text-sm font-medium">{score.score}/10</span>
                      </div>
                      <Progress value={score.score * 10} className="h-2" />
                      <p className="text-sm text-muted-foreground">{score.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Suggestions</h3>
                <ul className="space-y-2">
                  {feedback.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
