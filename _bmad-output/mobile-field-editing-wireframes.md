# Mobile Field Editing - Visual Wireframes

## 1. Chat with Field Extraction Badges

```
┌──────────────────────────┐
│ 📍 Step 3 of 11     72% │
│ ──────────────────────── │
│                          │
│ Trevor: Based on what    │
│ you've told me, I've     │
│ captured your brand      │
│ foundation...            │
│                          │
│ [+Brand Name]            │
│ [+Target Audience]       │
│ [+Mission]               │
│                          │
│ You: Perfect! Our brand  │
│ name is TechStart and    │
│ we help remote teams...  │
│                          │
│ ──────────────────────── │
│ [📎] [Type message] [✓]  │
└──────────────────────────┘
```

## 2. Field Review Overlay - One at a Time

### First Field (1 of 3)
```
┌──────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░ │ ← Dimmed chat
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ┌──────────────────────┐ │
│ │  Field Update 1/3 [X]│ │
│ │ ──────────────────── │ │
│ │                      │ │
│ │     Brand Name       │ │
│ │                      │ │
│ │ Was: (empty)         │ │
│ │ Now: TechStart       │ │
│ │                      │ │
│ │ [✗] [✓] [Accept All] │ │
│ │       ● ○ ○          │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Second Field (2 of 3)
```
┌──────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ┌──────────────────────┐ │
│ │  Field Update 2/3 [X]│ │
│ │ ──────────────────── │ │
│ │                      │ │
│ │   Target Audience    │ │
│ │                      │ │
│ │ Was: (empty)         │ │
│ │ Now: Remote teams    │ │
│ │      aged 25-40      │ │
│ │                      │ │
│ │ [✗] [✓] [Accept All] │ │
│ │       ○ ● ○          │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Swipe Gesture Indicators
```
┌──────────────────────────┐
│ ┌──────────────────────┐ │
│ │  Field Update 1/3    │ │
│ │ ←(reject)  (accept)→ │ │
│ │                      │ │
│ │     Brand Name       │ │
│ │                      │ │
│ │ Was: (empty)         │ │
│ │ Now: TechStart       │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

## 3. Tap-to-Edit Floating Card

```
┌──────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
│   ┌──────────────────┐   │
│   │ Brand Name   [AI]│   │
│   │ ──────────────── │   │
│   │                  │   │
│   │ [TechStart     ] │   │
│   │                  │   │
│   │ Your brand's    │   │
│   │ primary name    │   │
│   │                  │   │
│   │ [Cancel] [Save] │   │
│   └──────────────────┘   │
│ ░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────┘
```

## 4. Tab Navigation View

```
┌──────────────────────────┐
│ IDEA Brand Coach    72% │
│ ──────────────────────── │
│ [Chat] [Fields] Progress │
│ ──────────────────────── │
│                          │
│ Recently Updated (3)     │
│ ──────────────           │
│ • Brand Name       [AI]  │
│   "TechStart"      Edit  │
│                          │
│ • Target Audience  [AI]  │
│   "Remote teams"   Edit  │
│                          │
│ Chapter 1: Foundation ✓  │
│ ▼ 3/3 fields complete    │
│                          │
│ Chapter 3: Audience      │
│ ▼ 2/5 fields complete    │
│   │                      │
│   • Demographics   [AI]  │
│   • Psychographics [ ]   │
│                          │
└──────────────────────────┘
```

## 5. Progress Tab View

```
┌──────────────────────────┐
│ IDEA Brand Coach         │
│ ──────────────────────── │
│  Chat  Fields [Progress] │
│ ──────────────────────── │
│                          │
│      ╭───────────╮       │
│      │    72%    │       │
│      │  ██████   │       │
│      ╰───────────╯       │
│                          │
│ ✅ Chapter 1: Foundation │
│    3/3 fields            │
│                          │
│ ✅ Chapter 2: Audience   │
│    5/5 fields            │
│                          │
│ 🔄 Chapter 3: Execute    │
│    2/4 fields            │
│                          │
│ ⭕ Chapter 4: Analyze    │
│    0/6 fields            │
│                          │
│ [Export Avatar] [Share]  │
│                          │
└──────────────────────────┘
```

## 6. Auto-Accept Toggle States

### Default (Review Mode)
```
┌──────────────────────────┐
│ [📎] [Type message] [○]  │
└──────────────────────────┘
```

### Auto-Accept Enabled
```
┌──────────────────────────┐
│ [📎] [Type message] [✓]  │
└──────────────────────────┘
   Toast: "Auto-accept enabled"
```

## 7. Chapter Completion Celebration

```
┌──────────────────────────┐
│      🎉 🎊 🎉           │
│                          │
│  Chapter 3 Complete!     │
│                          │
│  Great progress! You've  │
│  completed 27% of your   │
│  brand avatar.           │
│                          │
│  [Continue] [Review]     │
│                          │
└──────────────────────────┘
```

## 8. Recently Updated Drawer

```
┌──────────────────────────┐
│ ← Recently Updated       │
│ ──────────────────────── │
│                          │
│ Just now                 │
│ Brand Name: TechStart    │
│ Source: You said this    │
│ [Edit] [Lock]            │
│                          │
│ 2 min ago                │
│ Mission: To empower...   │
│ Source: Extracted from   │
│ document                 │
│ [Edit] [Lock]            │
│                          │
│ 5 min ago                │
│ Target: Remote workers   │
│ Source: AI suggestion    │
│ [Edit] [Lock]            │
│                          │
└──────────────────────────┘
```