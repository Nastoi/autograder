# Autograder

This repository contains the Django-based auto-grader backend and frontend for assessment workflows. The current implementation includes submission intake, learner authentication, course and assignment models, and a placeholder mock grading pipeline.

## New auto-grader design

The auto-grader uses a fixed master assessor prompt combined with dynamically supplied structured data from Django.

Implemented components:
- `backend/prompts/assessor_system_prompt.txt`
- `backend/prompts/criterion_assessment_prompt.txt`
- `backend/grading/services/prompt_builder.py`
- `backend/grading/services/openai_client.py`
- `backend/grading/services/criterion_assessor.py`
- AI grading integration in `backend/submissions/views.py`
- AI grading workflow in `backend/submissions/services.py`

This design ensures consistent grading behavior across assignments and avoids free-form prompt drift.

## Implementation overview

### 1. Fixed master assessor prompt
A stable system prompt is stored in `backend/prompts/assessor_system_prompt.txt`.

The system prompt defines:
- evidence-only assessment rules
- fair and consistent assessor behavior
- BASIC vs ADVANCED assignment scoring rules
- forbidden learner instructions
- strict JSON output requirements
- criterion-level grading procedure

### 2. Dynamic rubric and evidence prompt
A user prompt template is stored in `backend/prompts/criterion_assessment_prompt.txt`.

Django populates this template with:
- assignment metadata
- task instructions
- criterion requirements
- rubric descriptors and score bands
- deterministic check results
- learner evidence payloads
- assessor guidance
- output JSON schema

### 3. One-criterion-per-request grading
The current implementation grades one rubric criterion per AI request.
This reduces hallucination and makes evidence mapping deterministic.

### 4. Structured evidence payloads
Evidence is sent as structured records with stable IDs.
Current proof-of-concept evidence includes `FILE_METADATA` and deterministic check records.

### 5. Deterministic checks
The workflow includes deterministic check payloads such as `DC_FILE_EXISTS`.
These are treated as formal evidence in the prompt.

### 6. Backend validation and persistence
The prompt builder renders JSON payloads and the AI client requests grading from OpenAI.
The response is currently mapped into submission fields in `backend/submissions/services.py`.

The Django service saves:
- `final_score`
- `maximum_score`
- `achieved_band`
- `feedback`
- status updates and timestamps

## Assignment types and valid achievement levels

- BASIC: `FAILED`, `FOUNDATION`, `PROFICIENT`
- ADVANCED: `FAILED`, `PROFICIENT`, `EXPERT`

The assessor prompt enforces:
- no `EXPERT` for BASIC assignments
- no `FOUNDATION` for ADVANCED assignments

## Current status

Completed:
- stable system prompt file
- criterion assessment prompt template
- prompt builder service
- OpenAI-assessment client
- criterion assessor orchestration
- submission grading route wiring

Work in progress:
- schema validation of AI responses in `backend/grading/services/schemas.py`
- robust evidence extraction from uploaded files
- human-review fallback for uncertain results
- full audit metadata and versioning

## Next implementation steps

1. Add strict AI response validation in `backend/grading/services/schemas.py`
2. Implement robust evidence extraction for uploaded assignments
3. Add human-review and uncertainty routing for low-confidence grades
4. Expand deterministic checks for assignment-specific requirements
5. Store prompt and rubric versions with each graded submission

## How to test the AI grading flow

1. Set environment variables:
   - `OPENAI_API_KEY` with a valid OpenAI key.
   - `OPENAI_API_MODEL` optionally, e.g. `gpt-4o-mini`.

2. Start the backend from the `autograder` root:
   - `docker compose up -d --build`

3. Create or use an existing learner account and assignment context.

4. Submit a file to the learner submission endpoint:
   - POST to `/api/submissions/<context_id>/` with `submitted_file` as multipart form-data.

5. Confirm the submission completes and the response contains:
   - `final_score`
   - `maximum_score`
   - `achieved_band`
   - `feedback`
   - `status` set to `COMPLETED`

6. Check the backend logs for any OpenAI request or JSON parsing errors.

7. If grading fails, verify:
   - `OPENAI_API_KEY` is correct
   - the backend can reach the OpenAI API
   - the prompt templates are present under `backend/prompts`

## What this README change provides

This README now documents the actual implemented grading flow and the next work needed to complete a production-ready AI-assisted auto-grader.

Use this as the source of truth for backend grading development.
