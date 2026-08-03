


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_access"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 1. Check super admin
  if exists (select 1 from rk_superadmins where email = p_email) then
    return true;
  end if;
  
  -- 2. Check team member
  return exists (select 1 from rk_team where email = p_email);
end;
$$;


ALTER FUNCTION "public"."check_access"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_project_access"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.has_project_access(p_id, current_setting('app.user_email', true));
$$;


ALTER FUNCTION "public"."check_project_access"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_projects"("p_email" "text") RETURNS TABLE("id" "uuid", "name" "text", "go_live_date" "date", "updated_at" timestamp with time zone, "is_archived" boolean, "progress" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_super boolean;
begin
  -- Check if super admin
  select exists(select 1 from rk_superadmins where lower(email) = lower(p_email)) into v_is_super;
  
  if v_is_super then
    return query 
    select 
      p.id, 
      p.name, 
      p.go_live_date, 
      p.updated_at, 
      p.is_archived,
      coalesce((select round(avg(percent_complete)) from rk_tasks where project_id = p.id), 0)::numeric as progress
    from rk_project p 
    order by p.updated_at desc;
  else
    return query
    select 
      p.id, 
      p.name, 
      p.go_live_date, 
      p.updated_at, 
      p.is_archived,
      coalesce((select round(avg(percent_complete)) from rk_tasks where project_id = p.id), 0)::numeric as progress
    from rk_project p
    where (
      p.id in (select project_id from rk_team where lower(email) = lower(p_email))
      or exists (
        select 1 from rk_org_members m 
        where lower(m.email) = lower(p_email) 
        and (m.org_role in ('Admin', 'PM') or m.role in ('Admin', 'PM'))
        and (p.org_id = m.org_id or p.org_id is null)
      )
    )
    and p.is_archived = false
    order by p.updated_at desc;
  end if;
end;
$$;


ALTER FUNCTION "public"."get_user_projects"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_project_access"("p_id" "uuid", "user_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- If email is missing, no access
  if user_email is null or user_email = '' then
    return false;
  end if;

  -- 1. Check if user is a super admin
  if exists (
    select 1 from rk_superadmins 
    where email = user_email
  ) then
    return true;
  end if;
  
  -- 2. Regular check against team members
  return exists (
    select 1 from rk_team 
    where project_id = p_id 
    and email = user_email
  );
end;
$$;


ALTER FUNCTION "public"."has_project_access"("p_id" "uuid", "user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"("user_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return exists (
    select 1 from public.rk_superadmins 
    where email = user_email
  );
end;
$$;


ALTER FUNCTION "public"."is_superadmin"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_context"("p_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.user_email', p_email, false);
end;
$$;


ALTER FUNCTION "public"."set_user_context"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subtask_secure"("p_id" "uuid", "p_title" "text", "p_assignee" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update rk_subtasks
  set
    title    = p_title,
    assignee = p_assignee
  where id = p_id;
end;
$$;


ALTER FUNCTION "public"."update_subtask_secure"("p_id" "uuid", "p_title" "text", "p_assignee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_activity" "text" DEFAULT NULL::"text", "p_owner" "text" DEFAULT NULL::"text", "p_plan_start" "date" DEFAULT NULL::"date", "p_plan_duration" integer DEFAULT NULL::integer, "p_actual_start" "date" DEFAULT NULL::"date", "p_actual_duration" integer DEFAULT NULL::integer, "p_percent_complete" integer DEFAULT NULL::integer, "p_section_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update rk_tasks set
    activity         = coalesce(p_activity, activity),
    owner            = coalesce(p_owner, owner),
    plan_start       = coalesce(p_plan_start, plan_start),
    plan_duration    = coalesce(p_plan_duration, plan_duration),
    actual_start     = coalesce(p_actual_start, actual_start),
    actual_duration  = coalesce(p_actual_duration, actual_duration),
    percent_complete = coalesce(p_percent_complete, percent_complete),
    section_id       = coalesce(p_section_id, section_id)
  where id = p_id;
end;
$$;


ALTER FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_activity" "text", "p_owner" "text", "p_plan_start" "date", "p_plan_duration" integer, "p_actual_start" "date", "p_actual_duration" integer, "p_percent_complete" integer, "p_section_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."rk_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."rk_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_project" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'New Project'::"text" NOT NULL,
    "go_live_date" "date" DEFAULT (CURRENT_DATE + '28 days'::interval) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_archived" boolean DEFAULT false
);

ALTER TABLE ONLY "public"."rk_project" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rk_project" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#2E75B6'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."rk_sections" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rk_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_stakeholders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."rk_stakeholders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rk_stakeholders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assignee" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."rk_subtasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_superadmins" (
    "email" "text" NOT NULL
);


ALTER TABLE "public"."rk_superadmins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."rk_task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "activity" "text" DEFAULT 'New task'::"text" NOT NULL,
    "owner" "text" DEFAULT ''::"text" NOT NULL,
    "plan_start" "date" DEFAULT CURRENT_DATE NOT NULL,
    "plan_duration" integer DEFAULT 5 NOT NULL,
    "actual_start" "date",
    "actual_duration" integer DEFAULT 0 NOT NULL,
    "percent_complete" integer DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."rk_tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rk_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rk_team" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'Member'::"text"
);

ALTER TABLE ONLY "public"."rk_team" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rk_team" OWNER TO "postgres";


ALTER TABLE ONLY "public"."rk_documents"
    ADD CONSTRAINT "rk_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_project"
    ADD CONSTRAINT "rk_project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_sections"
    ADD CONSTRAINT "rk_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_stakeholders"
    ADD CONSTRAINT "rk_stakeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_subtasks"
    ADD CONSTRAINT "rk_subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_superadmins"
    ADD CONSTRAINT "rk_superadmins_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."rk_task_dependencies"
    ADD CONSTRAINT "rk_task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_task_dependencies"
    ADD CONSTRAINT "rk_task_dependencies_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."rk_tasks"
    ADD CONSTRAINT "rk_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_team"
    ADD CONSTRAINT "rk_team_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rk_team"
    ADD CONSTRAINT "rk_team_project_email_unique" UNIQUE ("project_id", "email");



CREATE INDEX "rk_sections_project_id_position_idx" ON "public"."rk_sections" USING "btree" ("project_id", "position");



CREATE INDEX "rk_tasks_project_id_position_idx" ON "public"."rk_tasks" USING "btree" ("project_id", "position");



CREATE INDEX "rk_tasks_section_id_idx" ON "public"."rk_tasks" USING "btree" ("section_id");



CREATE INDEX "rk_team_email_idx" ON "public"."rk_team" USING "btree" ("email");



CREATE INDEX "rk_team_project_id_idx" ON "public"."rk_team" USING "btree" ("project_id");



ALTER TABLE ONLY "public"."rk_documents"
    ADD CONSTRAINT "rk_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rk_project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_sections"
    ADD CONSTRAINT "rk_sections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rk_project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_stakeholders"
    ADD CONSTRAINT "rk_stakeholders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rk_project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_subtasks"
    ADD CONSTRAINT "rk_subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."rk_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_task_dependencies"
    ADD CONSTRAINT "rk_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."rk_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_task_dependencies"
    ADD CONSTRAINT "rk_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."rk_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_tasks"
    ADD CONSTRAINT "rk_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rk_project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_tasks"
    ADD CONSTRAINT "rk_tasks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."rk_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rk_team"
    ADD CONSTRAINT "rk_team_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."rk_project"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all for rk_subtasks" ON "public"."rk_subtasks" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access to documents for project members" ON "public"."rk_documents" TO "authenticated", "anon" USING ("public"."check_project_access"("project_id")) WITH CHECK ("public"."check_project_access"("project_id"));



CREATE POLICY "Public stakeholders are viewable by everyone" ON "public"."rk_stakeholders" FOR SELECT USING (true);



CREATE POLICY "Stakeholders are deletable by everyone" ON "public"."rk_stakeholders" FOR DELETE USING (true);



CREATE POLICY "Stakeholders are insertable by everyone" ON "public"."rk_stakeholders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Stakeholders are updatable by everyone" ON "public"."rk_stakeholders" FOR UPDATE USING (true);



CREATE POLICY "admin_read_own" ON "public"."rk_superadmins" FOR SELECT USING (true);



ALTER TABLE "public"."rk_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rk_project" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_project_isolation" ON "public"."rk_project" USING (true);



ALTER TABLE "public"."rk_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_sections_isolation" ON "public"."rk_sections" USING (true);



ALTER TABLE "public"."rk_stakeholders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_stakeholders_isolation" ON "public"."rk_stakeholders" USING (true);



ALTER TABLE "public"."rk_subtasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rk_superadmins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rk_task_dependencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_task_dependencies_all" ON "public"."rk_task_dependencies" USING (true) WITH CHECK (true);



CREATE POLICY "rk_task_dependencies_isolation" ON "public"."rk_task_dependencies" USING ((EXISTS ( SELECT 1
   FROM "public"."rk_tasks" "t"
  WHERE (("t"."id" = "rk_task_dependencies"."task_id") AND "public"."has_project_access"("t"."project_id", "current_setting"('app.user_email'::"text", true))))));



ALTER TABLE "public"."rk_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_tasks_isolation" ON "public"."rk_tasks" USING (true);



ALTER TABLE "public"."rk_team" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rk_team_isolation" ON "public"."rk_team" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_project";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_sections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_stakeholders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_subtasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rk_team";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."check_access"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_access"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_access"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_project_access"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_project_access"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_project_access"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_projects"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_projects"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_projects"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_project_access"("p_id" "uuid", "user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_project_access"("p_id" "uuid", "user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_project_access"("p_id" "uuid", "user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_context"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_context"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_context"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subtask_secure"("p_id" "uuid", "p_title" "text", "p_assignee" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_subtask_secure"("p_id" "uuid", "p_title" "text", "p_assignee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subtask_secure"("p_id" "uuid", "p_title" "text", "p_assignee" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_activity" "text", "p_owner" "text", "p_plan_start" "date", "p_plan_duration" integer, "p_actual_start" "date", "p_actual_duration" integer, "p_percent_complete" integer, "p_section_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_activity" "text", "p_owner" "text", "p_plan_start" "date", "p_plan_duration" integer, "p_actual_start" "date", "p_actual_duration" integer, "p_percent_complete" integer, "p_section_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_secure"("p_id" "uuid", "p_activity" "text", "p_owner" "text", "p_plan_start" "date", "p_plan_duration" integer, "p_actual_start" "date", "p_actual_duration" integer, "p_percent_complete" integer, "p_section_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."rk_documents" TO "anon";
GRANT ALL ON TABLE "public"."rk_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_documents" TO "service_role";



GRANT ALL ON TABLE "public"."rk_project" TO "anon";
GRANT ALL ON TABLE "public"."rk_project" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_project" TO "service_role";



GRANT ALL ON TABLE "public"."rk_sections" TO "anon";
GRANT ALL ON TABLE "public"."rk_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_sections" TO "service_role";



GRANT ALL ON TABLE "public"."rk_stakeholders" TO "anon";
GRANT ALL ON TABLE "public"."rk_stakeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_stakeholders" TO "service_role";



GRANT ALL ON TABLE "public"."rk_subtasks" TO "anon";
GRANT ALL ON TABLE "public"."rk_subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."rk_superadmins" TO "anon";
GRANT ALL ON TABLE "public"."rk_superadmins" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_superadmins" TO "service_role";



GRANT ALL ON TABLE "public"."rk_task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."rk_task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."rk_tasks" TO "anon";
GRANT ALL ON TABLE "public"."rk_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."rk_team" TO "anon";
GRANT ALL ON TABLE "public"."rk_team" TO "authenticated";
GRANT ALL ON TABLE "public"."rk_team" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































