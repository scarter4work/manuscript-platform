# Manuscript Upload Platform

A Cloudflare Worker for handling manuscript uploads, processing, and publishing platform.

## Features

- Upload manuscripts (PDF, DOCX, TXT, EPUB)
- Upload marketing assets (cover images, author photos)
- List files by author
- Retrieve files
- Delete files

## Setup

1. Deploy to Cloudflare Workers via GitHub integration
2. R2 buckets are automatically bound via wrangler.toml

## API Endpoints

- `POST /upload/manuscript` - Upload a manuscript
- `POST /upload/marketing` - Upload marketing assets
- `GET /list/{authorId}` - List files for an author
- `GET /get/{key}` - Retrieve a file
- `DELETE /delete/{key}` - Delete a file

## Deployment

This Worker is automatically deployed via GitHub Actions when you push to the main branch.

## Last Updated

- 2025-09-29: Initial deployment with GitHub integration