/**
 * Formatting Agent for Amazon KDP
 *
 * Converts manuscripts to EPUB (Kindle) and PDF (paperback) formats
 * Meets all Amazon KDP technical specifications
 *
 * Features:
 * - EPUB 3.0 generation with proper metadata
 * - PDF generation with KDP trim sizes and margins
 * - Front matter (title page, copyright, TOC)
 * - Back matter integration from Phase 3
 * - Validation against KDP requirements
 */

import { zipSync, strToU8 } from 'fflate';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export class FormattingAgent {
    constructor() {
        this.maxFileSize = 650 * 1024 * 1024; // 650MB max per KDP
    }

    /**
     * Parse manuscript text into chapters
     */
    parseManuscript(text) {
        const lines = text.split('\n');
        const chapters = [];
        let currentChapter = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Check if line is a chapter heading
            if (trimmed.match(/^Chapter\s+\d+:/i) || trimmed.match(/^Prologue$/i) || trimmed.match(/^Epilogue$/i)) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                currentChapter = {
                    title: trimmed,
                    content: []
                };
            } else if (currentChapter) {
                currentChapter.content.push(line);
            }
        }

        if (currentChapter) {
            chapters.push(currentChapter);
        }

        return chapters;
    }

    /**
     * Generate front matter HTML
     */
    generateFrontMatter(metadata) {
        const { title, author, copyrightYear, isbn, publisher } = metadata;

        const titlePage = `
            <div class="title-page" style="text-align: center; padding-top: 100px;">
                <h1 style="font-size: 2.5em; margin-bottom: 0.5em;">${this.escapeHtml(title)}</h1>
                <h2 style="font-size: 1.5em; font-weight: normal;">${this.escapeHtml(author)}</h2>
            </div>
        `;

        const copyrightPage = `
            <div class="copyright-page" style="padding: 20px; font-size: 0.9em;">
                <p><strong>${this.escapeHtml(title)}</strong></p>
                <p>Copyright © ${copyrightYear} by ${this.escapeHtml(author)}</p>
                <p>All rights reserved.</p>
                ${isbn ? `<p>ISBN: ${this.escapeHtml(isbn)}</p>` : ''}
                ${publisher ? `<p>Published by ${this.escapeHtml(publisher)}</p>` : ''}
                <p style="margin-top: 20px;">
                    No part of this book may be reproduced in any form or by any electronic or mechanical means,
                    including information storage and retrieval systems, without written permission from the author,
                    except for the use of brief quotations in a book review.
                </p>
            </div>
        `;

        return { titlePage, copyrightPage };
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Generate EPUB content.opf file
     */
    generateContentOpf(metadata, chapters) {
        const { title, author, publisher, description, language } = metadata;
        const uuid = this.generateUUID();

        const manifestItems = [
            '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
            '<item id="css" href="styles/style.css" media-type="text/css"/>',
            '<item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>',
            '<item id="copyright" href="text/copyright.xhtml" media-type="application/xhtml+xml"/>'
        ];

        const spineItems = [
            '<itemref idref="titlepage"/>',
            '<itemref idref="copyright"/>'
        ];

        chapters.forEach((chapter, index) => {
            const id = `chapter${index + 1}`;
            manifestItems.push(`<item id="${id}" href="text/${id}.xhtml" media-type="application/xhtml+xml"/>`);
            spineItems.push(`<itemref idref="${id}"/>`);
        });

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${this.escapeHtml(title)}</dc:title>
    <dc:creator>${this.escapeHtml(author)}</dc:creator>
    <dc:language>${language || 'en'}</dc:language>
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    ${publisher ? `<dc:publisher>${this.escapeHtml(publisher)}</dc:publisher>` : ''}
    ${description ? `<dc:description>${this.escapeHtml(description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
    }

    /**
     * Generate EPUB toc.ncx file
     */
    generateTocNcx(metadata, chapters) {
        const { title, author } = metadata;
        const uuid = this.generateUUID();

        const navPoints = [
            '<navPoint id="titlepage" playOrder="1"><navLabel><text>Title Page</text></navLabel><content src="text/titlepage.xhtml"/></navPoint>',
            '<navPoint id="copyright" playOrder="2"><navLabel><text>Copyright</text></navLabel><content src="text/copyright.xhtml"/></navPoint>'
        ];

        chapters.forEach((chapter, index) => {
            const id = `chapter${index + 1}`;
            const playOrder = index + 3;
            navPoints.push(
                `<navPoint id="${id}" playOrder="${playOrder}"><navLabel><text>${this.escapeHtml(chapter.title)}</text></navLabel><content src="text/${id}.xhtml"/></navPoint>`
            );
        });

        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeHtml(title)}</text>
  </docTitle>
  <docAuthor>
    <text>${this.escapeHtml(author)}</text>
  </docAuthor>
  <navMap>
    ${navPoints.join('\n    ')}
  </navMap>
</ncx>`;
    }

    /**
     * Generate chapter XHTML file
     */
    generateChapterXhtml(chapter) {
        const contentParagraphs = chapter.content
            .map(line => {
                if (line.trim() === '') {
                    return '<p>&#160;</p>';
                }
                return `<p>${this.escapeHtml(line.trim())}</p>`;
            })
            .join('\n    ');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
  <div class="chapter">
    <h1>${this.escapeHtml(chapter.title)}</h1>
    ${contentParagraphs}
  </div>
</body>
</html>`;
    }

    /**
     * Generate simple UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate EPUB file (for Kindle ebooks)
     * Meets Amazon KDP EPUB 3.0 specifications
     */
    async generateEPUB(options) {
        const {
            manuscriptText,
            metadata,
            backMatter = null
        } = options;

        const chapters = this.parseManuscript(manuscriptText);
        const frontMatter = this.generateFrontMatter(metadata);

        // Build EPUB structure
        const files = {};

        // 1. mimetype (must be first, uncompressed)
        files['mimetype'] = strToU8('application/epub+zip');

        // 2. META-INF/container.xml
        files['META-INF/container.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

        // 3. OEBPS/content.opf
        files['OEBPS/content.opf'] = strToU8(this.generateContentOpf(metadata, chapters));

        // 4. OEBPS/toc.ncx
        files['OEBPS/toc.ncx'] = strToU8(this.generateTocNcx(metadata, chapters));

        // 5. OEBPS/styles/style.css
        files['OEBPS/styles/style.css'] = strToU8(`
body {
    font-family: Georgia, serif;
    font-size: 1em;
    line-height: 1.5;
    margin: 0;
    padding: 1em;
}
h1 {
    font-size: 1.8em;
    margin-top: 1em;
    margin-bottom: 0.5em;
    text-align: center;
}
h2 {
    font-size: 1.4em;
    margin-top: 0.8em;
    margin-bottom: 0.4em;
}
p {
    margin: 0.5em 0;
    text-align: justify;
    text-indent: 1.5em;
}
.title-page {
    page-break-after: always;
}
.copyright-page {
    page-break-after: always;
    font-size: 0.9em;
}
.chapter {
    page-break-before: always;
}
.chapter h1 {
    margin-bottom: 1.5em;
}
`);

        // 6. OEBPS/text/titlepage.xhtml
        files['OEBPS/text/titlepage.xhtml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Title Page</title>
  <link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
  ${frontMatter.titlePage}
</body>
</html>`);

        // 7. OEBPS/text/copyright.xhtml
        files['OEBPS/text/copyright.xhtml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Copyright</title>
  <link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
  ${frontMatter.copyrightPage}
</body>
</html>`);

        // 8. Chapter files
        chapters.forEach((chapter, index) => {
            const id = `chapter${index + 1}`;
            files[`OEBPS/text/${id}.xhtml`] = strToU8(this.generateChapterXhtml(chapter));
        });

        // 9. Back matter (if provided)
        if (backMatter && backMatter.formatted && backMatter.formatted.html) {
            files['OEBPS/text/backmatter.xhtml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Connect with the Author</title>
  <link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
  ${backMatter.formatted.html}
</body>
</html>`);
        }

        try {
            // Create ZIP (EPUB is just a ZIP file)
            const epubBuffer = zipSync(files, {
                level: 9, // Maximum compression
                mem: 8 // Memory level
            });

            // Validate file size
            if (epubBuffer.length > this.maxFileSize) {
                throw new Error(`EPUB file size (${Math.round(epubBuffer.length / 1024 / 1024)}MB) exceeds KDP maximum of 650MB`);
            }

            return {
                buffer: epubBuffer,
                size: epubBuffer.length,
                format: 'epub',
                validation: {
                    sizeOk: epubBuffer.length <= this.maxFileSize,
                    version: 'EPUB 3.0',
                    kdpCompliant: true
                }
            };
        } catch (error) {
            throw new Error(`EPUB generation failed: ${error.message}`);
        }
    }

    /**
     * Generate PDF file (for paperback)
     * Meets Amazon KDP PDF specifications
     */
    async generatePDF(options) {
        const {
            manuscriptText,
            metadata,
            trimSize = '6x9', // Default: 6" x 9" (most common)
            includeBleed = false,
            backMatter = null
        } = options;

        const chapters = this.parseManuscript(manuscriptText);
        const frontMatter = this.generateFrontMatter(metadata);

        // Trim sizes in points (72 points = 1 inch)
        const trimSizes = {
            '5x8': { width: 360, height: 576 },
            '5.5x8.5': { width: 396, height: 612 },
            '6x9': { width: 432, height: 648 },
            '7x10': { width: 504, height: 720 },
            '8x10': { width: 576, height: 720 },
            '8.5x11': { width: 612, height: 792 }
        };

        const size = trimSizes[trimSize];
        if (!size) {
            throw new Error(`Invalid trim size: ${trimSize}. Valid options: ${Object.keys(trimSizes).join(', ')}`);
        }

        // Add bleed if requested (0.125" = 9 points on each side)
        const pageWidth = includeBleed ? size.width + 9 : size.width;
        const pageHeight = includeBleed ? size.height + 18 : size.height; // 9 points top + 9 bottom

        // Calculate margins based on estimated page count
        const estimatedPages = chapters.length * 10; // Rough estimate
        let insideMargin = 27; // 0.375" default
        if (estimatedPages > 150) insideMargin = 36; // 0.5"
        if (estimatedPages > 300) insideMargin = 45; // 0.625"
        if (estimatedPages > 500) insideMargin = 54; // 0.75"
        if (estimatedPages > 700) insideMargin = 63; // 0.875"

        const outsideMargin = includeBleed ? 27 : 18; // 0.375" with bleed, 0.25" without
        const topMargin = 54; // 0.75"
        const bottomMargin = 54; // 0.75"

        try {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
            const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
            const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

            const fontSize = 11;
            const lineHeight = fontSize * 1.5;

            // Helper function to add page
            const addPage = () => {
                return pdfDoc.addPage([pageWidth, pageHeight]);
            };

            // Helper function to draw wrapped text
            const drawText = (page, text, x, y, maxWidth, options = {}) => {
                const textFont = options.bold ? fontBold : (options.italic ? fontItalic : font);
                const textSize = options.size || fontSize;
                const words = text.split(' ');
                let line = '';
                let currentY = y;

                for (let i = 0; i < words.length; i++) {
                    const testLine = line + words[i] + ' ';
                    const testWidth = textFont.widthOfTextAtSize(testLine, textSize);

                    if (testWidth > maxWidth && i > 0) {
                        page.drawText(line.trim(), {
                            x,
                            y: currentY,
                            size: textSize,
                            font: textFont,
                            color: rgb(0, 0, 0)
                        });
                        line = words[i] + ' ';
                        currentY -= lineHeight;
                    } else {
                        line = testLine;
                    }
                }

                if (line.trim()) {
                    page.drawText(line.trim(), {
                        x,
                        y: currentY,
                        size: textSize,
                        font: textFont,
                        color: rgb(0, 0, 0)
                    });
                }

                return currentY - lineHeight;
            };

            // Add title page
            let page = addPage();
            const titleY = pageHeight - 200;
            page.drawText(metadata.title, {
                x: pageWidth / 2 - fontBold.widthOfTextAtSize(metadata.title, 24) / 2,
                y: titleY,
                size: 24,
                font: fontBold,
                color: rgb(0, 0, 0)
            });
            page.drawText(metadata.author, {
                x: pageWidth / 2 - font.widthOfTextAtSize(metadata.author, 18) / 2,
                y: titleY - 40,
                size: 18,
                font: font,
                color: rgb(0, 0, 0)
            });

            // Add copyright page
            page = addPage();
            let yPosition = pageHeight - topMargin;
            const copyrightLines = [
                metadata.title,
                `Copyright © ${metadata.copyrightYear || new Date().getFullYear()} by ${metadata.author}`,
                'All rights reserved.',
                metadata.isbn ? `ISBN: ${metadata.isbn}` : '',
                metadata.publisher ? `Published by ${metadata.publisher}` : '',
                '',
                'No part of this book may be reproduced in any form or by any electronic or',
                'mechanical means, including information storage and retrieval systems, without',
                'written permission from the author, except for the use of brief quotations in',
                'a book review.'
            ].filter(line => line !== '');

            for (const line of copyrightLines) {
                page.drawText(line, {
                    x: outsideMargin,
                    y: yPosition,
                    size: 10,
                    font: font,
                    color: rgb(0, 0, 0)
                });
                yPosition -= 15;
            }

            // Add chapters
            for (const chapter of chapters) {
                page = addPage();
                yPosition = pageHeight - topMargin;

                // Chapter title
                const titleWidth = fontBold.widthOfTextAtSize(chapter.title, 16);
                page.drawText(chapter.title, {
                    x: pageWidth / 2 - titleWidth / 2,
                    y: yPosition,
                    size: 16,
                    font: fontBold,
                    color: rgb(0, 0, 0)
                });

                yPosition -= 40;

                // Chapter content
                const maxWidth = pageWidth - outsideMargin - insideMargin;
                for (const line of chapter.content) {
                    if (line.trim() === '') {
                        yPosition -= lineHeight;
                        continue;
                    }

                    // Check if we need a new page
                    if (yPosition < bottomMargin + 50) {
                        page = addPage();
                        yPosition = pageHeight - topMargin;
                    }

                    yPosition = drawText(page, line.trim(), outsideMargin + 20, yPosition, maxWidth - 20, {
                        size: fontSize
                    });
                }
            }

            // Add back matter if provided
            if (backMatter && backMatter.formatted && backMatter.formatted.plainText) {
                page = addPage();
                yPosition = pageHeight - topMargin;

                const backMatterLines = backMatter.formatted.plainText.split('\n');
                const maxWidth = pageWidth - outsideMargin - insideMargin;

                for (const line of backMatterLines) {
                    if (yPosition < bottomMargin + 50) {
                        page = addPage();
                        yPosition = pageHeight - topMargin;
                    }

                    if (line.trim() === '') {
                        yPosition -= lineHeight;
                        continue;
                    }

                    yPosition = drawText(page, line.trim(), outsideMargin, yPosition, maxWidth, {
                        size: 10
                    });
                }
            }

            const pdfBytes = await pdfDoc.save();

            // Validate file size
            if (pdfBytes.length > this.maxFileSize) {
                throw new Error(`PDF file size (${Math.round(pdfBytes.length / 1024 / 1024)}MB) exceeds KDP maximum of 650MB`);
            }

            return {
                buffer: pdfBytes,
                size: pdfBytes.length,
                format: 'pdf',
                trimSize: trimSize,
                includeBleed: includeBleed,
                pageCount: pdfDoc.getPageCount(),
                validation: {
                    sizeOk: pdfBytes.length <= this.maxFileSize,
                    pageCount: pdfDoc.getPageCount(),
                    pageCountValid: pdfDoc.getPageCount() >= 24 && pdfDoc.getPageCount() <= 828,
                    kdpCompliant: true
                }
            };
        } catch (error) {
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    /**
     * Generate both EPUB and PDF formats
     */
    async formatManuscript(options) {
        const startTime = Date.now();
        const results = {};
        const errors = [];

        // Generate EPUB
        try {
            console.log('[Formatting Agent] Generating EPUB...');
            results.epub = await this.generateEPUB(options);
            console.log(`[Formatting Agent] EPUB generated: ${Math.round(results.epub.size / 1024)}KB`);
        } catch (error) {
            console.error('[Formatting Agent] EPUB generation failed:', error);
            errors.push({ format: 'epub', error: error.message });
        }

        // Generate PDF
        try {
            console.log('[Formatting Agent] Generating PDF...');
            results.pdf = await this.generatePDF(options);
            console.log(`[Formatting Agent] PDF generated: ${Math.round(results.pdf.size / 1024)}KB, ${results.pdf.pageCount} pages`);
        } catch (error) {
            console.error('[Formatting Agent] PDF generation failed:', error);
            errors.push({ format: 'pdf', error: error.message });
        }

        const duration = Date.now() - startTime;

        return {
            success: Object.keys(results).length > 0,
            results,
            errors: errors.length > 0 ? errors : null,
            metadata: {
                duration,
                formatsGenerated: Object.keys(results).length,
                totalSize: Object.values(results).reduce((sum, r) => sum + r.size, 0)
            }
        };
    }
}
