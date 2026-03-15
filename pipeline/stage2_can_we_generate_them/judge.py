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

client = OpenAI()  

system_prompt = '''# Instructions for Evaluating Math Problem Description Similarity

When evaluating how closely a submitted description matches the reference description, consider both the core mathematical concepts and the specific details mentioned.

## Rating Scale
1. **Perfect Match (5/5)**: Description captures all key mathematical concepts and specific details from the reference.
2. **Strong Match (4/5)**: Description captures the main mathematical concepts but may miss minor details.
3. **Moderate Match (3/5)**: Description captures some key concepts but misses significant details or uses imprecise terminology.
4. **Weak Match (2/5)**: Description only vaguely relates to the reference, missing most key concepts.
5. **No Match (1/5)**: Description fails to capture any relevant mathematical concepts from the reference.

## Evaluation Process
1. Identify the core mathematical concepts in the reference description (both long and short versions)
2. Determine which specific details or applications are essential
3. Compare the submitted description against these elements
4. Assign a rating based on how completely the core concepts and essential details are captured

## Example Evaluation
**Reference (Long)**: "Solve real-world and mathematical problems involving the four operations with rational numbers."
**Reference (Short)**: "Add/sub/mult/div with fractions"

**Core Concepts**: 
- Arithmetic operations (addition, subtraction, multiplication, division)
- Fractions/rational numbers

**Rating Examples**:
- **Perfect (5/5)**: "Problems with the four arithmetic operations with fractions to solve problems."
- **Strong (4/5)**: "Problems with fractions using different operations to solve math problems."
- **Moderate (3/5)**: "Solving problems with fractions" (missing specific mention of operations)
- **Weak (2/5)**: "Working with number operations" (mentions operations but not fractions)
- **No Match (1/5)**: "Solving geometry problems" (unrelated mathematical domain)

When judging, remember to look for both the mathematical content (operations, number types, etc.) and number types and ranges (whole numbers, fractions, decimals, etc.).

Structure your entire output in JSON format with the following entries: \
    'Additional Comments': [comments],\n" \
    'Final Rating': [verdict]\n" 
"where \"verdict\" must be 1, 2, 3, 4, or 5 nothing else. 
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
parser.add_argument('--dataset',
                    help='the dataset to used (mathCAMPS or MMLU)')
parser.add_argument('--single-prominent-standard', action='store_true',
                    help='set flag for evaluating responses from the single-prominent-standard experiment')
args = parser.parse_args()

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
        raise ValueError(f"JSON decoding failed: {e}")

if __name__ == "__main__":
    model_settings = {}
    p = args.path
    print('path=', p)
    print(args)
    setting = '='.join(p.split('/')[-2].split('=')[1:])
    data = read_json_file(p)
    
    if args.single_prominent_standard:
        setting = f"{data['label']}-ratio={data['target_error_ratio']}"
        true_standards = [{
            "standard": data['label'],
            "description": data['label_descr'],
            "short_description": data['label_short_descr']
        }]
    else:
        true_standards = data["gold_labels"]

    hypotheses = data["response"].values()
    print('ture_standards=', true_standards)

    max_ratings = []
    std2maxhyp = defaultdict(list)
    max_ratings_per_standard = defaultdict(list)
    for hypothesis in hypotheses:
        ratings = []
        for standard in true_standards:
            standard_id = standard['standard']
            description = standard["description"]
            short_description = standard["short_description"]
            input_text = f"Group description: {hypothesis}\n\n" + f"Reference detailed description: {description}\n\n" + f"Reference gist: {short_description}"
            print (input_text)
            rating = get_judgement(input_text)
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
