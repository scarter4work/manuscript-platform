# GitHub Issues & Project Board Guide

This document explains how to use GitHub Issues for ticket tracking and project management.

## 📋 Table of Contents

- [Why GitHub Issues?](#why-github-issues)
- [Quick Start](#quick-start)
- [Migration from Linear](#migration-from-linear)
- [Using GitHub Issues](#using-github-issues)
- [Using GitHub Projects (Kanban Board)](#using-github-projects-kanban-board)
- [GitHub CLI Reference](#github-cli-reference)
- [Label System](#label-system)
- [Workflows](#workflows)

---

## Why GitHub Issues?

We migrated from Linear to GitHub Issues because:

1. ✅ **Native Integration** - Already using GitHub for code
2. ✅ **GitHub CLI Works** - Unlike Linear MCP which had connection issues
3. ✅ **Kanban Boards** - GitHub Projects provides excellent kanban views
4. ✅ **Free for Public Repos** - No additional cost
5. ✅ **Better for Open Source** - If we make the repo public later
6. ✅ **Automation** - GitHub Actions can automate issue management

---

## Quick Start

### Prerequisites

Install GitHub CLI:

```bash
# Windows (via winget)
winget install --id GitHub.cli

# Windows (via chocolatey)
choco install gh

# macOS (via homebrew)
brew install gh

# Linux (via apt)
sudo apt install gh
```

Authenticate:

```bash
gh auth login
```

### Run Migration

```bash
node migrate-to-github-issues.js
```

This will:
- ✅ Create all labels (priority, type, status, platform)
- ✅ Create issues for MAN-28, 40, 41, 42, 43, 44
- ✅ Set appropriate labels on each issue
- ✅ Preserve all descriptions and metadata

---

## Migration from Linear

### Migrated Tickets

| Linear ID | Title | Status | GitHub Issue |
|-----------|-------|--------|--------------|
| MAN-28 | Database Query Optimization and Caching | ✅ Done | #TBD |
| MAN-40 | Draft2Digital Export Packages | ✅ Done | #TBD |
| MAN-41 | IngramSpark Export Packages | ✅ Done | #TBD |
| MAN-42 | Apple Books Export Packages | ✅ Done | #TBD |
| MAN-43 | Document Processing Pipeline | ✅ Done | #TBD |
| MAN-44 | Export Packages Frontend UI | ✅ Done | #TBD |

### What's Different?

| Feature | Linear | GitHub Issues |
|---------|--------|---------------|
| **Ticket ID** | MAN-28 | #28 (auto-incrementing) |
| **Status** | Custom statuses | Labels + Project columns |
| **Priority** | Built-in field | Labels (priority: high/medium/low) |
| **MCP Integration** | Not working | GitHub CLI works |
| **Kanban Board** | Built-in | GitHub Projects |
| **Automation** | Linear automations | GitHub Actions |

---

## Using GitHub Issues

### Creating a New Issue

#### Via CLI

```bash
gh issue create \
  --title "Add email notifications for export packages" \
  --body "Users should receive email when export package is ready" \
  --label "type: feature,priority: medium"
```

#### Via Web

1. Go to https://github.com/scarter4work/manuscript-platform/issues
2. Click "New issue"
3. Fill in title and description
4. Add labels
5. Click "Submit new issue"

#### From Code (Claude Code)

When Claude identifies a new feature or bug:

```bash
gh issue create --title "[Feature] Add Kobo export support" \
  --body "Extend export system to support Kobo Writing Life platform" \
  --label "type: feature,priority: low,status: todo"
```

### Viewing Issues

```bash
# List all open issues
gh issue list

# List with specific label
gh issue list --label "status: todo"

# List by priority
gh issue list --label "priority: high"

# List by platform
gh issue list --label "platform: draft2digital"

# View specific issue
gh issue view 28

# View in browser
gh issue view 28 --web
```

### Updating Issues

```bash
# Close an issue
gh issue close 28 --comment "Completed and deployed"

# Reopen an issue
gh issue reopen 28

# Add labels
gh issue edit 28 --add-label "status: in-progress"

# Remove labels
gh issue edit 28 --remove-label "status: todo"

# Add comment
gh issue comment 28 --body "Started implementation"
```

### Searching Issues

```bash
# Search by keyword
gh issue list --search "export"

# Search with filters
gh issue list --search "is:open label:priority:high"

# Search closed issues
gh issue list --state closed

# Search by assignee
gh issue list --assignee scarter4work
```

---

## Using GitHub Projects (Kanban Board)

### Create a Project Board

#### Via Web

1. Go to https://github.com/scarter4work/manuscript-platform/projects
2. Click "New project"
3. Choose "Board" template
4. Name it "Manuscript Platform"
5. Click "Create project"

#### Set Up Columns

Default columns:
- 📋 **Todo** - New tickets waiting to be started
- 🚧 **In Progress** - Currently being worked on
- ✅ **Done** - Completed and deployed

You can customize columns:
- 🔴 **High Priority** - Critical issues
- 🐛 **Bugs** - Bug fixes
- 🎨 **Design** - UI/UX work
- 📚 **Documentation** - Docs and guides

### Adding Issues to Board

1. Open your project board
2. Click "+ Add item"
3. Search for issue number or title
4. Drag issue to appropriate column

### Moving Issues

- Drag and drop between columns
- Or use automation (see below)

### Automation

GitHub Projects supports automation:

1. **Auto-add to project**: When issue is created, add to "Todo" column
2. **Auto-move**: When issue is closed, move to "Done" column
3. **Auto-assign**: When moved to "In Progress", assign to creator

To set up:
1. Open project settings
2. Go to "Workflows"
3. Enable built-in workflows

---

## GitHub CLI Reference

### Essential Commands

```bash
# Issues
gh issue create              # Create new issue
gh issue list                # List issues
gh issue view <number>       # View issue details
gh issue close <number>      # Close issue
gh issue edit <number>       # Edit issue

# Labels
gh label create "name" --color "ff0000"  # Create label
gh label list                            # List all labels
gh label delete "name"                   # Delete label

# Projects
gh project list --owner scarter4work     # List projects
gh project create                        # Create project

# Repository
gh repo view                 # View repo details
gh repo view --web           # Open repo in browser
```

### Useful Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  issues = !gh issue list
  issue-new = !gh issue create
  issue-view = !gh issue view
```

Then use:

```bash
git issues
git issue-new
git issue-view 28
```

---

## Label System

### Priority Labels

| Label | Color | Use Case |
|-------|-------|----------|
| `priority: high` | 🔴 Red | Critical features or bugs blocking users |
| `priority: medium` | 🟡 Yellow | Important but not blocking |
| `priority: low` | 🟢 Green | Nice to have, future enhancements |

### Type Labels

| Label | Color | Use Case |
|-------|-------|----------|
| `type: feature` | 🔵 Blue | New functionality |
| `type: bug` | 🔴 Red | Something isn't working |
| `type: optimization` | 💙 Light Blue | Performance improvements |
| `type: documentation` | 📘 Purple | Docs and guides |

### Status Labels

| Label | Color | Use Case |
|-------|-------|----------|
| `status: todo` | 🟣 Purple | Not started yet |
| `status: in-progress` | 🟡 Yellow | Currently being worked on |
| `status: done` | 🟢 Green | Completed and deployed |
| `status: blocked` | 🔴 Red | Waiting on external dependency |

### Platform Labels

| Label | Color | Platform |
|-------|-------|----------|
| `platform: draft2digital` | 🔵 Blue | Draft2Digital specific |
| `platform: ingramspark` | 🟣 Purple | IngramSpark specific |
| `platform: apple-books` | 🟢 Green | Apple Books specific |
| `platform: kdp` | 🟠 Orange | Amazon KDP specific |

---

## Workflows

### Starting New Work

1. **Find ticket**: Browse issues or project board
   ```bash
   gh issue list --label "status: todo"
   ```

2. **Assign to yourself**:
   ```bash
   gh issue edit 45 --add-assignee @me
   ```

3. **Update status**:
   ```bash
   gh issue edit 45 --add-label "status: in-progress" --remove-label "status: todo"
   ```

4. **Create branch** (optional):
   ```bash
   git checkout -b feature/issue-45-kobo-export
   ```

5. **Work on implementation**

6. **Commit with issue reference**:
   ```bash
   git commit -m "feat: Add Kobo export support (resolves #45)"
   ```

7. **Create PR**:
   ```bash
   gh pr create --title "Add Kobo export support" --body "Closes #45"
   ```

8. **Mark as done** (happens automatically when PR is merged):
   ```bash
   gh issue close 45 --comment "Completed and deployed"
   ```

### Planning New Features

1. **Create epic/parent issue**:
   ```bash
   gh issue create \
     --title "[Epic] Multi-format export system" \
     --body "Implement export for 10+ platforms. Subtasks:\n- [ ] #40 Draft2Digital\n- [ ] #41 IngramSpark\n- [ ] #42 Apple Books"
   ```

2. **Create subtasks**:
   ```bash
   gh issue create --title "Add Barnes & Noble Press export" --label "type: feature,priority: medium,status: todo"
   ```

3. **Link to epic**: Reference parent issue in description
   ```
   Part of epic #50
   ```

### Bug Tracking

1. **Report bug**:
   ```bash
   gh issue create \
     --title "EPUB generation fails for large manuscripts" \
     --body "**Steps to reproduce:**\n1. Upload 500+ page DOCX\n2. Create D2D export\n3. EPUB generation times out\n\n**Expected:** EPUB generated successfully\n**Actual:** Timeout after 30 seconds" \
     --label "type: bug,priority: high"
   ```

2. **Debug and fix**

3. **Close with resolution**:
   ```bash
   gh issue close 55 --comment "Fixed by increasing Worker timeout to 60s and optimizing EPUB generation"
   ```

### Retrospective

After completing a major feature:

1. **Review completed issues**:
   ```bash
   gh issue list --state closed --search "label:status:done sort:updated-desc" --limit 10
   ```

2. **Create summary issue**:
   ```bash
   gh issue create \
     --title "Sprint Summary: Export System" \
     --body "Completed tickets:\n- #40 Draft2Digital\n- #41 IngramSpark\n- #42 Apple Books\n- #43 Document Processing\n- #44 Frontend UI\n\nMetrics:\n- 5 features shipped\n- 850+ lines of frontend code\n- 3 new database tables\n- 100% Workers-compatible"
   ```

---

## Integration with Claude Code

### Claude Creating Issues

When Claude identifies work to be done:

```javascript
// Claude can run:
await bash(`gh issue create --title "Add Kobo export support" --body "Extend export system for Kobo" --label "type: feature,priority: medium"`);
```

### Claude Updating Status

When completing work:

```javascript
// Mark as in-progress
await bash(`gh issue edit ${issueNumber} --add-label "status: in-progress"`);

// Mark as done
await bash(`gh issue close ${issueNumber} --comment "Implementation complete"`);
```

### Claude Querying Backlog

Before starting work:

```javascript
// Get high priority todos
const todos = await bash(`gh issue list --label "priority:high,status:todo" --json number,title`);

// Present options to user
const issues = JSON.parse(todos);
console.log("High priority todos:");
issues.forEach(issue => console.log(`#${issue.number}: ${issue.title}`));
```

---

## Best Practices

### Issue Titles

✅ **Good:**
- `Add Kobo Writing Life export support`
- `Fix EPUB generation timeout for large manuscripts`
- `Optimize database queries for manuscript listing`

❌ **Bad:**
- `bug` (too vague)
- `fix the thing` (unclear)
- `asdfasdf` (meaningless)

### Issue Descriptions

Include:
- ✅ **Context**: Why is this needed?
- ✅ **Acceptance Criteria**: What defines "done"?
- ✅ **Technical Details**: Any implementation notes
- ✅ **Links**: Related issues, docs, PRs

Template:
```markdown
## Overview
Brief description of the feature/bug

## Why
Business justification or user need

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
Implementation details, constraints, considerations

## Related
- #40 (parent issue)
- #41 (dependency)
```

### Labels

- Always add **priority** label
- Always add **type** label
- Update **status** labels as work progresses
- Add **platform** labels for platform-specific work

### Milestones

Create milestones for major releases:

```bash
gh milestone create "v1.0 - Multi-Platform Export" --description "Complete export system for 3 platforms" --due-date 2025-11-30
```

Link issues to milestones:

```bash
gh issue edit 40 --milestone "v1.0 - Multi-Platform Export"
```

---

## Migrating Additional Linear Tickets

If you have more Linear tickets to migrate:

1. Edit `migrate-to-github-issues.js`
2. Add ticket to `TICKETS` array:
   ```javascript
   {
     id: 'MAN-45',
     title: 'New Feature',
     status: 'todo',
     priority: 'medium',
     type: 'feature',
     description: `## Overview\n...`,
     labels: ['priority: medium', 'type: feature', 'status: todo'],
   }
   ```
3. Run migration:
   ```bash
   node migrate-to-github-issues.js
   ```

---

## Troubleshooting

### GitHub CLI Not Installed

```bash
# Check installation
gh --version

# If not installed:
winget install --id GitHub.cli
# or
choco install gh
```

### Not Authenticated

```bash
# Check auth status
gh auth status

# Login
gh auth login
```

### Permission Denied

Make sure you have write access to the repository:

```bash
gh repo view scarter4work/manuscript-platform --json permissions
```

### Label Already Exists

This is fine - the script will skip existing labels.

---

## Resources

- **GitHub Issues Docs**: https://docs.github.com/en/issues
- **GitHub Projects Docs**: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- **GitHub CLI Docs**: https://cli.github.com/manual/
- **GitHub Actions**: https://docs.github.com/en/actions (for automation)

---

## Next Steps

1. ✅ Install GitHub CLI
2. ✅ Run migration script
3. ✅ Create GitHub Project board
4. ✅ Organize issues into columns
5. ✅ Start using GitHub Issues for new work!

**Welcome to GitHub Issues! 🎉**
