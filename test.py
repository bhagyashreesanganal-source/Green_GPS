import networkx as nx
import sys
sys.stdout.reconfigure(encoding='utf-8')
# 1️⃣ Create graph with latency (ms) and carbon (g CO2)
G = nx.Graph()
G.add_edge("Mumbai", "Dubai", latency=50, carbon=20)
G.add_edge("Dubai", "London", latency=80, carbon=10)
G.add_edge("Mumbai", "Singapore", latency=60, carbon=5)
G.add_edge("Singapore", "London", latency=70, carbon=10)

# 2️⃣ Cost function for different modes
def cost(u, v, d, mode="balanced"):
    if mode == "eco":      # prioritize carbon
        return d['latency'] * 0.3 + d['carbon'] * 0.7
    elif mode == "fast":   # prioritize speed
        return d['latency'] * 0.8 + d['carbon'] * 0.2
    else:                  # balanced
        return d['latency'] + d['carbon']

# 3️⃣ Set source and destination
source = "Mumbai"
destination = "London"

# 4️⃣ Compute routes for all modes
eco_path = nx.dijkstra_path(G, source, destination,
                            weight=lambda u,v,d: cost(u,v,d,"eco"))
fast_path = nx.dijkstra_path(G, source, destination,
                             weight=lambda u,v,d: cost(u,v,d,"fast"))
balanced_path = nx.dijkstra_path(G, source, destination,
                                 weight=lambda u,v,d: cost(u,v,d,"balanced"))

# 5️⃣ Compute total latency and carbon for each path
def compute_totals(path):
    total_latency = 0
    total_carbon = 0
    for i in range(len(path)-1):
        edge = G[path[i]][path[i+1]]
        total_latency += edge['latency']
        total_carbon += edge['carbon']
    return total_latency, total_carbon

eco_latency, eco_carbon = compute_totals(eco_path)
fast_latency, fast_carbon = compute_totals(fast_path)
balanced_latency, balanced_carbon = compute_totals(balanced_path)

# 6️⃣ Print results
print("Eco Route:", eco_path, "| Latency:", eco_latency, "ms | Carbon:", eco_carbon, "g")
print("Fast Route:", fast_path, "| Latency:", fast_latency, "ms | Carbon:", fast_carbon, "g")
print("Balanced Route:", balanced_path, "| Latency:", balanced_latency, "ms | Carbon:", balanced_carbon, "g")