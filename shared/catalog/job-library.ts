import type { CatalogLibraryEntry } from "./types";

export type JobLibraryItem = {
  title: string;
  description: string;
  icon: string;
  recurrence: "once" | "daily" | "weekly" | "monthly";
};

export const JOB_LIBRARY_BY_SLUG: Record<string, JobLibraryItem[]> = {
  self_care: [
    { title: "Make my bed", description: "Straighten sheets and pillows every morning.", icon: "bed", recurrence: "daily" },
    { title: "Clean my room", description: "Pick up toys, books, and clothes so the room stays tidy.", icon: "sparkles", recurrence: "weekly" },
    { title: "Pick up toys", description: "Put toys away when you are done playing.", icon: "home", recurrence: "daily" },
    { title: "Brush my teeth", description: "Brush morning and night.", icon: "sparkles", recurrence: "daily" },
    { title: "Pick up after myself", description: "Put things back where they belong after using them.", icon: "home", recurrence: "daily" },
    { title: "Get dressed on my own", description: "Pick out clothes and get ready without reminders.", icon: "bed", recurrence: "daily" },
    { title: "Pack my backpack", description: "Pack school bag the night before.", icon: "briefcase", recurrence: "daily" },
    { title: "Water plants", description: "Water houseplants or garden.", icon: "sprout", recurrence: "weekly" },
  ],
  allowance: [
    { title: "Take out the trash", description: "Empty trash bins and take bags to the curb or dumpster.", icon: "trash2", recurrence: "weekly" },
    { title: "Empty the dishwasher", description: "Unload clean dishes and put them away.", icon: "utensils", recurrence: "daily" },
    { title: "Clean the bathroom", description: "Wipe counters, sink, and tidy the bathroom.", icon: "sparkles", recurrence: "weekly" },
    { title: "Vacuum the floor", description: "Vacuum shared living spaces.", icon: "wind", recurrence: "weekly" },
    { title: "Mow the lawn", description: "Help mow or edge the yard.", icon: "sprout", recurrence: "weekly" },
    { title: "Wash the car", description: "Help wash and dry the family car.", icon: "sparkles", recurrence: "monthly" },
    { title: "Fold laundry", description: "Fold and put away clean laundry.", icon: "home", recurrence: "weekly" },
    { title: "Walk the dog", description: "Take the dog for a walk and clean up after.", icon: "sprout", recurrence: "daily" },
  ],
  mind_body: [
    { title: "Read for 15 minutes", description: "Read a book or story for at least 15 minutes.", icon: "bookOpen", recurrence: "daily" },
    { title: "Book report", description: "Tell someone about what you read today.", icon: "bookOpen", recurrence: "weekly" },
    { title: "Practice worksheets", description: "Complete a learning worksheet.", icon: "calculator", recurrence: "weekly" },
    { title: "Learn a new skill", description: "Practice something new for 20 minutes.", icon: "target", recurrence: "weekly" },
    { title: "Exercise for 20 minutes", description: "Run, bike, or play active games.", icon: "target", recurrence: "daily" },
    { title: "Practice instrument", description: "Practice music for 15 minutes.", icon: "bookOpen", recurrence: "daily" },
    { title: "Journal entry", description: "Write a few sentences about your day.", icon: "bookOpen", recurrence: "daily" },
  ],
  help_others: [
    { title: "Help a sibling", description: "Help your brother or sister with something they need.", icon: "gift", recurrence: "once" },
    { title: "Write a thank-you note", description: "Make a card or note to thank someone.", icon: "gift", recurrence: "once" },
    { title: "Neighborhood kindness", description: "Do something kind for a neighbor.", icon: "sprout", recurrence: "once" },
    { title: "Set the table", description: "Help set the table before dinner.", icon: "utensils", recurrence: "daily" },
    { title: "Clear the table", description: "Clear dishes after a meal.", icon: "utensils", recurrence: "daily" },
  ],
  bonus_tasks: [
    { title: "Wash the car", description: "Wash and dry the family car.", icon: "sparkles", recurrence: "once" },
    { title: "Extra yard work", description: "Rake leaves, weed, or help in the yard.", icon: "sprout", recurrence: "once" },
    { title: "Organize the garage", description: "Help sort and tidy the garage or storage area.", icon: "home", recurrence: "once" },
    { title: "Babysit younger sibling", description: "Watch a younger sibling for a set time.", icon: "gift", recurrence: "once" },
    { title: "Deep clean a room", description: "Extra-thorough cleaning of one room.", icon: "sparkles", recurrence: "once" },
  ],
};

export function jobLibraryAsCatalogEntries(): CatalogLibraryEntry[] {
  const entries: CatalogLibraryEntry[] = [];
  for (const [categoryKey, items] of Object.entries(JOB_LIBRARY_BY_SLUG)) {
    for (const item of items) {
      entries.push({
        catalogType: "job",
        categoryKey,
        title: item.title,
        description: item.description,
        payload: { icon: item.icon, recurrence: item.recurrence },
        source: "builtin",
      });
    }
  }
  return entries;
}
