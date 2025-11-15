/**
 * Supporting Documents Handlers (Issue #49)
 *
 * Manages query letters, synopsis, and sample chapters for traditional publishing submissions.
 *
 * Features:
 * - AI generation of query letters and synopsis
 * - Version management with rollback
 * - Word count tracking
 * - Document CRUD operations
 */

import { getUserFromRequest } from '../utils/auth-utils.js';
import { generateQueryLetter, validateQueryLetter } from '../generators/query-letter-generator.js';
import { generateSynopsis, validateSynopsis, generateBothSynopses } from '../generators/synopsis-generator.js';
import crypto from 'crypto';

/**
 * POST /manuscripts/:id/documents/generate
 * Generate supporting document using AI
 *
 * Body: {
 *   documentType: 'query_letter' | 'short_synopsis' | 'long_synopsis',
 *   authorInfo: { authorName, previousWorks, awards, credentials, etc. },
 *   targetAgent: 'Agent Name' (optional, for query letters)
 * }
 */
export async function generateDocument(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get manuscript and verify ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json();
    const { documentType, authorInfo, targetAgent } = body;

    if (!documentType) {
      return new Response(JSON.stringify({
        error: 'documentType is required',
        validTypes: ['query_letter', 'short_synopsis', 'long_synopsis']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let generated;
    let validation;

    // Generate document based on type
    switch (documentType) {
      case 'query_letter':
        generated = await generateQueryLetter(manuscript, authorInfo || {}, targetAgent, env);
        validation = validateQueryLetter(generated.content);
        break;

      case 'short_synopsis':
        generated = await generateSynopsis(manuscript, 'short', env);
        validation = validateSynopsis(generated.content, 'short');
        break;

      case 'long_synopsis':
        generated = await generateSynopsis(manuscript, 'long', env);
        validation = validateSynopsis(generated.content, 'long');
        break;

      default:
        return new Response(JSON.stringify({
          error: 'Invalid document type',
          validTypes: ['query_letter', 'short_synopsis', 'long_synopsis']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // Save to database
    const docId = crypto.randomUUID();
    const fileName = `${documentType}_${new Date().toISOString().split('T')[0]}.txt`;

    // Check if there's an existing document of this type
    const existing = await env.DB.prepare(
      'SELECT MAX(version_number) as max_version FROM supporting_documents WHERE manuscript_id = ? AND document_type = ?'
    ).bind(manuscriptId, documentType).first();

    const versionNumber = (existing?.max_version || 0) + 1;

    // Mark all previous versions as not current
    if (versionNumber > 1) {
      await env.DB.prepare(
        'UPDATE supporting_documents SET is_current_version = 0 WHERE manuscript_id = ? AND document_type = ?'
      ).bind(manuscriptId, documentType).run();
    }

    // Insert new document
    await env.DB.prepare(`
      INSERT INTO supporting_documents
      (id, manuscript_id, user_id, document_type, content, file_name, version_number,
       is_current_version, word_count, generated_by_ai, ai_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?)
    `).bind(
      docId,
      manuscriptId,
      user.id,
      documentType,
      generated.content,
      fileName,
      versionNumber,
      generated.wordCount,
      generated.prompt
    ).run();

    return new Response(JSON.stringify({
      success: true,
      document: {
        id: docId,
        manuscriptId: manuscriptId,
        documentType: documentType,
        content: generated.content,
        wordCount: generated.wordCount,
        versionNumber: versionNumber,
        validation: validation,
        metadata: generated.metadata,
        generatedBy: generated.generatedBy,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating document:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate document',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /manuscripts/:id/documents/generate-all
 * Generate query letter + both synopsis in one call
 */
export async function generateAllDocuments(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, user.id).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { authorInfo, targetAgent } = body;

    // Generate all three documents in parallel
    const [queryLetter, synopses] = await Promise.all([
      generateQueryLetter(manuscript, authorInfo || {}, targetAgent, env),
      generateBothSynopses(manuscript, env),
    ]);

    // Save all documents
    const documents = [
      { type: 'query_letter', data: queryLetter },
      { type: 'short_synopsis', data: synopses.short },
      { type: 'long_synopsis', data: synopses.long },
    ];

    const savedDocs = [];

    for (const doc of documents) {
      const docId = crypto.randomUUID();
      const fileName = `${doc.type}_${new Date().toISOString().split('T')[0]}.txt`;

      // Get version number
      const existing = await env.DB.prepare(
        'SELECT MAX(version_number) as max_version FROM supporting_documents WHERE manuscript_id = ? AND document_type = ?'
      ).bind(manuscriptId, doc.type).first();

      const versionNumber = (existing?.max_version || 0) + 1;

      // Mark previous versions as not current
      if (versionNumber > 1) {
        await env.DB.prepare(
          'UPDATE supporting_documents SET is_current_version = 0 WHERE manuscript_id = ? AND document_type = ?'
        ).bind(manuscriptId, doc.type).run();
      }

      // Insert document
      await env.DB.prepare(`
        INSERT INTO supporting_documents
        (id, manuscript_id, user_id, document_type, content, file_name, version_number,
         is_current_version, word_count, generated_by_ai, ai_prompt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?)
      `).bind(
        docId,
        manuscriptId,
        user.id,
        doc.type,
        doc.data.content,
        fileName,
        versionNumber,
        doc.data.wordCount,
        doc.data.prompt
      ).run();

      savedDocs.push({
        id: docId,
        documentType: doc.type,
        wordCount: doc.data.wordCount,
        versionNumber: versionNumber,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Generated query letter and both synopsis',
      documents: savedDocs,
      totalWords: queryLetter.wordCount + synopses.short.wordCount + synopses.long.wordCount,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating all documents:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate documents',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/documents
 * List all supporting documents for a manuscript
 *
 * Query params:
 * - currentOnly: true (default) - only current versions
 * - documentType: filter by type
 */
export async function listDocuments(request, env, manuscriptId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const currentOnly = url.searchParams.get('currentOnly') !== 'false';
    const documentType = url.searchParams.get('documentType');

    let query = 'SELECT * FROM supporting_documents WHERE manuscript_id = ?';
    const bindings = [manuscriptId];

    if (currentOnly) {
      query += ' AND is_current_version = 1';
    }

    if (documentType) {
      query += ' AND document_type = ?';
      bindings.push(documentType);
    }

    query += ' ORDER BY document_type ASC, version_number DESC';

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      count: result.results?.length || 0,
      documents: result.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error listing documents:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list documents',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/documents/:docId
 * Get specific document
 */
export async function getDocument(request, env, manuscriptId, docId) {
  try {
    const user = await getUserFromRequest(request, env);

    const document = await env.DB.prepare(
      'SELECT * FROM supporting_documents WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(docId, manuscriptId, user.id).first();

    if (!document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      document: document,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting document:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get document',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PUT /manuscripts/:id/documents/:docId
 * Update document (creates new version)
 *
 * Body: { content, notes }
 */
export async function updateDocument(request, env, manuscriptId, docId) {
  try {
    const user = await getUserFromRequest(request, env);

    // Get existing document
    const existingDoc = await env.DB.prepare(
      'SELECT * FROM supporting_documents WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(docId, manuscriptId, user.id).first();

    if (!existingDoc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { content, notes } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create new version
    const newDocId = crypto.randomUUID();
    const wordCount = content.trim().split(/\s+/).length;
    const newVersionNumber = existingDoc.version_number + 1;

    // Mark all previous versions as not current
    await env.DB.prepare(
      'UPDATE supporting_documents SET is_current_version = 0 WHERE manuscript_id = ? AND document_type = ?'
    ).bind(manuscriptId, existingDoc.document_type).run();

    // Insert new version
    await env.DB.prepare(`
      INSERT INTO supporting_documents
      (id, manuscript_id, user_id, document_type, content, file_name, version_number,
       is_current_version, word_count, notes, generated_by_ai, ai_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, NULL)
    `).bind(
      newDocId,
      manuscriptId,
      user.id,
      existingDoc.document_type,
      content,
      existingDoc.file_name,
      newVersionNumber,
      wordCount,
      notes || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Document updated (new version created)',
      document: {
        id: newDocId,
        versionNumber: newVersionNumber,
        wordCount: wordCount,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating document:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update document',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /manuscripts/:id/documents/:docId
 * Delete document (or all versions of a type)
 */
export async function deleteDocument(request, env, manuscriptId, docId) {
  try {
    const user = await getUserFromRequest(request, env);

    const document = await env.DB.prepare(
      'SELECT * FROM supporting_documents WHERE id = ? AND manuscript_id = ? AND user_id = ?'
    ).bind(docId, manuscriptId, user.id).first();

    if (!document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the specific document
    await env.DB.prepare(
      'DELETE FROM supporting_documents WHERE id = ?'
    ).bind(docId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Document deleted',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete document',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /manuscripts/:id/documents/:docId/versions
 * Get version history for a document type
 */
export async function getDocumentVersions(request, env, manuscriptId, documentType) {
  try {
    const user = await getUserFromRequest(request, env);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT user_id FROM manuscripts WHERE id = ?'
    ).bind(manuscriptId).first();

    if (!manuscript || manuscript.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const versions = await env.DB.prepare(
      'SELECT * FROM supporting_documents WHERE manuscript_id = ? AND document_type = ? ORDER BY version_number DESC'
    ).bind(manuscriptId, documentType).all();

    return new Response(JSON.stringify({
      success: true,
      manuscriptId: manuscriptId,
      documentType: documentType,
      count: versions.results?.length || 0,
      versions: versions.results || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting document versions:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get document versions',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export handlers
export const supportingDocumentsHandlers = {
  generateDocument,
  generateAllDocuments,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  getDocumentVersions,
};

export default supportingDocumentsHandlers;
