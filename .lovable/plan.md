# Clinic System — Full Overhaul Plan

This is a very large scope (9 areas, 6 schema changes, 7+ page rewrites, new admin pages, print layouts, appointment scheduler, notification badges). Doing it all in a single pass risks regressions and is hard to review. I'd like to ship it in **4 reviewable phases**, each independently usable. Please confirm or reorder.

## Phase 1 — Database schema (foundation)
One migration adding every missing column so later phases just use them:
- `patients`: emergency_contact_name/phone/relationship, blood_type, chronic_conditions, current_medications, secondary_phone, insurance_provider, insurance_policy_number, notes
- `opd_records`: past_medical_history, family_history, social_history, review_of_systems, secondary_diagnosis, follow_up_date, referral_notes, vital_signs jsonb
- `prescriptions`: quantity int, route text
- `lab_results`: unit, status, results_ready bool
- `treatment_records`: route, medication_used, dose, dose_unit, start_time, end_time, patient_response, complications
- `payments`: discount_amount numeric default 0, discount_reason text
- New `appointments` table (patient_id, doctor, scheduled_at, notes, status) with RLS + grants
- `clinic_settings`: ensure `logo` key supported (already KV — no schema change)

## Phase 2 — Reception + OPD (clinical core)
- Register Patient: full intake form with all new fields; for existing patients show editable profile + last-5-visits panel
- OPD Visit: patient info banner; expanded Notes tab (history sections, vital signs w/ BMI auto-calc, follow-up, referral, secondary dx); new Patient History tab; clinical indication on orders; prescription quantity + route + clean preview
- Reception dashboard: cash vs transfer breakdown, Pending Payments table

## Phase 3 — Lab, Treatment, Pharmacy (service rooms)
- Shared `PatientBanner` component used on all three
- Lab: per-test cards w/ unit + reference + status, add-extra-test, print-ready report layout, set `results_ready=true` to flag OPD
- Treatment: full record fields (route, med/dose, start/end, response, complications)
- Pharmacy: full prescription dispense w/ qty dispensed, batch, expiry, out-of-stock + alert badge, print slip
- OPD queue shows "Lab results ready" badge

## Phase 4 — Admin, Reports, Appointments, polish
- Admin Users: edit modal (name/email/password/role), colored role badges
- Clinic Settings: logo upload (stored in settings KV, shown in navbar)
- Payment Management page: filters (date/method/bank/type), cash-vs-transfer card, per-patient history, discount apply (% or fixed) w/ reason
- Reports: weekly + monthly tabs, cash/transfer charts, CSV export
- Appointments page: scheduler (date, patient search, time, doctor, notes, status)
- Sidebar notification badges (pending payments for reception, pending lab-ready for OPD)
- Print layouts: Lab report + Visit summary

## Technical notes
- All new columns nullable / defaulted so existing rows stay valid
- All forms validated with zod, saved to Supabase, optimistic UI where it already exists
- Print views use a dedicated `@media print` stylesheet + isolated route components
- Logo stored as data URL in `clinic_settings` (no storage bucket needed)
- Appointments table gets `GRANT` + RLS per the public-schema rules

## What I need from you
1. **Approve the 4-phase split** (or tell me to do it all at once — will be one very long turn and harder to review).
2. **Logo storage**: data URL in settings table OK, or do you want a real Storage bucket?
3. **Appointment doctors**: free-text field, or pulled from `profiles` where role = `opd`?
4. **Discounts**: apply before payment is collected only, or also retroactively?

Once you confirm, I'll start Phase 1 (migration) immediately.