-- Clinic system overhaul migration.
-- Run this in your Supabase SQL Editor (Database → SQL Editor → New query → paste → Run).
-- Safe to run multiple times.

-- patients
alter table public.patients add column if not exists secondary_phone text;
alter table public.patients add column if not exists blood_type text;
alter table public.patients add column if not exists chronic_conditions text;
alter table public.patients add column if not exists current_medications text;
alter table public.patients add column if not exists emergency_contact_name text;
alter table public.patients add column if not exists emergency_contact_phone text;
alter table public.patients add column if not exists emergency_contact_relationship text;
alter table public.patients add column if not exists insurance_provider text;
alter table public.patients add column if not exists insurance_policy_number text;
alter table public.patients add column if not exists notes text;

-- opd_records
alter table public.opd_records add column if not exists past_medical_history text;
alter table public.opd_records add column if not exists family_history text;
alter table public.opd_records add column if not exists social_history text;
alter table public.opd_records add column if not exists review_of_systems text;
alter table public.opd_records add column if not exists secondary_diagnosis text;
alter table public.opd_records add column if not exists follow_up_date date;
alter table public.opd_records add column if not exists referral_notes text;
alter table public.opd_records add column if not exists vital_signs jsonb;

-- prescriptions
alter table public.prescriptions add column if not exists quantity integer;
alter table public.prescriptions add column if not exists route text;
alter table public.prescriptions add column if not exists batch_number text;
alter table public.prescriptions add column if not exists expiry_date date;
alter table public.prescriptions add column if not exists out_of_stock boolean default false;

-- lab_results
alter table public.lab_results add column if not exists unit text;
alter table public.lab_results add column if not exists status text;
alter table public.lab_results add column if not exists results_ready boolean default false;

-- treatment_records
alter table public.treatment_records add column if not exists route text;
alter table public.treatment_records add column if not exists medication_used text;
alter table public.treatment_records add column if not exists dose text;
alter table public.treatment_records add column if not exists dose_unit text;
alter table public.treatment_records add column if not exists start_time timestamptz;
alter table public.treatment_records add column if not exists end_time timestamptz;
alter table public.treatment_records add column if not exists patient_response text;
alter table public.treatment_records add column if not exists complications text;

-- payments
alter table public.payments add column if not exists discount_amount numeric default 0;
alter table public.payments add column if not exists discount_reason text;

-- appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor text,
  scheduled_at timestamptz not null,
  notes text,
  status text not null default 'scheduled',
  created_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.appointments to authenticated, anon;
grant all on public.appointments to service_role;

alter table public.appointments enable row level security;
drop policy if exists "appointments_all" on public.appointments;
create policy "appointments_all" on public.appointments for all using (true) with check (true);

create index if not exists appointments_scheduled_at_idx on public.appointments(scheduled_at);
create index if not exists appointments_patient_idx on public.appointments(patient_id);

-- ===== Post-lab OPD review (added for Lab Result Review feature) =====
ALTER TABLE public.opd_records
  ADD COLUMN IF NOT EXISTS post_lab_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_lab_review_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS post_lab_review_notes TEXT;

-- New visit status value used by the OPD lab-review queue: 'lab_result_pending'
-- (no schema change needed if visits.status is TEXT; if it's an enum, run:
--   ALTER TYPE visit_status ADD VALUE IF NOT EXISTS 'lab_result_pending';
-- )
