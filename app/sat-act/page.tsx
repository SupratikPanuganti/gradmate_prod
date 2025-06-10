"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Upload, FileText, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Question {
  id: number
  section: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty: "Easy" | "Medium" | "Hard"
}

interface TestScore {
  section: string
  score: number
  totalQuestions: number
  correctAnswers: number
  percentile: number
}

interface TestAnalysis {
  testType: "SAT" | "ACT"
  testName: string
  testDate: string
  overallScore: number
  maxPossibleScore: number
  scores: TestScore[]
  wrongQuestions: {
    question: Question
    userAnswer: string
  }[]
  totalQuestions: number
}

interface PreloadedTest {
  id: string
  name: string
  type: "SAT" | "ACT"
  date: string
  sections: string[]
  totalQuestions: number
}

export default function SatActPage() {
  const [activeTab, setActiveTab] = useState("test-analysis")
  const [analysisMode, setAnalysisMode] = useState<"select" | "upload">("select")
  const [selectedTest, setSelectedTest] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null)
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<TestAnalysis | null>(null)
  const [testType, setTestType] = useState<"SAT" | "ACT">("SAT")
  const [showAnswers, setShowAnswers] = useState<{ [key: number]: boolean }>({})

  // Mock preloaded tests
  const preloadedTests: PreloadedTest[] = [
    {
      id: "sat_2023_may",
      name: "SAT Practice Test - May 2023",
      type: "SAT",
      date: "May 2023",
      sections: ["Reading and Writing", "Math"],
      totalQuestions: 96,
    },
    {
      id: "sat_2023_march",
      name: "SAT Practice Test - March 2023",
      type: "SAT",
      date: "March 2023",
      sections: ["Reading and Writing", "Math"],
      totalQuestions: 96,
    },
    {
      id: "act_2023_june",
      name: "ACT Practice Test - June 2023",
      type: "ACT",
      date: "June 2023",
      sections: ["English", "Math", "Reading", "Science"],
      totalQuestions: 215,
    },
    {
      id: "act_2023_april",
      name: "ACT Practice Test - April 2023",
      type: "ACT",
      date: "April 2023",
      sections: ["English", "Math", "Reading", "Science"],
      totalQuestions: 215,
    },
  ]

  // Mock questions with explanations
  const mockQuestions: Question[] = [
    {
      id: 1,
      section: "Reading and Writing",
      question: "Which choice most logically completes the text?",
      options: ["A) However", "B) Therefore", "C) Moreover", "D) Nevertheless"],
      correctAnswer: "B",
      explanation:
        "The sentence requires a logical connector that shows cause and effect. 'Therefore' is the most appropriate choice as it indicates that the conclusion follows logically from the previous statement.",
      difficulty: "Medium",
    },
    {
      id: 2,
      section: "Math",
      question: "If 3x + 5 = 17, what is the value of x?",
      options: ["A) 2", "B) 4", "C) 6", "D) 8"],
      correctAnswer: "B",
      explanation: "To solve 3x + 5 = 17, subtract 5 from both sides: 3x = 12. Then divide both sides by 3: x = 4.",
      difficulty: "Easy",
    },
    {
      id: 3,
      section: "Reading and Writing",
      question: "The author's primary purpose in this passage is to:",
      options: ["A) Criticize", "B) Inform", "C) Persuade", "D) Entertain"],
      correctAnswer: "B",
      explanation:
        "The passage presents factual information without taking a strong stance or trying to convince the reader of a particular viewpoint, making 'inform' the correct answer.",
      difficulty: "Medium",
    },
    {
      id: 4,
      section: "Math",
      question: "What is the slope of the line passing through points (2, 3) and (6, 11)?",
      options: ["A) 1", "B) 2", "C) 3", "D) 4"],
      correctAnswer: "B",
      explanation: "Using the slope formula: m = (y₂ - y₁)/(x₂ - x₁) = (11 - 3)/(6 - 2) = 8/4 = 2.",
      difficulty: "Medium",
    },
    {
      id: 5,
      section: "Reading and Writing",
      question: "Which word best fits the context of the sentence?",
      options: ["A) Abundant", "B) Scarce", "C) Moderate", "D) Excessive"],
      correctAnswer: "A",
      explanation:
        "Given the context describing a plentiful supply, 'abundant' is the most appropriate choice to convey the idea of plenty or large quantity.",
      difficulty: "Easy",
    },
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "test" | "answerKey") => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === "test") {
        setFile(e.target.files[0])
      } else {
        setAnswerKeyFile(e.target.files[0])
      }
    }
  }

  const handleUserAnswerChange = (index: number, value: string) => {
    const newUserAnswers = [...userAnswers]
    newUserAnswers[index] = value
    setUserAnswers(newUserAnswers)
  }

  const initializeAnswers = (questionCount: number) => {
    setUserAnswers(Array(questionCount).fill(""))
  }

  const analyzeTest = () => {
    setAnalyzing(true)

    // Mock API call - in a real app, this would process the test
    setTimeout(() => {
      const selectedTestData = preloadedTests.find((test) => test.id === selectedTest)
      const questionsToAnalyze = mockQuestions.slice(0, 5) // Using 5 sample questions

      // Generate mock wrong answers
      const wrongQuestions = questionsToAnalyze
        .map((question, index) => ({
          question,
          userAnswer: userAnswers[index] || "C", // Mock user answer
        }))
        .filter((item) => item.userAnswer !== item.question.correctAnswer)

      const correctCount = questionsToAnalyze.length - wrongQuestions.length
      const totalQuestions = selectedTestData?.totalQuestions || questionsToAnalyze.length

      const mockAnalysis: TestAnalysis = {
        testType: selectedTestData?.type || testType,
        testName: selectedTestData?.name || "Custom Test",
        testDate: new Date().toLocaleDateString(),
        overallScore:
          selectedTestData?.type === "SAT"
            ? Math.round((correctCount / questionsToAnalyze.length) * 800) + 800
            : Math.round((correctCount / questionsToAnalyze.length) * 36),
        maxPossibleScore: selectedTestData?.type === "SAT" ? 1600 : 36,
        scores: [
          {
            section: "Reading and Writing",
            score:
              selectedTestData?.type === "SAT"
                ? Math.round((correctCount / questionsToAnalyze.length) * 400) + 400
                : Math.round((correctCount / questionsToAnalyze.length) * 18),
            totalQuestions: Math.ceil(questionsToAnalyze.length / 2),
            correctAnswers: Math.ceil(correctCount / 2),
            percentile: Math.round((correctCount / questionsToAnalyze.length) * 100),
          },
          {
            section: "Math",
            score:
              selectedTestData?.type === "SAT"
                ? Math.round((correctCount / questionsToAnalyze.length) * 400) + 400
                : Math.round((correctCount / questionsToAnalyze.length) * 18),
            totalQuestions: Math.floor(questionsToAnalyze.length / 2),
            correctAnswers: Math.floor(correctCount / 2),
            percentile: Math.round((correctCount / questionsToAnalyze.length) * 100),
          },
        ],
        wrongQuestions,
        totalQuestions: questionsToAnalyze.length,
      }

      setAnalysis(mockAnalysis)
      setAnalyzing(false)
    }, 2000)
  }

  const toggleAnswerVisibility = (questionId: number) => {
    setShowAnswers((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }))
  }

  const getDifficultyBadge = (difficulty: Question["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Easy</Badge>
      case "Medium":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Medium</Badge>
        )
      case "Hard":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Hard</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">SAT/ACT Practice Analysis</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="test-analysis">Test Analysis</TabsTrigger>
          <TabsTrigger value="answer-key">Answer Key & Explanations</TabsTrigger>
        </TabsList>

        <TabsContent value="test-analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Analysis Tool</CardTitle>
              <CardDescription>
                Choose a preloaded test or upload your own test and answer key for analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Analysis Mode</Label>
                <RadioGroup
                  value={analysisMode}
                  onValueChange={(value) => setAnalysisMode(value as "select" | "upload")}
                  className="flex space-x-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="select" id="select" />
                    <Label htmlFor="select">Select Preloaded Test</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upload" id="upload" />
                    <Label htmlFor="upload">Upload Custom Test</Label>
                  </div>
                </RadioGroup>
              </div>

              {analysisMode === "select" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-select">Select Test</Label>
                    <Select value={selectedTest} onValueChange={setSelectedTest}>
                      <SelectTrigger id="test-select">
                        <SelectValue placeholder="Choose a practice test" />
                      </SelectTrigger>
                      <SelectContent>
                        {preloadedTests.map((test) => (
                          <SelectItem key={test.id} value={test.id}>
                            {test.name} ({test.totalQuestions} questions)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTest && (
                    <div className="rounded-lg bg-muted p-4">
                      <h3 className="font-medium mb-2">Test Information</h3>
                      {(() => {
                        const test = preloadedTests.find((t) => t.id === selectedTest)
                        return (
                          test && (
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="font-medium">Type:</span> {test.type}
                              </p>
                              <p>
                                <span className="font-medium">Date:</span> {test.date}
                              </p>
                              <p>
                                <span className="font-medium">Sections:</span> {test.sections.join(", ")}
                              </p>
                              <p>
                                <span className="font-medium">Total Questions:</span> {test.totalQuestions}
                              </p>
                            </div>
                          )
                        )
                      })()}
                    </div>
                  )}

                  {selectedTest && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Your Answers (Sample Questions)</Label>
                        <Button variant="outline" size="sm" onClick={() => initializeAnswers(mockQuestions.length)}>
                          Initialize Answer Sheet
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-5">
                        {mockQuestions.map((_, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-8 text-sm font-medium">{index + 1}.</span>
                            <Input
                              value={userAnswers[index] || ""}
                              onChange={(e) => handleUserAnswerChange(index, e.target.value.toUpperCase())}
                              placeholder="A-D"
                              maxLength={1}
                              className="w-16 text-center"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Note: This demo shows 5 sample questions. The full test would include all{" "}
                        {preloadedTests.find((t) => t.id === selectedTest)?.totalQuestions} questions.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {analysisMode === "upload" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Test Type</Label>
                    <RadioGroup
                      value={testType}
                      onValueChange={(value) => setTestType(value as "SAT" | "ACT")}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SAT" id="sat-upload" />
                        <Label htmlFor="sat-upload">SAT</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ACT" id="act-upload" />
                        <Label htmlFor="act-upload">ACT</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <Label>Upload Test</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Upload your test file</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("test-upload")?.click()}
                        >
                          Select Test File
                        </Button>
                        <input
                          id="test-upload"
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, "test")}
                        />
                      </div>
                      {file && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Label>Upload Answer Key</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Upload your answer key</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("answer-key-upload")?.click()}
                        >
                          Select Answer Key
                        </Button>
                        <input
                          id="answer-key-upload"
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.txt"
                          onChange={(e) => handleFileChange(e, "answerKey")}
                        />
                      </div>
                      {answerKeyFile && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{answerKeyFile.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Or Type Your Answers</Label>
                    <div className="grid gap-2 md:grid-cols-10">
                      {Array(20)
                        .fill(0)
                        .map((_, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <span className="text-xs font-medium w-6">{index + 1}.</span>
                            <Input
                              value={userAnswers[index] || ""}
                              onChange={(e) => handleUserAnswerChange(index, e.target.value.toUpperCase())}
                              placeholder="A"
                              maxLength={1}
                              className="w-12 h-8 text-center text-xs"
                            />
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your answers for the first 20 questions (demo purposes)
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={analyzeTest}
                disabled={
                  analyzing ||
                  (analysisMode === "select" && (!selectedTest || userAnswers.every((a) => !a))) ||
                  (analysisMode === "upload" && !file && userAnswers.every((a) => !a))
                }
                className="w-full"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Test...
                  </>
                ) : (
                  "Analyze Test"
                )}
              </Button>

              {analysis && (
                <div className="mt-8 space-y-6">
                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Test Results: {analysis.testName}</h3>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Overall Score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{analysis.overallScore}</div>
                          <Progress
                            value={(analysis.overallScore / analysis.maxPossibleScore) * 100}
                            className="h-2 mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            out of {analysis.maxPossibleScore} possible
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Questions Correct</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {analysis.totalQuestions - analysis.wrongQuestions.length}/{analysis.totalQuestions}
                          </div>
                          <Progress
                            value={
                              ((analysis.totalQuestions - analysis.wrongQuestions.length) / analysis.totalQuestions) *
                              100
                            }
                            className="h-2 mt-2"
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Questions Wrong</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-red-600">{analysis.wrongQuestions.length}</div>
                          <p className="text-xs text-muted-foreground mt-1">Need to review</p>
                        </CardContent>
                      </Card>
                    </div>

                    {analysis.wrongQuestions.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium">Questions You Got Wrong</h4>
                        <div className="space-y-4">
                          {analysis.wrongQuestions.map((wrongQ, index) => (
                            <Card key={wrongQ.question.id} className="border-l-4 border-l-red-500">
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">
                                    Question {wrongQ.question.id} - {wrongQ.question.section}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    {getDifficultyBadge(wrongQ.question.difficulty)}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleAnswerVisibility(wrongQ.question.id)}
                                    >
                                      {showAnswers[wrongQ.question.id] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <p className="font-medium">{wrongQ.question.question}</p>
                                <div className="grid gap-2">
                                  {wrongQ.question.options.map((option, optIndex) => (
                                    <div
                                      key={optIndex}
                                      className={`p-2 rounded text-sm ${
                                        option.charAt(0) === wrongQ.question.correctAnswer
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                          : option.charAt(0) === wrongQ.userAnswer
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                            : "bg-muted"
                                      }`}
                                    >
                                      {option}
                                      {option.charAt(0) === wrongQ.question.correctAnswer && (
                                        <CheckCircle2 className="inline h-4 w-4 ml-2" />
                                      )}
                                      {option.charAt(0) === wrongQ.userAnswer &&
                                        wrongQ.userAnswer !== wrongQ.question.correctAnswer && (
                                          <XCircle className="inline h-4 w-4 ml-2" />
                                        )}
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span>
                                    <strong>Your Answer:</strong> {wrongQ.userAnswer}
                                  </span>
                                  <span>
                                    <strong>Correct Answer:</strong> {wrongQ.question.correctAnswer}
                                  </span>
                                </div>
                                {showAnswers[wrongQ.question.id] && (
                                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                                    <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Explanation:</h5>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                      {wrongQ.question.explanation}
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="answer-key" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Answer Key & Explanations</CardTitle>
              <CardDescription>View complete answer key with detailed explanations for all questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysis ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Answer Key: {analysis.testName}</h3>
                    <Badge variant="outline">{analysis.testType}</Badge>
                  </div>

                  <div className="space-y-4">
                    {mockQuestions.map((question) => (
                      <Card key={question.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Question {question.id} - {question.section}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {getDifficultyBadge(question.difficulty)}
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Answer: {question.correctAnswer}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="font-medium">{question.question}</p>
                          <div className="grid gap-2">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`p-2 rounded text-sm ${
                                  option.charAt(0) === question.correctAnswer
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-muted"
                                }`}
                              >
                                {option}
                                {option.charAt(0) === question.correctAnswer && (
                                  <CheckCircle2 className="inline h-4 w-4 ml-2" />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                            <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Explanation:</h5>
                            <p className="text-sm text-blue-800 dark:text-blue-200">{question.explanation}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Test Analyzed Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete a test analysis first to view the answer key and explanations.
                  </p>
                  <Button onClick={() => setActiveTab("test-analysis")}>Go to Test Analysis</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
