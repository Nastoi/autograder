-- Create the unmanaged tables that Django expects
CREATE TABLE IF NOT EXISTS qualification (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS module (
    id UUID PRIMARY KEY,
    qualification_id UUID NOT NULL REFERENCES qualification(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS module_assignment (
    id UUID PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES module(id),
    assignment_number INTEGER NOT NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    skill_statement_code VARCHAR(50) NOT NULL,
    skill_statement TEXT NOT NULL,
    objective TEXT DEFAULT '',
    maximum_score NUMERIC(7,2) NOT NULL,
    minimum_pass_score NUMERIC(7,2) NOT NULL,
    is_summative BOOLEAN DEFAULT TRUE,
    contributes_to_final_mark BOOLEAN DEFAULT TRUE,
    final_mark_weight NUMERIC(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_level (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES module_assignment(id),
    grading_configuration_id UUID NOT NULL,
    level_code VARCHAR(20) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT DEFAULT '',
    tasks JSONB DEFAULT '[]'::jsonb,
    deliverables JSONB DEFAULT '[]'::jsonb,
    expected_outcome TEXT DEFAULT '',
    source_filename VARCHAR(255),
    version INTEGER DEFAULT 1,
    configuration_status VARCHAR(20) DEFAULT 'draft',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
