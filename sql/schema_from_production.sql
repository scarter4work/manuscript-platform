--
-- PostgreSQL database dump
--

\restrict MLjTPCy0IwzdpqGd6auWmDLYLh2lXzGbM4Bsth6mWy2QyELDjMspthtnEHCkixT

-- Dumped from database version 17.6 (Debian 17.6-2.pgdg12+1)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: ensure_one_default_reading_order_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_one_default_reading_order_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE series_reading_orders
  SET is_default = 0
  WHERE series_id = NEW.series_id AND is_default = 1;
  RETURN NEW;
END;
$$;


--
-- Name: update_agent_config_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_config_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_agent_knowledge_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_knowledge_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_author_bios_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_author_bios_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_author_platform_scores_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_author_platform_scores_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_author_platform_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_author_platform_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_bookstore_positioning_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bookstore_positioning_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_comp_titles_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_comp_titles_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_cover_design_briefs_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cover_design_briefs_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_formatted_manuscripts_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_formatted_manuscripts_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_formatting_jobs_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_formatting_jobs_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_formatting_templates_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_formatting_templates_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_genres_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_genres_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_human_style_edits_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_human_style_edits_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_kdp_metadata_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kdp_metadata_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_kdp_packages_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kdp_packages_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_kdp_publishing_status_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kdp_publishing_status_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_manuscript_rights_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_manuscript_rights_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_market_positioning_reports_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_market_positioning_reports_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_marketing_hooks_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_marketing_hooks_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_marketing_kits_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_marketing_kits_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_marketing_materials_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_marketing_materials_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_message_templates_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_message_templates_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_notification_preferences_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_notification_preferences_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_platform_docs_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_platform_docs_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_publication_history_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publication_history_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_publisher_submission_windows_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publisher_submission_windows_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_publishers_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publishers_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_revision_requests_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_revision_requests_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_rights_offers_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_rights_offers_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_rights_templates_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_rights_templates_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_series_timestamp_on_delete_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_series_timestamp_on_delete_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = OLD.series_id;
  RETURN OLD;
END;
$$;


--
-- Name: update_series_timestamp_on_insert_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_series_timestamp_on_insert_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.series_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_series_timestamp_on_update_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_series_timestamp_on_update_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.series_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_assignments_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_assignments_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_deadlines_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_deadlines_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_discussions_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_discussions_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_feedback_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_feedback_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_packages_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_packages_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submission_ratings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submission_ratings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_submissions_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_submissions_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_supporting_documents_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supporting_documents_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$;


--
-- Name: update_user_workflows_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_workflows_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_window_alerts_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_window_alerts_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_workflows_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workflows_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_book_number_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_book_number_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.book_number <= 0 THEN
    RAISE EXCEPTION 'Book number must be positive';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_workflows (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text,
    workflow_id text NOT NULL,
    platform text NOT NULL,
    current_step_id text,
    steps_completed text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    last_activity_at timestamp without time zone DEFAULT now() NOT NULL,
    blocked_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_workflows_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text, 'blocked'::text])))
);


--
-- Name: active_workflows_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_workflows_summary AS
 SELECT platform,
    status,
    count(*) AS workflow_count,
    avg((EXTRACT(epoch FROM (now() - (started_at)::timestamp with time zone)) / 86400.0)) AS avg_days_in_progress
   FROM public.user_workflows uw
  WHERE (status = 'in_progress'::text)
  GROUP BY platform, status;


--
-- Name: agent_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_config (
    id text NOT NULL,
    platform text NOT NULL,
    agent_name text NOT NULL,
    agent_description text,
    system_prompt text NOT NULL,
    doc_sources text NOT NULL,
    tone text DEFAULT 'professional'::text,
    expertise_level text DEFAULT 'expert'::text,
    crawl_enabled integer DEFAULT 1,
    crawl_frequency_hours integer DEFAULT 24,
    last_crawl_at integer,
    next_crawl_at integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_config_platform_check CHECK ((platform = ANY (ARRAY['kdp'::text, 'draft2digital'::text, 'ingramspark'::text, 'apple_books'::text, 'barnes_noble'::text, 'kobo'::text, 'google_play'::text])))
);


--
-- Name: agent_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_conversations (
    id text NOT NULL,
    user_id text NOT NULL,
    platform text NOT NULL,
    user_workflow_id text,
    role text NOT NULL,
    message text NOT NULL,
    current_step_id text,
    context_metadata text,
    response_type text,
    model_used text,
    tokens_used integer,
    cost real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_conversations_platform_check CHECK ((platform = ANY (ARRAY['kdp'::text, 'draft2digital'::text, 'ingramspark'::text, 'apple_books'::text, 'barnes_noble'::text, 'kobo'::text, 'google_play'::text]))),
    CONSTRAINT agent_conversations_response_type_check CHECK ((response_type = ANY (ARRAY['guidance'::text, 'troubleshooting'::text, 'clarification'::text, 'celebration'::text, 'alert'::text]))),
    CONSTRAINT agent_conversations_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: agent_conversation_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agent_conversation_stats AS
 SELECT platform,
    user_id,
    count(*) AS total_messages,
    count(
        CASE
            WHEN (role = 'user'::text) THEN 1
            ELSE NULL::integer
        END) AS user_messages,
    count(
        CASE
            WHEN (role = 'assistant'::text) THEN 1
            ELSE NULL::integer
        END) AS assistant_messages,
    sum(tokens_used) AS total_tokens,
    sum(cost) AS total_cost,
    min(created_at) AS first_interaction,
    max(created_at) AS last_interaction
   FROM public.agent_conversations ac
  GROUP BY platform, user_id;


--
-- Name: agent_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_knowledge (
    id text NOT NULL,
    platform text NOT NULL,
    knowledge_type text NOT NULL,
    topic text NOT NULL,
    content text NOT NULL,
    source_doc_id text,
    confidence_score real DEFAULT 1.0,
    version integer DEFAULT 1 NOT NULL,
    supersedes_id text,
    is_current integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_knowledge_knowledge_type_check CHECK ((knowledge_type = ANY (ARRAY['requirement'::text, 'procedure'::text, 'error_solution'::text, 'terminology'::text, 'best_practice'::text, 'limitation'::text, 'pricing_strategy'::text, 'recent_change'::text]))),
    CONSTRAINT agent_knowledge_platform_check CHECK ((platform = ANY (ARRAY['kdp'::text, 'draft2digital'::text, 'ingramspark'::text, 'apple_books'::text, 'barnes_noble'::text, 'kobo'::text, 'google_play'::text])))
);


--
-- Name: ai_chat_sessions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ai_chat_sessions AS
 SELECT id,
    user_id,
    platform,
    user_workflow_id,
    role,
    message,
    current_step_id,
    context_metadata,
    response_type,
    model_used,
    tokens_used,
    cost,
    created_at
   FROM public.agent_conversations;


--
-- Name: amazon_search_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amazon_search_queries (
    id text NOT NULL,
    user_id text,
    manuscript_id text,
    query_text text NOT NULL,
    genre text,
    filters text,
    results_count integer DEFAULT 0,
    comp_titles_found text,
    search_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    search_source text
);


--
-- Name: analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyses (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    analysis_type text NOT NULL,
    status text DEFAULT 'pending'::text,
    overall_score real,
    issues_count integer,
    completed_at timestamp without time zone
);


--
-- Name: analysis_comp_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_comp_titles (
    id text NOT NULL,
    analysis_id text NOT NULL,
    comp_title_id text NOT NULL,
    relevance_score real,
    similarity_reasons text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    action character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(36) NOT NULL,
    "timestamp" integer NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_agent text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: author_bios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.author_bios (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text,
    author_name text NOT NULL,
    genre text NOT NULL,
    length text NOT NULL,
    variations text NOT NULL,
    generated_at text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT author_bios_length_check CHECK ((length = ANY (ARRAY['short'::text, 'medium'::text, 'long'::text])))
);


--
-- Name: author_bio_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.author_bio_stats AS
 SELECT user_id,
    count(*) AS total_bios,
    count(DISTINCT manuscript_id) AS manuscripts_with_bios,
    count(DISTINCT genre) AS genres_covered,
    sum(
        CASE
            WHEN (length = 'short'::text) THEN 1
            ELSE 0
        END) AS short_bios,
    sum(
        CASE
            WHEN (length = 'medium'::text) THEN 1
            ELSE 0
        END) AS medium_bios,
    sum(
        CASE
            WHEN (length = 'long'::text) THEN 1
            ELSE 0
        END) AS long_bios,
    max(created_at) AS last_generated
   FROM public.author_bios
  GROUP BY user_id;


--
-- Name: author_platform; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.author_platform (
    id text NOT NULL,
    user_id text NOT NULL,
    platform_type text NOT NULL,
    platform_name text,
    url text,
    username text,
    follower_count integer,
    subscriber_count integer,
    engagement_rate real,
    verified boolean DEFAULT false,
    post_frequency text,
    last_post_date integer,
    monetized integer DEFAULT 0,
    monthly_revenue real,
    is_active boolean DEFAULT true,
    last_updated timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT author_platform_platform_type_check CHECK ((platform_type = ANY (ARRAY['twitter'::text, 'facebook'::text, 'instagram'::text, 'tiktok'::text, 'youtube'::text, 'goodreads'::text, 'amazon_author_central'::text, 'website'::text, 'email_list'::text, 'podcast'::text, 'blog'::text, 'linkedin'::text, 'pinterest'::text, 'other'::text])))
);


--
-- Name: author_platform_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.author_platform_scores (
    id text NOT NULL,
    user_id text NOT NULL,
    overall_score integer,
    social_media_score integer,
    email_list_score integer,
    website_traffic_score integer,
    engagement_score integer,
    authority_score integer,
    total_followers integer,
    total_subscribers integer,
    avg_engagement_rate real,
    estimated_monthly_reach integer,
    monetization_potential real,
    improvement_areas text,
    next_steps text,
    score_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: author_platform_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.author_platform_summary AS
 SELECT user_id,
    count(*) AS total_platforms,
    sum(follower_count) AS total_followers,
    sum(subscriber_count) AS total_subscribers,
    avg(engagement_rate) AS avg_engagement,
    count(
        CASE
            WHEN (verified = true) THEN 1
            ELSE NULL::integer
        END) AS verified_platforms,
    count(
        CASE
            WHEN (is_active = true) THEN 1
            ELSE NULL::integer
        END) AS active_platforms
   FROM public.author_platform ap
  GROUP BY user_id;


--
-- Name: manuscript_rights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manuscript_rights (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    rights_type text NOT NULL,
    rights_status text DEFAULT 'available'::text NOT NULL,
    granted_to_publisher_id text,
    granted_to_publisher_name text,
    exclusive integer DEFAULT 0,
    grant_start_date integer,
    grant_end_date integer,
    grant_duration_years integer,
    reversion_clause text,
    auto_reversion integer DEFAULT 0,
    reversion_date integer,
    territories text,
    territory_restrictions text,
    languages text,
    advance real,
    royalty_rate real,
    royalty_escalation text,
    contract_file_key text,
    contract_signed_date integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT manuscript_rights_rights_status_check CHECK ((rights_status = ANY (ARRAY['available'::text, 'offered'::text, 'granted'::text, 'expired'::text, 'reverted'::text, 'reserved'::text]))),
    CONSTRAINT manuscript_rights_rights_type_check CHECK ((rights_type = ANY (ARRAY['first_serial'::text, 'north_american'::text, 'world_english'::text, 'world'::text, 'translation'::text, 'audio'::text, 'film_tv'::text, 'electronic'::text, 'print'::text, 'dramatic'::text, 'merchandising'::text, 'anthology'::text, 'excerpt'::text])))
);


--
-- Name: manuscripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manuscripts (
    id text NOT NULL,
    user_id text NOT NULL,
    report_id text NOT NULL,
    manuscript_key text NOT NULL,
    original_filename text NOT NULL,
    file_size bigint,
    genre text,
    status text DEFAULT 'uploaded'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    uploaded_at timestamp without time zone DEFAULT now(),
    word_count integer,
    title text,
    sub_genres text,
    content_warnings text,
    completion_percentage integer DEFAULT 100,
    target_audience text,
    publication_status text DEFAULT 'unpublished'::text,
    rights_status text,
    age_category text,
    completion_status text DEFAULT 'complete'::text,
    series_info text,
    primary_genre text,
    dmca_status text DEFAULT 'clear'::text,
    dmca_takedown_date timestamp without time zone,
    CONSTRAINT manuscripts_age_category_check CHECK ((age_category = ANY (ARRAY['adult'::text, 'young_adult'::text, 'middle_grade'::text, 'childrens'::text, 'all_ages'::text]))),
    CONSTRAINT manuscripts_completion_percentage_check CHECK (((completion_percentage >= 0) AND (completion_percentage <= 100))),
    CONSTRAINT manuscripts_completion_status_check CHECK ((completion_status = ANY (ARRAY['complete'::text, 'in_progress'::text, 'revision'::text, 'outline'::text]))),
    CONSTRAINT manuscripts_publication_status_check CHECK ((publication_status = ANY (ARRAY['unpublished'::text, 'self_published'::text, 'traditionally_published'::text, 'previously_published'::text])))
);


--
-- Name: available_rights; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.available_rights AS
 SELECT m.id AS manuscript_id,
    m.title AS manuscript_title,
    m.user_id,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'first_serial'::text
            ELSE NULL::text
        END AS first_serial_available,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'north_american'::text
            ELSE NULL::text
        END AS north_american_available,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'world_english'::text
            ELSE NULL::text
        END AS world_english_available,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'translation'::text
            ELSE NULL::text
        END AS translation_available,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'audio'::text
            ELSE NULL::text
        END AS audio_available,
        CASE
            WHEN (mr_granted.rights_type IS NULL) THEN 'film_tv'::text
            ELSE NULL::text
        END AS film_tv_available
   FROM (public.manuscripts m
     LEFT JOIN public.manuscript_rights mr_granted ON (((m.id = mr_granted.manuscript_id) AND (mr_granted.rights_status = ANY (ARRAY['granted'::text, 'offered'::text])))))
  WHERE (mr_granted.id IS NULL);


--
-- Name: bestseller_ranks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bestseller_ranks (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    platform text DEFAULT 'kdp'::text NOT NULL,
    category text NOT NULL,
    overall_rank integer,
    category_rank integer,
    tracked_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bookstore_positioning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookstore_positioning (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    primary_category text NOT NULL,
    primary_section text,
    secondary_categories text,
    placement_type text,
    placement_probability real,
    cover_design_notes text,
    trim_size_recommendation text,
    spine_width_estimate real,
    positioning_strategy text,
    target_reader_profile text,
    differentiation_points text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT bookstore_positioning_placement_type_check CHECK ((placement_type = ANY (ARRAY['face_out'::text, 'spine_out'::text, 'endcap'::text, 'table'::text, 'window'::text])))
);


--
-- Name: communication_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.communication_stats AS
SELECT
    NULL::text AS user_id,
    NULL::text AS email,
    NULL::bigint AS messages_sent,
    NULL::bigint AS messages_received,
    NULL::bigint AS unread_messages,
    NULL::bigint AS revision_requests_sent,
    NULL::bigint AS templates_created,
    NULL::timestamp without time zone AS last_message_at;


--
-- Name: comp_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comp_titles (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    comp_title text NOT NULL,
    comp_author text NOT NULL,
    comp_asin text,
    comp_isbn text,
    similarity_score real,
    why_comparable text,
    amazon_sales_rank integer,
    amazon_category_rank integer,
    amazon_category text,
    price real,
    publication_date bigint,
    page_count integer,
    format text,
    avg_rating real,
    review_count integer,
    cover_style text,
    blurb_style text,
    marketing_approach text,
    data_source text DEFAULT 'manual'::text,
    last_updated bigint,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT comp_titles_data_source_check CHECK ((data_source = ANY (ARRAY['manual'::text, 'ai_suggested'::text, 'amazon_api'::text, 'goodreads'::text])))
);


--
-- Name: comp_title_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.comp_title_summary AS
 SELECT ct.manuscript_id,
    m.title AS manuscript_title,
    count(*) AS total_comp_titles,
    avg(ct.similarity_score) AS avg_similarity,
    avg(ct.price) AS avg_comp_price,
    avg(ct.avg_rating) AS avg_comp_rating,
    min(ct.amazon_sales_rank) AS best_comp_sales_rank,
    max(ct.review_count) AS max_comp_reviews
   FROM (public.comp_titles ct
     JOIN public.manuscripts m ON ((ct.manuscript_id = m.id)))
  WHERE (ct.is_active = true)
  GROUP BY ct.manuscript_id, m.title;


--
-- Name: content_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_calendar (
    id text NOT NULL,
    kit_id text NOT NULL,
    day_number integer NOT NULL,
    calendar_date integer,
    platform text NOT NULL,
    post_id text,
    activity_type text NOT NULL,
    activity_description text NOT NULL,
    time_of_day text,
    priority text,
    completed integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_calendar_activity_type_check CHECK ((activity_type = ANY (ARRAY['post'::text, 'engage'::text, 'email'::text, 'story'::text, 'live'::text, 'blog'::text, 'other'::text]))),
    CONSTRAINT content_calendar_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: content_warning_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_warning_types (
    id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    severity text,
    display_order integer DEFAULT 0,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_warning_types_category_check CHECK ((category = ANY (ARRAY['violence'::text, 'sexual'::text, 'substance'::text, 'mental_health'::text, 'discrimination'::text, 'other'::text]))),
    CONSTRAINT content_warning_types_severity_check CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text])))
);


--
-- Name: cost_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_tracking (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text,
    service text NOT NULL,
    operation text NOT NULL,
    cost_usd numeric(10,4) NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: cover_design_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cover_design_briefs (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text NOT NULL,
    genre text NOT NULL,
    brief_data text NOT NULL,
    generated_at text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cover_brief_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cover_brief_stats AS
 SELECT user_id,
    count(*) AS total_briefs,
    count(DISTINCT manuscript_id) AS manuscripts_with_briefs,
    count(DISTINCT genre) AS genres_covered,
    max(created_at) AS last_generated
   FROM public.cover_design_briefs
  GROUP BY user_id;


--
-- Name: supporting_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supporting_documents (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    document_type text NOT NULL,
    content text NOT NULL,
    file_name text,
    version_number integer DEFAULT 1,
    is_current_version integer DEFAULT 1,
    word_count integer,
    notes text,
    generated_by_ai integer DEFAULT 0,
    ai_prompt text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT supporting_documents_document_type_check CHECK ((document_type = ANY (ARRAY['query_letter'::text, 'short_synopsis'::text, 'long_synopsis'::text, 'sample_chapters'::text, 'other'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login timestamp without time zone,
    plan text DEFAULT 'free'::text,
    manuscripts_count integer DEFAULT 0,
    monthly_analyses integer DEFAULT 0,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    role character varying(50) DEFAULT 'author'::character varying,
    subscription_tier character varying(50) DEFAULT 'free'::character varying,
    location text,
    bio text,
    website text,
    social_media text
);


--
-- Name: current_supporting_documents; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_supporting_documents AS
 SELECT sd.id,
    sd.manuscript_id,
    sd.user_id,
    sd.document_type,
    sd.content,
    sd.file_name,
    sd.version_number,
    sd.is_current_version,
    sd.word_count,
    sd.notes,
    sd.generated_by_ai,
    sd.ai_prompt,
    sd.created_at,
    sd.updated_at,
    m.title AS manuscript_title,
    u.full_name AS author_name
   FROM ((public.supporting_documents sd
     JOIN public.manuscripts m ON ((sd.manuscript_id = m.id)))
     JOIN public.users u ON ((sd.user_id = u.id)))
  WHERE (sd.is_current_version = 1);


--
-- Name: platform_docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_docs (
    id text NOT NULL,
    platform text NOT NULL,
    doc_type text NOT NULL,
    source_url text NOT NULL,
    title text,
    content text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    previous_version_id text,
    content_hash text NOT NULL,
    change_detected integer DEFAULT 0,
    change_significance text,
    change_summary text,
    fetched_at timestamp without time zone DEFAULT now() NOT NULL,
    analyzed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_docs_change_significance_check CHECK ((change_significance = ANY (ARRAY['critical'::text, 'important'::text, 'minor'::text, 'none'::text]))),
    CONSTRAINT platform_docs_doc_type_check CHECK ((doc_type = ANY (ARRAY['account_setup'::text, 'book_details'::text, 'content_upload'::text, 'pricing_rights'::text, 'preview_publish'::text, 'troubleshooting'::text, 'faq'::text, 'api_reference'::text, 'general'::text]))),
    CONSTRAINT platform_docs_platform_check CHECK ((platform = ANY (ARRAY['kdp'::text, 'draft2digital'::text, 'ingramspark'::text, 'apple_books'::text, 'barnes_noble'::text, 'kobo'::text, 'google_play'::text])))
);


--
-- Name: doc_change_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.doc_change_activity AS
 SELECT platform,
    change_significance,
    count(*) AS change_count,
    max(fetched_at) AS last_change_detected
   FROM public.platform_docs pd
  WHERE ((change_detected = 1) AND (fetched_at >= (now() - '30 days'::interval)))
  GROUP BY platform, change_significance;


--
-- Name: doc_fetch_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_fetch_log (
    id text NOT NULL,
    platform text NOT NULL,
    fetch_status text NOT NULL,
    urls_fetched integer DEFAULT 0,
    urls_failed integer DEFAULT 0,
    changes_detected integer DEFAULT 0,
    new_docs_added integer DEFAULT 0,
    error_message text,
    fetch_started_at timestamp without time zone DEFAULT now() NOT NULL,
    fetch_completed_at timestamp without time zone,
    duration_seconds real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT doc_fetch_log_fetch_status_check CHECK ((fetch_status = ANY (ARRAY['success'::text, 'failed'::text, 'partial'::text, 'skipped'::text])))
);


--
-- Name: editorial_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.editorial_assignments (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    editor_id text NOT NULL,
    assignment_type text NOT NULL,
    assigned_by text NOT NULL,
    assigned_at timestamp without time zone DEFAULT now(),
    deadline timestamp without time zone,
    status text DEFAULT 'pending'::text,
    notes text,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT editorial_assignments_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['developmental'::text, 'line'::text, 'copy'::text, 'proofread'::text]))),
    CONSTRAINT editorial_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_queue (
    id text NOT NULL,
    to_email text NOT NULL,
    from_email text DEFAULT 'noreply@selfpubhub.co'::text,
    subject text NOT NULL,
    body_html text,
    body_text text,
    status text DEFAULT 'pending'::text,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    scheduled_for timestamp without time zone DEFAULT now(),
    sent_at timestamp without time zone,
    error_message text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: file_scan_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_scan_results (
    id text NOT NULL,
    file_key text NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    scan_status text NOT NULL,
    scanner_name text NOT NULL,
    viruses_found text,
    scan_duration_ms integer,
    scanned_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text
);


--
-- Name: file_scan_statistics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.file_scan_statistics AS
 SELECT (scanned_at)::date AS scan_date,
    scan_status,
    count(*) AS total_scans,
    avg(scan_duration_ms) AS avg_scan_time_ms,
    sum(file_size) AS total_bytes_scanned,
    count(DISTINCT user_id) AS unique_users
   FROM public.file_scan_results
  GROUP BY ((scanned_at)::date), scan_status
  ORDER BY ((scanned_at)::date) DESC, scan_status;


--
-- Name: formatted_manuscripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formatted_manuscripts (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    format_type text NOT NULL,
    file_key text NOT NULL,
    file_size integer,
    file_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    trim_size text,
    page_count integer,
    has_bleed integer DEFAULT 0,
    font_family text DEFAULT 'Georgia'::text,
    font_size integer DEFAULT 12,
    include_title_page integer DEFAULT 1,
    include_copyright integer DEFAULT 1,
    include_dedication integer DEFAULT 0,
    dedication_text text,
    include_toc integer DEFAULT 1,
    include_author_bio integer DEFAULT 1,
    include_series_info integer DEFAULT 0,
    include_newsletter_signup integer DEFAULT 0,
    newsletter_url text,
    chapter_start_page text DEFAULT 'odd'::text,
    use_drop_caps integer DEFAULT 0,
    use_scene_breaks integer DEFAULT 1,
    scene_break_symbol text DEFAULT '* * *'::text,
    justify_text integer DEFAULT 1,
    enable_hyphenation integer DEFAULT 1,
    is_validated integer DEFAULT 0,
    validation_errors text,
    passes_amazon_specs integer DEFAULT 0,
    generation_cost real,
    processing_time_ms integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT formatted_manuscripts_chapter_start_page_check CHECK ((chapter_start_page = ANY (ARRAY['any'::text, 'odd'::text, 'even'::text]))),
    CONSTRAINT formatted_manuscripts_format_type_check CHECK ((format_type = ANY (ARRAY['epub'::text, 'pdf'::text, 'mobi'::text, 'preview_epub'::text, 'preview_pdf'::text]))),
    CONSTRAINT formatted_manuscripts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: formatting_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formatting_jobs (
    id text NOT NULL,
    formatted_manuscript_id text NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    priority integer DEFAULT 5,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    error_message text,
    started_at bigint,
    completed_at bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT formatting_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['epub'::text, 'pdf'::text, 'validation'::text, 'preview'::text]))),
    CONSTRAINT formatting_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: formatting_outputs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.formatting_outputs AS
 SELECT id,
    manuscript_id,
    user_id,
    format_type,
    file_key,
    file_size,
    file_url,
    status,
    error_message,
    trim_size,
    page_count,
    has_bleed,
    font_family,
    font_size,
    include_title_page,
    include_copyright,
    include_dedication,
    dedication_text,
    include_toc,
    include_author_bio,
    include_series_info,
    include_newsletter_signup,
    newsletter_url,
    chapter_start_page,
    use_drop_caps,
    use_scene_breaks,
    scene_break_symbol,
    justify_text,
    enable_hyphenation,
    is_validated,
    validation_errors,
    passes_amazon_specs,
    generation_cost,
    processing_time_ms,
    created_at,
    updated_at
   FROM public.formatted_manuscripts;


--
-- Name: formatting_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.formatting_stats AS
 SELECT f.manuscript_id,
    f.user_id,
    m.title AS manuscript_title,
    count(DISTINCT f.id) AS total_formats,
    count(DISTINCT
        CASE
            WHEN (f.format_type = 'epub'::text) THEN f.id
            ELSE NULL::text
        END) AS epub_count,
    count(DISTINCT
        CASE
            WHEN (f.format_type = 'mobi'::text) THEN f.id
            ELSE NULL::text
        END) AS mobi_count,
    count(DISTINCT
        CASE
            WHEN (f.format_type = 'pdf'::text) THEN f.id
            ELSE NULL::text
        END) AS pdf_count,
    count(DISTINCT
        CASE
            WHEN (f.status = 'completed'::text) THEN f.id
            ELSE NULL::text
        END) AS completed_count
   FROM (public.formatted_manuscripts f
     LEFT JOIN public.manuscripts m ON ((f.manuscript_id = m.id)))
  GROUP BY f.manuscript_id, f.user_id, m.title;


--
-- Name: formatting_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formatting_templates (
    id text NOT NULL,
    user_id text,
    template_name text NOT NULL,
    template_type text NOT NULL,
    is_system_template integer DEFAULT 0,
    description text,
    template_settings text NOT NULL,
    times_used integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT formatting_templates_template_type_check CHECK ((template_type = ANY (ARRAY['epub'::text, 'pdf'::text, 'both'::text])))
);


--
-- Name: genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genres (
    id text NOT NULL,
    name text NOT NULL,
    parent_genre_id text,
    description text,
    typical_word_count_min integer,
    typical_word_count_max integer,
    display_order integer DEFAULT 0,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: genre_usage_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.genre_usage_stats AS
 SELECT g.id,
    g.name,
    g.parent_genre_id,
    count(DISTINCT m.id) AS manuscript_count,
    avg(m.word_count) AS avg_word_count,
    min(m.word_count) AS min_word_count,
    max(m.word_count) AS max_word_count
   FROM (public.genres g
     LEFT JOIN public.manuscripts m ON ((m.primary_genre = g.id)))
  WHERE (g.is_active <> 0)
  GROUP BY g.id, g.name, g.parent_genre_id;


--
-- Name: hashtag_strategy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hashtag_strategy (
    id text NOT NULL,
    kit_id text NOT NULL,
    genre text NOT NULL,
    platform text NOT NULL,
    hashtag text NOT NULL,
    category text,
    estimated_reach text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT hashtag_strategy_category_check CHECK ((category = ANY (ARRAY['genre'::text, 'trending'::text, 'community'::text, 'author'::text, 'promotional'::text])))
);


--
-- Name: human_edit_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.human_edit_sessions (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    chapter_number integer NOT NULL,
    analysis_cost real,
    annotation_count integer DEFAULT 0,
    question_count integer DEFAULT 0,
    suggestion_count integer DEFAULT 0,
    praise_count integer DEFAULT 0,
    issue_count integer DEFAULT 0,
    continuity_count integer DEFAULT 0,
    chapter_context text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: human_editors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.human_editors (
    id text NOT NULL,
    user_id text NOT NULL,
    editor_name text NOT NULL,
    specialization text[],
    years_experience integer,
    rate_per_word numeric(10,4),
    rate_per_hour numeric(10,2),
    availability_status text DEFAULT 'available'::text,
    sample_work_url text,
    bio text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: human_style_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.human_style_edits (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    chapter_number integer,
    paragraph_index integer,
    annotation_type text NOT NULL,
    comment_text text NOT NULL,
    alternatives text,
    severity text DEFAULT 'medium'::text NOT NULL,
    chapter_context text,
    addressed integer DEFAULT 0,
    author_response text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT human_style_edits_annotation_type_check CHECK ((annotation_type = ANY (ARRAY['question'::text, 'suggestion'::text, 'praise'::text, 'issue'::text, 'continuity'::text]))),
    CONSTRAINT human_style_edits_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: kdp_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kdp_metadata (
    id text NOT NULL,
    package_id text NOT NULL,
    manuscript_id text NOT NULL,
    title text NOT NULL,
    subtitle text,
    series_name text,
    series_number integer,
    edition_number integer DEFAULT 1,
    author_name text NOT NULL,
    contributors text,
    description text NOT NULL,
    description_length integer,
    author_bio text,
    primary_category text,
    secondary_category text,
    bisac_codes text,
    keywords text NOT NULL,
    age_range_min integer,
    age_range_max integer,
    grade_level text,
    publishing_rights text NOT NULL,
    territories text,
    isbn_type text,
    isbn text,
    publication_date integer,
    price_usd real,
    price_gbp real,
    price_eur real,
    price_cad real,
    price_aud real,
    royalty_option text,
    kdp_select_enrolled integer DEFAULT 0,
    enable_lending integer DEFAULT 1,
    format_type text,
    trim_size text,
    bleed_settings text,
    paper_color text,
    adult_content integer DEFAULT 0,
    public_domain integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kdp_metadata_bleed_settings_check CHECK ((bleed_settings = ANY (ARRAY['no_bleed'::text, 'bleed'::text]))),
    CONSTRAINT kdp_metadata_format_type_check CHECK ((format_type = ANY (ARRAY['ebook'::text, 'paperback'::text, 'hardcover'::text]))),
    CONSTRAINT kdp_metadata_isbn_type_check CHECK ((isbn_type = ANY (ARRAY['amazon_free'::text, 'author_owned'::text, 'none'::text]))),
    CONSTRAINT kdp_metadata_paper_color_check CHECK ((paper_color = ANY (ARRAY['white'::text, 'cream'::text]))),
    CONSTRAINT kdp_metadata_publishing_rights_check CHECK ((publishing_rights = ANY (ARRAY['worldwide'::text, 'territories_included'::text, 'territories_excluded'::text]))),
    CONSTRAINT kdp_metadata_royalty_option_check CHECK ((royalty_option = ANY (ARRAY['35'::text, '70'::text])))
);


--
-- Name: kdp_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kdp_packages (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    package_status text DEFAULT 'pending'::text NOT NULL,
    package_key text,
    package_size integer,
    epub_key text,
    cover_key text,
    metadata_key text,
    instructions_key text,
    validation_passed integer DEFAULT 0,
    expiration_date integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kdp_packages_package_status_check CHECK ((package_status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'failed'::text, 'expired'::text])))
);


--
-- Name: kdp_publishing_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kdp_publishing_status (
    id text NOT NULL,
    package_id text NOT NULL,
    user_id text NOT NULL,
    publishing_method text,
    status text DEFAULT 'preparing'::text NOT NULL,
    kdp_asin text,
    kdp_url text,
    error_message text,
    published_at integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kdp_publishing_status_publishing_method_check CHECK ((publishing_method = ANY (ARRAY['manual_guided'::text, 'semi_automated'::text, 'fully_automated'::text]))),
    CONSTRAINT kdp_publishing_status_status_check CHECK ((status = ANY (ARRAY['preparing'::text, 'uploading'::text, 'in_review'::text, 'live'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: kdp_royalty_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kdp_royalty_calculations (
    id text NOT NULL,
    package_id text NOT NULL,
    price_usd real NOT NULL,
    royalty_option text NOT NULL,
    royalty_per_sale_usd real,
    delivery_cost_usd real,
    net_royalty_usd real,
    file_size_mb real,
    minimum_price_35 real,
    maximum_price_35 real,
    minimum_price_70 real,
    maximum_price_70 real,
    recommended_royalty text,
    recommendation_reason text,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kdp_royalty_calculations_royalty_option_check CHECK ((royalty_option = ANY (ARRAY['35'::text, '70'::text])))
);


--
-- Name: kdp_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kdp_stats AS
 SELECT count(DISTINCT kp.id) AS total_packages,
    count(DISTINCT
        CASE
            WHEN (kp.package_status = 'ready'::text) THEN kp.id
            ELSE NULL::text
        END) AS ready_packages,
    count(DISTINCT
        CASE
            WHEN (kp.validation_passed = 1) THEN kp.id
            ELSE NULL::text
        END) AS validated_packages,
    count(DISTINCT kps.id) AS total_publishing_attempts,
    count(DISTINCT
        CASE
            WHEN (kps.status = 'live'::text) THEN kps.id
            ELSE NULL::text
        END) AS live_books,
    avg(
        CASE
            WHEN (krc.royalty_option = '70'::text) THEN krc.net_royalty_usd
            ELSE NULL::real
        END) AS avg_royalty_70,
    avg(
        CASE
            WHEN (krc.royalty_option = '35'::text) THEN krc.net_royalty_usd
            ELSE NULL::real
        END) AS avg_royalty_35
   FROM ((public.kdp_packages kp
     LEFT JOIN public.kdp_publishing_status kps ON ((kp.id = kps.package_id)))
     LEFT JOIN public.kdp_royalty_calculations krc ON ((kp.id = krc.package_id)));


--
-- Name: kdp_validation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kdp_validation_results (
    id text NOT NULL,
    package_id text NOT NULL,
    validation_type text NOT NULL,
    status text NOT NULL,
    issues text,
    recommendations text,
    validated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kdp_validation_results_status_check CHECK ((status = ANY (ARRAY['pass'::text, 'fail'::text, 'warning'::text]))),
    CONSTRAINT kdp_validation_results_validation_type_check CHECK ((validation_type = ANY (ARRAY['file_format'::text, 'cover_specs'::text, 'metadata'::text, 'content'::text, 'full_package'::text])))
);


--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_incidents (
    id text NOT NULL,
    type text NOT NULL,
    details text,
    ip_address text,
    user_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false,
    resolved_at timestamp without time zone,
    resolved_by text,
    notes text
);


--
-- Name: malware_uploads; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.malware_uploads AS
 SELECT f.id,
    f.file_name,
    f.file_key,
    f.file_size,
    f.viruses_found,
    f.scanned_at,
    f.user_id,
    u.email AS user_email,
    s.ip_address,
    s.details AS incident_details
   FROM ((public.file_scan_results f
     LEFT JOIN public.users u ON ((f.user_id = u.id)))
     LEFT JOIN public.security_incidents s ON ((s.details ~~ (('%'::text || f.file_key) || '%'::text))))
  WHERE (f.scan_status = 'infected'::text)
  ORDER BY f.scanned_at DESC;


--
-- Name: manuscript_metadata_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manuscript_metadata_history (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_by text NOT NULL,
    changed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: manuscript_metadata_validation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.manuscript_metadata_validation AS
 SELECT m.id,
    m.title,
    m.primary_genre,
    m.word_count,
    m.age_category,
    g.typical_word_count_min,
    g.typical_word_count_max,
        CASE
            WHEN (m.word_count IS NULL) THEN 'missing_word_count'::text
            WHEN (m.word_count < g.typical_word_count_min) THEN 'word_count_too_low'::text
            WHEN (m.word_count > g.typical_word_count_max) THEN 'word_count_too_high'::text
            ELSE 'valid'::text
        END AS validation_status,
        CASE
            WHEN (m.primary_genre IS NULL) THEN 'missing_genre'::text
            WHEN (m.age_category IS NULL) THEN 'missing_age_category'::text
            ELSE 'complete'::text
        END AS metadata_completeness
   FROM (public.manuscripts m
     LEFT JOIN public.genres g ON ((m.primary_genre = g.id)));


--
-- Name: manuscript_publishing_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manuscript_publishing_progress (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    platform text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    overall_completion_percentage integer DEFAULT 0,
    estimated_time_to_completion integer,
    next_action_recommendation text,
    started_at bigint,
    uploaded_at integer,
    published_at integer,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: market_analysis_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_analysis_reports (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    genre text NOT NULL,
    search_keywords text,
    comp_titles_count integer DEFAULT 0,
    recommended_price_usd real,
    price_range_min real,
    price_range_max real,
    price_confidence_score real,
    price_reasoning text,
    recommended_categories text,
    category_confidence_scores text,
    recommended_keywords text,
    keyword_search_volumes text,
    keyword_competition_scores text,
    positioning_strategy text,
    target_audience_profile text,
    competitive_advantages text,
    market_gaps text,
    market_saturation_level text,
    trend_direction text,
    seasonal_patterns text,
    report_text text,
    report_summary text,
    ai_cost real,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT market_analysis_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: market_positioning_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_positioning_reports (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    report_date timestamp without time zone DEFAULT now() NOT NULL,
    report_version integer DEFAULT 1,
    genre_trends text,
    market_saturation text,
    pricing_analysis text,
    top_competitors text,
    market_gap_analysis text,
    unique_angle text,
    target_demographics text,
    marketing_channels text,
    platform_priorities text,
    launch_strategy text,
    estimated_sales_rank integer,
    estimated_monthly_sales integer,
    estimated_monthly_revenue real,
    model_used text,
    confidence_score real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: market_positioning_overview; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.market_positioning_overview AS
 SELECT m.id AS manuscript_id,
    m.title,
    m.genre,
    ct_summary.total_comp_titles,
    ct_summary.avg_comp_price,
    bp.primary_category,
    bp.placement_probability,
    mpr.estimated_monthly_sales,
    mpr.confidence_score
   FROM (((public.manuscripts m
     LEFT JOIN public.comp_title_summary ct_summary ON ((m.id = ct_summary.manuscript_id)))
     LEFT JOIN public.bookstore_positioning bp ON ((m.id = bp.manuscript_id)))
     LEFT JOIN ( SELECT market_positioning_reports.manuscript_id,
            market_positioning_reports.estimated_monthly_sales,
            market_positioning_reports.confidence_score
           FROM public.market_positioning_reports
          WHERE ((market_positioning_reports.manuscript_id, market_positioning_reports.report_date) IN ( SELECT market_positioning_reports_1.manuscript_id,
                    max(market_positioning_reports_1.report_date) AS max
                   FROM public.market_positioning_reports market_positioning_reports_1
                  GROUP BY market_positioning_reports_1.manuscript_id))) mpr ON ((m.id = mpr.manuscript_id)));


--
-- Name: market_trends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_trends (
    id text NOT NULL,
    genre text NOT NULL,
    trend_period text,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    new_releases_count integer,
    bestseller_turnover_rate real,
    avg_review_velocity real,
    competition_level text,
    barrier_to_entry text,
    avg_price_change_pct real,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaigns (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text NOT NULL,
    campaign_name text NOT NULL,
    campaign_type text NOT NULL,
    start_date integer NOT NULL,
    end_date integer,
    budget real,
    spend real DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    target_metric text,
    target_value real,
    settings text,
    units_sold integer DEFAULT 0,
    revenue real DEFAULT 0,
    roi real,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: marketing_hooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_hooks (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    hook_type text NOT NULL,
    hook_text text NOT NULL,
    effectiveness_score real,
    target_audience text,
    variation_number integer DEFAULT 1,
    user_rating integer,
    used_in_marketing integer DEFAULT 0,
    model_used text,
    generated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_hooks_hook_type_check CHECK ((hook_type = ANY (ARRAY['elevator_pitch'::text, 'logline'::text, 'tagline'::text, 'unique_selling_proposition'::text, 'comparable_titles'::text, 'hook_sentence'::text, 'back_cover_copy'::text, 'social_media_bio'::text, 'press_release'::text, 'reader_promise'::text])))
);


--
-- Name: marketing_hooks_by_manuscript; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.marketing_hooks_by_manuscript AS
 SELECT mh.manuscript_id,
    m.title AS manuscript_title,
    mh.hook_type,
    count(*) AS variation_count,
    avg(mh.effectiveness_score) AS avg_effectiveness,
    count(
        CASE
            WHEN (mh.used_in_marketing = 1) THEN 1
            ELSE NULL::integer
        END) AS used_count
   FROM (public.marketing_hooks mh
     JOIN public.manuscripts m ON ((mh.manuscript_id = m.id)))
  GROUP BY mh.manuscript_id, m.title, mh.hook_type;


--
-- Name: marketing_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_kits (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    kit_name text NOT NULL,
    genre text,
    target_audience text,
    tone text,
    generation_cost real,
    generated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_materials (
    id text NOT NULL,
    kit_id text NOT NULL,
    material_type text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    format text,
    word_count integer,
    estimated_duration text,
    additional_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_materials_material_type_check CHECK ((material_type = ANY (ARRAY['launch_email'::text, 'trailer_script'::text, 'reader_magnet'::text, 'blog_post'::text, 'press_release'::text, 'interview_qa'::text, 'other'::text])))
);


--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_templates (
    id text NOT NULL,
    publisher_id text,
    template_name text NOT NULL,
    template_type text NOT NULL,
    is_system_template integer DEFAULT 0,
    subject_line text NOT NULL,
    body_text text NOT NULL,
    merge_fields text,
    times_used integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_templates_template_type_check CHECK ((template_type = ANY (ARRAY['rejection'::text, 'request_and_revise'::text, 'request_full'::text, 'offer'::text, 'acknowledgment'::text, 'custom'::text])))
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id text NOT NULL,
    user_id text NOT NULL,
    email_on_submission_received integer DEFAULT 1,
    email_on_status_change integer DEFAULT 1,
    email_on_decision integer DEFAULT 1,
    email_on_message integer DEFAULT 1,
    email_on_revision_request integer DEFAULT 1,
    email_on_revision_submitted integer DEFAULT 1,
    digest_frequency text DEFAULT 'immediate'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_preferences_digest_frequency_check CHECK ((digest_frequency = ANY (ARRAY['immediate'::text, 'daily'::text, 'weekly'::text, 'none'::text])))
);


--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_queue (
    id text NOT NULL,
    user_id text NOT NULL,
    notification_type text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    submission_id text,
    message_id text,
    revision_request_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at bigint,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_queue_notification_type_check CHECK ((notification_type = ANY (ARRAY['submission_received'::text, 'status_change'::text, 'decision'::text, 'message'::text, 'revision_request'::text, 'revision_submitted'::text]))),
    CONSTRAINT notification_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: publisher_submission_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_submission_windows (
    id text NOT NULL,
    publisher_id text NOT NULL,
    window_type text NOT NULL,
    is_open integer DEFAULT 1,
    opens_at integer,
    closes_at integer,
    capacity_limit integer,
    current_submissions integer DEFAULT 0,
    genres_accepted text,
    window_name text,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT publisher_submission_windows_window_type_check CHECK ((window_type = ANY (ARRAY['rolling'::text, 'periodic'::text, 'annual'::text, 'contest'::text, 'closed'::text])))
);


--
-- Name: publishers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publishers (
    id text NOT NULL,
    name text NOT NULL,
    publisher_type text,
    website text,
    submission_guidelines_url text,
    email text,
    avg_response_time_days integer,
    acceptance_rate real,
    genres_accepted text,
    accepts_simultaneous integer DEFAULT 1,
    requires_exclusive integer DEFAULT 0,
    notes text,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT publishers_publisher_type_check CHECK ((publisher_type = ANY (ARRAY['traditional_publisher'::text, 'indie_press'::text, 'literary_agent'::text, 'magazine'::text, 'anthology'::text, 'contest'::text])))
);


--
-- Name: open_submission_windows; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.open_submission_windows AS
 SELECT psw.id,
    psw.publisher_id,
    psw.window_type,
    psw.is_open,
    psw.opens_at,
    psw.closes_at,
    psw.capacity_limit,
    psw.current_submissions,
    psw.genres_accepted,
    psw.window_name,
    psw.description,
    psw.notes,
    psw.created_at,
    psw.updated_at,
    p.name AS publisher_name,
    p.publisher_type,
    p.website,
    p.avg_response_time_days,
        CASE
            WHEN (psw.closes_at IS NOT NULL) THEN ((((psw.closes_at - (EXTRACT(epoch FROM now()))::bigint))::numeric / 86400.0))::integer
            ELSE NULL::integer
        END AS days_until_close,
        CASE
            WHEN (psw.capacity_limit IS NOT NULL) THEN ((((psw.current_submissions)::numeric * 100.0) / (psw.capacity_limit)::numeric))::integer
            ELSE NULL::integer
        END AS capacity_percent
   FROM (public.publisher_submission_windows psw
     JOIN public.publishers p ON ((psw.publisher_id = p.id)))
  WHERE ((psw.is_open = 1) AND ((psw.closes_at IS NULL) OR (psw.closes_at > (EXTRACT(epoch FROM now()))::bigint)) AND ((psw.capacity_limit IS NULL) OR (psw.current_submissions < psw.capacity_limit)));


--
-- Name: package_document_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_document_map (
    package_id text NOT NULL,
    document_id text NOT NULL,
    document_type text NOT NULL,
    document_order integer DEFAULT 1,
    include_full boolean DEFAULT true
);


--
-- Name: submission_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_packages (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    package_name text NOT NULL,
    package_type text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    metadata text,
    CONSTRAINT submission_packages_package_type_check CHECK ((package_type = ANY (ARRAY['partial'::text, 'full'::text, 'query_only'::text, 'custom'::text, 'contest'::text])))
);


--
-- Name: package_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.package_stats AS
 SELECT sp.id,
    sp.package_name,
    sp.package_type,
    count(pdm.document_id) AS document_count,
    sp.created_at,
    m.title AS manuscript_title
   FROM ((public.submission_packages sp
     LEFT JOIN public.package_document_map pdm ON ((sp.id = pdm.package_id)))
     LEFT JOIN public.manuscripts m ON ((sp.manuscript_id = m.id)))
  GROUP BY sp.id, sp.package_name, sp.package_type, sp.created_at, m.title;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_history (
    id text NOT NULL,
    user_id text NOT NULL,
    subscription_id text,
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    amount integer NOT NULL,
    currency text DEFAULT 'usd'::text,
    payment_type text NOT NULL,
    status text NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    user_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    status text NOT NULL,
    plan text NOT NULL,
    stripe_payment_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_connections (
    id text NOT NULL,
    user_id text NOT NULL,
    platform text NOT NULL,
    status text DEFAULT 'disconnected'::text NOT NULL,
    api_key_encrypted text,
    api_secret_encrypted text,
    access_token_encrypted text,
    refresh_token_encrypted text,
    token_expires_at integer,
    platform_user_id text,
    platform_username text,
    last_sync_at integer,
    last_sync_status text,
    last_sync_error text,
    next_sync_at integer,
    connected_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text, 'expired'::text])))
);


--
-- Name: pricing_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_analysis (
    id text NOT NULL,
    genre text NOT NULL,
    sample_size integer NOT NULL,
    min_price real,
    max_price real,
    avg_price real,
    median_price real,
    mode_price real,
    price_p25 real,
    price_p50 real,
    price_p75 real,
    price_p90 real,
    bestseller_avg_price real,
    high_rated_avg_price real,
    kindle_avg_price real,
    paperback_avg_price real,
    hardcover_avg_price real,
    analyzed_at timestamp without time zone DEFAULT now() NOT NULL,
    data_freshness text
);


--
-- Name: progress_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_checklist_items (
    id text NOT NULL,
    progress_id text NOT NULL,
    item_key text NOT NULL,
    item_label text NOT NULL,
    item_category text,
    is_completed integer DEFAULT 0,
    completed_at integer,
    completion_notes text,
    sort_order integer DEFAULT 0,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: publication_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publication_history (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    publication_type text NOT NULL,
    publication_name text NOT NULL,
    publication_date integer,
    publication_url text,
    rights_sold text,
    rights_currently_held text DEFAULT 'author'::text NOT NULL,
    rights_reversion_date integer,
    rights_reversion_documentation text,
    isbn text,
    circulation integer,
    payment_received real,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT publication_history_publication_type_check CHECK ((publication_type = ANY (ARRAY['magazine'::text, 'journal'::text, 'anthology'::text, 'self_published'::text, 'traditional_publisher'::text, 'online'::text, 'contest'::text, 'other'::text])))
);


--
-- Name: publication_history_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.publication_history_summary AS
 SELECT ph.manuscript_id,
    m.title AS manuscript_title,
    ph.user_id,
    count(*) AS publication_count,
    string_agg(DISTINCT ph.publication_type, ','::text) AS publication_types,
    min(ph.publication_date) AS first_publication,
    max(ph.publication_date) AS latest_publication,
    sum(ph.payment_received) AS total_payments_received
   FROM (public.publication_history ph
     JOIN public.manuscripts m ON ((ph.manuscript_id = m.id)))
  GROUP BY ph.manuscript_id, m.title, ph.user_id;


--
-- Name: revision_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revision_requests (
    id text NOT NULL,
    submission_id text NOT NULL,
    requested_by_user_id text NOT NULL,
    requested_changes text NOT NULL,
    revision_type text,
    deadline integer,
    author_response text,
    author_response_at integer,
    resubmission_manuscript_id text,
    resubmitted_at integer,
    status text DEFAULT 'pending'::text NOT NULL,
    decision text,
    decision_at integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT revision_requests_revision_type_check CHECK ((revision_type = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'substantial'::text]))),
    CONSTRAINT revision_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'resubmitted'::text, 'expired'::text])))
);


--
-- Name: rights_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rights_conflicts (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    rights_type text NOT NULL,
    rights_id_1 text NOT NULL,
    rights_id_2 text NOT NULL,
    conflict_type text NOT NULL,
    conflict_detected_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false,
    resolved_at bigint,
    resolution_notes text,
    CONSTRAINT rights_conflicts_conflict_type_check CHECK ((conflict_type = ANY (ARRAY['territorial_overlap'::text, 'time_overlap'::text, 'exclusive_violation'::text, 'reversion_dispute'::text])))
);


--
-- Name: rights_expiring_soon; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rights_expiring_soon AS
 SELECT mr.id,
    mr.manuscript_id,
    m.title AS manuscript_title,
    mr.user_id,
    mr.rights_type,
    mr.granted_to_publisher_name,
    mr.grant_end_date,
    ((mr.grant_end_date - (EXTRACT(epoch FROM now()))::integer) / 86400) AS days_until_expiration
   FROM (public.manuscript_rights mr
     JOIN public.manuscripts m ON ((mr.manuscript_id = m.id)))
  WHERE ((mr.rights_status = 'granted'::text) AND (mr.grant_end_date IS NOT NULL) AND (mr.grant_end_date <= ((EXTRACT(epoch FROM now()))::integer + (90 * 86400))) AND (mr.grant_end_date > (EXTRACT(epoch FROM now()))::integer))
  ORDER BY mr.grant_end_date;


--
-- Name: rights_licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rights_licenses (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    license_type text NOT NULL,
    licensee_name text NOT NULL,
    territory text,
    language text,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    payment_terms text,
    advance_amount numeric(10,2),
    royalty_rate numeric(5,2),
    rights_granted text[],
    contract_url text,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT rights_licenses_license_type_check CHECK ((license_type = ANY (ARRAY['exclusive'::text, 'non_exclusive'::text, 'first_rights'::text, 'reprint'::text, 'foreign'::text, 'translation'::text, 'audio'::text, 'dramatic'::text, 'anthology'::text]))),
    CONSTRAINT rights_licenses_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'terminated'::text, 'renewed'::text])))
);


--
-- Name: rights_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rights_offers (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    submission_id text,
    publisher_id text,
    publisher_name text NOT NULL,
    rights_offered text NOT NULL,
    offer_date timestamp without time zone DEFAULT now() NOT NULL,
    response_deadline integer,
    status text DEFAULT 'pending'::text NOT NULL,
    response_date integer,
    response_notes text,
    proposed_advance real,
    proposed_royalty_rate real,
    proposed_duration_years integer,
    proposed_exclusive integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rights_offers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'countered'::text, 'withdrawn'::text, 'expired'::text])))
);


--
-- Name: rights_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rights_summary AS
 SELECT mr.manuscript_id,
    m.title AS manuscript_title,
    mr.user_id,
    count(DISTINCT mr.id) AS total_rights_grants,
    count(DISTINCT
        CASE
            WHEN (mr.rights_status = 'granted'::text) THEN mr.id
            ELSE NULL::text
        END) AS active_grants,
    count(DISTINCT
        CASE
            WHEN (mr.exclusive = 1) THEN mr.id
            ELSE NULL::text
        END) AS exclusive_grants,
    string_agg(DISTINCT mr.rights_type, ','::text) AS rights_types_granted,
    sum(mr.advance) AS total_advances,
    max(mr.grant_end_date) AS latest_expiration
   FROM (public.manuscript_rights mr
     JOIN public.manuscripts m ON ((mr.manuscript_id = m.id)))
  GROUP BY mr.manuscript_id, m.title, mr.user_id;


--
-- Name: rights_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rights_templates (
    id text NOT NULL,
    user_id text,
    template_name text NOT NULL,
    template_description text,
    rights_types text NOT NULL,
    default_exclusive integer DEFAULT 0,
    default_duration_years integer,
    default_territories text,
    default_languages text,
    template_type text DEFAULT 'custom'::text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rights_templates_template_type_check CHECK ((template_type = ANY (ARRAY['system'::text, 'custom'::text])))
);


--
-- Name: royalty_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.royalty_payments (
    id text NOT NULL,
    user_id text NOT NULL,
    platform text NOT NULL,
    payment_period_start integer NOT NULL,
    payment_period_end integer NOT NULL,
    payment_date integer,
    expected_payment_date integer,
    amount real NOT NULL,
    currency text DEFAULT 'USD'::text,
    exchange_rate real,
    status text DEFAULT 'pending'::text NOT NULL,
    tax_withheld real DEFAULT 0,
    tax_country text,
    sales_count integer,
    expected_amount real,
    discrepancy real,
    reconciliation_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT royalty_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'reconciled'::text, 'disputed'::text])))
);


--
-- Name: sales_aggregations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_aggregations (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    period_type text NOT NULL,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    platform text NOT NULL,
    total_units_sold integer DEFAULT 0,
    total_revenue real DEFAULT 0,
    total_royalties real DEFAULT 0,
    ebook_units integer DEFAULT 0,
    paperback_units integer DEFAULT 0,
    hardcover_units integer DEFAULT 0,
    audiobook_units integer DEFAULT 0,
    ebook_revenue real DEFAULT 0,
    paperback_revenue real DEFAULT 0,
    hardcover_revenue real DEFAULT 0,
    audiobook_revenue real DEFAULT 0,
    kenp_pages_read integer DEFAULT 0,
    kenp_revenue real DEFAULT 0,
    top_countries text,
    computed_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_aggregations_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])))
);


--
-- Name: sales_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_data (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    sale_date integer NOT NULL,
    platform text NOT NULL,
    format text NOT NULL,
    units_sold integer DEFAULT 0,
    list_price real,
    revenue real DEFAULT 0,
    royalty_earned real DEFAULT 0,
    royalty_rate real,
    currency text DEFAULT 'USD'::text,
    country_code text,
    marketplace text,
    promotion_id text,
    source text,
    kenp_pages_read integer DEFAULT 0,
    kenp_revenue real DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_goals (
    id text NOT NULL,
    user_id text NOT NULL,
    manuscript_id text,
    goal_name text NOT NULL,
    goal_type text NOT NULL,
    target_value real NOT NULL,
    current_value real DEFAULT 0,
    start_date integer NOT NULL,
    end_date integer,
    status text DEFAULT 'active'::text NOT NULL,
    completed_at bigint,
    notify_on_milestone integer DEFAULT 1,
    last_notification_at integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_goals_goal_type_check CHECK ((goal_type = ANY (ARRAY['units'::text, 'revenue'::text, 'royalties'::text, 'reviews'::text, 'rank'::text]))),
    CONSTRAINT sales_goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: scanner_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scanner_health (
    id text NOT NULL,
    scanner_name text NOT NULL,
    status text NOT NULL,
    last_successful_scan timestamp without time zone,
    virus_definitions_version text,
    last_definition_update timestamp without time zone,
    error_message text,
    checked_at timestamp without time zone DEFAULT now() NOT NULL,
    response_time_ms integer
);


--
-- Name: scanner_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.scanner_status AS
 SELECT scanner_name,
    status,
    virus_definitions_version,
    last_definition_update,
    checked_at,
    response_time_ms,
        CASE
            WHEN ((status = 'online'::text) AND (checked_at > (now() - '00:05:00'::interval))) THEN 'healthy'::text
            WHEN (status = 'online'::text) THEN 'stale'::text
            ELSE 'unhealthy'::text
        END AS health_status
   FROM public.scanner_health
  WHERE (id IN ( SELECT scanner_health_1.id
           FROM public.scanner_health scanner_health_1
          WHERE (scanner_health_1.scanner_name IN ( SELECT DISTINCT scanner_health_2.scanner_name
                   FROM public.scanner_health scanner_health_2))
          ORDER BY scanner_health_1.checked_at DESC
         LIMIT 1));


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    migration_name character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: security_incidents_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.security_incidents_summary AS
 SELECT type,
    count(*) AS total_incidents,
    count(
        CASE
            WHEN (resolved = true) THEN 1
            ELSE NULL::integer
        END) AS resolved_count,
    count(
        CASE
            WHEN (resolved = false) THEN 1
            ELSE NULL::integer
        END) AS unresolved_count,
    max(created_at) AS last_incident_at,
    count(DISTINCT user_id) AS affected_users,
    count(DISTINCT ip_address) AS unique_ips
   FROM public.security_incidents
  GROUP BY type
  ORDER BY (count(*)) DESC;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id text NOT NULL,
    user_id text NOT NULL,
    series_name text NOT NULL,
    series_description text,
    total_books_planned integer,
    genre text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: slush_pile_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slush_pile_decisions (
    id text NOT NULL,
    submission_id text NOT NULL,
    decision_type text NOT NULL,
    decided_by text NOT NULL,
    decided_at timestamp without time zone DEFAULT now(),
    decision_notes text,
    feedback_sent boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT slush_pile_decisions_decision_type_check CHECK ((decision_type = ANY (ARRAY['accept'::text, 'reject'::text, 'request_revisions'::text, 'hold'::text])))
);


--
-- Name: social_media_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_media_posts (
    id text NOT NULL,
    kit_id text NOT NULL,
    platform text NOT NULL,
    post_type text NOT NULL,
    post_text text NOT NULL,
    hashtags text,
    image_suggestion text,
    optimal_posting_time text,
    character_count integer,
    engagement_hook text,
    post_order integer DEFAULT 0,
    is_used integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_media_posts_platform_check CHECK ((platform = ANY (ARRAY['twitter'::text, 'facebook'::text, 'instagram'::text, 'tiktok'::text, 'linkedin'::text, 'threads'::text, 'bluesky'::text]))),
    CONSTRAINT social_media_posts_post_type_check CHECK ((post_type = ANY (ARRAY['announcement'::text, 'character_spotlight'::text, 'quote'::text, 'behind_scenes'::text, 'engagement_question'::text, 'countdown'::text, 'review_request'::text, 'giveaway'::text, 'other'::text])))
);


--
-- Name: social_posts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.social_posts AS
 SELECT id,
    kit_id,
    platform,
    post_type,
    post_text,
    hashtags,
    image_suggestion,
    optimal_posting_time,
    character_count,
    engagement_hook,
    post_order,
    is_used,
    created_at
   FROM public.social_media_posts;


--
-- Name: submission_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_assignments (
    id text NOT NULL,
    submission_id text NOT NULL,
    assigned_to_user_id text NOT NULL,
    assigned_by_user_id text NOT NULL,
    assignment_date timestamp without time zone DEFAULT now() NOT NULL,
    completion_date integer,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text])))
);


--
-- Name: submission_deadlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_deadlines (
    id text NOT NULL,
    submission_id text NOT NULL,
    deadline_type text NOT NULL,
    deadline_date timestamp without time zone NOT NULL,
    reminder_days_before integer DEFAULT 7,
    reminder_sent integer DEFAULT 0,
    reminder_sent_at bigint,
    deadline_name text,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_deadlines_deadline_type_check CHECK ((deadline_type = ANY (ARRAY['response_expected'::text, 'revise_resubmit'::text, 'contract_expires'::text, 'contest'::text, 'window_closes'::text, 'other'::text])))
);


--
-- Name: submission_discussions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_discussions (
    id text NOT NULL,
    submission_id text NOT NULL,
    user_id text NOT NULL,
    comment_text text NOT NULL,
    is_internal integer DEFAULT 1,
    parent_comment_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: submission_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_feedback (
    id text NOT NULL,
    submission_id text NOT NULL,
    feedback_type text NOT NULL,
    feedback_text text NOT NULL,
    addressed integer DEFAULT 0,
    response_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['plot'::text, 'character'::text, 'pacing'::text, 'voice'::text, 'dialogue'::text, 'worldbuilding'::text, 'marketability'::text, 'length'::text, 'genre_fit'::text, 'other'::text])))
);


--
-- Name: submission_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_messages (
    id text NOT NULL,
    submission_id text NOT NULL,
    sender_user_id text NOT NULL,
    recipient_user_id text NOT NULL,
    message_type text NOT NULL,
    subject text,
    body text NOT NULL,
    attachments text,
    is_read integer DEFAULT 0,
    read_at bigint,
    parent_message_id text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_messages_message_type_check CHECK ((message_type = ANY (ARRAY['status_update'::text, 'feedback'::text, 'revision_request'::text, 'general'::text, 'system'::text])))
);


--
-- Name: submission_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_ratings (
    id text NOT NULL,
    submission_id text NOT NULL,
    rater_user_id text NOT NULL,
    assignment_id text,
    overall_score real NOT NULL,
    plot_score real,
    writing_quality_score real,
    marketability_score real,
    voice_score real,
    recommendation text,
    strengths text,
    weaknesses text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_ratings_marketability_score_check CHECK (((marketability_score >= (1)::double precision) AND (marketability_score <= (10)::double precision))),
    CONSTRAINT submission_ratings_overall_score_check CHECK (((overall_score >= (1)::double precision) AND (overall_score <= (10)::double precision))),
    CONSTRAINT submission_ratings_plot_score_check CHECK (((plot_score >= (1)::double precision) AND (plot_score <= (10)::double precision))),
    CONSTRAINT submission_ratings_recommendation_check CHECK ((recommendation = ANY (ARRAY['pass'::text, 'consider'::text, 'request_full'::text, 'revise_resubmit'::text, 'offer'::text]))),
    CONSTRAINT submission_ratings_voice_score_check CHECK (((voice_score >= (1)::double precision) AND (voice_score <= (10)::double precision))),
    CONSTRAINT submission_ratings_writing_quality_score_check CHECK (((writing_quality_score >= (1)::double precision) AND (writing_quality_score <= (10)::double precision)))
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id text NOT NULL,
    manuscript_id text NOT NULL,
    user_id text NOT NULL,
    package_id text,
    publisher_name text NOT NULL,
    publisher_type text,
    submission_date timestamp without time zone DEFAULT now() NOT NULL,
    response_date bigint,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    response_type text DEFAULT 'pending'::text,
    feedback_text text,
    feedback_category text,
    is_resubmission integer DEFAULT 0,
    original_submission_id text,
    revision_notes text,
    resubmission_deadline integer,
    response_notes text,
    submission_type text,
    CONSTRAINT submissions_publisher_type_check CHECK ((publisher_type = ANY (ARRAY['agent'::text, 'publisher'::text, 'magazine'::text, 'contest'::text, 'other'::text])))
);


--
-- Name: submission_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.submission_stats AS
 SELECT s.id,
    s.manuscript_id,
    s.publisher_name,
    s.publisher_type,
    s.submission_date,
    s.response_date,
    s.response_type,
    s.is_resubmission,
    m.title AS manuscript_title,
    count(sf.id) AS feedback_count
   FROM ((public.submissions s
     LEFT JOIN public.manuscripts m ON ((s.manuscript_id = m.id)))
     LEFT JOIN public.submission_feedback sf ON ((s.id = sf.submission_id)))
  GROUP BY s.id, s.manuscript_id, s.publisher_name, s.publisher_type, s.submission_date, s.response_date, s.response_type, s.is_resubmission, m.title;


--
-- Name: submission_windows; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.submission_windows AS
 SELECT id,
    publisher_id,
    window_type,
    is_open,
    opens_at,
    closes_at,
    capacity_limit,
    current_submissions,
    genres_accepted,
    window_name,
    description,
    notes,
    created_at,
    updated_at
   FROM public.publisher_submission_windows;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    user_id text NOT NULL,
    stripe_subscription_id text,
    stripe_customer_id text NOT NULL,
    plan_type text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp without time zone NOT NULL,
    current_period_end timestamp without time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: supporting_docs_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.supporting_docs_stats AS
 SELECT user_id,
    manuscript_id,
    document_type,
    count(*) AS total_versions,
    max(version_number) AS latest_version,
    sum(
        CASE
            WHEN (is_current_version = 1) THEN 1
            ELSE 0
        END) AS current_count,
    avg(word_count) AS avg_word_count,
    max(created_at) AS last_updated
   FROM public.supporting_documents
  GROUP BY user_id, manuscript_id, document_type;


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id text NOT NULL,
    team_id text NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    permissions jsonb,
    joined_at timestamp without time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id text NOT NULL,
    name text NOT NULL,
    owner_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: upcoming_deadlines; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.upcoming_deadlines AS
 SELECT sd.id,
    sd.submission_id,
    sd.deadline_type,
    sd.deadline_date,
    sd.reminder_days_before,
    sd.reminder_sent,
    sd.reminder_sent_at,
    sd.deadline_name,
    sd.description,
    sd.notes,
    sd.created_at,
    sd.updated_at,
    m.title AS manuscript_title,
    m.genre,
    ((EXTRACT(epoch FROM ((sd.deadline_date)::timestamp with time zone - now())) / 86400.0))::integer AS days_until_deadline,
        CASE
            WHEN (sd.deadline_date < now()) THEN 1
            ELSE 0
        END AS is_overdue
   FROM (public.submission_deadlines sd
     JOIN public.manuscripts m ON ((sd.submission_id = m.id)))
  WHERE (sd.deadline_date > (now() - '7 days'::interval))
  ORDER BY sd.deadline_date;


--
-- Name: usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_logs (
    id text NOT NULL,
    user_id text NOT NULL,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_tracking (
    id text NOT NULL,
    user_id text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    billing_period_start timestamp without time zone NOT NULL,
    billing_period_end timestamp without time zone NOT NULL,
    tracked_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_subscriptions_with_usage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_subscriptions_with_usage AS
 SELECT u.id AS user_id,
    u.email,
    COALESCE(u.subscription_tier, 'FREE'::character varying) AS subscription_tier,
    s.id AS subscription_id,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    COALESCE(s.plan_type, 'free'::text) AS plan_type,
    COALESCE(s.status, 'active'::text) AS subscription_status,
    s.current_period_start,
    s.current_period_end,
    COALESCE(s.cancel_at_period_end, false) AS cancel_at_period_end,
    count(ut.id) AS manuscripts_this_period,
        CASE
            WHEN (COALESCE(s.plan_type, 'free'::text) = 'free'::text) THEN 999999
            WHEN (s.plan_type = 'pro'::text) THEN 999999
            WHEN (s.plan_type = 'enterprise'::text) THEN 999999
            ELSE 999999
        END AS monthly_limit
   FROM ((public.users u
     LEFT JOIN public.subscriptions s ON (((u.id = s.user_id) AND (s.status = 'active'::text))))
     LEFT JOIN public.usage_tracking ut ON (((u.id = ut.user_id) AND (ut.billing_period_start = s.current_period_start) AND (ut.billing_period_end = s.current_period_end))))
  GROUP BY u.id, u.email, u.subscription_tier, s.id, s.stripe_subscription_id, s.stripe_customer_id, s.plan_type, s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end;


--
-- Name: window_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.window_alerts (
    id text NOT NULL,
    user_id text NOT NULL,
    publisher_id text NOT NULL,
    alert_on_open integer DEFAULT 1,
    alert_on_closing_soon integer DEFAULT 1,
    alert_on_capacity_warning integer DEFAULT 1,
    last_alerted_at integer,
    alerts_sent_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: windows_opening_soon; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.windows_opening_soon AS
 SELECT psw.id,
    psw.publisher_id,
    psw.window_type,
    psw.is_open,
    psw.opens_at,
    psw.closes_at,
    psw.capacity_limit,
    psw.current_submissions,
    psw.genres_accepted,
    psw.window_name,
    psw.description,
    psw.notes,
    psw.created_at,
    psw.updated_at,
    p.name AS publisher_name,
    p.publisher_type,
    p.website,
    ((((psw.opens_at - (EXTRACT(epoch FROM now()))::integer))::numeric / 86400.0))::integer AS days_until_open
   FROM (public.publisher_submission_windows psw
     JOIN public.publishers p ON ((psw.publisher_id = p.id)))
  WHERE ((psw.is_open = 0) AND (psw.opens_at IS NOT NULL) AND (psw.opens_at > (EXTRACT(epoch FROM now()))::integer) AND (psw.opens_at <= ((EXTRACT(epoch FROM now()))::integer + 2592000)))
  ORDER BY psw.opens_at;


--
-- Name: workflow_change_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_change_notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    workflow_id text NOT NULL,
    platform text NOT NULL,
    change_type text NOT NULL,
    change_description text NOT NULL,
    change_significance text,
    notification_sent integer DEFAULT 0,
    notification_sent_at integer,
    user_acknowledged integer DEFAULT 0,
    user_acknowledged_at integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_change_notifications_change_significance_check CHECK ((change_significance = ANY (ARRAY['critical'::text, 'important'::text, 'minor'::text]))),
    CONSTRAINT workflow_change_notifications_change_type_check CHECK ((change_type = ANY (ARRAY['requirement_added'::text, 'requirement_removed'::text, 'step_added'::text, 'step_removed'::text, 'step_modified'::text, 'order_changed'::text])))
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id text NOT NULL,
    platform text NOT NULL,
    workflow_name text NOT NULL,
    workflow_description text,
    steps text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    previous_version_id text,
    is_active boolean DEFAULT true,
    changelog text,
    auto_generated integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflows_platform_check CHECK ((platform = ANY (ARRAY['kdp'::text, 'draft2digital'::text, 'ingramspark'::text, 'apple_books'::text, 'barnes_noble'::text, 'kobo'::text, 'google_play'::text])))
);


--
-- Name: workflow_completion_rates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workflow_completion_rates AS
 SELECT uw.platform,
    w.workflow_name,
    count(*) AS total_started,
    count(
        CASE
            WHEN (uw.status = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_count,
    round(((((count(
        CASE
            WHEN (uw.status = 'completed'::text) THEN 1
            ELSE NULL::integer
        END))::real / (count(*))::double precision) * (100)::double precision))::numeric, 2) AS completion_rate_percent,
    avg(
        CASE
            WHEN (uw.completed_at IS NOT NULL) THEN (EXTRACT(epoch FROM (uw.completed_at - uw.started_at)) / 86400.0)
            ELSE NULL::numeric
        END) AS avg_days_to_complete
   FROM (public.user_workflows uw
     JOIN public.workflows w ON ((uw.workflow_id = w.id)))
  GROUP BY uw.platform, w.workflow_name;


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: agent_config agent_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_config
    ADD CONSTRAINT agent_config_pkey PRIMARY KEY (id);


--
-- Name: agent_config agent_config_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_config
    ADD CONSTRAINT agent_config_platform_key UNIQUE (platform);


--
-- Name: agent_conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);


--
-- Name: agent_knowledge agent_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_knowledge
    ADD CONSTRAINT agent_knowledge_pkey PRIMARY KEY (id);


--
-- Name: amazon_search_queries amazon_search_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amazon_search_queries
    ADD CONSTRAINT amazon_search_queries_pkey PRIMARY KEY (id);


--
-- Name: analyses analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_pkey PRIMARY KEY (id);


--
-- Name: analysis_comp_titles analysis_comp_titles_analysis_id_comp_title_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_comp_titles
    ADD CONSTRAINT analysis_comp_titles_analysis_id_comp_title_id_key UNIQUE (analysis_id, comp_title_id);


--
-- Name: analysis_comp_titles analysis_comp_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_comp_titles
    ADD CONSTRAINT analysis_comp_titles_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: author_bios author_bios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_bios
    ADD CONSTRAINT author_bios_pkey PRIMARY KEY (id);


--
-- Name: author_platform author_platform_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_platform
    ADD CONSTRAINT author_platform_pkey PRIMARY KEY (id);


--
-- Name: author_platform_scores author_platform_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_platform_scores
    ADD CONSTRAINT author_platform_scores_pkey PRIMARY KEY (id);


--
-- Name: bestseller_ranks bestseller_ranks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bestseller_ranks
    ADD CONSTRAINT bestseller_ranks_pkey PRIMARY KEY (id);


--
-- Name: bookstore_positioning bookstore_positioning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookstore_positioning
    ADD CONSTRAINT bookstore_positioning_pkey PRIMARY KEY (id);


--
-- Name: comp_titles comp_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_titles
    ADD CONSTRAINT comp_titles_pkey PRIMARY KEY (id);


--
-- Name: content_calendar content_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_calendar
    ADD CONSTRAINT content_calendar_pkey PRIMARY KEY (id);


--
-- Name: content_warning_types content_warning_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_warning_types
    ADD CONSTRAINT content_warning_types_name_key UNIQUE (name);


--
-- Name: content_warning_types content_warning_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_warning_types
    ADD CONSTRAINT content_warning_types_pkey PRIMARY KEY (id);


--
-- Name: cost_tracking cost_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_tracking
    ADD CONSTRAINT cost_tracking_pkey PRIMARY KEY (id);


--
-- Name: cover_design_briefs cover_design_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_design_briefs
    ADD CONSTRAINT cover_design_briefs_pkey PRIMARY KEY (id);


--
-- Name: doc_fetch_log doc_fetch_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_fetch_log
    ADD CONSTRAINT doc_fetch_log_pkey PRIMARY KEY (id);


--
-- Name: editorial_assignments editorial_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editorial_assignments
    ADD CONSTRAINT editorial_assignments_pkey PRIMARY KEY (id);


--
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- Name: file_scan_results file_scan_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_scan_results
    ADD CONSTRAINT file_scan_results_pkey PRIMARY KEY (id);


--
-- Name: formatted_manuscripts formatted_manuscripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatted_manuscripts
    ADD CONSTRAINT formatted_manuscripts_pkey PRIMARY KEY (id);


--
-- Name: formatting_jobs formatting_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatting_jobs
    ADD CONSTRAINT formatting_jobs_pkey PRIMARY KEY (id);


--
-- Name: formatting_templates formatting_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatting_templates
    ADD CONSTRAINT formatting_templates_pkey PRIMARY KEY (id);


--
-- Name: genres genres_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_name_key UNIQUE (name);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- Name: hashtag_strategy hashtag_strategy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hashtag_strategy
    ADD CONSTRAINT hashtag_strategy_pkey PRIMARY KEY (id);


--
-- Name: human_edit_sessions human_edit_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_edit_sessions
    ADD CONSTRAINT human_edit_sessions_pkey PRIMARY KEY (id);


--
-- Name: human_editors human_editors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_editors
    ADD CONSTRAINT human_editors_pkey PRIMARY KEY (id);


--
-- Name: human_style_edits human_style_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_style_edits
    ADD CONSTRAINT human_style_edits_pkey PRIMARY KEY (id);


--
-- Name: kdp_metadata kdp_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_metadata
    ADD CONSTRAINT kdp_metadata_pkey PRIMARY KEY (id);


--
-- Name: kdp_packages kdp_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_packages
    ADD CONSTRAINT kdp_packages_pkey PRIMARY KEY (id);


--
-- Name: kdp_publishing_status kdp_publishing_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_publishing_status
    ADD CONSTRAINT kdp_publishing_status_pkey PRIMARY KEY (id);


--
-- Name: kdp_royalty_calculations kdp_royalty_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_royalty_calculations
    ADD CONSTRAINT kdp_royalty_calculations_pkey PRIMARY KEY (id);


--
-- Name: kdp_validation_results kdp_validation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_validation_results
    ADD CONSTRAINT kdp_validation_results_pkey PRIMARY KEY (id);


--
-- Name: manuscript_metadata_history manuscript_metadata_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_metadata_history
    ADD CONSTRAINT manuscript_metadata_history_pkey PRIMARY KEY (id);


--
-- Name: manuscript_publishing_progress manuscript_publishing_progress_manuscript_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_publishing_progress
    ADD CONSTRAINT manuscript_publishing_progress_manuscript_id_platform_key UNIQUE (manuscript_id, platform);


--
-- Name: manuscript_publishing_progress manuscript_publishing_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_publishing_progress
    ADD CONSTRAINT manuscript_publishing_progress_pkey PRIMARY KEY (id);


--
-- Name: manuscript_rights manuscript_rights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_rights
    ADD CONSTRAINT manuscript_rights_pkey PRIMARY KEY (id);


--
-- Name: manuscripts manuscripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscripts
    ADD CONSTRAINT manuscripts_pkey PRIMARY KEY (id);


--
-- Name: manuscripts manuscripts_report_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscripts
    ADD CONSTRAINT manuscripts_report_id_key UNIQUE (report_id);


--
-- Name: market_analysis_reports market_analysis_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_analysis_reports
    ADD CONSTRAINT market_analysis_reports_pkey PRIMARY KEY (id);


--
-- Name: market_positioning_reports market_positioning_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_positioning_reports
    ADD CONSTRAINT market_positioning_reports_pkey PRIMARY KEY (id);


--
-- Name: market_trends market_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_trends
    ADD CONSTRAINT market_trends_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_hooks marketing_hooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_hooks
    ADD CONSTRAINT marketing_hooks_pkey PRIMARY KEY (id);


--
-- Name: marketing_kits marketing_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_kits
    ADD CONSTRAINT marketing_kits_pkey PRIMARY KEY (id);


--
-- Name: marketing_materials marketing_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_materials
    ADD CONSTRAINT marketing_materials_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notification_queue notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);


--
-- Name: package_document_map package_document_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_document_map
    ADD CONSTRAINT package_document_map_pkey PRIMARY KEY (package_id, document_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: payment_history payment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: platform_connections platform_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_pkey PRIMARY KEY (id);


--
-- Name: platform_connections platform_connections_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_user_id_platform_key UNIQUE (user_id, platform);


--
-- Name: platform_docs platform_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_docs
    ADD CONSTRAINT platform_docs_pkey PRIMARY KEY (id);


--
-- Name: pricing_analysis pricing_analysis_genre_analyzed_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_analysis
    ADD CONSTRAINT pricing_analysis_genre_analyzed_at_key UNIQUE (genre, analyzed_at);


--
-- Name: pricing_analysis pricing_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_analysis
    ADD CONSTRAINT pricing_analysis_pkey PRIMARY KEY (id);


--
-- Name: progress_checklist_items progress_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_checklist_items
    ADD CONSTRAINT progress_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: progress_checklist_items progress_checklist_items_progress_id_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_checklist_items
    ADD CONSTRAINT progress_checklist_items_progress_id_item_key_key UNIQUE (progress_id, item_key);


--
-- Name: publication_history publication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publication_history
    ADD CONSTRAINT publication_history_pkey PRIMARY KEY (id);


--
-- Name: publisher_submission_windows publisher_submission_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_submission_windows
    ADD CONSTRAINT publisher_submission_windows_pkey PRIMARY KEY (id);


--
-- Name: publishers publishers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publishers
    ADD CONSTRAINT publishers_pkey PRIMARY KEY (id);


--
-- Name: revision_requests revision_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_pkey PRIMARY KEY (id);


--
-- Name: rights_conflicts rights_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_conflicts
    ADD CONSTRAINT rights_conflicts_pkey PRIMARY KEY (id);


--
-- Name: rights_licenses rights_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_licenses
    ADD CONSTRAINT rights_licenses_pkey PRIMARY KEY (id);


--
-- Name: rights_offers rights_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_offers
    ADD CONSTRAINT rights_offers_pkey PRIMARY KEY (id);


--
-- Name: rights_templates rights_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_templates
    ADD CONSTRAINT rights_templates_pkey PRIMARY KEY (id);


--
-- Name: royalty_payments royalty_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.royalty_payments
    ADD CONSTRAINT royalty_payments_pkey PRIMARY KEY (id);


--
-- Name: sales_aggregations sales_aggregations_manuscript_id_period_type_period_start_p_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_aggregations
    ADD CONSTRAINT sales_aggregations_manuscript_id_period_type_period_start_p_key UNIQUE (manuscript_id, period_type, period_start, platform);


--
-- Name: sales_aggregations sales_aggregations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_aggregations
    ADD CONSTRAINT sales_aggregations_pkey PRIMARY KEY (id);


--
-- Name: sales_data sales_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_pkey PRIMARY KEY (id);


--
-- Name: sales_goals sales_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_goals
    ADD CONSTRAINT sales_goals_pkey PRIMARY KEY (id);


--
-- Name: scanner_health scanner_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scanner_health
    ADD CONSTRAINT scanner_health_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_migration_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_migration_name_key UNIQUE (migration_name);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: slush_pile_decisions slush_pile_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slush_pile_decisions
    ADD CONSTRAINT slush_pile_decisions_pkey PRIMARY KEY (id);


--
-- Name: slush_pile_decisions slush_pile_decisions_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slush_pile_decisions
    ADD CONSTRAINT slush_pile_decisions_submission_id_key UNIQUE (submission_id);


--
-- Name: social_media_posts social_media_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media_posts
    ADD CONSTRAINT social_media_posts_pkey PRIMARY KEY (id);


--
-- Name: submission_assignments submission_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_assignments
    ADD CONSTRAINT submission_assignments_pkey PRIMARY KEY (id);


--
-- Name: submission_deadlines submission_deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_deadlines
    ADD CONSTRAINT submission_deadlines_pkey PRIMARY KEY (id);


--
-- Name: submission_discussions submission_discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_discussions
    ADD CONSTRAINT submission_discussions_pkey PRIMARY KEY (id);


--
-- Name: submission_feedback submission_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_feedback
    ADD CONSTRAINT submission_feedback_pkey PRIMARY KEY (id);


--
-- Name: submission_messages submission_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_messages
    ADD CONSTRAINT submission_messages_pkey PRIMARY KEY (id);


--
-- Name: submission_packages submission_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_packages
    ADD CONSTRAINT submission_packages_pkey PRIMARY KEY (id);


--
-- Name: submission_ratings submission_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_ratings
    ADD CONSTRAINT submission_ratings_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: supporting_documents supporting_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporting_documents
    ADD CONSTRAINT supporting_documents_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: usage_logs usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_logs
    ADD CONSTRAINT usage_logs_pkey PRIMARY KEY (id);


--
-- Name: usage_tracking usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: user_workflows user_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_workflows
    ADD CONSTRAINT user_workflows_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: window_alerts window_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.window_alerts
    ADD CONSTRAINT window_alerts_pkey PRIMARY KEY (id);


--
-- Name: window_alerts window_alerts_user_id_publisher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.window_alerts
    ADD CONSTRAINT window_alerts_user_id_publisher_id_key UNIQUE (user_id, publisher_id);


--
-- Name: workflow_change_notifications workflow_change_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_change_notifications
    ADD CONSTRAINT workflow_change_notifications_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: idx_agent_conversations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_created ON public.agent_conversations USING btree (created_at DESC);


--
-- Name: idx_agent_conversations_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_platform ON public.agent_conversations USING btree (platform);


--
-- Name: idx_agent_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_user ON public.agent_conversations USING btree (user_id);


--
-- Name: idx_agent_conversations_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_workflow ON public.agent_conversations USING btree (user_workflow_id);


--
-- Name: idx_agent_knowledge_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_knowledge_current ON public.agent_knowledge USING btree (is_current);


--
-- Name: idx_agent_knowledge_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_knowledge_platform ON public.agent_knowledge USING btree (platform);


--
-- Name: idx_agent_knowledge_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_knowledge_topic ON public.agent_knowledge USING btree (topic);


--
-- Name: idx_agent_knowledge_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_knowledge_type ON public.agent_knowledge USING btree (knowledge_type);


--
-- Name: idx_analyses_manuscript_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyses_manuscript_id ON public.analyses USING btree (manuscript_id);


--
-- Name: idx_analysis_comp_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_comp_analysis ON public.analysis_comp_titles USING btree (analysis_id);


--
-- Name: idx_analysis_comp_relevance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_comp_relevance ON public.analysis_comp_titles USING btree (relevance_score DESC);


--
-- Name: idx_analysis_comp_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_comp_title ON public.analysis_comp_titles USING btree (comp_title_id);


--
-- Name: idx_analysis_reports_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reports_created ON public.market_analysis_reports USING btree (created_at DESC);


--
-- Name: idx_analysis_reports_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reports_genre ON public.market_analysis_reports USING btree (genre);


--
-- Name: idx_analysis_reports_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reports_manuscript ON public.market_analysis_reports USING btree (manuscript_id);


--
-- Name: idx_analysis_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reports_status ON public.market_analysis_reports USING btree (status);


--
-- Name: idx_analysis_reports_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_reports_user ON public.market_analysis_reports USING btree (user_id);


--
-- Name: idx_assignments_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_assigned_by ON public.submission_assignments USING btree (assigned_by_user_id);


--
-- Name: idx_assignments_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_assigned_to ON public.submission_assignments USING btree (assigned_to_user_id);


--
-- Name: idx_assignments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_date ON public.submission_assignments USING btree (assignment_date DESC);


--
-- Name: idx_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_status ON public.submission_assignments USING btree (status);


--
-- Name: idx_assignments_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_submission ON public.submission_assignments USING btree (submission_id);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_resource ON public.audit_log USING btree (resource_type, resource_id);


--
-- Name: idx_audit_log_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_timestamp ON public.audit_log USING btree ("timestamp");


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_author_bios_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_bios_created ON public.author_bios USING btree (created_at);


--
-- Name: idx_author_bios_length; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_bios_length ON public.author_bios USING btree (length);


--
-- Name: idx_author_bios_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_bios_manuscript ON public.author_bios USING btree (manuscript_id);


--
-- Name: idx_author_bios_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_bios_user ON public.author_bios USING btree (user_id);


--
-- Name: idx_author_platform_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_platform_active ON public.author_platform USING btree (is_active);


--
-- Name: idx_author_platform_followers; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_platform_followers ON public.author_platform USING btree (follower_count DESC);


--
-- Name: idx_author_platform_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_platform_type ON public.author_platform USING btree (platform_type);


--
-- Name: idx_author_platform_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_platform_user ON public.author_platform USING btree (user_id);


--
-- Name: idx_bookstore_positioning_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookstore_positioning_category ON public.bookstore_positioning USING btree (primary_category);


--
-- Name: idx_bookstore_positioning_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookstore_positioning_manuscript ON public.bookstore_positioning USING btree (manuscript_id);


--
-- Name: idx_bookstore_positioning_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookstore_positioning_user ON public.bookstore_positioning USING btree (user_id);


--
-- Name: idx_calendar_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_completed ON public.content_calendar USING btree (completed);


--
-- Name: idx_calendar_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_day ON public.content_calendar USING btree (day_number);


--
-- Name: idx_calendar_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_kit ON public.content_calendar USING btree (kit_id);


--
-- Name: idx_calendar_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_platform ON public.content_calendar USING btree (platform);


--
-- Name: idx_checklist_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_completed ON public.progress_checklist_items USING btree (is_completed);


--
-- Name: idx_checklist_progress; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_progress ON public.progress_checklist_items USING btree (progress_id);


--
-- Name: idx_comp_titles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_titles_active ON public.comp_titles USING btree (is_active);


--
-- Name: idx_comp_titles_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_titles_manuscript ON public.comp_titles USING btree (manuscript_id);


--
-- Name: idx_comp_titles_similarity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_titles_similarity ON public.comp_titles USING btree (similarity_score DESC);


--
-- Name: idx_comp_titles_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_titles_source ON public.comp_titles USING btree (data_source);


--
-- Name: idx_comp_titles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_titles_user ON public.comp_titles USING btree (user_id);


--
-- Name: idx_content_warnings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_warnings_active ON public.content_warning_types USING btree (is_active);


--
-- Name: idx_content_warnings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_warnings_category ON public.content_warning_types USING btree (category);


--
-- Name: idx_cost_tracking_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tracking_manuscript ON public.cost_tracking USING btree (manuscript_id);


--
-- Name: idx_cost_tracking_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tracking_service ON public.cost_tracking USING btree (service);


--
-- Name: idx_cost_tracking_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_tracking_user ON public.cost_tracking USING btree (user_id);


--
-- Name: idx_cover_briefs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_briefs_created ON public.cover_design_briefs USING btree (created_at);


--
-- Name: idx_cover_briefs_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_briefs_genre ON public.cover_design_briefs USING btree (genre);


--
-- Name: idx_cover_briefs_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_briefs_manuscript ON public.cover_design_briefs USING btree (manuscript_id);


--
-- Name: idx_cover_briefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_briefs_user ON public.cover_design_briefs USING btree (user_id);


--
-- Name: idx_deadlines_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deadlines_date ON public.submission_deadlines USING btree (deadline_date);


--
-- Name: idx_deadlines_reminder_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deadlines_reminder_sent ON public.submission_deadlines USING btree (reminder_sent);


--
-- Name: idx_deadlines_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deadlines_submission ON public.submission_deadlines USING btree (submission_id);


--
-- Name: idx_deadlines_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deadlines_type ON public.submission_deadlines USING btree (deadline_type);


--
-- Name: idx_discussions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussions_date ON public.submission_discussions USING btree (created_at DESC);


--
-- Name: idx_discussions_internal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussions_internal ON public.submission_discussions USING btree (is_internal);


--
-- Name: idx_discussions_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussions_parent ON public.submission_discussions USING btree (parent_comment_id);


--
-- Name: idx_discussions_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussions_submission ON public.submission_discussions USING btree (submission_id);


--
-- Name: idx_discussions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discussions_user ON public.submission_discussions USING btree (user_id);


--
-- Name: idx_doc_fetch_log_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_fetch_log_platform ON public.doc_fetch_log USING btree (platform);


--
-- Name: idx_doc_fetch_log_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_fetch_log_started ON public.doc_fetch_log USING btree (fetch_started_at DESC);


--
-- Name: idx_doc_fetch_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_fetch_log_status ON public.doc_fetch_log USING btree (fetch_status);


--
-- Name: idx_editorial_assignments_editor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_editorial_assignments_editor ON public.editorial_assignments USING btree (editor_id);


--
-- Name: idx_editorial_assignments_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_editorial_assignments_manuscript ON public.editorial_assignments USING btree (manuscript_id);


--
-- Name: idx_editorial_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_editorial_assignments_status ON public.editorial_assignments USING btree (status);


--
-- Name: idx_email_queue_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_scheduled ON public.email_queue USING btree (scheduled_for);


--
-- Name: idx_email_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);


--
-- Name: idx_file_scan_results_file_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_results_file_key ON public.file_scan_results USING btree (file_key);


--
-- Name: idx_file_scan_results_scanned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_results_scanned ON public.file_scan_results USING btree (scanned_at DESC);


--
-- Name: idx_file_scan_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_results_status ON public.file_scan_results USING btree (scan_status);


--
-- Name: idx_file_scan_results_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_scan_results_user ON public.file_scan_results USING btree (user_id);


--
-- Name: idx_formatted_manuscripts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatted_manuscripts_created ON public.formatted_manuscripts USING btree (created_at DESC);


--
-- Name: idx_formatted_manuscripts_format; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatted_manuscripts_format ON public.formatted_manuscripts USING btree (format_type);


--
-- Name: idx_formatted_manuscripts_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatted_manuscripts_manuscript ON public.formatted_manuscripts USING btree (manuscript_id);


--
-- Name: idx_formatted_manuscripts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatted_manuscripts_status ON public.formatted_manuscripts USING btree (status);


--
-- Name: idx_formatted_manuscripts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatted_manuscripts_user ON public.formatted_manuscripts USING btree (user_id);


--
-- Name: idx_formatting_jobs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_jobs_created ON public.formatting_jobs USING btree (created_at);


--
-- Name: idx_formatting_jobs_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_jobs_priority ON public.formatting_jobs USING btree (priority DESC);


--
-- Name: idx_formatting_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_jobs_status ON public.formatting_jobs USING btree (status);


--
-- Name: idx_formatting_templates_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_templates_system ON public.formatting_templates USING btree (is_system_template);


--
-- Name: idx_formatting_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_templates_type ON public.formatting_templates USING btree (template_type);


--
-- Name: idx_formatting_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formatting_templates_user ON public.formatting_templates USING btree (user_id);


--
-- Name: idx_genres_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genres_active ON public.genres USING btree (is_active);


--
-- Name: idx_genres_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genres_name ON public.genres USING btree (name);


--
-- Name: idx_genres_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genres_parent ON public.genres USING btree (parent_genre_id);


--
-- Name: idx_hashtags_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hashtags_genre ON public.hashtag_strategy USING btree (genre);


--
-- Name: idx_hashtags_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hashtags_kit ON public.hashtag_strategy USING btree (kit_id);


--
-- Name: idx_hashtags_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hashtags_platform ON public.hashtag_strategy USING btree (platform);


--
-- Name: idx_human_editors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_editors_status ON public.human_editors USING btree (availability_status);


--
-- Name: idx_human_editors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_editors_user ON public.human_editors USING btree (user_id);


--
-- Name: idx_human_edits_addressed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_addressed ON public.human_style_edits USING btree (addressed);


--
-- Name: idx_human_edits_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_chapter ON public.human_style_edits USING btree (manuscript_id, chapter_number);


--
-- Name: idx_human_edits_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_created ON public.human_style_edits USING btree (created_at DESC);


--
-- Name: idx_human_edits_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_manuscript ON public.human_style_edits USING btree (manuscript_id);


--
-- Name: idx_human_edits_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_type ON public.human_style_edits USING btree (annotation_type);


--
-- Name: idx_human_edits_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_edits_user ON public.human_style_edits USING btree (user_id);


--
-- Name: idx_human_sessions_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_sessions_chapter ON public.human_edit_sessions USING btree (manuscript_id, chapter_number);


--
-- Name: idx_human_sessions_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_sessions_manuscript ON public.human_edit_sessions USING btree (manuscript_id);


--
-- Name: idx_human_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_sessions_user ON public.human_edit_sessions USING btree (user_id);


--
-- Name: idx_kdp_metadata_isbn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_metadata_isbn ON public.kdp_metadata USING btree (isbn);


--
-- Name: idx_kdp_metadata_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_metadata_manuscript ON public.kdp_metadata USING btree (manuscript_id);


--
-- Name: idx_kdp_metadata_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_metadata_package ON public.kdp_metadata USING btree (package_id);


--
-- Name: idx_kdp_packages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_packages_created ON public.kdp_packages USING btree (created_at DESC);


--
-- Name: idx_kdp_packages_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_packages_manuscript ON public.kdp_packages USING btree (manuscript_id);


--
-- Name: idx_kdp_packages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_packages_status ON public.kdp_packages USING btree (package_status);


--
-- Name: idx_kdp_packages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_packages_user ON public.kdp_packages USING btree (user_id);


--
-- Name: idx_kdp_publishing_asin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_publishing_asin ON public.kdp_publishing_status USING btree (kdp_asin);


--
-- Name: idx_kdp_publishing_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_publishing_package ON public.kdp_publishing_status USING btree (package_id);


--
-- Name: idx_kdp_publishing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_publishing_status ON public.kdp_publishing_status USING btree (status);


--
-- Name: idx_kdp_publishing_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_publishing_user ON public.kdp_publishing_status USING btree (user_id);


--
-- Name: idx_kdp_royalty_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_royalty_package ON public.kdp_royalty_calculations USING btree (package_id);


--
-- Name: idx_kdp_validation_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_validation_package ON public.kdp_validation_results USING btree (package_id);


--
-- Name: idx_kdp_validation_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kdp_validation_type ON public.kdp_validation_results USING btree (validation_type);


--
-- Name: idx_manuscript_rights_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_dates ON public.manuscript_rights USING btree (grant_start_date, grant_end_date);


--
-- Name: idx_manuscript_rights_exclusive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_exclusive ON public.manuscript_rights USING btree (exclusive);


--
-- Name: idx_manuscript_rights_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_manuscript ON public.manuscript_rights USING btree (manuscript_id);


--
-- Name: idx_manuscript_rights_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_publisher ON public.manuscript_rights USING btree (granted_to_publisher_id);


--
-- Name: idx_manuscript_rights_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_status ON public.manuscript_rights USING btree (rights_status);


--
-- Name: idx_manuscript_rights_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_type ON public.manuscript_rights USING btree (rights_type);


--
-- Name: idx_manuscript_rights_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscript_rights_user ON public.manuscript_rights USING btree (user_id);


--
-- Name: idx_manuscripts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscripts_created_at ON public.manuscripts USING btree (created_at);


--
-- Name: idx_manuscripts_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscripts_report_id ON public.manuscripts USING btree (report_id);


--
-- Name: idx_manuscripts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manuscripts_user_id ON public.manuscripts USING btree (user_id);


--
-- Name: idx_market_reports_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_reports_date ON public.market_positioning_reports USING btree (report_date DESC);


--
-- Name: idx_market_reports_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_reports_manuscript ON public.market_positioning_reports USING btree (manuscript_id);


--
-- Name: idx_market_reports_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_reports_user ON public.market_positioning_reports USING btree (user_id);


--
-- Name: idx_market_trends_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_genre ON public.market_trends USING btree (genre);


--
-- Name: idx_market_trends_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_period ON public.market_trends USING btree (period_start DESC);


--
-- Name: idx_marketing_hooks_effectiveness; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_hooks_effectiveness ON public.marketing_hooks USING btree (effectiveness_score DESC);


--
-- Name: idx_marketing_hooks_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_hooks_manuscript ON public.marketing_hooks USING btree (manuscript_id);


--
-- Name: idx_marketing_hooks_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_hooks_type ON public.marketing_hooks USING btree (hook_type);


--
-- Name: idx_marketing_hooks_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_hooks_used ON public.marketing_hooks USING btree (used_in_marketing);


--
-- Name: idx_marketing_hooks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_hooks_user ON public.marketing_hooks USING btree (user_id);


--
-- Name: idx_marketing_kits_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_kits_created ON public.marketing_kits USING btree (created_at DESC);


--
-- Name: idx_marketing_kits_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_kits_manuscript ON public.marketing_kits USING btree (manuscript_id);


--
-- Name: idx_marketing_kits_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_kits_user ON public.marketing_kits USING btree (user_id);


--
-- Name: idx_materials_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_kit ON public.marketing_materials USING btree (kit_id);


--
-- Name: idx_materials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_type ON public.marketing_materials USING btree (material_type);


--
-- Name: idx_message_templates_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_publisher ON public.message_templates USING btree (publisher_id);


--
-- Name: idx_message_templates_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_system ON public.message_templates USING btree (is_system_template);


--
-- Name: idx_message_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_type ON public.message_templates USING btree (template_type);


--
-- Name: idx_metadata_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_history_changed_at ON public.manuscript_metadata_history USING btree (changed_at);


--
-- Name: idx_metadata_history_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_history_manuscript ON public.manuscript_metadata_history USING btree (manuscript_id);


--
-- Name: idx_notification_preferences_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notification_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_created ON public.notification_queue USING btree (created_at);


--
-- Name: idx_notification_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_status ON public.notification_queue USING btree (status);


--
-- Name: idx_notification_queue_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_type ON public.notification_queue USING btree (notification_type);


--
-- Name: idx_notification_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_user ON public.notification_queue USING btree (user_id);


--
-- Name: idx_package_document_map_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_document_map_package ON public.package_document_map USING btree (package_id);


--
-- Name: idx_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_password_reset_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_payment_history_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_subscription ON public.payment_history USING btree (subscription_id);


--
-- Name: idx_payment_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_user ON public.payment_history USING btree (user_id);


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);


--
-- Name: idx_platform_docs_change; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_change ON public.platform_docs USING btree (change_detected);


--
-- Name: idx_platform_docs_fetched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_fetched ON public.platform_docs USING btree (fetched_at DESC);


--
-- Name: idx_platform_docs_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_hash ON public.platform_docs USING btree (content_hash);


--
-- Name: idx_platform_docs_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_platform ON public.platform_docs USING btree (platform);


--
-- Name: idx_platform_docs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_type ON public.platform_docs USING btree (doc_type);


--
-- Name: idx_platform_docs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_docs_version ON public.platform_docs USING btree (version DESC);


--
-- Name: idx_platform_scores_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_scores_date ON public.author_platform_scores USING btree (score_date DESC);


--
-- Name: idx_platform_scores_overall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_scores_overall ON public.author_platform_scores USING btree (overall_score DESC);


--
-- Name: idx_platform_scores_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_scores_user ON public.author_platform_scores USING btree (user_id);


--
-- Name: idx_pricing_analysis_analyzed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_analysis_analyzed ON public.pricing_analysis USING btree (analyzed_at DESC);


--
-- Name: idx_pricing_analysis_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_analysis_genre ON public.pricing_analysis USING btree (genre);


--
-- Name: idx_progress_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_manuscript ON public.manuscript_publishing_progress USING btree (manuscript_id);


--
-- Name: idx_progress_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_platform ON public.manuscript_publishing_progress USING btree (platform);


--
-- Name: idx_progress_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_status ON public.manuscript_publishing_progress USING btree (status);


--
-- Name: idx_publication_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publication_history_date ON public.publication_history USING btree (publication_date DESC);


--
-- Name: idx_publication_history_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publication_history_manuscript ON public.publication_history USING btree (manuscript_id);


--
-- Name: idx_publication_history_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publication_history_type ON public.publication_history USING btree (publication_type);


--
-- Name: idx_publication_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publication_history_user ON public.publication_history USING btree (user_id);


--
-- Name: idx_publishers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_active ON public.publishers USING btree (is_active);


--
-- Name: idx_publishers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_name ON public.publishers USING btree (name);


--
-- Name: idx_publishers_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_type ON public.publishers USING btree (publisher_type);


--
-- Name: idx_ratings_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_assignment ON public.submission_ratings USING btree (assignment_id);


--
-- Name: idx_ratings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_created ON public.submission_ratings USING btree (created_at DESC);


--
-- Name: idx_ratings_overall_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_overall_score ON public.submission_ratings USING btree (overall_score DESC);


--
-- Name: idx_ratings_rater; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_rater ON public.submission_ratings USING btree (rater_user_id);


--
-- Name: idx_ratings_recommendation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_recommendation ON public.submission_ratings USING btree (recommendation);


--
-- Name: idx_ratings_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_submission ON public.submission_ratings USING btree (submission_id);


--
-- Name: idx_revision_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_requests_created ON public.revision_requests USING btree (created_at DESC);


--
-- Name: idx_revision_requests_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_requests_deadline ON public.revision_requests USING btree (deadline);


--
-- Name: idx_revision_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_requests_requester ON public.revision_requests USING btree (requested_by_user_id);


--
-- Name: idx_revision_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_requests_status ON public.revision_requests USING btree (status);


--
-- Name: idx_revision_requests_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revision_requests_submission ON public.revision_requests USING btree (submission_id);


--
-- Name: idx_rights_conflicts_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_conflicts_manuscript ON public.rights_conflicts USING btree (manuscript_id);


--
-- Name: idx_rights_conflicts_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_conflicts_resolved ON public.rights_conflicts USING btree (resolved);


--
-- Name: idx_rights_conflicts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_conflicts_type ON public.rights_conflicts USING btree (rights_type);


--
-- Name: idx_rights_licenses_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_licenses_manuscript ON public.rights_licenses USING btree (manuscript_id);


--
-- Name: idx_rights_licenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_licenses_status ON public.rights_licenses USING btree (status);


--
-- Name: idx_rights_licenses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_licenses_type ON public.rights_licenses USING btree (license_type);


--
-- Name: idx_rights_licenses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_licenses_user ON public.rights_licenses USING btree (user_id);


--
-- Name: idx_rights_offers_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_offers_date ON public.rights_offers USING btree (offer_date DESC);


--
-- Name: idx_rights_offers_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_offers_manuscript ON public.rights_offers USING btree (manuscript_id);


--
-- Name: idx_rights_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_offers_status ON public.rights_offers USING btree (status);


--
-- Name: idx_rights_offers_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_offers_submission ON public.rights_offers USING btree (submission_id);


--
-- Name: idx_rights_offers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_offers_user ON public.rights_offers USING btree (user_id);


--
-- Name: idx_rights_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_templates_active ON public.rights_templates USING btree (is_active);


--
-- Name: idx_rights_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_templates_type ON public.rights_templates USING btree (template_type);


--
-- Name: idx_rights_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rights_templates_user ON public.rights_templates USING btree (user_id);


--
-- Name: idx_scanner_health_checked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scanner_health_checked ON public.scanner_health USING btree (checked_at DESC);


--
-- Name: idx_scanner_health_scanner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scanner_health_scanner ON public.scanner_health USING btree (scanner_name);


--
-- Name: idx_search_queries_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_queries_genre ON public.amazon_search_queries USING btree (genre);


--
-- Name: idx_search_queries_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_queries_manuscript ON public.amazon_search_queries USING btree (manuscript_id);


--
-- Name: idx_search_queries_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_queries_timestamp ON public.amazon_search_queries USING btree (search_timestamp DESC);


--
-- Name: idx_search_queries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_queries_user ON public.amazon_search_queries USING btree (user_id);


--
-- Name: idx_security_incidents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_created ON public.security_incidents USING btree (created_at DESC);


--
-- Name: idx_security_incidents_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_ip ON public.security_incidents USING btree (ip_address);


--
-- Name: idx_security_incidents_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_resolved ON public.security_incidents USING btree (resolved);


--
-- Name: idx_security_incidents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_type ON public.security_incidents USING btree (type);


--
-- Name: idx_security_incidents_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_user ON public.security_incidents USING btree (user_id);


--
-- Name: idx_series_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_name ON public.series USING btree (series_name);


--
-- Name: idx_series_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_user ON public.series USING btree (user_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_slush_pile_decisions_decided_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slush_pile_decisions_decided_by ON public.slush_pile_decisions USING btree (decided_by);


--
-- Name: idx_slush_pile_decisions_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slush_pile_decisions_submission ON public.slush_pile_decisions USING btree (submission_id);


--
-- Name: idx_slush_pile_decisions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slush_pile_decisions_type ON public.slush_pile_decisions USING btree (decision_type);


--
-- Name: idx_social_posts_kit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_kit ON public.social_media_posts USING btree (kit_id);


--
-- Name: idx_social_posts_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_order ON public.social_media_posts USING btree (post_order);


--
-- Name: idx_social_posts_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_platform ON public.social_media_posts USING btree (platform);


--
-- Name: idx_social_posts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_type ON public.social_media_posts USING btree (post_type);


--
-- Name: idx_submission_feedback_addressed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_feedback_addressed ON public.submission_feedback USING btree (addressed);


--
-- Name: idx_submission_feedback_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_feedback_submission ON public.submission_feedback USING btree (submission_id);


--
-- Name: idx_submission_feedback_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_feedback_type ON public.submission_feedback USING btree (feedback_type);


--
-- Name: idx_submission_messages_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_parent ON public.submission_messages USING btree (parent_message_id);


--
-- Name: idx_submission_messages_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_read ON public.submission_messages USING btree (is_read);


--
-- Name: idx_submission_messages_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_recipient ON public.submission_messages USING btree (recipient_user_id);


--
-- Name: idx_submission_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_sender ON public.submission_messages USING btree (sender_user_id);


--
-- Name: idx_submission_messages_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_sent ON public.submission_messages USING btree (sent_at DESC);


--
-- Name: idx_submission_messages_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_messages_submission ON public.submission_messages USING btree (submission_id);


--
-- Name: idx_submission_packages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_packages_created ON public.submission_packages USING btree (created_at DESC);


--
-- Name: idx_submission_packages_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_packages_manuscript ON public.submission_packages USING btree (manuscript_id);


--
-- Name: idx_submission_packages_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_packages_type ON public.submission_packages USING btree (package_type);


--
-- Name: idx_submission_packages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_packages_user ON public.submission_packages USING btree (user_id);


--
-- Name: idx_submissions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_date ON public.submissions USING btree (submission_date DESC);


--
-- Name: idx_submissions_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_manuscript ON public.submissions USING btree (manuscript_id);


--
-- Name: idx_submissions_original; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_original ON public.submissions USING btree (original_submission_id);


--
-- Name: idx_submissions_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_package ON public.submissions USING btree (package_id);


--
-- Name: idx_submissions_response_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_response_type ON public.submissions USING btree (response_type);


--
-- Name: idx_submissions_resubmission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_resubmission ON public.submissions USING btree (is_resubmission);


--
-- Name: idx_submissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_user ON public.submissions USING btree (user_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_supporting_docs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporting_docs_created ON public.supporting_documents USING btree (created_at);


--
-- Name: idx_supporting_docs_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporting_docs_current ON public.supporting_documents USING btree (is_current_version);


--
-- Name: idx_supporting_docs_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporting_docs_manuscript ON public.supporting_documents USING btree (manuscript_id);


--
-- Name: idx_supporting_docs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporting_docs_type ON public.supporting_documents USING btree (document_type);


--
-- Name: idx_supporting_docs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporting_docs_user ON public.supporting_documents USING btree (user_id);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);


--
-- Name: idx_usage_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_timestamp ON public.usage_logs USING btree ("timestamp");


--
-- Name: idx_usage_tracking_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_tracking_period ON public.usage_tracking USING btree (billing_period_start, billing_period_end);


--
-- Name: idx_usage_tracking_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_tracking_user ON public.usage_tracking USING btree (user_id);


--
-- Name: idx_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_user_id ON public.usage_logs USING btree (user_id);


--
-- Name: idx_user_workflows_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_workflows_activity ON public.user_workflows USING btree (last_activity_at DESC);


--
-- Name: idx_user_workflows_manuscript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_workflows_manuscript ON public.user_workflows USING btree (manuscript_id);


--
-- Name: idx_user_workflows_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_workflows_platform ON public.user_workflows USING btree (platform);


--
-- Name: idx_user_workflows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_workflows_status ON public.user_workflows USING btree (status);


--
-- Name: idx_user_workflows_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_workflows_user ON public.user_workflows USING btree (user_id);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_window_alerts_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_window_alerts_publisher ON public.window_alerts USING btree (publisher_id);


--
-- Name: idx_window_alerts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_window_alerts_user ON public.window_alerts USING btree (user_id);


--
-- Name: idx_windows_closes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_windows_closes ON public.publisher_submission_windows USING btree (closes_at DESC);


--
-- Name: idx_windows_is_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_windows_is_open ON public.publisher_submission_windows USING btree (is_open);


--
-- Name: idx_windows_opens; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_windows_opens ON public.publisher_submission_windows USING btree (opens_at);


--
-- Name: idx_windows_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_windows_publisher ON public.publisher_submission_windows USING btree (publisher_id);


--
-- Name: idx_windows_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_windows_type ON public.publisher_submission_windows USING btree (window_type);


--
-- Name: idx_workflow_notifications_ack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_notifications_ack ON public.workflow_change_notifications USING btree (user_acknowledged);


--
-- Name: idx_workflow_notifications_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_notifications_platform ON public.workflow_change_notifications USING btree (platform);


--
-- Name: idx_workflow_notifications_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_notifications_sent ON public.workflow_change_notifications USING btree (notification_sent);


--
-- Name: idx_workflow_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_notifications_user ON public.workflow_change_notifications USING btree (user_id);


--
-- Name: idx_workflows_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_active ON public.workflows USING btree (is_active);


--
-- Name: idx_workflows_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_platform ON public.workflows USING btree (platform);


--
-- Name: idx_workflows_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_version ON public.workflows USING btree (version DESC);


--
-- Name: communication_stats _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.communication_stats AS
 SELECT u.id AS user_id,
    u.email,
    count(DISTINCT
        CASE
            WHEN (sm.sender_user_id = u.id) THEN sm.id
            ELSE NULL::text
        END) AS messages_sent,
    count(DISTINCT
        CASE
            WHEN (sm.recipient_user_id = u.id) THEN sm.id
            ELSE NULL::text
        END) AS messages_received,
    count(DISTINCT
        CASE
            WHEN ((sm.recipient_user_id = u.id) AND (sm.is_read = 0)) THEN sm.id
            ELSE NULL::text
        END) AS unread_messages,
    count(DISTINCT
        CASE
            WHEN (rr.requested_by_user_id = u.id) THEN rr.id
            ELSE NULL::text
        END) AS revision_requests_sent,
    count(DISTINCT mt.id) AS templates_created,
    max(sm.sent_at) AS last_message_at
   FROM (((public.users u
     LEFT JOIN public.submission_messages sm ON (((u.id = sm.sender_user_id) OR (u.id = sm.recipient_user_id))))
     LEFT JOIN public.revision_requests rr ON ((u.id = rr.requested_by_user_id)))
     LEFT JOIN public.message_templates mt ON ((u.id = mt.publisher_id)))
  GROUP BY u.id;


--
-- Name: agent_config agent_config_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_config_updated BEFORE UPDATE ON public.agent_config FOR EACH ROW EXECUTE FUNCTION public.update_agent_config_timestamp();


--
-- Name: agent_knowledge agent_knowledge_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_knowledge_updated BEFORE UPDATE ON public.agent_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_agent_knowledge_timestamp();


--
-- Name: author_platform author_platform_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER author_platform_updated BEFORE UPDATE ON public.author_platform FOR EACH ROW EXECUTE FUNCTION public.update_author_platform_timestamp();


--
-- Name: bookstore_positioning bookstore_positioning_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookstore_positioning_updated BEFORE UPDATE ON public.bookstore_positioning FOR EACH ROW EXECUTE FUNCTION public.update_bookstore_positioning_timestamp();


--
-- Name: comp_titles comp_titles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comp_titles_updated BEFORE UPDATE ON public.comp_titles FOR EACH ROW EXECUTE FUNCTION public.update_comp_titles_timestamp();


--
-- Name: kdp_metadata kdp_metadata_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kdp_metadata_updated BEFORE UPDATE ON public.kdp_metadata FOR EACH ROW EXECUTE FUNCTION public.update_kdp_metadata_timestamp();


--
-- Name: kdp_packages kdp_packages_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kdp_packages_updated BEFORE UPDATE ON public.kdp_packages FOR EACH ROW EXECUTE FUNCTION public.update_kdp_packages_timestamp();


--
-- Name: kdp_publishing_status kdp_publishing_status_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kdp_publishing_status_updated BEFORE UPDATE ON public.kdp_publishing_status FOR EACH ROW EXECUTE FUNCTION public.update_kdp_publishing_status_timestamp();


--
-- Name: manuscript_rights manuscript_rights_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER manuscript_rights_updated BEFORE UPDATE ON public.manuscript_rights FOR EACH ROW EXECUTE FUNCTION public.update_manuscript_rights_timestamp();


--
-- Name: market_positioning_reports market_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER market_reports_updated BEFORE UPDATE ON public.market_positioning_reports FOR EACH ROW EXECUTE FUNCTION public.update_market_positioning_reports_timestamp();


--
-- Name: marketing_hooks marketing_hooks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketing_hooks_updated BEFORE UPDATE ON public.marketing_hooks FOR EACH ROW EXECUTE FUNCTION public.update_marketing_hooks_timestamp();


--
-- Name: platform_docs platform_docs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER platform_docs_updated BEFORE UPDATE ON public.platform_docs FOR EACH ROW EXECUTE FUNCTION public.update_platform_docs_timestamp();


--
-- Name: author_platform_scores platform_scores_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER platform_scores_updated BEFORE UPDATE ON public.author_platform_scores FOR EACH ROW EXECUTE FUNCTION public.update_author_platform_scores_timestamp();


--
-- Name: publication_history publication_history_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER publication_history_updated BEFORE UPDATE ON public.publication_history FOR EACH ROW EXECUTE FUNCTION public.update_publication_history_timestamp();


--
-- Name: rights_offers rights_offers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rights_offers_updated BEFORE UPDATE ON public.rights_offers FOR EACH ROW EXECUTE FUNCTION public.update_rights_offers_timestamp();


--
-- Name: rights_templates rights_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rights_templates_updated BEFORE UPDATE ON public.rights_templates FOR EACH ROW EXECUTE FUNCTION public.update_rights_templates_timestamp();


--
-- Name: author_bios update_author_bios_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_author_bios_timestamp BEFORE UPDATE ON public.author_bios FOR EACH ROW EXECUTE FUNCTION public.update_author_bios_timestamp();


--
-- Name: cover_design_briefs update_cover_briefs_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cover_briefs_timestamp BEFORE UPDATE ON public.cover_design_briefs FOR EACH ROW EXECUTE FUNCTION public.update_cover_design_briefs_timestamp();


--
-- Name: formatted_manuscripts update_formatted_manuscripts_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_formatted_manuscripts_timestamp BEFORE UPDATE ON public.formatted_manuscripts FOR EACH ROW EXECUTE FUNCTION public.update_formatted_manuscripts_timestamp();


--
-- Name: formatting_jobs update_formatting_jobs_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_formatting_jobs_timestamp BEFORE UPDATE ON public.formatting_jobs FOR EACH ROW EXECUTE FUNCTION public.update_formatting_jobs_timestamp();


--
-- Name: formatting_templates update_formatting_templates_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_formatting_templates_timestamp BEFORE UPDATE ON public.formatting_templates FOR EACH ROW EXECUTE FUNCTION public.update_formatting_templates_timestamp();


--
-- Name: genres update_genres_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_genres_timestamp BEFORE UPDATE ON public.genres FOR EACH ROW EXECUTE FUNCTION public.update_genres_timestamp();


--
-- Name: human_style_edits update_human_edits_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_human_edits_timestamp BEFORE UPDATE ON public.human_style_edits FOR EACH ROW EXECUTE FUNCTION public.update_human_style_edits_timestamp();


--
-- Name: marketing_kits update_marketing_kits_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_marketing_kits_timestamp BEFORE UPDATE ON public.marketing_kits FOR EACH ROW EXECUTE FUNCTION public.update_marketing_kits_timestamp();


--
-- Name: marketing_materials update_marketing_materials_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_marketing_materials_timestamp BEFORE UPDATE ON public.marketing_materials FOR EACH ROW EXECUTE FUNCTION public.update_marketing_materials_timestamp();


--
-- Name: message_templates update_message_templates_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_message_templates_timestamp BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_message_templates_timestamp();


--
-- Name: notification_preferences update_notification_preferences_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_timestamp BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_notification_preferences_timestamp();


--
-- Name: publishers update_publishers_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_publishers_timestamp BEFORE UPDATE ON public.publishers FOR EACH ROW EXECUTE FUNCTION public.update_publishers_timestamp();


--
-- Name: revision_requests update_revision_requests_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_revision_requests_timestamp BEFORE UPDATE ON public.revision_requests FOR EACH ROW EXECUTE FUNCTION public.update_revision_requests_timestamp();


--
-- Name: submission_assignments update_submission_assignments_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_assignments_timestamp BEFORE UPDATE ON public.submission_assignments FOR EACH ROW EXECUTE FUNCTION public.update_submission_assignments_timestamp();


--
-- Name: submission_deadlines update_submission_deadlines_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_deadlines_timestamp BEFORE UPDATE ON public.submission_deadlines FOR EACH ROW EXECUTE FUNCTION public.update_submission_deadlines_timestamp();


--
-- Name: submission_discussions update_submission_discussions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_discussions_timestamp BEFORE UPDATE ON public.submission_discussions FOR EACH ROW EXECUTE FUNCTION public.update_submission_discussions_timestamp();


--
-- Name: submission_feedback update_submission_feedback_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_feedback_timestamp BEFORE UPDATE ON public.submission_feedback FOR EACH ROW EXECUTE FUNCTION public.update_submission_feedback_timestamp();


--
-- Name: submission_packages update_submission_packages_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_packages_timestamp BEFORE UPDATE ON public.submission_packages FOR EACH ROW EXECUTE FUNCTION public.update_submission_packages_timestamp();


--
-- Name: submission_ratings update_submission_ratings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_ratings_timestamp BEFORE UPDATE ON public.submission_ratings FOR EACH ROW EXECUTE FUNCTION public.update_submission_ratings_timestamp();


--
-- Name: publisher_submission_windows update_submission_windows_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submission_windows_timestamp BEFORE UPDATE ON public.publisher_submission_windows FOR EACH ROW EXECUTE FUNCTION public.update_publisher_submission_windows_timestamp();


--
-- Name: submissions update_submissions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submissions_timestamp BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_submissions_timestamp();


--
-- Name: supporting_documents update_supporting_docs_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_supporting_docs_timestamp BEFORE UPDATE ON public.supporting_documents FOR EACH ROW EXECUTE FUNCTION public.update_supporting_documents_timestamp();


--
-- Name: window_alerts update_window_alerts_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_window_alerts_timestamp BEFORE UPDATE ON public.window_alerts FOR EACH ROW EXECUTE FUNCTION public.update_window_alerts_timestamp();


--
-- Name: user_workflows user_workflows_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_workflows_updated BEFORE UPDATE ON public.user_workflows FOR EACH ROW EXECUTE FUNCTION public.update_user_workflows_timestamp();


--
-- Name: workflows workflows_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflows_updated BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_workflows_timestamp();


--
-- Name: agent_conversations agent_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_conversations agent_conversations_user_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_user_workflow_id_fkey FOREIGN KEY (user_workflow_id) REFERENCES public.user_workflows(id) ON DELETE SET NULL;


--
-- Name: agent_knowledge agent_knowledge_source_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_knowledge
    ADD CONSTRAINT agent_knowledge_source_doc_id_fkey FOREIGN KEY (source_doc_id) REFERENCES public.platform_docs(id) ON DELETE SET NULL;


--
-- Name: agent_knowledge agent_knowledge_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_knowledge
    ADD CONSTRAINT agent_knowledge_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.agent_knowledge(id) ON DELETE SET NULL;


--
-- Name: amazon_search_queries amazon_search_queries_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amazon_search_queries
    ADD CONSTRAINT amazon_search_queries_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE SET NULL;


--
-- Name: amazon_search_queries amazon_search_queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amazon_search_queries
    ADD CONSTRAINT amazon_search_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: analyses analyses_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: analysis_comp_titles analysis_comp_titles_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_comp_titles
    ADD CONSTRAINT analysis_comp_titles_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.market_analysis_reports(id) ON DELETE CASCADE;


--
-- Name: author_bios author_bios_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_bios
    ADD CONSTRAINT author_bios_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: author_bios author_bios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_bios
    ADD CONSTRAINT author_bios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: author_platform_scores author_platform_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_platform_scores
    ADD CONSTRAINT author_platform_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: author_platform author_platform_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_platform
    ADD CONSTRAINT author_platform_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bestseller_ranks bestseller_ranks_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bestseller_ranks
    ADD CONSTRAINT bestseller_ranks_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: bookstore_positioning bookstore_positioning_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookstore_positioning
    ADD CONSTRAINT bookstore_positioning_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: bookstore_positioning bookstore_positioning_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookstore_positioning
    ADD CONSTRAINT bookstore_positioning_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comp_titles comp_titles_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_titles
    ADD CONSTRAINT comp_titles_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: comp_titles comp_titles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_titles
    ADD CONSTRAINT comp_titles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: content_calendar content_calendar_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_calendar
    ADD CONSTRAINT content_calendar_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.marketing_kits(id) ON DELETE CASCADE;


--
-- Name: content_calendar content_calendar_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_calendar
    ADD CONSTRAINT content_calendar_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_media_posts(id) ON DELETE SET NULL;


--
-- Name: cost_tracking cost_tracking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_tracking
    ADD CONSTRAINT cost_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cover_design_briefs cover_design_briefs_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_design_briefs
    ADD CONSTRAINT cover_design_briefs_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: cover_design_briefs cover_design_briefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_design_briefs
    ADD CONSTRAINT cover_design_briefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: file_scan_results file_scan_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_scan_results
    ADD CONSTRAINT file_scan_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: formatted_manuscripts formatted_manuscripts_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatted_manuscripts
    ADD CONSTRAINT formatted_manuscripts_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: formatted_manuscripts formatted_manuscripts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatted_manuscripts
    ADD CONSTRAINT formatted_manuscripts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: formatting_jobs formatting_jobs_formatted_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatting_jobs
    ADD CONSTRAINT formatting_jobs_formatted_manuscript_id_fkey FOREIGN KEY (formatted_manuscript_id) REFERENCES public.formatted_manuscripts(id) ON DELETE CASCADE;


--
-- Name: formatting_templates formatting_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatting_templates
    ADD CONSTRAINT formatting_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: genres genres_parent_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_parent_genre_id_fkey FOREIGN KEY (parent_genre_id) REFERENCES public.genres(id) ON DELETE SET NULL;


--
-- Name: hashtag_strategy hashtag_strategy_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hashtag_strategy
    ADD CONSTRAINT hashtag_strategy_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.marketing_kits(id) ON DELETE CASCADE;


--
-- Name: human_edit_sessions human_edit_sessions_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_edit_sessions
    ADD CONSTRAINT human_edit_sessions_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: human_edit_sessions human_edit_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_edit_sessions
    ADD CONSTRAINT human_edit_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: human_style_edits human_style_edits_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_style_edits
    ADD CONSTRAINT human_style_edits_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: human_style_edits human_style_edits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_style_edits
    ADD CONSTRAINT human_style_edits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kdp_metadata kdp_metadata_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_metadata
    ADD CONSTRAINT kdp_metadata_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: kdp_metadata kdp_metadata_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_metadata
    ADD CONSTRAINT kdp_metadata_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.kdp_packages(id) ON DELETE CASCADE;


--
-- Name: kdp_packages kdp_packages_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_packages
    ADD CONSTRAINT kdp_packages_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: kdp_packages kdp_packages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_packages
    ADD CONSTRAINT kdp_packages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kdp_publishing_status kdp_publishing_status_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_publishing_status
    ADD CONSTRAINT kdp_publishing_status_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.kdp_packages(id) ON DELETE CASCADE;


--
-- Name: kdp_publishing_status kdp_publishing_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_publishing_status
    ADD CONSTRAINT kdp_publishing_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kdp_royalty_calculations kdp_royalty_calculations_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_royalty_calculations
    ADD CONSTRAINT kdp_royalty_calculations_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.kdp_packages(id) ON DELETE CASCADE;


--
-- Name: kdp_validation_results kdp_validation_results_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kdp_validation_results
    ADD CONSTRAINT kdp_validation_results_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.kdp_packages(id) ON DELETE CASCADE;


--
-- Name: manuscript_metadata_history manuscript_metadata_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_metadata_history
    ADD CONSTRAINT manuscript_metadata_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: manuscript_metadata_history manuscript_metadata_history_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_metadata_history
    ADD CONSTRAINT manuscript_metadata_history_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: manuscript_publishing_progress manuscript_publishing_progress_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_publishing_progress
    ADD CONSTRAINT manuscript_publishing_progress_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: manuscript_rights manuscript_rights_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_rights
    ADD CONSTRAINT manuscript_rights_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: manuscript_rights manuscript_rights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_rights
    ADD CONSTRAINT manuscript_rights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manuscripts manuscripts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscripts
    ADD CONSTRAINT manuscripts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: market_analysis_reports market_analysis_reports_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_analysis_reports
    ADD CONSTRAINT market_analysis_reports_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: market_analysis_reports market_analysis_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_analysis_reports
    ADD CONSTRAINT market_analysis_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: market_positioning_reports market_positioning_reports_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_positioning_reports
    ADD CONSTRAINT market_positioning_reports_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: market_positioning_reports market_positioning_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_positioning_reports
    ADD CONSTRAINT market_positioning_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: marketing_hooks marketing_hooks_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_hooks
    ADD CONSTRAINT marketing_hooks_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: marketing_hooks marketing_hooks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_hooks
    ADD CONSTRAINT marketing_hooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: marketing_kits marketing_kits_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_kits
    ADD CONSTRAINT marketing_kits_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: marketing_kits marketing_kits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_kits
    ADD CONSTRAINT marketing_kits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: marketing_materials marketing_materials_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_materials
    ADD CONSTRAINT marketing_materials_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.marketing_kits(id) ON DELETE CASCADE;


--
-- Name: message_templates message_templates_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.submission_messages(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_revision_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_revision_request_id_fkey FOREIGN KEY (revision_request_id) REFERENCES public.revision_requests(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: package_document_map package_document_map_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_document_map
    ADD CONSTRAINT package_document_map_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.submission_packages(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_history payment_history_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: payment_history payment_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: platform_connections platform_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: platform_docs platform_docs_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_docs
    ADD CONSTRAINT platform_docs_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.platform_docs(id) ON DELETE SET NULL;


--
-- Name: progress_checklist_items progress_checklist_items_progress_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_checklist_items
    ADD CONSTRAINT progress_checklist_items_progress_id_fkey FOREIGN KEY (progress_id) REFERENCES public.manuscript_publishing_progress(id) ON DELETE CASCADE;


--
-- Name: publication_history publication_history_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publication_history
    ADD CONSTRAINT publication_history_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: publication_history publication_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publication_history
    ADD CONSTRAINT publication_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: publisher_submission_windows publisher_submission_windows_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_submission_windows
    ADD CONSTRAINT publisher_submission_windows_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: revision_requests revision_requests_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: revision_requests revision_requests_resubmission_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_resubmission_manuscript_id_fkey FOREIGN KEY (resubmission_manuscript_id) REFERENCES public.manuscripts(id) ON DELETE SET NULL;


--
-- Name: revision_requests revision_requests_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_requests
    ADD CONSTRAINT revision_requests_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: rights_conflicts rights_conflicts_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_conflicts
    ADD CONSTRAINT rights_conflicts_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: rights_conflicts rights_conflicts_rights_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_conflicts
    ADD CONSTRAINT rights_conflicts_rights_id_1_fkey FOREIGN KEY (rights_id_1) REFERENCES public.manuscript_rights(id) ON DELETE CASCADE;


--
-- Name: rights_conflicts rights_conflicts_rights_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_conflicts
    ADD CONSTRAINT rights_conflicts_rights_id_2_fkey FOREIGN KEY (rights_id_2) REFERENCES public.manuscript_rights(id) ON DELETE CASCADE;


--
-- Name: rights_offers rights_offers_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_offers
    ADD CONSTRAINT rights_offers_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: rights_offers rights_offers_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_offers
    ADD CONSTRAINT rights_offers_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE SET NULL;


--
-- Name: rights_offers rights_offers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_offers
    ADD CONSTRAINT rights_offers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rights_templates rights_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights_templates
    ADD CONSTRAINT rights_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: royalty_payments royalty_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.royalty_payments
    ADD CONSTRAINT royalty_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_aggregations sales_aggregations_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_aggregations
    ADD CONSTRAINT sales_aggregations_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: sales_aggregations sales_aggregations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_aggregations
    ADD CONSTRAINT sales_aggregations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_data sales_data_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: sales_data sales_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_goals sales_goals_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_goals
    ADD CONSTRAINT sales_goals_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: sales_goals sales_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_goals
    ADD CONSTRAINT sales_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_incidents security_incidents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: social_media_posts social_media_posts_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media_posts
    ADD CONSTRAINT social_media_posts_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.marketing_kits(id) ON DELETE CASCADE;


--
-- Name: submission_assignments submission_assignments_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_assignments
    ADD CONSTRAINT submission_assignments_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_assignments submission_assignments_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_assignments
    ADD CONSTRAINT submission_assignments_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_assignments submission_assignments_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_assignments
    ADD CONSTRAINT submission_assignments_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submission_deadlines submission_deadlines_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_deadlines
    ADD CONSTRAINT submission_deadlines_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submission_discussions submission_discussions_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_discussions
    ADD CONSTRAINT submission_discussions_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.submission_discussions(id) ON DELETE CASCADE;


--
-- Name: submission_discussions submission_discussions_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_discussions
    ADD CONSTRAINT submission_discussions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submission_discussions submission_discussions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_discussions
    ADD CONSTRAINT submission_discussions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_feedback submission_feedback_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_feedback
    ADD CONSTRAINT submission_feedback_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: submission_messages submission_messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_messages
    ADD CONSTRAINT submission_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.submission_messages(id) ON DELETE CASCADE;


--
-- Name: submission_messages submission_messages_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_messages
    ADD CONSTRAINT submission_messages_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_messages submission_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_messages
    ADD CONSTRAINT submission_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_messages submission_messages_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_messages
    ADD CONSTRAINT submission_messages_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submission_packages submission_packages_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_packages
    ADD CONSTRAINT submission_packages_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submission_packages submission_packages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_packages
    ADD CONSTRAINT submission_packages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_ratings submission_ratings_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_ratings
    ADD CONSTRAINT submission_ratings_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.submission_assignments(id) ON DELETE SET NULL;


--
-- Name: submission_ratings submission_ratings_rater_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_ratings
    ADD CONSTRAINT submission_ratings_rater_user_id_fkey FOREIGN KEY (rater_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_ratings submission_ratings_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_ratings
    ADD CONSTRAINT submission_ratings_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.submission_packages(id) ON DELETE SET NULL;


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: supporting_documents supporting_documents_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporting_documents
    ADD CONSTRAINT supporting_documents_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE CASCADE;


--
-- Name: supporting_documents supporting_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporting_documents
    ADD CONSTRAINT supporting_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: usage_logs usage_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_logs
    ADD CONSTRAINT usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: usage_tracking usage_tracking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_workflows user_workflows_manuscript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_workflows
    ADD CONSTRAINT user_workflows_manuscript_id_fkey FOREIGN KEY (manuscript_id) REFERENCES public.manuscripts(id) ON DELETE SET NULL;


--
-- Name: user_workflows user_workflows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_workflows
    ADD CONSTRAINT user_workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_workflows user_workflows_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_workflows
    ADD CONSTRAINT user_workflows_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: window_alerts window_alerts_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.window_alerts
    ADD CONSTRAINT window_alerts_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: window_alerts window_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.window_alerts
    ADD CONSTRAINT window_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_change_notifications workflow_change_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_change_notifications
    ADD CONSTRAINT workflow_change_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_change_notifications workflow_change_notifications_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_change_notifications
    ADD CONSTRAINT workflow_change_notifications_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.workflows(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict MLjTPCy0IwzdpqGd6auWmDLYLh2lXzGbM4Bsth6mWy2QyELDjMspthtnEHCkixT

