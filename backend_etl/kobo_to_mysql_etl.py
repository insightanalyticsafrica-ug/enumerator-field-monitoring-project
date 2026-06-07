import pandas as pd
import numpy as np
import requests
from sqlalchemy import create_engine
import urllib.parse

# ==========================================
# 0. CONFIGURATION & CREDENTIALS
# ==========================================
KOBO_TOKEN = "d50b43ad91a8a31348ef45ab9ce8334159e2424f"  # Replace with your actual token
ASSET_UID = "aphbwAFgFmZxxHy9FZp8rA"    # Replace with your actual form UID
KOBO_URL = f"https://kf.kobotoolbox.org/api/v2/assets/{ASSET_UID}/data.json" #Change to eu.kobotoolbox.org if using EU server

DB_Password = "SFU@2025!"

DB_USER = "root"
DB_PASS = urllib.parse.quote_plus(DB_Password)  # URL-encode the password for safe connection string usage
DB_HOST = "localhost"
DB_PORT = "3306"
DB_NAME = "me_monitoring_db"

# ==========================================
# 1. EXTRACT: Fetch Data from Kobo API
# ==========================================
def extract_kobo_data():
    headers = {"Authorization": f"Token {KOBO_TOKEN}"}
    print("Fetching data from KoboToolbox API...")
    response = requests.get(KOBO_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        if not results:
            print("No submissions found in this form yet.")
            return pd.DataFrame()
        return pd.DataFrame(results)
    else:
        raise Exception(f"Failed to fetch data. API Status Code: {response.status_code}, Response: {response.text}")

# ==========================================
# 2. TRANSFORM: Clean & Apply M&E Quality Logic
# ==========================================
def transform_data(df):
    if df.empty:
        return df

    # Map Kobo's API output column names to our MySQL database schema
    # Kobo prefixes manually created fields, so we align them here
    rename_dict = {
        '_id': 'submission_id',
        '_uuid': 'unique_uuid',
        'enumerator_id': 'enumerator_id',
        'district': 'district',
        '_submission_time': 'submission_time',
        'interview_duration': 'interview_duration_mins',
        'household_interviewed': 'household_interviewed'
    }
    
    # Ensure missing keys don't crash the script if no data is uploaded yet
    existing_renames = {k: v for k, v in rename_dict.items() if k in df.columns}
    df = df.rename(columns=existing_renames)
    
    # Standardize Data Types
    df['submission_time'] = pd.to_datetime(df['submission_time'])
    df['interview_duration_mins'] = pd.to_numeric(df['interview_duration_mins'], errors='coerce').fillna(0)
    
    # Handle GPS handling (Kobo returns GPS as a space-separated string: "Lat Long Alt Accuracy")
    if 'gps_captured' in df.columns:
        df['gps_captured'] = df['gps_captured'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    else:
        df['gps_captured'] = 0

    # A. M&E Flag: Duplicate Detection (Same Enumerator interviewing the same Household)
    df['is_duplicate'] = df.duplicated(subset=['enumerator_id', 'household_interviewed'], keep='first').astype(int)
    
    # B. M&E Flag: Outlier Detection (Too fast < 15 mins or too slow > 90 mins)
    df['is_duration_outlier'] = ((df['interview_duration_mins'] < 15) | (df['interview_duration_mins'] > 90)).astype(int)
    
    # C. Composite Data Quality Scoring (Base 100)
    df['quality_score'] = 100.0
    df['quality_score'] -= df['gps_captured'].apply(lambda x: 0 if x == 1 else 40) # Deduct 40 if missing GPS
    df['quality_score'] -= df['is_duration_outlier'] * 30                           # Deduct 30 for speeders/laggers
    df['quality_score'] -= df['is_duplicate'] * 50                                  # Deduct 50 for duplicate data
    df['quality_score'] = df['quality_score'].clip(lower=0)                         # Bound at zero
    
    # D. Compile text-based reasons for flags
    flag_reasons = []
    for _, row in df.iterrows():
        reasons = []
        if row['gps_captured'] == 0: reasons.append("Missing GPS")
        if row['is_duration_outlier'] == 1: reasons.append("Duration Outlier")
        if row['is_duplicate'] == 1: reasons.append("Duplicate Entry")
        flag_reasons.append(", ".join(reasons) if reasons else "Clean")
    df['flag_reason'] = flag_reasons

    # Select only the columns that match our MySQL database schema
    final_columns = [
        'unique_uuid', 'enumerator_id', 'district', 'submission_time', 
        'interview_duration_mins', 'gps_captured', 'household_interviewed',
        'is_duplicate', 'is_duration_outlier', 'quality_score', 'flag_reason'
    ]
    
    return df[final_columns]

# ==========================================
# 3. LOAD: Upsert into MySQL Database
# ==========================================
def load_to_mysql(df):
    if df.empty:
        return
    
    # Connect to MySQL
    connection_string = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    engine = create_engine(connection_string)
    
    # To prevent throwing primary key errors on repeated script runs, we use a staging-load approach 
    # or overwriting the daily partition. For simplicity in this demo, we'll clear and reload.
    # Production note: Use "INSERT INTO ... ON DUPLICATE KEY UPDATE" for live streaming.
    df.to_sql('enumerator_submissions', con=engine, if_exists='replace', index=False)
    print(f"Successfully processed and loaded {len(df)} submissions into MySQL.")

# ==========================================
# EXECUTE THE PIPELINE
# ==========================================
if __name__ == "__main__":
    try:
        raw_data = extract_kobo_data()
        if not raw_data.empty:
            processed_data = transform_data(raw_data)
            load_to_mysql(processed_data)
            print("\nETL Pipeline Execution Complete! Here is a preview:")
            print(processed_data[['enumerator_id', 'quality_score', 'flag_reason']])
    except Exception as e:
        print(f"ETL Pipeline Failed: {e}")