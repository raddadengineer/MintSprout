import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Coins, Heart, PiggyBank, ShoppingCart, Gift, Target, Users } from "lucide-react";

interface ElmoJarsActivityProps {
  onComplete?: () => void;
}

export default function ElmoJarsActivity({ onComplete }: ElmoJarsActivityProps) {
  const [totalMoney, setTotalMoney] = useState(10); // Starting with $10 for the activity
  const [spendJar, setSpendJar] = useState(0);
  const [saveJar, setSaveJar] = useState(0);
  const [shareJar, setShareJar] = useState(0);
  const [step, setStep] = useState(0);

  const remainingMoney = totalMoney - spendJar - saveJar - shareJar;

  const addToJar = (jar: 'spend' | 'save' | 'share', amount: number) => {
    if (remainingMoney >= amount) {
      if (jar === 'spend') setSpendJar(prev => prev + amount);
      if (jar === 'save') setSaveJar(prev => prev + amount);
      if (jar === 'share') setShareJar(prev => prev + amount);
    }
  };

  const resetActivity = () => {
    setSpendJar(0);
    setSaveJar(0);
    setShareJar(0);
    setStep(0);
  };

  const completeActivity = () => {
    setStep(4);
    onComplete?.();
  };

  const jarActivities = {
    spend: [
      "A new book to read",
      "Stickers for decorating",
      "A small toy or game",
      "A special snack or treat",
      "Art supplies like crayons"
    ],
    save: [
      "A bicycle for riding",
      "A big LEGO set",
      "A tablet for learning",
      "A special trip or vacation",
      "A musical instrument"
    ],
    share: [
      "Donate to help hungry families",
      "Buy a gift for grandparents",
      "Help animals at the shelter",
      "Share with a friend in need",
      "Support kids who need school supplies"
    ]
  };

  const getJarColor = (jar: string) => {
    switch (jar) {
      case 'spend': return 'bg-green-100 border-green-300';
      case 'save': return 'bg-blue-100 border-blue-300';
      case 'share': return 'bg-red-100 border-red-300';
      default: return 'bg-gray-100';
    }
  };

  const getJarIcon = (jar: string) => {
    switch (jar) {
      case 'spend': return <ShoppingCart className="h-8 w-8 text-green-600" />;
      case 'save': return <PiggyBank className="h-8 w-8 text-blue-600" />;
      case 'share': return <Heart className="h-8 w-8 text-red-600" />;
      default: return null;
    }
  };

  if (step === 4) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-green-600">
            🎉 Great Job! You're Learning Like Elmo!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-6xl mb-4">🏆</div>
            <p className="text-lg text-gray-700">
              You've learned how to divide your money just like Elmo taught Abby!
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <ShoppingCart className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="font-bold text-green-800">${spendJar}</div>
              <div className="text-sm text-green-600">To Spend</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <PiggyBank className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="font-bold text-blue-800">${saveJar}</div>
              <div className="text-sm text-blue-600">To Save</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <div className="font-bold text-red-800">${shareJar}</div>
              <div className="text-sm text-red-600">To Share</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">🌟 What You Learned:</h4>
            <ul className="text-yellow-700 text-sm space-y-1">
              <li>• Money can be used for different purposes</li>
              <li>• It's important to save some money for the future</li>
              <li>• Sharing with others feels good and helps people</li>
              <li>• You can make smart choices about your money</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <Button onClick={resetActivity} variant="outline" className="flex-1">
              Try Again
            </Button>
            <Button onClick={() => setStep(0)} className="flex-1">
              Continue Learning
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="text-2xl">🔴</div>
            <span>Elmo's Spend, Share, and Save Jars Activity</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">Ages 3-7</Badge>
            <Badge className="bg-blue-500">Interactive Activity</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Activity Progress</span>
              <span className="text-sm text-gray-500">{Math.min(step + 1, 4)} of 4 steps</span>
            </div>
            <Progress value={(Math.min(step + 1, 4) / 4) * 100} />
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">🎬 Watch Elmo's Video First!</h3>
                <div className="aspect-video rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.youtube.com/embed/roeeYtf5XBA"
                    title="Elmo's Spend, Share, and Save Jars"
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Watch how Elmo and his dad Louie teach Abby about the three special jars!
                </p>
                <Button onClick={() => setStep(1)}>
                  I Watched the Video! Let's Start the Activity
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center mb-4">
                Step 1: Meet Your Three Magic Jars! 🏺
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'SPEND', jar: 'spend', description: 'For things you want to buy soon!', examples: jarActivities.spend },
                  { name: 'SAVE', jar: 'save', description: 'For special things you want later!', examples: jarActivities.save },
                  { name: 'SHARE', jar: 'share', description: 'To help others and give gifts!', examples: jarActivities.share }
                ].map((jarInfo) => (
                  <Card key={jarInfo.jar} className={`${getJarColor(jarInfo.jar)} border-2`}>
                    <CardContent className="p-4 text-center">
                      <div className="mb-3">{getJarIcon(jarInfo.jar)}</div>
                      <h4 className="font-bold text-lg mb-2">{jarInfo.name} JAR</h4>
                      <p className="text-sm mb-3">{jarInfo.description}</p>
                      <div className="text-xs space-y-1">
                        <div className="font-semibold">Examples:</div>
                        {jarInfo.examples.slice(0, 3).map((example, i) => (
                          <div key={i} className="text-gray-600">• {example}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="text-center">
                <Button onClick={() => setStep(2)}>
                  I Understand the Jars! Let's Practice
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-center">
                Step 2: Let's Practice Dividing Money! 💰
              </h3>
              
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2">
                  <Coins className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold">You have ${totalMoney} to divide</span>
                  <span className="text-sm text-gray-600">| Remaining: ${remainingMoney}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'SPEND', jar: 'spend', amount: spendJar, color: 'green' },
                  { name: 'SAVE', jar: 'save', amount: saveJar, color: 'blue' },
                  { name: 'SHARE', jar: 'share', amount: shareJar, color: 'red' }
                ].map((jarInfo) => (
                  <Card key={jarInfo.jar} className={`${getJarColor(jarInfo.jar)} border-2`}>
                    <CardContent className="p-4">
                      <div className="text-center mb-4">
                        {getJarIcon(jarInfo.jar)}
                        <h4 className="font-bold text-lg mt-2">{jarInfo.name} JAR</h4>
                        <div className="text-2xl font-bold text-gray-800">${jarInfo.amount}</div>
                      </div>
                      <div className="space-y-2">
                        <Button 
                          size="sm" 
                          className="w-full" 
                          onClick={() => addToJar(jarInfo.jar as any, 1)}
                          disabled={remainingMoney < 1}
                        >
                          Add $1
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => addToJar(jarInfo.jar as any, 2)}
                          disabled={remainingMoney < 2}
                        >
                          Add $2
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {remainingMoney === 0 && (
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-green-800">Great job! You divided all your money!</h4>
                    <p className="text-green-600">Now let's talk about your choices.</p>
                  </div>
                  <Button onClick={() => setStep(3)}>
                    Let's Talk About My Choices!
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-center">
                Step 3: Let's Talk About Your Choices! 💭
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'SPEND', jar: 'spend', amount: spendJar, questions: [
                    "What's something you'd like to buy soon?",
                    "Why did you choose this amount for spending?"
                  ]},
                  { name: 'SAVE', jar: 'save', amount: saveJar, questions: [
                    "What special thing are you saving for?",
                    "How does it feel to save money for later?"
                  ]},
                  { name: 'SHARE', jar: 'share', amount: shareJar, questions: [
                    "Who could you help with this money?",
                    "How do you think sharing makes others feel?"
                  ]}
                ].map((jarInfo) => (
                  <Card key={jarInfo.jar} className={`${getJarColor(jarInfo.jar)} border-2`}>
                    <CardContent className="p-4">
                      <div className="text-center mb-4">
                        {getJarIcon(jarInfo.jar)}
                        <h4 className="font-bold text-lg mt-2">{jarInfo.name} JAR</h4>
                        <div className="text-2xl font-bold text-gray-800">${jarInfo.amount}</div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm">Think About:</h5>
                        {jarInfo.questions.map((question, i) => (
                          <div key={i} className="text-xs text-gray-600 bg-white/50 p-2 rounded">
                            {question}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-2 flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  Parent Discussion Tips:
                </h4>
                <ul className="text-purple-700 text-sm space-y-1">
                  <li>• Ask your child to explain their choices - there are no wrong answers!</li>
                  <li>• Share how you divide your own money using bank accounts</li>
                  <li>• Celebrate their thinking process, not just the final amounts</li>
                  <li>• Talk about how the family uses these same ideas for budgeting</li>
                </ul>
              </div>

              <div className="text-center">
                <Button onClick={completeActivity} className="px-8">
                  I'm Ready to Finish! 🎉
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}