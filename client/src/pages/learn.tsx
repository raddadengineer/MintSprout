import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Video, Trophy, Star, CheckCircle, PlayCircle, Gamepad2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import ElmoJarsActivity from "@/components/ElmoJarsActivity";

const categories = [
  { id: "earning", name: "Earning", icon: "💰", color: "bg-green-500" },
  { id: "saving", name: "Saving", icon: "🐷", color: "bg-blue-500" },
  { id: "spending", name: "Spending", icon: "🛒", color: "bg-purple-500" },
  { id: "investing", name: "Investing", icon: "📈", color: "bg-yellow-500" },
  { id: "donating", name: "Donating", icon: "❤️", color: "bg-red-500" },
];

export default function Learn() {
  const [selectedCategory, setSelectedCategory] = useState("earning");
  const [watchedVideos, setWatchedVideos] = useState<Set<number>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [showElmoActivity, setShowElmoActivity] = useState(false);

  const { user } = useAuth();

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["/api/lessons"],
  });

  const { data: children = [] } = useQuery({
    queryKey: ["/api/children"],
    enabled: user?.role === "parent",
  });

  // For parents, use the first child's ID, for children use their own progress
  const firstChildId = Array.isArray(children) && children.length > 0 ? children[0].id : null;
  
  const { data: learningProgress = [] } = useQuery({
    queryKey: user?.role === "parent" ? ["/api/learning-progress", firstChildId] : ["/api/learning-progress"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let url = "/api/learning-progress";
      if (user?.role === "parent" && firstChildId) {
        url += `?childId=${firstChildId}`;
      }

      const res = await fetch(url, {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    enabled: (user?.role === "parent" && !!firstChildId) || user?.role === "child",
  });

  const categoryLessons = Array.isArray(lessons) 
    ? lessons.filter((lesson: any) => lesson.category === selectedCategory) 
    : [];

  const markProgressMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/learning-progress", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-progress"] });
    },
  });

  const { data: currentQuizzes = [] } = useQuery({
    queryKey: ["/api/quizzes", selectedLesson?.id],
    enabled: !!selectedLesson?.id,
  });

  const handleVideoWatched = (lessonId: number) => {
    setWatchedVideos(prev => new Set(Array.from(prev).concat([lessonId])));
  };

  const startQuiz = (lesson: any) => {
    setSelectedLesson(lesson);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    setShowQuizResults(false);
    setShowQuiz(true);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
  };

  const nextQuestion = () => {
    if (selectedAnswer !== null && Array.isArray(currentQuizzes) && currentQuizzes.length > 0) {
      const currentQuiz = currentQuizzes[currentQuestionIndex] as any;
      const isCorrect = selectedAnswer === currentQuiz.correctAnswer - 1;
      if (isCorrect) {
        setQuizScore(prev => prev + 1);
      }
      
      if (currentQuestionIndex < currentQuizzes.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        // Quiz complete
        const finalScore = quizScore + (isCorrect ? 1 : 0);
        const percentage = Math.round((finalScore / currentQuizzes.length) * 100);
        
        markProgressMutation.mutate({
          lessonId: selectedLesson.id,
          completed: true,
          quizScore: percentage
        });
        
        setShowQuizResults(true);
      }
    }
  };

  const closeQuiz = () => {
    setShowQuiz(false);
    setSelectedLesson(null);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    setShowQuizResults(false);
  };

  const isLessonCompleted = (lessonId: number) => {
    return Array.isArray(learningProgress) && 
           learningProgress.some((p: any) => p.lessonId === lessonId && p.completed);
  };

  const getLessonScore = (lessonId: number) => {
    const progress = Array.isArray(learningProgress) && 
                    learningProgress.find((p: any) => p.lessonId === lessonId);
    return progress?.quizScore || 0;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showElmoActivity) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowElmoActivity(false)}
            className="mb-4"
          >
            ← Back to Learning
          </Button>
        </div>
        <ElmoJarsActivity 
          onComplete={() => {
            // Only mark progress for child users, parents are just viewing
            if (user?.role === "child") {
              const elmoLesson = Array.isArray(lessons) && lessons.find((l: any) => l.title.includes("Elmo"));
              if (elmoLesson) {
                markProgressMutation.mutate({
                  lessonId: elmoLesson.id,
                  completed: true,
                  quizScore: 100
                });
              }
            }
          }}
          onBackToLearning={() => setShowElmoActivity(false)}
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Learn About Money</h1>
        <p className="text-gray-600 text-lg">Discover the secrets of smart money management!</p>
      </div>

      {/* Featured Interactive Activity */}
      <Card className="mb-8 bg-gradient-to-r from-red-50 to-blue-50 border-2 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🔴</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  NEW! Elmo's Spend, Share, and Save Jars
                </h2>
                <p className="text-gray-600 mb-2">
                  Interactive activity perfect for ages 3-7! Learn with Elmo how to divide money into three special jars.
                </p>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-white">Ages 3-7</Badge>
                  <Badge className="bg-red-500">Featured Activity</Badge>
                  <Badge variant="outline" className="bg-white">15 minutes</Badge>
                </div>
              </div>
            </div>
            <div className="text-center">
              <Button 
                onClick={() => setShowElmoActivity(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3"
              >
                <Gamepad2 className="h-4 w-4 mr-2" />
                Start Activity
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-8">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <span className="text-lg">{category.icon}</span>
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="space-y-6">
            <div className={`${category.color} rounded-2xl p-6 text-white`}>
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-3xl">{category.icon}</span>
                <h2 className="text-2xl font-bold">{category.name} Money</h2>
              </div>
              <p className="text-white/90">
                {category.id === "earning" && "Learn how to make money by doing valuable work and helping others."}
                {category.id === "saving" && "Discover the power of saving money for your future goals and dreams."}
                {category.id === "spending" && "Make smart choices about how to spend your money wisely."}
                {category.id === "investing" && "Grow your money by making it work for you in the long term."}
                {category.id === "donating" && "Share your wealth to help others and make a positive impact."}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categoryLessons.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <p className="text-gray-500">No lessons available for this category yet.</p>
                </div>
              ) : (
                categoryLessons.map((lesson: any) => {
                  const isCompleted = isLessonCompleted(lesson.id);
                  const score = getLessonScore(lesson.id);
                  
                  return (
                    <Card key={lesson.id} className="mint-card relative overflow-hidden">
                      {isCompleted && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {score}% Complete
                          </Badge>
                        </div>
                      )}
                      
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <span>{lesson.title}</span>
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <p className="text-gray-700 leading-relaxed text-sm">
                          {lesson.content}
                        </p>

                        {lesson.videoUrl && (
                          <div className="space-y-2">
                            <div className="aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                              {watchedVideos.has(lesson.id) ? (
                                <iframe
                                  src={lesson.videoUrl}
                                  title={lesson.title}
                                  className="w-full h-full"
                                  frameBorder="0"
                                  allowFullScreen
                                />
                              ) : (
                                <Button
                                  variant="outline"
                                  onClick={() => handleVideoWatched(lesson.id)}
                                  className="flex items-center space-x-2"
                                >
                                  <PlayCircle className="h-5 w-5" />
                                  <span>Watch Video</span>
                                </Button>
                              )}
                            </div>
                            {watchedVideos.has(lesson.id) && (
                              <div className="flex items-center text-green-600 text-sm">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Video watched!
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-3 pt-2">
                          {lesson.title.includes("Elmo") ? (
                            <Button
                              className="w-full bg-red-500 hover:bg-red-600"
                              onClick={() => setShowElmoActivity(true)}
                            >
                              <Gamepad2 className="h-4 w-4 mr-2" />
                              Start Interactive Activity
                            </Button>
                          ) : (
                            <Button
                              className="w-full"
                              onClick={() => startQuiz(lesson)}
                              disabled={markProgressMutation.isPending}
                            >
                              <Trophy className="h-4 w-4 mr-2" />
                              {isCompleted ? `Retake Quiz (${score}%)` : "Take Quiz"}
                            </Button>
                          )}
                          
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-1 flex items-center">
                              <Star className="h-4 w-4 mr-1" />
                              Fun Fact!
                            </h4>
                            <p className="text-blue-700 text-sm">
                              {category.id === "earning" && "The first coins were made over 2,600 years ago in ancient Turkey!"}
                              {category.id === "saving" && "If you save just $1 per day, you'll have $365 in a year - enough for something special!"}
                              {category.id === "spending" && "The average person makes over 35,000 decisions per day - including many about money!"}
                              {category.id === "investing" && "Warren Buffett bought his first stock at age 11 and wishes he had started even earlier!"}
                              {category.id === "donating" && "Kids who learn to give early in life are happier and more successful as adults!"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Learning Progress */}
      <Card className="mint-card mt-8">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-primary" />
            Your Learning Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {categories.map((category) => {
              const categoryLessonsCount = Array.isArray(lessons) 
                ? lessons.filter((l: any) => l.category === category.id).length 
                : 0;
              const completedCount = Array.isArray(learningProgress) 
                ? learningProgress.filter((p: any) => {
                    const lesson = Array.isArray(lessons) && lessons.find((l: any) => l.id === p.lessonId);
                    return lesson && lesson.category === category.id && p.completed;
                  }).length 
                : 0;
              const progress = categoryLessonsCount > 0 ? (completedCount / categoryLessonsCount) * 100 : 0;
              
              return (
                <div key={category.id} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full ${category.color}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    {completedCount}/{categoryLessonsCount} completed
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quiz Modal */}
      <Dialog open={showQuiz} onOpenChange={setShowQuiz}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>{selectedLesson?.title} Quiz</span>
            </DialogTitle>
          </DialogHeader>
          
          {!showQuizResults ? (
            Array.isArray(currentQuizzes) && currentQuizzes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Question {currentQuestionIndex + 1} of {currentQuizzes.length}</span>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: currentQuizzes.length }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < currentQuestionIndex ? 'bg-green-500' : 
                          i === currentQuestionIndex ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                <Progress value={((currentQuestionIndex + 1) / currentQuizzes.length) * 100} />
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    {(currentQuizzes[currentQuestionIndex] as any)?.question}
                  </h3>
                  
                  <div className="space-y-2">
                    {(currentQuizzes[currentQuestionIndex] as any)?.options?.map((option: string, index: number) => (
                      <Button
                        key={index}
                        variant={selectedAnswer === index ? "default" : "outline"}
                        className="w-full text-left justify-start"
                        onClick={() => handleAnswerSelect(index)}
                      >
                        {String.fromCharCode(65 + index)}. {option}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={closeQuiz}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={nextQuestion}
                      disabled={selectedAnswer === null}
                    >
                      {currentQuestionIndex < currentQuizzes.length - 1 ? "Next" : "Finish"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading quiz questions...</p>
              </div>
            )
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl">
                {quizScore / (currentQuizzes as any[]).length >= 0.8 ? '🎉' : 
                 quizScore / (currentQuizzes as any[]).length >= 0.6 ? '👏' : '💪'}
              </div>
              <h3 className="text-2xl font-bold">
                Quiz Complete!
              </h3>
              <p className="text-lg">
                You scored {quizScore} out of {(currentQuizzes as any[]).length} questions correct!
              </p>
              <div className="text-3xl font-bold text-primary">
                {Math.round((quizScore / (currentQuizzes as any[]).length) * 100)}%
              </div>
              <p className="text-gray-600">
                {quizScore / (currentQuizzes as any[]).length >= 0.8 ? "Excellent work! You really understand this topic!" :
                 quizScore / (currentQuizzes as any[]).length >= 0.6 ? "Good job! You're getting the hang of it!" :
                 "Keep practicing! You'll get better with more learning!"}
              </p>
              <Button onClick={closeQuiz} className="w-full">
                Continue Learning
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
