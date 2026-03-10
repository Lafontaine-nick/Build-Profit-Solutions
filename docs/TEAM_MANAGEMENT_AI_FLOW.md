# Team Management AI Flow

This document captures the approved AI Assistant flow for team management (Assign PM, Add Team Member).

## Assign PM Flow

1. **User intent**: "Assign a project manager", "Assign PM", "Can you assign a project manager to this project"
2. **AI prompt**: "Which team member do you want to appoint as project manager, or do you want to add a team member as PM?"
3. **AI displays**: Current team list (e.g., Jack, John Smith, nicholas, Mike Johnson, Sarah Wilson, etc.)
4. **User options**:
   - **Select existing member**: User replies with a name (e.g., "nicholas") → AI assigns that person as PM
   - **Add new member**: User says "Add a new team member" → AI transitions to Add Team Member flow
5. **Confirmation**: "Assigned [name] as project manager for the project."
6. **Follow-up**: "Need anything else regarding team management?"

### Rules
- When assigning an existing member as PM, remove them from the crew list so they don't appear twice (PM + crew)
- Team list must include project crew (crewMembers) merged with global team

---

## Add Team Member Flow

1. **User intent**: "Add a new team member", "Add team member"
2. **Step 1 – Name**: AI asks "What is the name of the team member you'd like to add?"
3. **User provides name** (e.g., "nicholas")
4. **Step 2 – Phone**: AI asks "What is the phone number for [name]?"
5. **User provides phone** (e.g., "7028618618")
6. **Confirmation**: "Added [name] to the team. They'll appear in your Team tab."

### Rules
- Phone number is required before executing add_team_member
- Store phone in crewMemberPhones for the new member

---

## Context-Aware Chips

When in team management context, show these chips:
- **Assign PM** (person icon)
- **Add Team Member** (+ icon)
- **Team Status** (chart icon)

---

## Data Sync

- **Deletions**: When user removes a team member from the Team tab, sync to ProjectDataContext so the AI gets the updated list
- **AI refresh**: AI Assistant reloads team data when crewMembers change (e.g., after deletions)
