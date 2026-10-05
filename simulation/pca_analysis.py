import pymongo
import pandas as pd
import numpy as np
from bson import ObjectId
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def calc_dfa(rr_series, scale_min=4, scale_max=16):
    if len(rr_series) < scale_max: return np.nan
    y = np.cumsum(rr_series - np.mean(rr_series))
    scales = np.unique(np.floor(np.logspace(np.log10(scale_min), np.log10(scale_max), 10)).astype(int))
    F = []
    for s in scales:
        f2 = 0
        n_windows = len(y) // s
        if n_windows == 0: continue
        for i in range(n_windows):
            window = y[i*s : (i+1)*s]
            x = np.arange(s)
            coef = np.polyfit(x, window, 1)
            trend = np.polyval(coef, x)
            f2 += np.sum((window - trend)**2)
        F.append(np.sqrt(f2 / (n_windows * s)))
    
    valid = np.array(F) > 0
    scales = scales[valid]
    F = np.array(F)[valid]
    if len(F) > 2:
        return np.polyfit(np.log10(scales), np.log10(F), 1)[0]
    return np.nan

def extract_features(df, window_size=60, global_hr_mean=75, global_hr_std=10):
    # Sort and split into windows of length window_size
    n_windows = len(df) // window_size
    if n_windows == 0: return pd.DataFrame()
    
    features = []
    for i in range(n_windows):
        win = df.iloc[i*window_size : (i+1)*window_size]
        
        # 1. Motion: RMS of acc_x, acc_y, acc_z.
        # It's in g. Subtract 1 to get net acceleration magnitude, then take mean or std.
        rms = np.sqrt(win['acc_x']**2 + win['acc_y']**2 + win['acc_z']**2)
        motion = np.std(rms)  # Standard deviation is better to capture "movement"
        
        # 2. Delta HR
        delta_hr = win['hr'].max() - win['hr'].min()
        
        # 3. SDNN
        sdnn = win['rr'].std()
        
        # 4. DFA Alpha 1
        dfa = calc_dfa(win['rr'].values)
        
        # 5. Z-Score HR (Using population or user global mean)
        z_score = (win['hr'].mean() - global_hr_mean) / global_hr_std
        
        features.append({
            'activity': win['activity'].iloc[0],
            'Motion': motion,
            'deltaHR': delta_hr,
            'SDNN': sdnn,
            'DFA': dfa,
            'z_score': z_score
        })
    return pd.DataFrame(features)

def run_pca_for_user(user_id, title_prefix):
    print(f"\n--- Processing User {user_id} ---")
    uri = 'mongodb://capar_admin:SecurePassword123!@127.0.0.1:27017/test?authSource=admin'
    client = pymongo.MongoClient(uri)
    coll = client['test']['polardatas']
    
    query_id = ObjectId(user_id) if coll.count_documents({'user_id': ObjectId(user_id)}) > 0 else user_id
    
    # We take Duduk and Berjalan since Berdiri is not available for these users
    activities = ['Duduk', 'Berjalan']
    
    docs = list(coll.find(
        {'user_id': query_id, 'activity': {'$in': activities}, 'acc_x': {'$exists': True}},
        {'hr':1, 'rr':1, 'acc_x':1, 'acc_y':1, 'acc_z':1, 'activity':1, '_id':0}
    ))
    
    if not docs:
        print("No data found!")
        return
        
    df = pd.DataFrame(docs)
    df = df.dropna()
    
    global_hr_mean = df['hr'].mean()
    global_hr_std = df['hr'].std()
    
    # Group by activity and extract windowed features
    feat_dfs = []
    for act in activities:
        d_act = df[df['activity'] == act]
        f = extract_features(d_act, window_size=60, global_hr_mean=global_hr_mean, global_hr_std=global_hr_std)
        if not f.empty:
            feat_dfs.append(f)
            
    if not feat_dfs:
        print("Not enough data to create windows!")
        return
        
    df_feat = pd.concat(feat_dfs, ignore_index=True).dropna()
    print(f"Extracted {len(df_feat)} feature windows.")
    
    variables = ['Motion', 'deltaHR', 'SDNN', 'DFA', 'z_score']
    X = df_feat[variables]
    y = df_feat['activity']
    
    # Standardize
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # PCA
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)
    
    # Analyze Loadings
    loadings = pd.DataFrame(pca.components_.T, columns=['PC1', 'PC2'], index=variables)
    print("\nPCA Loadings (Pengaruh tiap variabel terhadap Principal Components):")
    print(loadings)
    
    # Find most influential feature for PC1
    most_influential = loadings['PC1'].abs().idxmax()
    print(f"\nVariabel Paling Berpengaruh (PC1): {most_influential}")
    
    # Plot PCA Scatter
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    fig.patch.set_facecolor('#0F1923')
    
    ax = axes[0]
    ax.set_facecolor('#131F2B')
    colors = {'Duduk': '#38BDF8', 'Berjalan': '#FB923C'}
    for act in df_feat['activity'].unique():
        idx = df_feat['activity'] == act
        ax.scatter(X_pca[idx, 0], X_pca[idx, 1], label=act, color=colors.get(act, 'white'), alpha=0.7, edgecolors='none')
    
    ax.set_xlabel(f'PC1 ({pca.explained_variance_ratio_[0]*100:.1f}%)', color='#C9D8E8')
    ax.set_ylabel(f'PC2 ({pca.explained_variance_ratio_[1]*100:.1f}%)', color='#C9D8E8')
    ax.set_title(f'PCA Scatter Plot - Peserta {title_prefix}', color='#E2EAF0')
    ax.tick_params(colors='#8BA3B8')
    ax.grid(color='#1E2E3C', linestyle='--')
    ax.legend(facecolor='#162030', edgecolor='#2D3F50', labelcolor='white')
    
    # Plot Loadings (Biplot vectors)
    ax2 = axes[1]
    ax2.set_facecolor('#131F2B')
    
    for i, var in enumerate(variables):
        ax2.arrow(0, 0, loadings.iloc[i, 0], loadings.iloc[i, 1], head_width=0.05, head_length=0.05, fc='#A78BFA', ec='#A78BFA')
        ax2.text(loadings.iloc[i, 0]*1.15, loadings.iloc[i, 1]*1.15, var, color='#FCD34D', fontsize=11, ha='center')
        
    ax2.set_xlim(-1, 1)
    ax2.set_ylim(-1, 1)
    ax2.axhline(0, color='#1E2E3C', ls='--')
    ax2.axvline(0, color='#1E2E3C', ls='--')
    ax2.set_xlabel('PC1 Loading', color='#C9D8E8')
    ax2.set_ylabel('PC2 Loading', color='#C9D8E8')
    ax2.set_title('PCA Feature Loadings (Pengaruh Faktor)', color='#E2EAF0')
    ax2.tick_params(colors='#8BA3B8')
    
    plt.tight_layout()
    out = os.path.join(OUT_DIR, f'pca_{title_prefix}.png')
    plt.savefig(out, dpi=150, facecolor=fig.get_facecolor())
    print(f"Saved plot to {out}")

if __name__ == '__main__':
    run_pca_for_user('6a8f9fab74156d89d1dc3c47', '22')
    run_pca_for_user('6a98264316b1f3634c777f82', '23')
