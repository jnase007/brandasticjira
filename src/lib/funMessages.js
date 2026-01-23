// ============================================
// FUN MESSAGES & COPY THROUGHOUT THE APP
// ============================================

// Time-based greetings with personality
export function getGreeting(name) {
  const hour = new Date().getHours()
  const firstName = name?.split(' ')[0] || 'friend'
  
  if (hour < 6) {
    const msgs = [
      `Burning the midnight oil, ${firstName}? 🌙`,
      `You're up early! Or really late? 🦉`,
      `The early bird gets the client work done! 🐦`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  if (hour < 9) {
    const msgs = [
      `Good morning, ${firstName}! ☀️`,
      `Rise and grind, ${firstName}! 💪`,
      `Morning sunshine! Ready to crush it? ☕`,
      `Top of the morning, ${firstName}! 🌅`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  if (hour < 12) {
    const msgs = [
      `Hey ${firstName}! Let's make today legendary 🚀`,
      `Looking good, ${firstName}! Time to slay 🔥`,
      `${firstName}! Ready to move mountains? ⛰️`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  if (hour < 14) {
    const msgs = [
      `Lunch break yet, ${firstName}? 🍕`,
      `Afternoon vibes, ${firstName}! Keep crushing it 💪`,
      `Hey ${firstName}! Hope you've eaten! 🌮`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  if (hour < 17) {
    const msgs = [
      `Afternoon, ${firstName}! You're on fire today 🔥`,
      `Keep going, ${firstName}! The finish line is near 🏁`,
      `Hey ${firstName}! Powering through like a boss 👑`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  if (hour < 20) {
    const msgs = [
      `Evening, ${firstName}! Wrapping up strong? 💫`,
      `Almost there, ${firstName}! You've got this 🌟`,
      `Hey ${firstName}! Time to wind down? 🌆`,
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  const msgs = [
    `Still here, ${firstName}? Dedication! 🌙`,
    `Night owl mode activated, ${firstName} 🦉`,
    `Burning that midnight oil, ${firstName}! 🕯️`,
  ]
  return msgs[Math.floor(Math.random() * msgs.length)]
}

// Empty state messages
export const EMPTY_STATES = {
  clients: {
    title: "No clients yet? Let's fix that! 🎯",
    subtitle: "Every empire starts with client #1. Ready to build yours?",
    action: "Add Your First Client",
  },
  boards: {
    title: "Your board collection is feeling lonely 📋",
    subtitle: "Boards are where the magic happens. Let's create one!",
    action: "Create First Board",
  },
  tickets: {
    title: "No tasks yet? Time to get productive! 📝",
    subtitle: "Add your first task and start crushing it!",
    action: "Create First Task",
  },
  timeEntries: {
    title: "Time flies when you're having fun! ⏰",
    subtitle: "But we haven't tracked any yet. Let's start!",
    action: "Log Some Time",
  },
  search: {
    title: "Nothing found 🔍",
    subtitle: "Maybe try different keywords? Or check if you spelled it right 😉",
  },
  achievements: {
    title: "Achievement hunter in training 🏆",
    subtitle: "Complete tasks, log time, and unlock awesome badges!",
  },
}

// Success toast messages (randomized)
export const SUCCESS_MESSAGES = {
  clientCreated: [
    "🎉 Client added! Let the billing begin!",
    "✨ New client unlocked! Ka-ching!",
    "🚀 Client created! Time to make them happy!",
    "💼 Welcome aboard, new client!",
  ],
  clientUpdated: [
    "✅ Client updated! Looking fresh!",
    "👌 Changes saved! Nailed it!",
    "💾 Saved! Your future self thanks you.",
  ],
  ticketCreated: [
    "📝 Task created! Add it to the pile!",
    "✨ Task added! One step closer to greatness!",
    "🎯 New task! Let's crush it!",
  ],
  ticketCompleted: [
    "🎉 DONE! You're on fire!",
    "✅ Crushed it! What's next?",
    "💪 Another one bites the dust!",
    "🏆 Victory! Task destroyed!",
    "🚀 Boom! Shipped it!",
    "⚡ Lightning fast completion!",
  ],
  timeLogged: [
    "⏱️ Time logged! Every minute counts!",
    "💰 Billable hours go brrrr!",
    "📊 Time tracked! The accountant is pleased.",
  ],
  profileUpdated: [
    "👤 Profile updated! Looking good!",
    "✨ Fresh new you! Love it!",
    "💅 Makeover complete!",
  ],
  copied: [
    "📋 Copied! Paste away!",
    "✂️ Snagged it! It's yours now!",
  ],
}

// Error messages (friendly)
export const ERROR_MESSAGES = {
  generic: [
    "😅 Oops! Something went sideways.",
    "🤔 Well, that didn't work...",
    "💥 Houston, we have a problem.",
  ],
  network: [
    "📡 Lost connection! Are you on a plane?",
    "🌐 Network hiccup! Try again?",
  ],
  validation: [
    "👀 Hold up! Missing some info there.",
    "📝 Looks like we need more details!",
  ],
  permission: [
    "🔒 Sorry, that's above your pay grade!",
    "🚫 Access denied! Talk to your admin.",
  ],
}

// Fun placeholder texts
export const PLACEHOLDERS = {
  ticketTitle: [
    "Fix that thing that broke...",
    "Make the client happy (again)...",
    "Build something awesome...",
    "Debug the mysterious bug...",
  ],
  ticketDescription: [
    "Describe the task (with as many details as your coffee allows)...",
    "What needs to happen? Be specific, future you will thank you...",
  ],
  search: [
    "Search for anything...",
    "What are you looking for?",
    "Find clients, boards, tasks...",
  ],
  comment: [
    "Add a brilliant comment...",
    "Share your wisdom...",
    "Say something nice (or useful)...",
  ],
}

// Fun facts that appear randomly
export const FUN_FACTS = [
  "💡 Did you know? The first computer bug was an actual bug!",
  "🎮 Pro tip: Press ⌘K to open quick search!",
  "☕ Coffee break? You've earned it!",
  "🚀 You're doing great! Keep it up!",
  "✨ Every task completed makes a client smile!",
  "🎯 Focus mode: activated!",
  "💪 You've got this!",
  "🌟 Making magic happen, one task at a time!",
]

// Motivational messages for low efficiency
export const MOTIVATION = {
  low: [
    "Every journey starts with a single step! 👣",
    "Today is a fresh start! Let's go! 🌅",
    "Small progress is still progress! 📈",
  ],
  medium: [
    "You're building momentum! Keep going! 🔥",
    "Nice work! Almost at the top! 💪",
    "The grind is paying off! 📈",
  ],
  high: [
    "Absolutely crushing it! 🏆",
    "You're a productivity machine! 🤖",
    "On fire! Legendary performance! 🔥",
  ],
}

// Random helper
export function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Get success message
export function getSuccessMessage(type) {
  return getRandom(SUCCESS_MESSAGES[type] || SUCCESS_MESSAGES.generic)
}

// Get error message  
export function getErrorMessage(type) {
  return getRandom(ERROR_MESSAGES[type] || ERROR_MESSAGES.generic)
}

// Get placeholder
export function getPlaceholder(type) {
  return getRandom(PLACEHOLDERS[type] || PLACEHOLDERS.search)
}

// Get fun fact
export function getFunFact() {
  return getRandom(FUN_FACTS)
}

// Get motivation based on efficiency percentage
export function getMotivation(efficiency) {
  if (efficiency < 50) return getRandom(MOTIVATION.low)
  if (efficiency < 80) return getRandom(MOTIVATION.medium)
  return getRandom(MOTIVATION.high)
}
