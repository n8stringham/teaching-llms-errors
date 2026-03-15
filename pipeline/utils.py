import pandas as pd
import numpy as np
import yaml
from typing import List, Dict, Callable
from openai import OpenAI
import os
from transformers import AutoTokenizer
import tiktoken
import matplotlib.pyplot as plt
import numpy as np
import matplotlib.colors as mcolors
import matplotlib.cm as cm
import math

def calculate_error_metrics(df, group_cols, label_col, mmlu=False):
    """
    Calculate the error ratio and coverage after grouping by group_col
    
    Parameters:
        df (pd.DataFrame): The DataFrame containing the col to group by and the label
    
    Returns:
        pd.DataFrame: A grouped Dataframe, 'error_ratio', and 'coverage'.
    """
    # Filter rows for wrong instances
    wrong_df = df[df[label_col] == 0]
    total_wrong = len(wrong_df)
    
    if not mmlu:
        # Calculate the metrics
        metrics = (
            df.groupby(group_cols)
            .apply(lambda group: pd.Series({
                'wrongVScorrect': len(group[group[label_col] == 0]) / len(group[group[label_col] == 1]) if len(group[group[label_col] == 1]) > 0 else len(group[group[label_col] == 0]) ,
                'coverage': len(group[group[label_col] == 0]) / total_wrong if total_wrong > 0 else 0,
                'accuracy': group[label_col].mean(),
                'short_description': group['short_description'].iloc[0],
                'description': group['description'].iloc[0],
                'verification_criteria': group['verification_criteria'].iloc[0],
                'num_samples': len(group),
                'model': group['model'].unique()[0],
            **({'standard': group['standard'].unique()[0]} if 'standard' not in group_cols else {})  # Conditionally include 'standard'
            }), include_groups=False).reset_index()
        )
    else:
        metrics = (
            df.groupby(group_cols)
            .apply(lambda group: pd.Series({
                'wrongVScorrect': len(group[group[label_col] == 0]) / len(group[group[label_col] == 1]) if len(group[group[label_col] == 1]) > 0 else len(group[group[label_col] == 0]) ,
                'coverage': len(group[group[label_col] == 0]) / total_wrong if total_wrong > 0 else 0,
                'accuracy': group[label_col].mean(),
                # 'subject': group['subject'].iloc[0],
                # 'subcat': group['subcat'].iloc[0],
                # 'cat': group['cat'].iloc[0],
                'num_samples': len(group),
                'model': group['ai_model'].unique()[0],
            **({'subcat': group['subcat'].iloc[0]} if 'subcat' not in group_cols else {}),  # Conditionally include 'standard'
            **({'cat': group['cat'].iloc[0]} if 'cat' not in group_cols else {}),  # Conditionally include 'cat'            
            }), include_groups=False).reset_index()
        )        
    
    return metrics

def load_mathcamps_data(json_file: str, model_id: str) -> pd.DataFrame:
    '''
    Load mathcamps json data for a model into a dataframe and add standards
    '''
    # map standard id to description
    standards_path = 'stage1_do_errors_exist/datasets/mathcamps/commoncore.yaml'
    with open(standards_path, 'r') as f:
        standards = yaml.safe_load(f)
        standards = {s['id']: s for s in standards}

    # read the model responses file - each row is a question with model response
    data = pd.read_json(json_file).T

    # add column for the descriptions of the standard
    data['description'] = data.apply(lambda row: standards[row['standard']]['description'], axis=1)
    data['short_description'] = data.apply(lambda row: standards[row['standard']]['short_description'], axis=1)
    # change correct to bool
    data['correct'] = data['correct'].astype(bool)
    # add a column for the grade represented by each standard
    data['grade'] = data.apply(lambda row: row['standard'].split('.')[0], axis=1)
    data['verification_criteria'] = data.apply(lambda row: standards[row['standard']]['verification_criteria'], axis=1)
    
    if model_id == None:
        # print("No model id specified, loading all dataframe with all models combined")
        return data

    return data[data['model'] == model_id]


def generate_prompt(entry: Dict[str, str], template: str) -> str:
    """
    Format a prompt using a template and an entry from the dataset.

    Args:
        entry (Dict[str, str]): A data entry with standardized keys.
        template (str): A string template for the prompt (e.g., "Question: {question}").

    Returns:
        str: The formatted prompt.
    """
    return template.format(**entry)


def query_openai(prompt, model="gpt-4o-2024-08-06", t=0.2):
    """Queries the OpenAI API with the given prompt and returns the response."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": prompt, 
        }
    ],
    model=model,
    response_format={"type": "json_object"},
    temperature=t,
)
    return response

def fit_in_context(prompt_instances):
    '''
    If necessary, remove examples from the prompt so that it fits in the context length
    '''
    MAX_CONTEXT_LENGTH=128000
    RESPONSE_LENGTH_BUFFER=400
    REDUCE_NUM=10
    encoding = tiktoken.get_encoding("cl100k_base")
    cur_len = len(encoding.encode(prompt_instances))
    reduced = prompt_instances
    while cur_len > MAX_CONTEXT_LENGTH - RESPONSE_LENGTH_BUFFER:
        reduced = '\n***\n'.join(reduced.split('***')[:-REDUCE_NUM])
        # print('reduced=', reduced)
        cur_len = len(encoding.encode(reduced))
        print('cur_len=', cur_len)

    return reduced


def df_to_dict(df, groupbyCol):
    """Converts a DataFrame with columns 'standard', 'wrongVScorrect', and 'coverage' to the required dictionary format."""
    return df.set_index(groupbyCol)[['wrongVScorrect', 'coverage']].to_dict(orient='index')


    
def plot_metrics(data):
    # Sort properties by wrongVScorrect
    sorted_items = sorted(data.items(), key=lambda x: x[1]['wrongVScorrect'])
    properties = [item[0] for item in sorted_items]
    wrong_vs_correct = np.array([data[p]['wrongVScorrect'] for p in properties])
    coverage = np.array([data[p]['coverage'] for p in properties])
    
    # Normalize coverage values for color mapping
    norm = mcolors.Normalize(vmin=min(coverage), vmax=max(coverage))
    cmap = cm.get_cmap('Blues')  # Use a blue colormap
    colors = cmap(norm(coverage))
    
    fig, ax = plt.subplots(figsize=(8, len(properties) * 0.5))
    bars = ax.barh(properties, wrong_vs_correct, color=colors, edgecolor='black')
    
    # Add colorbar
    sm = cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = plt.colorbar(sm, ax=ax)
    cbar.set_label('Coverage')
    
    ax.set_xlabel('Wrong / Correct')
    ax.set_ylabel('Property')
    ax.set_title('Error Ratio and Coverage per Meta-Label')
#     plt.show()


def plot_metrics_fig(data, ax, title, norm, cmap, xlim, max_items=10, fsize=12):
    # Sort properties by wrongVScorrect
    sorted_items = sorted(data.items(), key=lambda x: x[1]['wrongVScorrect'])
    # Select only the top `max_items`
    selected_items = sorted_items[-max_items:]  
    properties = [item[0] for item in selected_items]
    wrong_vs_correct = np.array([item[1]['wrongVScorrect'] for item in selected_items])
    coverage = np.array([item[1]['coverage'] for item in selected_items])
    
    # Map coverage to colors using shared colormap
    colors = cmap(norm(coverage))
    
    ax.barh(properties, wrong_vs_correct, color=colors, edgecolor='black')
    
    # Add a vertical dashed red line at x = 0.5
    ax.axvline(x=0.5, color='red', linestyle='dashed', linewidth=2)
    ax.set_xlabel('Error Ratio')
    ax.set_title(title, fontsize=fsize+2)
    ax.set_xlim(xlim)
    # Increase the font size of y-axis labels
    ax.tick_params(axis='y', labelsize=fsize)
    ax.tick_params(axis='x', labelsize=fsize-1)



def plot_metrics_fig_mathcamps(data, ax, title, norm, cmap, xlim, max_items=10, fsize=12):
    # Sort properties by wrongVScorrect
    sorted_items = sorted(data.items(), key=lambda x: x[1]['wrongVScorrect'])
    # print(sorted_items)
    # Select only the top `max_items`
    selected_items = sorted_items[-max_items:]  
    properties = [item[0] for item in selected_items]
    wrong_vs_correct = np.array([item[1]['wrongVScorrect'] for item in selected_items])
    coverage = np.array([item[1]['coverage'] for item in selected_items])
    
    # Map coverage to colors using shared colormap
    colors = cmap(norm(coverage))
    
    ax.barh(properties, wrong_vs_correct, color=colors, edgecolor='black')
    
    # Add a vertical dashed red line at x = 0.5
    ax.axvline(x=0.5, color='red', linestyle='dashed', linewidth=2)
    ax.set_xlabel('Error Ratio')
    ax.set_title(title, fontsize=fsize+2)
    ax.set_xlim(xlim)
    # Increase the font size of y-axis labels
    ax.tick_params(axis='y', labelsize=fsize)
    ax.tick_params(axis='x', labelsize=fsize-1)