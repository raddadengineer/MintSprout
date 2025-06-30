import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  Home, 
  Car, 
  Utensils, 
  Trash2, 
  Shirt, 
  Dog, 
  Sprout, 
  Paintbrush, 
  BookOpen,
  Bed,
  ShoppingCart,
  Wrench,
  Scissors,
  TreePine,
  Flower,
  Smartphone,
  Laptop,
  Camera,
  Music,
  Gamepad2,
  Calculator,
  Palette,
  Hammer,
  DollarSign,
  Gift,
  Star,
  Award,
  Crown,
  Trophy,
  Target,
  Check,
  Plus,
  Clock,
  Zap,
  Sparkles,
  Leaf,
  Droplets,
  Wind,
  Sun
} from "lucide-react";

export const JOB_ICONS = {
  // Household chores
  briefcase: { icon: Briefcase, label: "General Work", category: "General" },
  home: { icon: Home, label: "Home Tasks", category: "Household" },
  trash2: { icon: Trash2, label: "Take Out Trash", category: "Household" },
  bed: { icon: Bed, label: "Make Bed", category: "Household" },
  utensils: { icon: Utensils, label: "Kitchen Tasks", category: "Household" },
  zap: { icon: Zap, label: "Wash Dishes", category: "Household" },
  sparkles: { icon: Sparkles, label: "Clean", category: "Household" },
  wind: { icon: Wind, label: "Vacuum", category: "Household" },
  droplets: { icon: Droplets, label: "Laundry", category: "Household" },
  shirt: { icon: Shirt, label: "Fold Clothes", category: "Household" },
  
  // Outdoor & Garden
  car: { icon: Car, label: "Car Wash", category: "Outdoor" },
  sprout: { icon: Sprout, label: "Garden Work", category: "Outdoor" },
  flower: { icon: Flower, label: "Water Plants", category: "Outdoor" },
  treePine: { icon: TreePine, label: "Yard Work", category: "Outdoor" },
  
  // Pet Care
  dog: { icon: Dog, label: "Pet Care", category: "Pet Care" },
  
  // Learning & School
  bookOpen: { icon: BookOpen, label: "Study/Homework", category: "Learning" },
  calculator: { icon: Calculator, label: "Math Practice", category: "Learning" },
  paintbrush: { icon: Paintbrush, label: "Art Project", category: "Learning" },
  palette: { icon: Palette, label: "Creative Work", category: "Learning" },
  
  // Technology
  smartphone: { icon: Smartphone, label: "Tech Help", category: "Technology" },
  laptop: { icon: Laptop, label: "Computer Tasks", category: "Technology" },
  camera: { icon: Camera, label: "Photography", category: "Technology" },
  
  // Entertainment & Hobbies
  music: { icon: Music, label: "Music Practice", category: "Entertainment" },
  gamepad2: { icon: Gamepad2, label: "Gaming Tasks", category: "Entertainment" },
  
  // Repair & Maintenance
  hammer: { icon: Hammer, label: "Fix/Build", category: "Repair" },
  wrench: { icon: Wrench, label: "Tool Work", category: "Repair" },
  scissors: { icon: Scissors, label: "Cutting Tasks", category: "Repair" },
  
  // Shopping & Errands
  shoppingCart: { icon: ShoppingCart, label: "Shopping", category: "Errands" },
  dollarSign: { icon: DollarSign, label: "Money Tasks", category: "Errands" },
  
  // Rewards & Goals
  gift: { icon: Gift, label: "Special Task", category: "Rewards" },
  star: { icon: Star, label: "Star Task", category: "Rewards" },
  award: { icon: Award, label: "Achievement", category: "Rewards" },
  crown: { icon: Crown, label: "Premium Task", category: "Rewards" },
  trophy: { icon: Trophy, label: "Challenge", category: "Rewards" },
  target: { icon: Target, label: "Goal", category: "Rewards" },
  
  // Status & Time
  check: { icon: Check, label: "Simple Task", category: "General" },
  plus: { icon: Plus, label: "Add Task", category: "General" },
  clock: { icon: Clock, label: "Timed Task", category: "General" },
};

interface IconSelectorProps {
  selectedIcon: string;
  onIconSelect: (icon: string) => void;
}

export function IconSelector({ selectedIcon, onIconSelect }: IconSelectorProps) {
  const categories = Array.from(new Set(Object.values(JOB_ICONS).map(icon => icon.category)));
  const SelectedIcon = JOB_ICONS[selectedIcon as keyof typeof JOB_ICONS]?.icon || Briefcase;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <SelectedIcon className="mr-2 h-4 w-4" />
          {JOB_ICONS[selectedIcon as keyof typeof JOB_ICONS]?.label || "Select Icon"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Select Job Icon</h4>
          {categories.map((category) => (
            <div key={category} className="space-y-2">
              <Badge variant="secondary" className="text-xs">
                {category}
              </Badge>
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(JOB_ICONS)
                  .filter(([, iconData]) => iconData.category === category)
                  .map(([iconKey, iconData]) => {
                    const IconComponent = iconData.icon;
                    return (
                      <Button
                        key={iconKey}
                        variant={selectedIcon === iconKey ? "default" : "ghost"}
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => onIconSelect(iconKey)}
                        title={iconData.label}
                      >
                        <IconComponent className="h-4 w-4" />
                      </Button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}