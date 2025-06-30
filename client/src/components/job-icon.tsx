import { JOB_ICONS } from "./icon-selector";
import { Briefcase } from "lucide-react";

interface JobIconProps {
  iconName?: string | null;
  className?: string;
}

export function JobIcon({ iconName, className = "h-4 w-4" }: JobIconProps) {
  const IconComponent = iconName && JOB_ICONS[iconName as keyof typeof JOB_ICONS] 
    ? JOB_ICONS[iconName as keyof typeof JOB_ICONS].icon 
    : Briefcase;
  
  return <IconComponent className={className} />;
}