import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
import re

def extract_difficulty_features(text: str) -> list:
    """Extract surface-level difficulty features from the input text."""
    length = len(text.split())
    num_numbers = len(re.findall(r'\d+', text))
    num_logical_ops = len(re.findall(r'\b(if|and|or|not|because)\b', text.lower()))
    
    return [length, num_numbers, num_logical_ops]

def compute_residuals_and_group(df: pd.DataFrame, text_col: str, error_col: str) -> pd.DataFrame:
    """
    Trains a Logistic Regression to predict expected error, computes residuals,
    and assigns High/Low residual groups.
    """
    # Extract features
    X = np.array([extract_difficulty_features(t) for t in df[text_col]])
    y = df[error_col].values # 1 if error, 0 if correct

    # Train logistic regression
    lr = LogisticRegression(class_weight='balanced')
    lr.fit(X, y)

    # Predict expected error probability
    expected_error_prob = lr.predict_proba(X)[:, 1]

    # Calculate residual error 
    df['expected_error'] = expected_error_prob
    df['residual_error'] = df[error_col] - df['expected_error']

    # 5. Group into High vs. Low residual
    high_threshold = df['residual_error'].quantile(0.75)
    low_threshold = df['residual_error'].quantile(0.25)

    df['group'] = 'neutral'
    df.loc[df['residual_error'] >= high_threshold, 'group'] = 'High Residual'
    df.loc[df['residual_error'] <= low_threshold, 'group'] = 'Low Residual'

    return df
