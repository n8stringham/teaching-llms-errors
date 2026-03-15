from tqdm import tqdm
#import numpy as np
import re
import json
import random
import os
import openai
from openai import OpenAI
from collections import defaultdict
import numpy as np
import glob
import argparse
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = OpenAI()  

system_prompt = '''# Instructions for Evaluating Math Problem Description Similarity to MMLU-Math Topics

When evaluating how closely a submitted description matches the reference topic from MMLU-math, consider how well the description aligns with the mathematical domain and concepts typically covered under that topic.

## Rating Scale

1. Perfect Match (5/5): Description directly addresses the core mathematical concepts and methods central to the topic.
2. Strong Match (4/5): Description captures the main mathematical domain and most relevant concepts for the topic.
3. Moderate Match (3/5): Description relates to the topic but may be too broad, narrow, or miss some key conceptual areas.
4. Weak Match (2/5): Description only tangentially relates to the topic, touching on peripheral concepts.
5. No Match (1/5): Description addresses a completely different mathematical domain or unrelated concepts.

Evaluation Process

1. Identify the core mathematical domain and key concepts typically associated with the reference topic
2. Consider the scope and typical applications within that mathematical area
3. Compare the submitted description against the expected conceptual coverage
4. Assign a rating based on how well the description aligns with the topic's mathematical focus

## Example Evaluation
Reference Topic Description: "Algebra"
Expected Core Concepts:

Algebraic expressions and equations
Variable manipulation and solving
Functions and their properties
Polynomial operations

Rating Examples:

Perfect (5/5): "Solving algebraic equations and working with variables to find unknown values"
Strong (4/5): "Problems involving equations and mathematical expressions with unknowns"
Moderate (3/5): "Mathematical problem-solving with symbols" (too broad, lacks specificity)
Weak (2/5): "Working with mathematical formulas" (vague, could apply to many areas)
No Match (1/5): "Calculating areas and perimeters of geometric shapes" (geometry, not algebra)

## Additional Considerations

Consider whether the description captures the appropriate level of mathematical sophistication for the topic
Look for key terminology and concepts that are characteristic of the mathematical domain
Evaluate if the scope is appropriately matched (not too broad or too narrow)

Structure your entire output in JSON format with the following entries:
'Additional Comments': [comments],
'Final Rating': [verdict]
where "verdict" must be 1, 2, 3, 4, or 5 nothing else.
'''

health_system_prompt = '''# Instructions for Evaluating Health Problem Description Similarity to MMLU-Health Topics
When evaluating how closely a submitted description matches the reference topic from MMLU-health, consider how well the description aligns with the medical/health domain and concepts typically covered under that topic.

## Rating Scale

1. Perfect Match (5/5): Description directly addresses the core health concepts, medical principles, or clinical scenarios central to the topic.
2. Strong Match (4/5): Description captures the main health domain and most relevant concepts for the topic.
3. Moderate Match (3/5): Description relates to the topic but may be too broad, narrow, or miss some key clinical/health areas.
4. Weak Match (2/5): Description only tangentially relates to the topic, touching on peripheral health concepts.
5. No Match (1/5): Description addresses a completely different health domain or unrelated concepts.

## Evaluation Process

1. Identify the core health/medical domain and key concepts typically associated with the reference topic
2. Consider the scope and typical clinical applications within that health area
3. Compare the submitted description against the expected conceptual coverage
4. Assign a rating based on how well the description aligns with the topic's health/medical focus

Example Evaluation
Reference Topic: "Cardiology"
Expected Core Concepts:

Heart anatomy and physiology
Cardiovascular diseases and conditions
Diagnostic procedures (ECG, echocardiograms)
Treatment approaches and medications
Risk factors and prevention

## Rating Examples:

Perfect (5/5): "Diagnosing and treating heart conditions including arrhythmias and coronary artery disease"
Strong (4/5): "Medical problems related to heart function and cardiovascular health"
Moderate (3/5): "Health issues affecting the circulatory system" (too broad, lacks clinical specificity)
Weak (2/5): "Managing chronic health conditions" (vague, could apply to many specialties)
No Match (1/5): "Treating skin disorders and dermatological conditions" (dermatology, not cardiology)

## Additional Considerations

Consider whether the description captures the appropriate level of medical sophistication for the topic
Look for key terminology and concepts that are characteristic of the health domain
Evaluate if the scope appropriately matches clinical practice areas (not too broad or too narrow)
Consider both theoretical knowledge and practical clinical applications

Structure your entire output in JSON format with the following entries:
'Additional Comments': [comments],
'Final Rating': [verdict]
where "verdict" must be 1, 2, 3, 4, or 5 nothing else.
'''


def read_json_file(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)
    
def get_judgement(input_text, model="o3-mini-2025-01-31", max_tokens=2048):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{input_text}"}
        ],
        #temperature=0,
        max_completion_tokens=max_tokens,
        response_format={"type": "json_object"},
    )

    response = response.choices[0].message.content.strip().replace("json", "").replace("```", "")
    response_dict = convert_json(response)
    # response_dict = json.loads(response)
    print (f"\nComments: {response_dict['Additional Comments']}")
    print (f"\nRating: {response_dict['Final Rating']}")

    return response_dict['Final Rating']


parser = argparse.ArgumentParser()
parser.add_argument('--seed',
                    help='identify which run')
parser.add_argument('--path',
                    help='path to outputs to be verified')
parser.add_argument('--subset', choices=['health','math'],
                    help='mmlu subset determines prompt to use')
args = parser.parse_args()

# select eval prompt to use based on subset
if args.subset == 'health':
    system_prompt = health_system_prompt

def convert_json(text):
    match = re.search(r'```json\s*(\{.*\})\s*```', text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        json_str = text
    
    pattern = r'("(?:(?:\\.)|[^"\\])*")'

    
    def escape_newline(match):
        s = match.group(0)
        if "\n" in s:
            inner = s[1:-1]
            inner_fixed = inner.replace('\n', '\\n')
            return '"' + inner_fixed + '"'
        return s
    
    fixed_json_str = re.sub(pattern, escape_newline, json_str)

    try:
        return json.loads(fixed_json_str)
    except json.JSONDecodeError as e:
        print('text=', text)
        print('fixed_json_str=', fixed_json_str)
        raise ValueError(f"JSON decoding failed: {e}")

if __name__ == "__main__":
    model_settings = {}
    p = args.path
    print('path=', p)
    setting = '='.join(p.split('/')[-2].split('=')[1:])
    data = read_json_file(p)
    true_standards = data["gold_labels"] 
    hypotheses = data["response"].values()

    max_ratings = []
    std2maxhyp = defaultdict(list)
    max_ratings_per_standard = defaultdict(list)
    for hypothesis in hypotheses:
        ratings = []
        for standard in true_standards:
            standard_id = standard['subject']
            description = standard["subject"]
            input_text = f"Group description: {hypothesis}\n\n" + f"Reference topic description: {description}\n\n"
            print (input_text)
            ####
            # add retries and logging
            max_retries = 5
            retry_delay = 0.5  # seconds
            for attempt in range(1, max_retries + 1):
                try:
                    rating = get_judgement(input_text)
                    logger.info("get_judgement succeeded on attempt %d", attempt)
                    break
                except json.JSONDecodeError as e:
                    logger.warning("Attempt %d failed with JSONDecodeError: %s", attempt, str(e))
                    time.sleep(retry_delay)
            else:
                logger.error("get_judgement failed after %d attempts", max_retries)
                raise RuntimeError("get_judgement failed after maximum retries")
            ratings.append(rating)
            max_ratings_per_standard[standard_id].append(rating)
            # record all hypothesis rating pairs for each standard
            std2maxhyp[standard_id].append((hypothesis, rating))
        print (f"Max rating for this hypothesis: {max(ratings)}")
        print ("-----------------------------------------------------------\n")
        max_ratings.append(max(ratings))
            # Update max rating per standard
    max_ratings_per_standard = {s: max(rating) for s, rating in max_ratings_per_standard.items()}

    # Compute F1 score
    avg_rating_hyps = np.mean(max_ratings)
    avg_rating_stds = np.mean(list(max_ratings_per_standard.values()))
    
    if avg_rating_hyps + avg_rating_stds == 0:
        f1 = 0.0  # Avoid division by zero
    else:
        f1 = 2 * (avg_rating_hyps * avg_rating_stds) / (avg_rating_hyps + avg_rating_stds)

    model_settings[setting] = {'avg_rating_hyps': avg_rating_hyps,
                                'ratings_hyps': max_ratings,
                                'avg_rating_stds': avg_rating_stds,
                                'ratings_stds': max_ratings_per_standard,
                                'f1': f1,
                                'standard2maxhyp': std2maxhyp}

    print(model_settings)
    out_path = f"{p.split('.json')[0]}_o3_judge-seed={args.seed}.json"
    with open(out_path, "w") as f:
        json.dump(model_settings, f, indent=4)
