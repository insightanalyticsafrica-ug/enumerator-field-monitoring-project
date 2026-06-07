USE me_monitoring_db;

CREATE TABLE enumerator_submissions(
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    unique_uuid VARCHAR(100) UNIQUE,
    enumerator_id VARCHAR(50),
    district VARCHAR(100),
    submission_time DATETIME,
    interview_duration_mins FLOAT,
    gps_captured INT, -- Stores 1 for Yes, 0 for No
    household_interviewed VARCHAR(100),
    
    is_duplicate INT DEFAULT 0, -- Stores 1 if flagged as duplicate, else 0
    is_duration_outlier INT DEFAULT 0, -- Stores 1 if flagged as too fast/slow, else 0
    quality_score FLOAT,                 -- Calculated composite score (0 - 100)
    flag_reason VARCHAR(255),            -- Text summary of infractions (e.g., "Missing GPS, Duplicate")
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
