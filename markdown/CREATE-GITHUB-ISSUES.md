# Create GitHub Issues - Click Links Below

Click each link to create the corresponding issue. GitHub will pre-fill the title and body for you.

## 📋 Issues to Create

### 1. MAN-28: Database Query Optimization and Caching ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-28%5D%20Database%20Query%20Optimization%20and%20Caching&body=%23%23%20Overview%0AImplement%20comprehensive%20database%20query%20optimization%20and%20caching%20system.%0A%0A%23%23%20Features%0A-%20KV-based%20caching%20layer%20with%20TTL%20management%0A-%20Cursor-based%20pagination%20(faster%20than%20OFFSET)%0A-%20Composite%20indexes%20for%20common%20query%20patterns%0A-%20Prepared%20statement%20caching%0A-%20Query%20performance%20monitoring%0A%0A%23%23%20Impact%0A-%2050-80%25%20faster%20API%20responses%0A-%2060-70%25%20reduction%20in%20D1%20query%20costs%0A-%2075%25%20reduction%20in%20R2%20requests%0A-%2010x%20better%20scalability%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20db-cache.js%0A-%20db-utils.js%0A-%20migrations%2F007-query-optimization.sql%0A-%20docs%2FDB-OPTIMIZATION.md&labels=priority%3A%20medium%2Ctype%3A%20optimization%2Cstatus%3A%20done)

**After creating, add labels:** `priority: medium`, `type: optimization`, `status: done`

---

### 2. MAN-40: Draft2Digital Export Packages ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-40%5D%20Draft2Digital%20Export%20Packages&body=%23%23%20Overview%0ABuild%20export%20package%20system%20for%20Draft2Digital%20platform.%0A%0A%23%23%20Features%0A-%20EPUB%20and%20DOCX%20format%20support%0A-%20Cover%20image%20processing%0A-%20README%20generation%20with%20upload%20instructions%0A-%20Package%20expiration%20tracking%20(30%20days)%0A-%20Download%20tracking%0A%0A%23%23%20Technical%20Implementation%0A-%20Database%3A%20d2d_export_packages%20table%0A-%20R2%20Storage%3A%20exports%2Fd2d%2F%7BuserId%7D%2F%7BpackageId%7D%2F%0A-%20API%20Endpoints%3A%20POST%2FGET%20%2Fexports%2Fd2d%2F*%0A-%20Document%20Processing%3A%20JSZip%20for%20EPUB%2C%20mammoth%20for%20DOCX%20parsing%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20export-handler.js%0A-%20epub-generator.js%0A-%20migration_021_multi_platform_exports.sql&labels=priority%3A%20high%2Ctype%3A%20feature%2Cstatus%3A%20done%2Cplatform%3A%20draft2digital)

**After creating, add labels:** `priority: high`, `type: feature`, `status: done`, `platform: draft2digital`

---

### 3. MAN-41: IngramSpark Export Packages ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-41%5D%20IngramSpark%20Export%20Packages&body=%23%23%20Overview%0ABuild%20export%20package%20system%20for%20IngramSpark%20platform%20(print%20and%20ebook).%0A%0A%23%23%20Features%0A-%20Print%20book%20support%20with%20trim%20sizes%2C%20page%20count%2C%20paper%20types%0A-%20Interior%20PDF%20generation%20with%20proper%20bleed%0A-%20Print%20cover%20PDF%20with%20spine%20width%20calculation%0A-%20EPUB%20for%20ebook%20distribution%0A-%20README%20with%20IngramSpark%20upload%20instructions%0A%0A%23%23%20Print%20Options%0A-%20Trim%20Sizes%3A%206x9%2C%205.5x8.5%2C%205x8%2C%208.5x11%0A-%20Page%20Count%3A%2024-828%20(even%20pages)%0A-%20Paper%20Types%3A%20Cream%2FWhite%2050%23-70%23%0A-%20Automatic%20bleed%20inclusion%0A-%20Spine%20width%20calculation%0A%0A%23%23%20Technical%20Implementation%0A-%20Database%3A%20ingramspark_export_packages%20table%0A-%20R2%20Storage%3A%20exports%2Fingramspark%2F%7BuserId%7D%2F%7BpackageId%7D%2F%0A-%20PDF%20Generation%3A%20pdf-lib%20(Workers-compatible)%0A-%20Cover%20Processing%3A%20Spine%20calculation%20%2B%20pdf-lib%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20export-handler.js%0A-%20pdf-generator.js%0A-%20cover-processor.js&labels=priority%3A%20high%2Ctype%3A%20feature%2Cstatus%3A%20done%2Cplatform%3A%20ingramspark)

**After creating, add labels:** `priority: high`, `type: feature`, `status: done`, `platform: ingramspark`

---

### 4. MAN-42: Apple Books Export Packages ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-42%5D%20Apple%20Books%20Export%20Packages&body=%23%23%20Overview%0ABuild%20export%20package%20system%20for%20Apple%20Books%20platform.%0A%0A%23%23%20Features%0A-%20EPUB%203.0%20generation%0A-%20Age%20rating%20and%20explicit%20content%20flags%0A-%20EPUB%20validation%0A-%20Cover%20image%20validation%20and%20processing%0A-%20README%20with%20Apple%20Books%20Connect%20upload%20instructions%0A%0A%23%23%20Validation%0A-%20EPUB%203.0%20compliance%0A-%20Cover%20dimensions%20(1600x2400%20recommended)%0A-%20Metadata%20completeness%0A-%20File%20size%20limits%0A%0A%23%23%20Technical%20Implementation%0A-%20Database%3A%20apple_books_export_packages%20table%0A-%20R2%20Storage%3A%20exports%2Fapple_books%2F%7BuserId%7D%2F%7BpackageId%7D%2F%0A-%20EPUB%20Generation%3A%20JSZip%20%2B%20manual%20EPUB%203.0%20assembly%0A-%20Validation%3A%20format-validator.js%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20export-handler.js%0A-%20epub-generator.js%0A-%20format-validator.js&labels=priority%3A%20high%2Ctype%3A%20feature%2Cstatus%3A%20done%2Cplatform%3A%20apple-books)

**After creating, add labels:** `priority: high`, `type: feature`, `status: done`, `platform: apple-books`

---

### 5. MAN-43: Document Processing Pipeline ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-43%5D%20Document%20Processing%20Pipeline&body=%23%23%20Overview%0ACentral%20document%20processing%20pipeline%20for%20generating%20platform-specific%20export%20packages.%0A%0A%23%23%20Features%0A-%20DOCX%20to%20EPUB%20conversion%20(JSZip%20%2B%20mammoth)%0A-%20DOCX%20to%20PDF%20conversion%20(pdf-lib)%0A-%20Cover%20image%20processing%0A-%20Platform-specific%20format%20handling%0A-%20Multi-platform%20batch%20processing%0A-%20Format%20validation%0A%0A%23%23%20Workers-Compatible%20Libraries%0A-%20%E2%9C%85%20JSZip%20-%20EPUB%20assembly%0A-%20%E2%9C%85%20pdf-lib%20-%20PDF%20generation%0A-%20%E2%9C%85%20mammoth%20-%20DOCX%20parsing%0A-%20%E2%9C%85%20Replaced%20epub-gen-memory%20(uses%20eval())%0A-%20%E2%9C%85%20Replaced%20sharp%20(native%20binaries)%0A-%20%E2%9C%85%20Replaced%20PDFKit%20(compatibility%20issues)%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20document-processor.js%0A-%20epub-generator.js%20(complete%20rewrite)%0A-%20pdf-generator.js%20(complete%20rewrite)%0A-%20cover-processor.js%20(rewrite)%0A-%20format-validator.js&labels=priority%3A%20high%2Ctype%3A%20feature%2Cstatus%3A%20done)

**After creating, add labels:** `priority: high`, `type: feature`, `status: done`

---

### 6. MAN-44: Export Packages Frontend UI ✅

**Status: DONE** - This was already completed

[Click to create issue →](https://github.com/scarter4work/manuscript-platform/issues/new?title=%5BMAN-44%5D%20Export%20Packages%20Frontend%20UI&body=%23%23%20Overview%0AFrontend%20interface%20for%20multi-platform%20export%20package%20system.%0A%0A%23%23%20Features%0A-%20Export%20dashboard%20with%20package%20listing%0A-%20Platform%20filtering%20(D2D%2C%20IngramSpark%2C%20Apple%20Books)%0A-%20Create%20export%20package%20interface%0A-%20Platform-specific%20option%20forms%0A-%20Package%20details%20view%0A-%20Individual%20file%20downloads%0A-%20Status%20badges%20and%20expiration%20tracking%0A%0A%23%23%20UI%2FUX%0A-%20Card-based%20layout%0A-%20Platform%20color%20coding%0A-%20Loading%20states%20and%20animations%0A-%20Responsive%20design%0A-%20Form%20validation%0A-%20Error%20handling%0A%0A%23%23%20Technical%20Implementation%0A-%20Single%20Page%20Application%20(SPA)%0A-%20Vanilla%20JavaScript%20(no%20framework)%0A-%20Multi-view%20navigation%0A-%20API%20integration%20via%20fetch%0A%0A%23%23%20Status%0A%E2%9C%85%20Complete%20and%20deployed%0A%0A%23%23%20Files%0A-%20frontend%2Fexports.html%20(850%2B%20lines)%0A-%20frontend%2Fdashboard-spa.html%20(navigation%20update)%0A%0A%23%23%20Production%0A-%20https%3A%2F%2Fselfpubhub.co%2Fexports.html&labels=priority%3A%20high%2Ctype%3A%20feature%2Cstatus%3A%20done)

**After creating, add labels:** `priority: high`, `type: feature`, `status: done`

---

## 🏷️ Labels to Create First

Before creating issues, create these labels in your repo:

1. Go to: https://github.com/scarter4work/manuscript-platform/labels
2. Click "New label" for each:

### Priority Labels
- **Name:** `priority: high` | **Color:** `#d73a4a` (red)
- **Name:** `priority: medium` | **Color:** `#fbca04` (yellow)
- **Name:** `priority: low` | **Color:** `#0e8a16` (green)

### Type Labels
- **Name:** `type: feature` | **Color:** `#a2eeef` (blue)
- **Name:** `type: bug` | **Color:** `#d73a4a` (red)
- **Name:** `type: optimization` | **Color:** `#c5def5` (light blue)

### Status Labels
- **Name:** `status: done` | **Color:** `#0e8a16` (green)
- **Name:** `status: in-progress` | **Color:** `#fbca04` (yellow)
- **Name:** `status: todo` | **Color:** `#d4c5f9` (purple)

### Platform Labels
- **Name:** `platform: draft2digital` | **Color:** `#e3f2fd` (light blue)
- **Name:** `platform: ingramspark` | **Color:** `#f3e5f5` (light purple)
- **Name:** `platform: apple-books` | **Color:** `#e8f5e9` (light green)

---

## 🎯 Next: Create Project Board

After creating issues:

1. Go to: https://github.com/scarter4work/manuscript-platform/projects
2. Click "New project"
3. Choose "Board" template
4. Name it "Manuscript Platform"
5. Add these columns:
   - 📋 Todo
   - 🚧 In Progress
   - ✅ Done
6. Drag issues into appropriate columns

---

## ✅ Success!

Once complete, you'll have:
- ✅ All Linear tickets migrated to GitHub Issues
- ✅ Proper labeling system
- ✅ Kanban board for visual tracking
- ✅ Better integration with code repo

**All tickets are currently marked as "Done" ✅**
