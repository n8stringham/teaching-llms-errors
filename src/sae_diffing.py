import torch
from scipy.stats import ttest_ind
import numpy as np

def extract_sae_activations(model, sae, dataloader):
    """
    Passes data through the LLM to get hidden states, then through the SAE 
    to get sparse latent activations.
    """
    all_latent_acts = []
    
    with torch.no_grad():
        for batch in dataloader:
            # 1. Get hidden states from LLM
            hidden_states = model(batch['input_ids'], output_hidden_states=True).hidden_states[-1]
            
            # 2. Pass hidden states through SAE to get latent activations (f(x))
            latent_acts = sae.encode(hidden_states)
            all_latent_acts.append(latent_acts.cpu())
            
    return torch.cat(all_latent_acts, dim=0)

def discover_failure_patterns(latent_acts, groups, p_value_threshold=0.05):
    high_res_acts = latent_acts[groups == 'High Residual']
    low_res_acts = latent_acts[groups == 'Low Residual']
    
    discovered_latents = []
    num_latents = latent_acts.shape[-1]
    
    for i in range(num_latents):
        high_vals = high_res_acts[:, i].numpy()
        low_vals = low_res_acts[:, i].numpy()
        
        t_stat, p_val = ttest_ind(high_vals, low_vals, equal_var=False)
        
        effect_size = (np.mean(high_vals) - np.mean(low_vals)) / np.std(low_vals) if np.std(low_vals) > 0 else 0
        
        if p_val < p_value_threshold and effect_size > 0:
            discovered_latents.append({
                "latent_id": i,
                "V'": f"{effect_size:.2f}",
                "p-value": float(p_val)
            })
            
    # Sort
    discovered_latents = sorted(discovered_latents, key=lambda x: float(x["V'"]), reverse=True)
    return discovered_latents
