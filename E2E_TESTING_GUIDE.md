# End-to-End Testing Guide
## Electrical Certification System

**Version**: 1.0
**Date**: 2026-02-21
**Status**: Ready for Manual Testing

---

## Prerequisites

### Backend Status
- ✅ Coordinator: Running at https://jobbuilda-production.up.railway.app
- ✅ Health Check: Passing
- ✅ Database: Migrations complete (28 BS 7671 standards loaded)
- ✅ All MCP Services: Registered and operational
- ✅ API Routes: All 11 test routes registered

### Frontend Status
- ✅ Admin Dashboard: Deployed on Vercel
- ✅ Components: All 13 components created
- ✅ Pages: Tests listing, test detail, test recording wizard
- ✅ Modals: Create test, generate certificate

---

## Known Issue: Route Ordering

**Problem**: The `/api/tests/standards` endpoint is being matched by `/api/tests/:id` route first, causing "standards" to be interpreted as a test ID.

**Impact**: The measurement standards API endpoint cannot be accessed via GET request. This affects the real-time validation feature in CircuitMeasurementForm.

**Workaround**: The validation will fail gracefully and allow measurements to be entered without real-time validation. Full validation still occurs on the backend when saving measurements.

**Fix Required**: Reorder routes in `apps/coordinator/src/routes/tests.ts` - move line 216-232 (GET /api/tests/standards) to before line 18 (GET /api/tests/:id).

---

## Test Scenario 1: Create Job with Electrical Work

### Objective
Verify job creation with electrical work type and circuit details.

### Steps

1. **Navigate to Job Creation**
   - URL: `https://admin.vercel-domain.com/jobs/new`
   - Expected: Job creation form loads

2. **Fill Basic Job Details**
   - Client: Select existing client or create new
   - Site: Select existing site
   - Job title: "Test Electrical Installation"
   - Description: "Two new circuits for kitchen renovation"

3. **Select Electrical Work Type**
   - Find "Electrical Work Type" dropdown
   - Select: **"New Circuit Installation"**
   - Expected: CircuitDetailsForm appears below

4. **Add First Circuit**
   - Click "Add Circuit" button
   - Fill Circuit 1 details:
     - Circuit Reference: "C1"
     - Location: "Kitchen"
     - Description: "Ring final circuit for sockets"
     - Overcurrent Device Type: "MCB Type B"
     - Overcurrent Device Rating: "32A"
   - Expected: Circuit appears in list

5. **Add Second Circuit**
   - Click "Add Circuit" button again
   - Fill Circuit 2 details:
     - Circuit Reference: "C2"
     - Location: "Kitchen"
     - Description: "Lighting circuit"
     - Overcurrent Device Type: "MCB Type B"
     - Overcurrent Device Rating: "6A"
   - Expected: Both circuits show in list

6. **Create Job**
   - Click "Create Job" button
   - Expected: Redirected to job detail page
   - Expected: Job shows electrical_work_type badge

### Verification
- ✅ Job created successfully
- ✅ Job detail page shows "Electrical Tests & Certification" section
- ✅ Circuit details stored in job record

---

## Test Scenario 2: Create Test from Job

### Objective
Create an electrical test linked to the job and auto-initialize circuits.

### Steps

1. **Navigate to Job Detail Page**
   - From previous test or navigate to `/jobs/[job-id]`
   - Expected: Job detail page loads

2. **Locate Tests Section**
   - Scroll to "Electrical Tests & Certification" section
   - Expected: Section shows "No tests created yet"
   - Expected: "Create Test" button visible

3. **Open Create Test Modal**
   - Click "Create Test" button
   - Expected: CreateTestModal opens

4. **Fill Test Details**
   - Test Type: Auto-selected as "Electrical Installation Certificate (EIC)"
   - Test Date: Select today's date
   - Inspector Name: "John Smith"
   - Inspector Registration: "NICEIC12345"
   - Expected: Form fields populated correctly

5. **Create Test**
   - Click "Create Test" button
   - Expected: Loading spinner shows
   - Expected: Redirected to test detail page `/tests/[test-id]`

6. **Verify Test Created**
   - Check test detail page loads
   - Check test number displayed (format: TEST-YYYYMMDD-XXXX)
   - Check status shows "Draft"
   - Check "Record Measurements" button visible

7. **Verify Circuits Auto-Created**
   - Scroll to "Circuits" section
   - Expected: Table shows 2 circuits (C1 and C2)
   - Expected: Both circuits show status "Not Tested"
   - Expected: Circuit details match job circuit_details

### Verification
- ✅ Test created successfully
- ✅ Test linked to job
- ✅ 2 circuits auto-created from job
- ✅ Circuit references match (C1, C2)

---

## Test Scenario 3: Record Test Measurements

### Objective
Complete the 4-step wizard to record all test measurements and inspection items.

### Steps

#### Step 1: Installation Details

1. **Navigate to Record Page**
   - From test detail page, click "Record Measurements"
   - URL: `/tests/[test-id]/record`
   - Expected: Wizard loads on Step 1 "Installation Details"

2. **Fill Installation Details**
   - Premises Type: Select "Domestic"
   - Earthing Arrangements: Select "TN-C-S"
   - Supply Voltage: "230V"
   - Supply Frequency: "50Hz"
   - Main Switch Type: "Double Pole Isolator"
   - Main Switch Rating: "100A"
   - Expected: All fields accept input

3. **Save Installation Details**
   - Click "Save & Continue" button
   - Expected: Details saved
   - Expected: Progress to Step 2 "Circuit Measurements"

#### Step 2: Circuit Measurements

1. **Select First Circuit (C1)**
   - Circuit selector shows "C1 - Kitchen - Ring final circuit"
   - Expected: Circuit info card displays full details
   - Expected: Measurement form appears

2. **Enter Continuity Measurements**
   - R1+R2: Enter "0.35"
   - Expected: Input border turns green (pass)
   - Expected: Acceptable range displayed: "< 1.0 Ω"
   - Note: If validation doesn't show, this is due to the route ordering bug - measurements can still be saved

3. **Enter Insulation Resistance**
   - Line to Earth: Enter "150"
   - Line to Neutral: Enter "150"
   - Neutral to Earth: Enter "150"
   - Expected: All show green borders (pass)
   - Expected: Acceptable range: "> 1.0 MΩ"

4. **Enter Earth Loop Impedance**
   - Zs: Enter "0.8"
   - Expected: Green border (pass)
   - Expected: For 32A MCB Type B, max is 1.44Ω
   - Expected: Shows "✓ Pass - Within acceptable range"

5. **Set Polarity**
   - Check "Polarity Correct" checkbox
   - Expected: Checkbox checked

6. **Save Circuit 1 Measurements**
   - Click "Save Measurements" button
   - Expected: Success message
   - Expected: "Next Circuit" button enabled

7. **Proceed to Circuit 2**
   - Click "Next Circuit" button
   - Expected: Circuit selector changes to C2

8. **Enter Circuit 2 Measurements**
   - Continuity R1+R2: "0.25" (lower rating circuit)
   - Insulation L-E: "200"
   - Insulation L-N: "200"
   - Insulation N-E: "200"
   - Earth Loop Zs: "1.2" (6A circuit, max is 7.67Ω)
   - Polarity: Checked
   - Expected: All pass validation

9. **Save Circuit 2 & Continue**
   - Click "Save Measurements"
   - Click "Continue to Inspection"
   - Expected: Progress to Step 3

#### Step 3: Inspection Checklist

1. **Review Checklist Items**
   - Expected: 25 inspection items for EIC
   - Expected: Grouped by categories:
     - Protection against electric shock
     - Identification and notices
     - Cables and conductors
     - General installation
     - Etc.

2. **Complete First 5 Items (Pass)**
   - Item EIC-01: Select "Pass"
   - Item EIC-02: Select "Pass"
   - Item EIC-03: Select "Pass"
   - Item EIC-04: Select "Pass"
   - Item EIC-05: Select "Pass"
   - Click "Save" after each item
   - Expected: "✓ Saved" appears after each

3. **Mark One Item as N/A**
   - Item EIC-06: Select "N/A"
   - Notes: "Not applicable to this installation"
   - Click "Save"
   - Expected: Saved successfully

4. **Complete Remaining Items**
   - Select "Pass" for items 7-25
   - Save each item individually or use "Save All" button
   - Expected: Progress bar updates as items complete
   - Expected: Progress shows "25 / 25 (100%)"

5. **Continue to Review**
   - Click "Continue to Review" button
   - Expected: Progress to Step 4

#### Step 4: Review & Complete

1. **Review Summary**
   - Expected: Installation details summary shown
   - Expected: Circuit summary table:
     - C1: 5 measurements recorded, Status: Pass
     - C2: 5 measurements recorded, Status: Pass
   - Expected: Inspection progress: 25/25 (100%)

2. **Select Overall Outcome**
   - Outcome: Select "Satisfactory"
   - Expected: Dropdown shows options: Satisfactory, Unsatisfactory, Requires Investigation

3. **Add Test Notes** (Optional)
   - Notes: "All measurements within acceptable limits. Installation complies with BS 7671:2018+A3:2024."
   - Expected: Notes field accepts text

4. **Complete Test**
   - Click "Complete Test" button
   - Expected: Confirmation dialog appears
   - Click "Confirm"
   - Expected: Loading spinner
   - Expected: Test status changed to "Completed"
   - Expected: Redirected to test detail page

### Verification
- ✅ Installation details saved
- ✅ Both circuits have measurements recorded
- ✅ All measurements validated correctly
- ✅ Inspection checklist 100% complete
- ✅ Test marked as completed
- ✅ Outcome set to "Satisfactory"

---

## Test Scenario 4: Generate Certificate

### Objective
Generate an Electrical Installation Certificate (EIC) PDF.

### Steps

1. **Verify Test is Complete**
   - Status badge shows "Completed"
   - Outcome badge shows "Satisfactory" in green
   - Expected: "Generate Certificate" button visible

2. **Open Certificate Generation Modal**
   - Click "Generate Certificate" button
   - Expected: GenerateCertificateModal opens

3. **Review Certificate Options**
   - Certificate Type: Should default to "Electrical Installation Certificate (EIC)"
   - Description shows: "For new circuit installations and initial verifications"
   - Issue Date: Defaults to today
   - Expected: Info box explains what will be included

4. **Adjust Issue Date** (Optional)
   - Change issue date to yesterday or earlier
   - Expected: Date picker only allows past dates (max: today)

5. **Generate Certificate**
   - Click "Generate Certificate" button
   - Expected: Loading spinner in button
   - Expected: Button text changes to "Generating..."
   - Expected: Wait for PDF generation (may take 5-10 seconds)

6. **Verify Certificate Created**
   - Expected: Modal closes
   - Expected: Success message appears
   - Expected: Certificates section updates
   - Expected: New certificate appears in grid

7. **Review Certificate Card**
   - Expected: Certificate shows:
     - Badge: "EIC" in blue
     - Certificate number (format: CERT-EIC-YYYYMMDD-XXXX)
     - Issue date: Today (or selected date)
     - File size: ~50-100 KB
     - Generated date/time
   - Expected: Three buttons:
     - Download PDF (primary blue button)
     - Regenerate (gray button)
     - Email (gray button, disabled)

### Verification
- ✅ Certificate generated successfully
- ✅ Certificate number assigned
- ✅ Certificate card displays correctly
- ✅ Certificate stored in database

---

## Test Scenario 5: Download Certificate

### Objective
Download and verify the PDF certificate contents.

### Steps

1. **Download Certificate**
   - Click "Download PDF" button on certificate card
   - Expected: Button shows loading spinner
   - Expected: PDF opens in new browser tab or downloads

2. **Verify PDF Structure**
   Open the downloaded PDF and verify it contains:

   **Header Section:**
   - ✅ Document title: "Electrical Installation Certificate"
   - ✅ Certificate number displayed
   - ✅ Business name/logo (if configured)
   - ✅ Issue date

   **Installation Details:**
   - ✅ Client name and address
   - ✅ Site address
   - ✅ Premises type: "Domestic"
   - ✅ Earthing arrangements: "TN-C-S"
   - ✅ Supply voltage: "230V 50Hz"
   - ✅ Main switch details: "Double Pole Isolator, 100A"

   **Circuit Details Table:**
   - ✅ Table with 2 rows (C1, C2)
   - ✅ Columns: Reference, Location, Type, Protection, Conductor Sizes
   - ✅ Circuit C1 data: Kitchen, Ring final, MCB Type B 32A
   - ✅ Circuit C2 data: Kitchen, Lighting, MCB Type B 6A

   **Test Results:**
   - ✅ Continuity (R1+R2) for both circuits
   - ✅ Insulation resistance (L-E, L-N, N-E) for both circuits
   - ✅ Earth loop impedance (Zs) for both circuits
   - ✅ Polarity test results
   - ✅ Pass/Fail indicators

   **Inspection Results:**
   - ✅ Summary of inspection checklist
   - ✅ 25 items inspected
   - ✅ Pass/N/A results shown
   - ✅ Any limitations noted

   **Declarations:**
   - ✅ Inspector declaration
   - ✅ Inspector name: "John Smith"
   - ✅ Inspector registration: "NICEIC12345"
   - ✅ Signature line
   - ✅ Date

   **Compliance Statement:**
   - ✅ "This installation complies with BS 7671:2018+A3:2024"
   - ✅ Next inspection due date (10 years for domestic)

### Verification
- ✅ PDF downloads successfully
- ✅ All sections present
- ✅ Data populated correctly
- ✅ Professional formatting
- ✅ BS 7671 compliance referenced

---

## Test Scenario 6: Certificate Regeneration

### Objective
Test regenerating a certificate (creates new version).

### Steps

1. **Locate Certificate**
   - On test detail page, find the certificate in grid

2. **Click Regenerate**
   - Click "Regenerate" button (gray button with refresh icon)
   - Expected: Confirmation dialog appears
   - Message: "Generate a new version of this certificate? The previous version will remain accessible."

3. **Confirm Regeneration**
   - Click "OK" in confirmation dialog
   - Expected: Loading spinner in button
   - Expected: Button text changes to "Regenerating..."
   - Expected: Wait for PDF generation

4. **Verify New Certificate**
   - Expected: New certificate appears in grid
   - Expected: New certificate number assigned
   - Expected: Both versions visible (old and new)
   - Expected: New version has updated generated_at timestamp

### Verification
- ✅ Regeneration successful
- ✅ New version created
- ✅ Previous version retained
- ✅ Both accessible for download

---

## Test Scenario 7: Validation Edge Cases

### Objective
Test validation warnings and failures.

### Precondition
Create a new test (repeat Scenarios 1-2).

### Steps

#### Test 7.1: Low Insulation Resistance (Warning)

1. Navigate to Circuit Measurements (Step 2 of wizard)
2. Enter Circuit measurements:
   - Insulation L-E: "0.8" (below 1.0 MΩ minimum)
3. Expected Results:
   - Input border: Yellow (warning)
   - Warning icon: ⚠
   - Message: "Warning: Below minimum standard (1.0 MΩ)"
   - BS 7671 reference displayed
4. Note: Measurement can still be saved (with warning flag)

#### Test 7.2: High Earth Loop Impedance (Fail)

1. For a 32A circuit, enter:
   - Zs: "2.0" (exceeds 1.44Ω maximum)
2. Expected Results:
   - Input border: Red (fail)
   - Fail icon: ✗
   - Message: "Fail: Exceeds maximum (1.44 Ω for 32A MCB Type B)"
   - BS 7671 regulation 411.4.4 reference
3. Note: Circuit test_result should be marked as "Unsatisfactory"

#### Test 7.3: Borderline Value (Warning)

1. For a 32A circuit, enter:
   - Zs: "1.38" (within 10% of 1.44Ω limit)
2. Expected Results:
   - Input border: Yellow (warning)
   - Warning icon: ⚠
   - Message: "Warning: Close to maximum limit"
   - Measurement accepted but flagged

#### Test 7.4: Missing Inspector Details

1. Try to complete test without inspector name
2. Expected: Validation error prevents completion
3. Message: "Inspector name is required"

#### Test 7.5: Incomplete Inspection Checklist

1. Try to complete test with only 20/25 items done
2. Expected: Warning or block
3. Message: "Please complete all inspection items (20/25 completed)"

### Verification
- ✅ Warnings display correctly (yellow)
- ✅ Failures display correctly (red)
- ✅ Pass displays correctly (green)
- ✅ BS 7671 references shown
- ✅ Required fields enforced

---

## Test Scenario 8: Database Verification

### Objective
Verify database records were created correctly.

### Prerequisites
- Access to Supabase dashboard
- Or PostgreSQL client with connection to production DB

### Steps

1. **Check Tests Table**
   ```sql
   SELECT
     id, test_number, test_type, status, outcome,
     premises_type, earthing_arrangements,
     inspector_name, inspector_registration_number
   FROM tests
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - Expected: Test record exists
   - Expected: All fields populated correctly

2. **Check Test Circuits Table**
   ```sql
   SELECT
     id, test_id, circuit_reference, location,
     circuit_type, overcurrent_device_type,
     overcurrent_device_rating,
     continuity_r1_r2, insulation_resistance,
     earth_loop_impedance, polarity_correct,
     test_result
   FROM test_circuits
   WHERE test_id = '[test-id-from-step-1]'
   ORDER BY circuit_reference;
   ```
   - Expected: 2 circuit records (C1, C2)
   - Expected: All measurements stored
   - Expected: test_result = 'satisfactory'

3. **Check Test Certificates Table**
   ```sql
   SELECT
     id, test_id, certificate_number, certificate_type,
     issue_date, storage_url, file_size_bytes,
     generated_at, generated_by
   FROM test_certificates
   WHERE test_id = '[test-id]'
   ORDER BY generated_at DESC;
   ```
   - Expected: 1 or more certificates (if regenerated)
   - Expected: certificate_type = 'eic'
   - Expected: storage_url populated

4. **Check Supabase Storage**
   - Navigate to Supabase Storage bucket: `certificates`
   - Path: `[tenant_id]/[year]/[certificate_number].pdf`
   - Expected: PDF file exists
   - Expected: File size matches file_size_bytes in database

5. **Check Measurement Standards**
   ```sql
   SELECT
     measurement_type, circuit_type, circuit_rating,
     min_acceptable, max_acceptable, unit,
     bs7671_reference
   FROM test_measurement_standards
   ORDER BY measurement_type, circuit_type, circuit_rating;
   ```
   - Expected: 28 standard records
   - Expected: Standards for insulation, earth_loop, continuity, rcd, voltage

### Verification
- ✅ Test record created
- ✅ 2 circuit records created
- ✅ Certificate record created
- ✅ PDF stored in Supabase Storage
- ✅ All relationships correct

---

## Test Scenario 9: Minor Works Certificate

### Objective
Test Minor Works Certificate generation.

### Steps

1. **Create Job**
   - Select electrical_work_type: "Minor Works / Alterations"
   - Add 1 circuit
   - Create job

2. **Create Test**
   - Test type auto-selects: "Minor Works Certificate"
   - Create test

3. **Record Measurements**
   - Follow wizard (similar to EIC but simpler)
   - Inspection checklist: Only 11 items (not 25)
   - Complete test

4. **Generate Certificate**
   - Certificate type: "Minor Works Certificate"
   - Generate

5. **Verify PDF**
   - Title: "Minor Electrical Installation Works Certificate"
   - Simplified format compared to EIC
   - Only 11 inspection items listed

### Verification
- ✅ Minor Works certificate generated
- ✅ Correct template used
- ✅ 11 inspection items (not 25)

---

## Test Scenario 10: EICR Certificate

### Objective
Test Electrical Installation Condition Report (EICR) generation.

### Steps

1. **Create Job**
   - Select electrical_work_type: "Inspection / EICR"
   - No circuits needed (inspecting existing)
   - Create job

2. **Create Test**
   - Test type: "Electrical Installation Condition Report (EICR)"
   - Create test

3. **Manually Add Circuits**
   - Since no circuits from job, use "Add Circuit" if available
   - Or test without circuits (EICR can be general inspection)

4. **Complete Inspection**
   - Inspection checklist: 16 items (EICR specific)
   - Mark items as Pass/Fail/Limitation
   - Add notes for any limitations

5. **Generate Certificate**
   - Certificate type: "Electrical Installation Condition Report (EICR)"
   - Generate

6. **Verify PDF**
   - Title: "Electrical Installation Condition Report"
   - Classification: C1, C2, C3 codes
   - Limitations section
   - Recommendations section
   - Next inspection recommendation

### Verification
- ✅ EICR certificate generated
- ✅ Correct template used
- ✅ 16 inspection items
- ✅ Classification codes present

---

## Test Summary Checklist

After completing all scenarios, verify:

### Backend
- ✅ All database migrations run successfully
- ✅ 28 BS 7671 standards loaded
- ✅ All MCP tools operational
- ✅ All coordinator routes responding
- ✅ Test data persists correctly

### Frontend
- ✅ Job creation with electrical work type works
- ✅ Circuit details form captures data
- ✅ Test creation from job works
- ✅ Circuits auto-initialize from job
- ✅ Measurement recording wizard complete
- ✅ Real-time validation displays (or fails gracefully)
- ✅ Inspection checklist functions
- ✅ Test completion works
- ✅ Certificate generation works
- ✅ Certificate download works
- ✅ Certificate regeneration works

### Certificates
- ✅ EIC certificate generated correctly
- ✅ Minor Works certificate generated correctly
- ✅ EICR certificate generated correctly
- ✅ All PDF sections present
- ✅ BS 7671 compliance referenced
- ✅ Professional formatting

### Validation
- ✅ Pass validation (green) works
- ✅ Warning validation (yellow) works
- ✅ Fail validation (red) works
- ✅ BS 7671 references displayed
- ✅ Required fields enforced

---

## Known Issues

### 1. Route Ordering Bug (HIGH Priority)
**Issue**: `/api/tests/standards` matched by `/api/tests/:id`
**Impact**: Real-time validation may not display ranges
**Workaround**: Validation still occurs on backend save
**Fix**: Reorder routes in `apps/coordinator/src/routes/tests.ts`

### 2. Mock Authentication
**Issue**: Using hardcoded mock credentials
**Impact**: All users share same tenant/user ID
**Status**: Expected for MVP testing
**Fix**: Implement real authentication (future)

---

## Success Criteria

### Must Pass (Critical)
1. ✅ Job with electrical work created
2. ✅ Test created from job
3. ✅ Circuits auto-initialized
4. ✅ Measurements recorded and saved
5. ✅ Inspection checklist completed
6. ✅ Test marked as complete
7. ✅ Certificate generated (PDF)
8. ✅ Certificate downloadable
9. ✅ Database records correct
10. ✅ BS 7671 compliance referenced

### Should Pass (Important)
11. Real-time validation displays (may fail due to route bug)
12. Warning/fail states show correctly
13. All three certificate types work (EIC, Minor Works, EICR)
14. Certificate regeneration works
15. Edge cases handled gracefully

### Nice to Have (Optional)
16. Validation shows acceptable ranges with BS 7671 refs
17. Empty states display helpfully
18. Loading states provide feedback
19. Error messages are user-friendly
20. Mobile responsive design works

---

## Post-Testing Actions

### If All Tests Pass
1. ✅ Mark Phase 6 complete in implementation plan
2. ✅ Update progress to 100%
3. ✅ Deploy to production (if in staging)
4. ✅ Train users on new feature
5. ✅ Monitor for issues in production use

### If Tests Fail
1. Document failures in detail
2. Prioritize by severity (critical/high/medium/low)
3. Create bug fixes for critical issues
4. Retest after fixes
5. Iterate until all critical tests pass

### Next Steps
1. Fix route ordering bug (high priority)
2. Add automated API tests
3. Add frontend unit tests
4. Consider Playwright/Cypress E2E tests
5. Performance testing (PDF generation time)
6. Security review (especially file uploads)

---

## Contact

For issues or questions during testing:
- Check implementation plan: `ELECTRICAL_CERTIFICATION_IMPLEMENTATION_PLAN.md`
- Review technical docs: `JobBuilda_MCP_PRD_FRD_v2.0.md`
- Check deployment status: `DEPLOYMENT_STATUS_*.md`

**Testing Started**: [Date/Time]
**Testing Completed**: [Date/Time]
**Tested By**: [Name]
**Overall Result**: [PASS / FAIL / PARTIAL]
**Notes**: [Any additional observations]

---

