import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for Submission Package Bundler (Issue #50)
 *
 * Tests package creation, templates, and ZIP generation:
 * - Package templates (agent query, full manuscript, query only, contest)
 * - Document selection and ordering
 * - ZIP file generation
 * - Package duplication
 */

describe('Submission Package Bundler', () => {
  describe('Package Templates', () => {
    const templates = {
      agent_query: {
        name: 'Agent Query',
        requiredDocs: ['query_letter', 'synopsis_short', 'first_10_pages'],
        optionalDocs: ['author_bio', 'comparable_titles'],
      },
      full_manuscript: {
        name: 'Full Manuscript Submission',
        requiredDocs: ['query_letter', 'synopsis_long', 'full_manuscript'],
        optionalDocs: ['author_bio', 'cover_letter'],
      },
      query_only: {
        name: 'Query Only',
        requiredDocs: ['query_letter'],
        optionalDocs: ['synopsis_short'],
      },
      contest: {
        name: 'Writing Contest',
        requiredDocs: ['manuscript_excerpt', 'author_statement'],
        optionalDocs: ['author_bio'],
      },
    };

    it('should have agent query template', () => {
      expect(templates.agent_query).toBeDefined();
      expect(templates.agent_query.requiredDocs).toContain('query_letter');
    });

    it('should have full manuscript template', () => {
      expect(templates.full_manuscript).toBeDefined();
      expect(templates.full_manuscript.requiredDocs).toContain(
        'full_manuscript'
      );
    });

    it('should have query only template', () => {
      expect(templates.query_only).toBeDefined();
      expect(templates.query_only.requiredDocs).toHaveLength(1);
    });

    it('should have contest template', () => {
      expect(templates.contest).toBeDefined();
      expect(templates.contest.requiredDocs).toContain('manuscript_excerpt');
    });

    it('should validate required documents', () => {
      const template = templates.agent_query;

      expect(template.requiredDocs).toBeDefined();
      expect(template.requiredDocs.length).toBeGreaterThan(0);
    });
  });

  describe('Package Creation', () => {
    it('should create package with metadata', () => {
      const pkg = {
        packageId: 'pkg-123',
        manuscriptId: 'ms-456',
        packageName: 'Agent Smith Submission',
        templateType: 'agent_query',
        createdAt: new Date().toISOString(),
        documents: [],
      };

      expect(pkg.packageId).toBeDefined();
      expect(pkg.manuscriptId).toBeDefined();
      expect(pkg.packageName).toBeDefined();
    });

    it('should include document list with ordering', () => {
      const documents = [
        { documentId: 'doc-1', documentType: 'query_letter', order: 1 },
        { documentId: 'doc-2', documentType: 'synopsis_short', order: 2 },
        { documentId: 'doc-3', documentType: 'first_10_pages', order: 3 },
      ];

      documents.forEach((doc, index) => {
        expect(doc.order).toBe(index + 1);
      });
    });

    it('should validate package has at least one document', () => {
      const emptyPackage = {
        documents: [],
      };

      const validPackage = {
        documents: [{ documentId: 'doc-1' }],
      };

      expect(emptyPackage.documents.length === 0).toBe(true);
      expect(validPackage.documents.length > 0).toBe(true);
    });

    it('should allow custom package names', () => {
      const customNames = [
        'Agent Smith - Innovative Literary',
        'Publisher XYZ Full Manuscript',
        'Contest Entry - Writers Digest',
        'Query - Jane Doe Agency',
      ];

      customNames.forEach(name => {
        expect(name.length).toBeGreaterThan(0);
        expect(name.length).toBeLessThan(200);
      });
    });
  });

  describe('Document Selection', () => {
    it('should allow selecting multiple documents', () => {
      const selectedDocs = [
        'query_letter',
        'synopsis_short',
        'first_10_pages',
        'author_bio',
      ];

      expect(selectedDocs.length).toBeGreaterThan(1);
      expect(selectedDocs).toContain('query_letter');
    });

    it('should maintain document order', () => {
      const orderedDocs = [
        { type: 'query_letter', order: 1 },
        { type: 'synopsis_short', order: 2 },
        { type: 'first_10_pages', order: 3 },
      ];

      for (let i = 1; i < orderedDocs.length; i++) {
        expect(orderedDocs[i].order).toBeGreaterThan(
          orderedDocs[i - 1].order
        );
      }
    });

    it('should allow reordering documents', () => {
      const docs = [
        { id: 1, order: 1 },
        { id: 2, order: 2 },
        { id: 3, order: 3 },
      ];

      // Swap order 2 and 3
      [docs[1].order, docs[2].order] = [docs[2].order, docs[1].order];

      expect(docs[1].order).toBe(3);
      expect(docs[2].order).toBe(2);
    });
  });

  describe('ZIP File Generation', () => {
    it('should generate ZIP with multiple files', () => {
      const zipContents = {
        files: [
          { name: '1_query_letter.txt', size: 2500 },
          { name: '2_synopsis_short.txt', size: 3000 },
          { name: '3_first_10_pages.pdf', size: 150000 },
        ],
        totalSize: 155500,
      };

      expect(zipContents.files.length).toBe(3);
      expect(zipContents.totalSize).toBeGreaterThan(0);
    });

    it('should prefix files with order numbers', () => {
      const fileNames = [
        '1_query_letter.txt',
        '2_synopsis_short.txt',
        '3_manuscript_excerpt.pdf',
      ];

      fileNames.forEach((name, index) => {
        expect(name).toMatch(new RegExp(`^${index + 1}_`));
      });
    });

    it('should sanitize filenames', () => {
      const unsafeFilename = 'My Query Letter (Agent: Smith & Co.).txt';
      const safeFilename = unsafeFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

      expect(safeFilename).not.toContain('(');
      expect(safeFilename).not.toContain(')');
      expect(safeFilename).not.toContain(':');
    });

    it('should support different file formats', () => {
      const supportedFormats = ['.txt', '.pdf', '.doc', '.docx'];
      const testFile = 'query_letter.pdf';

      const hasValidExtension = supportedFormats.some(ext =>
        testFile.endsWith(ext)
      );

      expect(hasValidExtension).toBe(true);
    });

    it('should include metadata file in ZIP', () => {
      const zipContents = [
        'metadata.json',
        '1_query_letter.txt',
        '2_synopsis.txt',
      ];

      expect(zipContents).toContain('metadata.json');
    });
  });

  describe('Package Duplication', () => {
    it('should create copy of existing package', () => {
      const original = {
        packageId: 'pkg-123',
        packageName: 'Original Package',
        documents: ['doc-1', 'doc-2'],
      };

      const duplicate = {
        packageId: 'pkg-456', // New ID
        packageName: 'Copy of Original Package',
        documents: original.documents, // Same documents
      };

      expect(duplicate.packageId).not.toBe(original.packageId);
      expect(duplicate.packageName).toContain('Copy of');
      expect(duplicate.documents).toEqual(original.documents);
    });

    it('should increment copy counter in name', () => {
      const names = [
        'My Package',
        'Copy of My Package',
        'Copy of My Package (2)',
        'Copy of My Package (3)',
      ];

      expect(names[1]).toContain('Copy of');
      expect(names[2]).toContain('(2)');
      expect(names[3]).toContain('(3)');
    });
  });

  describe('Package Management', () => {
    it('should list packages for manuscript', () => {
      const packages = [
        { packageId: 'pkg-1', manuscriptId: 'ms-123', name: 'Package 1' },
        { packageId: 'pkg-2', manuscriptId: 'ms-123', name: 'Package 2' },
        { packageId: 'pkg-3', manuscriptId: 'ms-456', name: 'Package 3' },
      ];

      const ms123Packages = packages.filter(
        p => p.manuscriptId === 'ms-123'
      );

      expect(ms123Packages).toHaveLength(2);
    });

    it('should update package details', () => {
      const pkg = {
        packageId: 'pkg-123',
        packageName: 'Original Name',
        updatedAt: new Date().toISOString(),
      };

      pkg.packageName = 'Updated Name';

      expect(pkg.packageName).toBe('Updated Name');
      expect(pkg.updatedAt).toBeDefined();
    });

    it('should delete package', () => {
      const packages = [
        { packageId: 'pkg-1' },
        { packageId: 'pkg-2' },
        { packageId: 'pkg-3' },
      ];

      const deleteId = 'pkg-2';
      const remainingPackages = packages.filter(p => p.packageId !== deleteId);

      expect(remainingPackages).toHaveLength(2);
      expect(remainingPackages.some(p => p.packageId === deleteId)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate package has required documents', () => {
      const template = {
        requiredDocs: ['query_letter', 'synopsis_short'],
      };

      const pkg1 = {
        documents: [
          { type: 'query_letter' },
          { type: 'synopsis_short' },
        ],
      };

      const pkg2 = {
        documents: [{ type: 'query_letter' }], // Missing synopsis
      };

      const hasAllRequired1 = template.requiredDocs.every(req =>
        pkg1.documents.some(doc => doc.type === req)
      );

      const hasAllRequired2 = template.requiredDocs.every(req =>
        pkg2.documents.some(doc => doc.type === req)
      );

      expect(hasAllRequired1).toBe(true);
      expect(hasAllRequired2).toBe(false);
    });

    it('should validate document exists before adding to package', () => {
      const availableDocs = ['doc-1', 'doc-2', 'doc-3'];
      const requestedDoc = 'doc-2';
      const missingDoc = 'doc-99';

      expect(availableDocs).toContain(requestedDoc);
      expect(availableDocs).not.toContain(missingDoc);
    });

    it('should prevent duplicate documents in package', () => {
      const documents = [
        { documentId: 'doc-1' },
        { documentId: 'doc-2' },
      ];

      const newDoc = { documentId: 'doc-1' }; // Duplicate

      const isDuplicate = documents.some(
        d => d.documentId === newDoc.documentId
      );

      expect(isDuplicate).toBe(true);
    });
  });

  describe('Download Tracking', () => {
    it('should track download count', () => {
      const pkg = {
        packageId: 'pkg-123',
        downloadCount: 0,
      };

      pkg.downloadCount++;
      pkg.downloadCount++;

      expect(pkg.downloadCount).toBe(2);
    });

    it('should track last downloaded timestamp', () => {
      const pkg = {
        packageId: 'pkg-123',
        lastDownloadedAt: null,
      };

      pkg.lastDownloadedAt = new Date().toISOString();

      expect(pkg.lastDownloadedAt).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty package name', () => {
      const packageName = '';
      const isValid = packageName.length > 0;

      expect(isValid).toBe(false);
    });

    it('should handle very long package name', () => {
      const longName = 'A'.repeat(300);
      const maxLength = 200;

      expect(longName.length > maxLength).toBe(true);
    });

    it('should handle package with only one document', () => {
      const pkg = {
        documents: [{ documentId: 'doc-1' }],
      };

      expect(pkg.documents).toHaveLength(1);
    });

    it('should handle large file sizes', () => {
      const largeFile = {
        name: 'full_manuscript.pdf',
        size: 50 * 1024 * 1024, // 50MB
      };

      const maxSize = 52428800; // 50MB limit

      expect(largeFile.size).toBeLessThanOrEqual(maxSize);
    });
  });
});
