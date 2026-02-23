# 📱 iOS Simulator Scrolling Guide

## How to Scroll in iOS Simulator

### Method 1: Click and Drag (Most Common)
1. **Click** on the simulator screen
2. **Hold and drag** up or down
3. Release to stop scrolling

### Method 2: Trackpad Gestures
- **Two-finger scroll** on your trackpad (same as scrolling on a Mac)
- Works just like scrolling on a real iPhone

### Method 3: Keyboard Shortcuts
- **Arrow Keys** (↑ ↓): Scroll line by line
- **Page Up/Page Down**: Scroll by page
- **Space**: Scroll down one page
- **Shift + Space**: Scroll up one page

### Method 4: Mouse Wheel
- If you have a mouse, use the **scroll wheel**

## Common Issues & Fixes

### Issue: Nothing Happens When I Try to Scroll
**Possible causes:**
1. **Content isn't scrollable** - The content might fit on screen
2. **Wrong area clicked** - Click in the middle of the scrollable area
3. **Simulator not focused** - Click the simulator window first

**Fix:**
- Make sure the simulator window is **focused** (click it)
- Click in the **middle of the screen** (not on buttons)
- Try dragging from the center area

### Issue: Scrolling is Too Fast/Slow
**Fix:**
- Use **click and drag** for precise control
- Or use **arrow keys** for slow, precise scrolling

### Issue: Can't Scroll in Specific Screen
**Fix:**
- Some screens might not have scrollable content
- Check if content extends beyond the screen height
- Try scrolling in different areas of the screen

## Quick Test

1. **Open your app** in simulator
2. **Click in the middle** of the screen
3. **Drag up/down** - should scroll
4. If it doesn't work, try **two-finger scroll** on trackpad

## Pro Tips

1. **Click first, then drag** - Don't just move mouse, actually click and hold
2. **Use trackpad** - Two-finger scroll is most natural
3. **Check scroll indicators** - If you see scroll bars, content is scrollable
4. **Try different areas** - Some UI elements might block scrolling

## If Still Not Working

The content might not be scrollable. Check:
- Is there more content below the visible area?
- Are you on a screen with a ScrollView component?
- Try navigating to a different screen to test scrolling
