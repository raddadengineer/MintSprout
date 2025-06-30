import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["/api/lessons"],
  });

  const categoryLessons = lessons?.filter((lesson: any) => lesson.category === selectedCategory) || [];

  const handleVideoWatched = (lessonId: number) => {
    setWatchedVideos(prev => new Set([...prev, lessonId]));
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Learn About Money</h1>
        <p className="text-gray-600 text-lg">Discover the secrets of smart money management!</p>
      </div>

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
                categoryLessons.map((lesson: any) => (
                  <Card key={lesson.id} className="mint-card">
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{lesson.title}</h3>
                      
                      <div className="mb-4">
                        <p className="text-gray-700 leading-relaxed">{lesson.content}</p>
                      </div>

                      {lesson.videoUrl && (
                        <div className="mb-4">
                          <div className="aspect-video rounded-lg overflow-hidden border border-gray-200">
                            <iframe
                              src={lesson.videoUrl}
                              title={lesson.title}
                              className="w-full h-full"
                              frameBorder="0"
                              allowFullScreen
                              onLoad={() => handleVideoWatched(lesson.id)}
                            />
                          </div>
                          {watchedVideos.has(lesson.id) && (
                            <div className="mt-2 flex items-center text-green-600 text-sm">
                              <span className="mr-1">✅</span>
                              Video watched!
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        <Button
                          className="w-full mint-primary"
                          onClick={() => handleVideoWatched(lesson.id)}
                        >
                          📝 Take Quiz
                        </Button>
                        
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <h4 className="font-semibold text-yellow-800 mb-1">💡 Fun Fact!</h4>
                          <p className="text-yellow-700 text-sm">
                            {category.id === "earning" && "Did you know? The first piggy banks were made of clay and shaped like pigs!"}
                            {category.id === "saving" && "Albert Einstein called compound interest 'the eighth wonder of the world.'"}
                            {category.id === "spending" && "The 50/30/20 rule suggests spending 50% on needs, 30% on wants, and saving 20%."}
                            {category.id === "investing" && "If you invested $1 in the stock market 100 years ago, it would be worth over $1,000 today!"}
                            {category.id === "donating" && "Studies show that giving to others makes us happier than spending on ourselves!"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Learning Progress */}
      <Card className="mint-card mt-8">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Your Learning Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {categories.map((category) => {
              const categoryLessonsCount = lessons?.filter((l: any) => l.category === category.id).length || 0;
              const completedCount = Math.floor(Math.random() * (categoryLessonsCount + 1)); // Simulated progress
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
    </main>
  );
}
