# Linear → GitHub Issues Migration

## 📊 Summary

Successfully created migration tooling to move from Linear to GitHub Issues for ticket tracking.

### Why We're Migrating

1. ❌ **Linear MCP server not working** - Connection issues preventing ticket management
2. ✅ **GitHub CLI works reliably** - Tested and functional
3. ✅ **Native integration** - Already using GitHub for code
4. ✅ **Kanban boards** - GitHub Projects provides excellent kanban views
5. ✅ **Free** - No additional cost
6. ✅ **Better automation** - GitHub Actions for workflow automation

---

## 🎯 What's Been Created

### 1. Migration Script (`migrate-to-github-issues.js`)

Comprehensive Node.js script that:
- ✅ Creates all labels (priority, type, status, platform)
- ✅ Migrates 6 completed tickets (MAN-28, 40, 41, 42, 43, 44)
- ✅ Preserves all descriptions and metadata
- ✅ Sets up proper labeling system

**Tickets to be migrated:**
- **MAN-28**: Database Query Optimization and Caching ✅ Done
- **MAN-40**: Draft2Digital Export Packages ✅ Done
- **MAN-41**: IngramSpark Export Packages ✅ Done
- **MAN-42**: Apple Books Export Packages ✅ Done
- **MAN-43**: Document Processing Pipeline ✅ Done
- **MAN-44**: Export Packages Frontend UI ✅ Done

### 2. Complete Guide (`GITHUB-ISSUES-GUIDE.md`)

Comprehensive documentation covering:
- ✅ Installing GitHub CLI
- ✅ Creating and managing issues
- ✅ Setting up kanban board
- ✅ Label system
- ✅ Workflows and best practices
- ✅ Integration with Claude Code
- ✅ GitHub CLI reference

### 3. Installation Script (`install-gh-cli.ps1`)

PowerShell script to install GitHub CLI without admin rights.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install GitHub CLI

Choose one method:

#### Option A: Via Official Installer (Recommended)
1. Download from: https://cli.github.com/
2. Run installer
3. Restart terminal

#### Option B: Via Chocolatey (If you have admin rights)
```bash
choco install gh
```

#### Option C: Via PowerShell Script (No admin)
```powershell
powershell.exe -ExecutionPolicy Bypass -File install-gh-cli.ps1
```

Verify installation:
```bash
gh --version
```

### Step 2: Authenticate

```bash
gh auth login
```

Follow the prompts:
1. Choose "GitHub.com"
2. Choose "HTTPS"
3. Authenticate with your browser or token

### Step 3: Run Migration

```bash
node migrate-to-github-issues.js
```

This will create:
- 📋 13 labels (priority, type, status, platform)
- 🎫 6 issues (MAN-28, 40, 41, 42, 43, 44)
- 🏷️ Proper labels on each issue

---

## 📋 Post-Migration Setup

### Create Kanban Board

1. Visit: https://github.com/scarter4work/manuscript-platform/projects
2. Click "New project"
3. Choose "Board" template
4. Name it "Manuscript Platform"
5. Click "Create project"

### Set Up Columns

Create these columns:
- 📋 **Todo** - Backlog of work
- 🚧 **In Progress** - Active work
- ✅ **Done** - Completed work

### Add Issues to Board

1. Click "+ Add item" in each column
2. Search for issue number or title
3. Drag to organize

### Enable Automation

In project settings → Workflows:
- ✅ Auto-add new issues to "Todo"
- ✅ Auto-move closed issues to "Done"

---

## 🎨 Label System

### Priority
- 🔴 `priority: high` - Critical, blocking users
- 🟡 `priority: medium` - Important but not blocking
- 🟢 `priority: low` - Nice to have

### Type
- 🔵 `type: feature` - New functionality
- 🔴 `type: bug` - Something broken
- 💙 `type: optimization` - Performance improvement
- 📘 `type: documentation` - Docs and guides

### Status
- 🟣 `status: todo` - Not started
- 🟡 `status: in-progress` - Being worked on
- 🟢 `status: done` - Complete and deployed
- 🔴 `status: blocked` - Waiting on dependency

### Platform
- 🔵 `platform: draft2digital`
- 🟣 `platform: ingramspark`
- 🟢 `platform: apple-books`
- 🟠 `platform: kdp`

---

## 💻 Using GitHub Issues

### Create New Issue

```bash
gh issue create \
  --title "Add Kobo Writing Life export support" \
  --body "Extend export system to support Kobo platform" \
  --label "type: feature,priority: medium,status: todo"
```

### List Issues

```bash
# All open issues
gh issue list

# High priority todos
gh issue list --label "priority:high,status:todo"

# Specific platform
gh issue list --label "platform:draft2digital"
```

### Update Issue

```bash
# Mark as in-progress
gh issue edit 45 --add-label "status: in-progress"

# Close as done
gh issue close 45 --comment "Completed and deployed"
```

### View Issue

```bash
# In terminal
gh issue view 45

# In browser
gh issue view 45 --web
```

---

## 🤖 Claude Code Integration

Claude can now manage issues directly:

### Creating Issues

When Claude identifies new work:
```bash
gh issue create --title "Optimize EPUB generation" --body "Reduce memory usage" --label "type: optimization,priority: medium"
```

### Querying Backlog

Before starting work:
```bash
gh issue list --label "priority:high,status:todo" --json number,title
```

### Updating Status

When completing work:
```bash
gh issue edit 28 --add-label "status: in-progress"
gh issue close 28 --comment "Implementation complete"
```

---

## 📊 Comparison: Linear vs GitHub Issues

| Feature | Linear | GitHub Issues |
|---------|--------|---------------|
| **MCP Integration** | ❌ Not working | ✅ GitHub CLI works |
| **Ticket IDs** | MAN-28 | #28 |
| **Cost** | Paid | Free |
| **Kanban Board** | Built-in | GitHub Projects |
| **Automation** | Linear workflows | GitHub Actions |
| **CLI** | `linear-cli` | `gh` (robust) |
| **Integration** | Separate tool | Same as code repo |

---

## 🎯 Next Steps

1. ✅ **Install GitHub CLI** (see Step 1 above)
2. ✅ **Authenticate** (`gh auth login`)
3. ✅ **Run migration** (`node migrate-to-github-issues.js`)
4. ✅ **Create project board** (see Post-Migration Setup)
5. ✅ **Start using GitHub Issues** for new tickets!

---

## 📚 Resources

- **Migration Script**: `migrate-to-github-issues.js`
- **Complete Guide**: `GITHUB-ISSUES-GUIDE.md`
- **GitHub CLI Docs**: https://cli.github.com/manual/
- **GitHub Issues Docs**: https://docs.github.com/en/issues
- **GitHub Projects Docs**: https://docs.github.com/en/issues/planning-and-tracking-with-projects

---

## ✅ Success Criteria

After migration, you should be able to:

- ✅ View all tickets at: https://github.com/scarter4work/manuscript-platform/issues
- ✅ Create new tickets via CLI: `gh issue create`
- ✅ Organize work on kanban board
- ✅ Track progress with labels
- ✅ Claude can manage tickets programmatically

---

## 🆘 Troubleshooting

### "gh: command not found"
- Install GitHub CLI (see Step 1)
- Restart terminal after installation

### "Not logged into any GitHub hosts"
- Run: `gh auth login`
- Follow authentication prompts

### "HTTP 401: Requires authentication"
- Check auth: `gh auth status`
- Re-authenticate: `gh auth refresh`

### Issues not appearing
- Check repo: `gh repo view`
- Verify you have write access

---

## 🎉 Benefits of GitHub Issues

1. **Unified Workflow** - Code and tickets in one place
2. **Better CLI Integration** - `gh` command works reliably
3. **Native Kanban** - GitHub Projects for visual management
4. **Automation** - GitHub Actions for automated workflows
5. **Free** - No additional cost
6. **Public Ready** - Easy to open source later

**Welcome to GitHub Issues! 🚀**
