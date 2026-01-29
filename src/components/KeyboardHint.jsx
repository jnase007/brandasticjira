import { cn } from '../lib/utils'

/**
 * Keyboard shortcut hint component
 * Displays keyboard keys in a stylish way
 * 
 * @param {string} keys - Space-separated keys like "Cmd K" or "G D"
 * @param {string} className - Additional classes
 */
export default function KeyboardHint({ keys, className = '' }) {
  const keyList = keys.split(' ')
  
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keyList.map((key, i) => (
        <kbd
          key={i}
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5",
            "text-[10px] font-mono font-medium",
            "bg-muted border border-border rounded",
            "shadow-[0_1px_0_1px] shadow-border/50",
            "text-muted-foreground"
          )}
        >
          {formatKey(key)}
        </kbd>
      ))}
    </span>
  )
}

// Format special keys
function formatKey(key) {
  const keyMap = {
    'cmd': '⌘',
    'command': '⌘',
    'ctrl': '⌃',
    'control': '⌃',
    'alt': '⌥',
    'option': '⌥',
    'shift': '⇧',
    'enter': '↵',
    'return': '↵',
    'esc': 'Esc',
    'escape': 'Esc',
    'tab': '⇥',
    'space': '␣',
    'backspace': '⌫',
    'delete': '⌦',
    'up': '↑',
    'down': '↓',
    'left': '←',
    'right': '→',
  }
  
  return keyMap[key.toLowerCase()] || key.toUpperCase()
}

/**
 * Inline keyboard hint with label
 */
export function ShortcutLabel({ label, keys, className = '' }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span>{label}</span>
      <KeyboardHint keys={keys} />
    </span>
  )
}
