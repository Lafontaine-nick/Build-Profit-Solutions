# AI Assistant Comprehensive Analysis

## Executive Summary

The AI Assistant is experiencing reliability issues, particularly with:
1. **Creating purchase orders with default amounts ($350) when user doesn't provide them**
2. **Not following instructions consistently**
3. **Complex validation logic that may be causing edge cases**

## Root Cause Analysis

### 1. **System Prompt Conflicts**

**Problem:** The system prompt contains conflicting instructions:

```javascript
// Line 125-126: Says NEVER mention amounts unless user provided them
**NEVER mention any dollar amount ($350, $500, $1000, etc.) in your response unless the user explicitly provided that amount in their message.**

// Line 131-134: But then says to extract numbers immediately
- If the message contains a number (like "350", "500", "$300"), that number IS the amount - extract it immediately
- Example: "Let's add 350 material spent" → amount = 350 (DO NOT ask "How much?" - the number is right there!)
```

**Impact:** The AI is confused about when to extract amounts vs when to ask for them.

**Recommendation:** 
- Separate instructions for **expenses** (extract immediately) vs **purchase orders** (ask if missing)
- Make purchase order instructions more explicit and separate

### 2. **Model Configuration Issues**

**Current Settings:**
- Model: `gpt-4o-mini` (line 1413, 1945)
- Temperature: `0.7` (line 1417, 1949)
- Max Tokens: `1000` (line 1418, 1950)

**Problems:**
1. **Temperature 0.7 is too high** - Makes the AI too creative and less deterministic
2. **gpt-4o-mini is less capable** - May not follow complex instructions as well as gpt-4o
3. **Max tokens 1000 might cut off responses** - Could truncate important instructions

**Recommendations:**
- Lower temperature to `0.3` for more deterministic behavior
- Consider upgrading to `gpt-4o` for better instruction following
- Increase max_tokens to `2000` to ensure complete responses

### 3. **Validation Logic Complexity**

**Problem:** The validation logic has multiple layers and edge cases:

1. **Amount Extraction** (lines 488-546): Tries to extract from last message, then recent messages
2. **Amount Validation** (lines 547-640): Validates against all user messages with complex regex patterns
3. **Placeholder Detection** (lines 551-577): Special handling for common amounts like 350
4. **Plain Number Acceptance** (lines 588-610): Only accepts if previous assistant asked for amount

**Issues:**
- Too many conditions can cause edge cases
- The validation might be too strict in some cases, too lenient in others
- The logic for accepting plain numbers is complex and error-prone

**Recommendation:**
- Simplify validation: If user didn't explicitly mention amount with indicators ($, "dollars", etc.), reject it
- For purchase orders specifically, require explicit amount indicators ALWAYS

### 4. **Function Call Flow Issues**

**Problem:** The AI can call functions before validation runs:

1. AI decides to call `add_purchase_order` with amount: 350
2. Function is called with that amount
3. Validation runs inside `executeAddPurchaseOrder`
4. Validation might pass if it finds "350" somewhere in conversation history

**Issue:** The AI is making decisions before validation can prevent bad calls.

**Recommendation:**
- Add pre-validation before function calls
- Reject function calls with common placeholder amounts immediately
- Don't let the AI call functions with amounts that weren't explicitly provided

### 5. **System Prompt Length and Clarity**

**Problem:** The system prompt is very long (2000+ lines) with many conflicting instructions.

**Issues:**
- Too much information can confuse the AI
- Conflicting instructions (extract vs ask)
- Examples with "$350" might be teaching the AI to use that number

**Recommendation:**
- Simplify the system prompt
- Remove all examples with "$350" or other placeholder amounts
- Make purchase order instructions crystal clear and separate from expense instructions

## Specific Issues Found

### Issue 1: Purchase Order Amount Validation

**Location:** Lines 547-640

**Problem:** The validation accepts plain numbers if there's "purchase order context" in the conversation, even if the user never provided that number.

**Fix Applied:** Removed the overly permissive check, but validation might still have issues.

### Issue 2: AI Model Behavior

**Problem:** The AI (gpt-4o-mini) might be:
- Hallucinating amounts based on examples in the prompt
- Not following instructions strictly enough
- Being too creative with temperature 0.7

**Recommendation:** 
- Lower temperature to 0.3
- Use more explicit instructions
- Add examples of what NOT to do

### Issue 3: Function Call Timing

**Problem:** The AI calls functions before validation can prevent bad calls.

**Current Flow:**
1. User: "Create me a purchase order"
2. AI: Calls `add_purchase_order` with amount: 350 (AI's decision)
3. Validation: Checks if 350 was mentioned (might find it in examples)

**Better Flow:**
1. User: "Create me a purchase order"
2. AI: Asks "How much is the purchase order for?"
3. User: "400"
4. AI: Calls `add_purchase_order` with amount: 400

## Recommendations

### Immediate Fixes

1. **Lower Temperature**
   ```javascript
   temperature: 0.3  // Instead of 0.7
   ```

2. **Simplify Purchase Order Instructions**
   - Remove all examples with "$350"
   - Make it crystal clear: "NEVER call add_purchase_order without an explicit amount from the user"
   - Separate purchase order instructions from expense instructions

3. **Add Pre-Validation**
   - Before calling `add_purchase_order`, check if amount is a common placeholder
   - Reject immediately if amount is 350, 500, 1000, etc. and user didn't mention it

4. **Stricter Validation**
   - For purchase orders, require explicit amount indicators ($, "dollars", "for $X")
   - Don't accept plain numbers unless the AI just asked for the amount

### Long-term Improvements

1. **Upgrade Model**
   - Consider `gpt-4o` for better instruction following
   - Or use `gpt-4-turbo` for better reliability

2. **Restructure System Prompt**
   - Split into clear sections: Expenses vs Purchase Orders
   - Remove conflicting instructions
   - Use negative examples (what NOT to do)

3. **Add Function Call Validation**
   - Validate function arguments before executing
   - Return clear errors that the AI can understand

4. **Improve Error Handling**
   - When validation fails, return clear error messages
   - Make sure the AI sees and responds to these errors

## Testing Recommendations

1. **Test Cases:**
   - "Create me a purchase order" → Should ask for amount
   - "Create me a purchase order for Windows" → Should ask for amount
   - "Create me a purchase order for $400" → Should work
   - "Create me a purchase order" → "400" → Should work

2. **Monitor:**
   - Check logs for when validation fails
   - Track when AI provides amounts without user input
   - Monitor function call success rates

## Code Quality Issues

1. **File Length:** 2306 lines - too long, should be split into modules
2. **Complex Logic:** Validation logic is spread across multiple functions
3. **Error Handling:** Some errors might not be caught properly
4. **Logging:** Too much logging in some places, not enough in others

## Conclusion

The main issues are:
1. **Conflicting system prompt instructions**
2. **AI model not following instructions strictly enough**
3. **Complex validation logic with edge cases**
4. **Function calls happening before validation**

The fixes should focus on:
1. Simplifying and clarifying instructions
2. Making validation stricter and simpler
3. Lowering temperature for more deterministic behavior
4. Adding pre-validation before function calls
