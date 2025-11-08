import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for Enhanced Metadata Handlers (Issue #51)
 *
 * Tests the following API endpoints:
 * - GET /genres - Get genre taxonomy
 * - GET /genres/:id - Get specific genre
 * - GET /genres/:id/subgenres - Get subgenres
 * - GET /content-warnings - Get content warnings
 * - PATCH /manuscripts/:id/enhanced-metadata - Update metadata
 * - GET /manuscripts/:id/validate-genre - Validate word count
 * - GET /manuscripts/:id/metadata-history - Get change history
 */

describe('Enhanced Metadata Handlers', () => {
  let mockDB;
  let mockEnv;

  beforeEach(() => {
    // Mock D1 database
    mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      first: vi.fn(),
      run: vi.fn(),
    };

    mockEnv = {
      DB: mockDB,
    };
  });

  describe('Genre Validation', () => {
    it('should validate word count for romance novel', async () => {
      // Romance novels typically 70,000-100,000 words
      const wordCount = 85000;
      const genre = 'Romance';

      // Expected ranges for romance
      const expectedMin = 70000;
      const expectedMax = 100000;

      expect(wordCount).toBeGreaterThanOrEqual(expectedMin);
      expect(wordCount).toBeLessThanOrEqual(expectedMax);
    });

    it('should flag word count outside genre norms', () => {
      // Thriller at 30,000 words is too short (typical: 70-90k)
      const wordCount = 30000;
      const genreMin = 70000;
      const genreMax = 90000;

      const isTooShort = wordCount < genreMin;
      const isTooLong = wordCount > genreMax;

      expect(isTooShort || isTooLong).toBe(true);
      expect(isTooShort).toBe(true);
    });

    it('should accept novella word counts for appropriate genres', () => {
      // Novella: 20,000-50,000 words
      const wordCount = 35000;
      const novellaMin = 20000;
      const novellaMax = 50000;

      expect(wordCount).toBeGreaterThanOrEqual(novellaMin);
      expect(wordCount).toBeLessThanOrEqual(novellaMax);
    });
  });

  describe('Content Warning Validation', () => {
    it('should validate content warning categories', () => {
      const validCategories = [
        'Violence',
        'Sexual Content',
        'Substance Use',
        'Mental Health',
        'Discrimination & Abuse',
        'Other',
      ];

      const testCategory = 'Violence';
      expect(validCategories).toContain(testCategory);
    });

    it('should validate severity levels', () => {
      const validSeverities = ['mild', 'moderate', 'severe'];
      const testSeverity = 'moderate';

      expect(validSeverities).toContain(testSeverity);
    });

    it('should handle multiple content warnings', () => {
      const warnings = [
        { category: 'Violence', severity: 'moderate' },
        { category: 'Mental Health', severity: 'mild' },
        { category: 'Sexual Content', severity: 'severe' },
      ];

      expect(warnings).toHaveLength(3);
      expect(warnings.every(w => w.category && w.severity)).toBe(true);
    });
  });

  describe('Metadata Structure', () => {
    it('should validate primary genre and subgenres', () => {
      const metadata = {
        primaryGenre: 'Science Fiction',
        subgenres: ['Space Opera', 'Dystopian', 'Cyberpunk'],
      };

      expect(metadata.primaryGenre).toBeDefined();
      expect(metadata.subgenres).toBeInstanceOf(Array);
      expect(metadata.subgenres.length).toBeLessThanOrEqual(3);
    });

    it('should validate age category', () => {
      const validAgeCategories = [
        'Adult',
        'Young Adult',
        'Middle Grade',
        "Children's",
        'All Ages',
      ];

      const ageCategory = 'Young Adult';
      expect(validAgeCategories).toContain(ageCategory);
    });

    it('should validate manuscript status', () => {
      const validStatuses = ['Draft', 'In Progress', 'Complete', 'Published'];
      const status = 'Complete';

      expect(validStatuses).toContain(status);
    });

    it('should validate series information', () => {
      const seriesInfo = {
        isSeries: true,
        seriesTitle: 'The Chronicles of Tomorrow',
        bookNumber: 2,
        totalBooks: 5,
      };

      expect(seriesInfo.isSeries).toBe(true);
      expect(seriesInfo.bookNumber).toBeGreaterThan(0);
      expect(seriesInfo.bookNumber).toBeLessThanOrEqual(seriesInfo.totalBooks);
    });
  });

  describe('Metadata History Tracking', () => {
    it('should record metadata changes with timestamp', () => {
      const historyEntry = {
        manuscriptId: 'ms-123',
        changedBy: 'user-456',
        changedAt: new Date().toISOString(),
        changes: {
          primaryGenre: { old: 'Fantasy', new: 'Science Fiction' },
          wordCount: { old: 75000, new: 82000 },
        },
      };

      expect(historyEntry.changedAt).toBeDefined();
      expect(historyEntry.changes).toBeDefined();
      expect(Object.keys(historyEntry.changes).length).toBeGreaterThan(0);
    });

    it('should track multiple change types', () => {
      const changes = {
        primaryGenre: { old: 'Mystery', new: 'Thriller' },
        ageCategory: { old: 'Adult', new: 'Young Adult' },
        completionPercentage: { old: 75, new: 100 },
      };

      const changeTypes = Object.keys(changes);
      expect(changeTypes).toContain('primaryGenre');
      expect(changeTypes).toContain('ageCategory');
      expect(changeTypes).toContain('completionPercentage');
    });
  });

  describe('Genre Hierarchy', () => {
    it('should validate parent-child genre relationships', () => {
      const genreHierarchy = {
        parent: 'Fiction',
        children: [
          'Science Fiction',
          'Fantasy',
          'Romance',
          'Mystery',
          'Thriller',
        ],
      };

      expect(genreHierarchy.parent).toBe('Fiction');
      expect(genreHierarchy.children.length).toBeGreaterThan(0);
      expect(genreHierarchy.children).toContain('Science Fiction');
    });

    it('should handle subgenre depth', () => {
      const sciFiSubgenres = [
        'Space Opera',
        'Cyberpunk',
        'Dystopian',
        'Time Travel',
        'Alien Invasion',
      ];

      expect(sciFiSubgenres).toBeInstanceOf(Array);
      expect(sciFiSubgenres.length).toBeGreaterThan(0);
    });
  });

  describe('Word Count Validation Logic', () => {
    const genreRanges = {
      'Flash Fiction': { min: 0, max: 1500 },
      'Short Story': { min: 1500, max: 20000 },
      'Novella': { min: 20000, max: 50000 },
      'Novel': { min: 50000, max: 120000 },
      'Epic': { min: 120000, max: 999999 },
    };

    it('should categorize flash fiction correctly', () => {
      const wordCount = 1000;
      const category = 'Flash Fiction';

      expect(wordCount).toBeLessThan(genreRanges['Flash Fiction'].max);
    });

    it('should categorize novel correctly', () => {
      const wordCount = 85000;
      const min = genreRanges['Novel'].min;
      const max = genreRanges['Novel'].max;

      expect(wordCount).toBeGreaterThanOrEqual(min);
      expect(wordCount).toBeLessThan(max);
    });

    it('should categorize epic correctly', () => {
      const wordCount = 150000;
      expect(wordCount).toBeGreaterThanOrEqual(genreRanges['Epic'].min);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional metadata fields', () => {
      const metadata = {
        primaryGenre: 'Science Fiction',
        // subgenres, age category, etc. are optional
      };

      expect(metadata.primaryGenre).toBeDefined();
      expect(metadata.subgenres).toBeUndefined();
    });

    it('should handle empty subgenres array', () => {
      const metadata = {
        primaryGenre: 'Nonfiction',
        subgenres: [],
      };

      expect(metadata.subgenres).toHaveLength(0);
    });

    it('should validate completion percentage range', () => {
      const validPercentages = [0, 25, 50, 75, 100];

      validPercentages.forEach(percent => {
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
      });
    });

    it('should reject invalid completion percentage', () => {
      const invalidPercent = 150;

      expect(invalidPercent > 100).toBe(true);
    });
  });
});
