#include <algorithm>
#include <cctype>
#include <cmath>
#include <fstream>
#include <iostream>
#include <limits>
#include <optional>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace {

struct Edge {
  std::string to;
  double latency = 0.0;
  double carbon = 0.0;
};

struct Graph {
  std::unordered_set<std::string> nodes;
  std::unordered_map<std::string, std::vector<Edge>> adj;
};

static inline void ltrim(std::string &s) {
  s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char ch) { return !std::isspace(ch); }));
}
static inline void rtrim(std::string &s) {
  s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char ch) { return !std::isspace(ch); }).base(), s.end());
}
static inline void trim(std::string &s) { ltrim(s); rtrim(s); }

// Minimal JSON parser for this project's graph.json structure.
// This avoids third-party dependencies; it is intentionally strict and small.
std::string readFile(const std::string &path) {
  std::ifstream f(path, std::ios::binary);
  if (!f) throw std::runtime_error("Failed to open graph.json: " + path);
  std::ostringstream ss;
  ss << f.rdbuf();
  return ss.str();
}

size_t skipWs(const std::string &s, size_t i) {
  while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) i++;
  return i;
}

void expectChar(const std::string &s, size_t &i, char c) {
  i = skipWs(s, i);
  if (i >= s.size() || s[i] != c) {
    std::ostringstream msg;
    msg << "Expected '" << c << "' at position " << i;
    throw std::runtime_error(msg.str());
  }
  i++;
}

std::string parseString(const std::string &s, size_t &i) {
  i = skipWs(s, i);
  if (i >= s.size() || s[i] != '"') throw std::runtime_error("Expected string");
  i++;
  std::string out;
  while (i < s.size()) {
    char ch = s[i++];
    if (ch == '"') break;
    if (ch == '\\') {
      if (i >= s.size()) throw std::runtime_error("Invalid escape");
      char esc = s[i++];
      switch (esc) {
      case '"': out.push_back('"'); break;
      case '\\': out.push_back('\\'); break;
      case '/': out.push_back('/'); break;
      case 'b': out.push_back('\b'); break;
      case 'f': out.push_back('\f'); break;
      case 'n': out.push_back('\n'); break;
      case 'r': out.push_back('\r'); break;
      case 't': out.push_back('\t'); break;
      default: throw std::runtime_error("Unsupported escape");
      }
    } else {
      out.push_back(ch);
    }
  }
  return out;
}

double parseNumber(const std::string &s, size_t &i) {
  i = skipWs(s, i);
  size_t start = i;
  if (i < s.size() && (s[i] == '-' || s[i] == '+')) i++;
  while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) i++;
  if (i < s.size() && s[i] == '.') {
    i++;
    while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) i++;
  }
  if (i < s.size() && (s[i] == 'e' || s[i] == 'E')) {
    i++;
    if (i < s.size() && (s[i] == '-' || s[i] == '+')) i++;
    while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) i++;
  }
  if (start == i) throw std::runtime_error("Expected number");
  return std::stod(s.substr(start, i - start));
}

void skipValue(const std::string &s, size_t &i); // forward

void skipArray(const std::string &s, size_t &i) {
  expectChar(s, i, '[');
  i = skipWs(s, i);
  if (i < s.size() && s[i] == ']') {
    i++;
    return;
  }
  while (true) {
    skipValue(s, i);
    i = skipWs(s, i);
    if (i >= s.size()) throw std::runtime_error("Unexpected end in array");
    if (s[i] == ']') {
      i++;
      break;
    }
    expectChar(s, i, ',');
  }
}

void skipObject(const std::string &s, size_t &i) {
  expectChar(s, i, '{');
  i = skipWs(s, i);
  if (i < s.size() && s[i] == '}') {
    i++;
    return;
  }
  while (true) {
    (void)parseString(s, i);
    expectChar(s, i, ':');
    skipValue(s, i);
    i = skipWs(s, i);
    if (i >= s.size()) throw std::runtime_error("Unexpected end in object");
    if (s[i] == '}') {
      i++;
      break;
    }
    expectChar(s, i, ',');
  }
}

void skipValue(const std::string &s, size_t &i) {
  i = skipWs(s, i);
  if (i >= s.size()) throw std::runtime_error("Unexpected end of JSON");
  char c = s[i];
  if (c == '"') { (void)parseString(s, i); return; }
  if (c == '{') { skipObject(s, i); return; }
  if (c == '[') { skipArray(s, i); return; }
  if (std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == '+') { (void)parseNumber(s, i); return; }
  if (s.compare(i, 4, "true") == 0) { i += 4; return; }
  if (s.compare(i, 5, "false") == 0) { i += 5; return; }
  if (s.compare(i, 4, "null") == 0) { i += 4; return; }
  throw std::runtime_error("Unexpected JSON token");
}

Graph parseGraphJson(const std::string &json) {
  Graph g;
  size_t i = 0;
  expectChar(json, i, '{');
  i = skipWs(json, i);
  while (i < json.size() && json[i] != '}') {
    std::string key = parseString(json, i);
    expectChar(json, i, ':');
    if (key == "nodes") {
      expectChar(json, i, '[');
      i = skipWs(json, i);
      if (i < json.size() && json[i] != ']') {
        while (true) {
          std::string node = parseString(json, i);
          g.nodes.insert(node);
          i = skipWs(json, i);
          if (i < json.size() && json[i] == ']') break;
          expectChar(json, i, ',');
        }
      }
      expectChar(json, i, ']');
    } else if (key == "edges") {
      expectChar(json, i, '[');
      i = skipWs(json, i);
      if (i < json.size() && json[i] != ']') {
        while (true) {
          expectChar(json, i, '{');
          std::optional<std::string> from;
          std::optional<std::string> to;
          std::optional<double> latency;
          std::optional<double> carbon;
          i = skipWs(json, i);
          while (i < json.size() && json[i] != '}') {
            std::string ek = parseString(json, i);
            expectChar(json, i, ':');
            if (ek == "from") from = parseString(json, i);
            else if (ek == "to") to = parseString(json, i);
            else if (ek == "latency") latency = parseNumber(json, i);
            else if (ek == "carbon") carbon = parseNumber(json, i);
            else skipValue(json, i);
            i = skipWs(json, i);
            if (json[i] == '}') break;
            expectChar(json, i, ',');
            i = skipWs(json, i);
          }
          expectChar(json, i, '}');
          if (!from || !to || !latency || !carbon) throw std::runtime_error("Edge missing required fields");
          g.nodes.insert(*from);
          g.nodes.insert(*to);
          // Treat edges as undirected by adding both directions.
          g.adj[*from].push_back(Edge{*to, *latency, *carbon});
          g.adj[*to].push_back(Edge{*from, *latency, *carbon});

          i = skipWs(json, i);
          if (i < json.size() && json[i] == ']') break;
          expectChar(json, i, ',');
          i = skipWs(json, i);
        }
      }
      expectChar(json, i, ']');
    } else {
      skipValue(json, i);
    }
    i = skipWs(json, i);
    if (i < json.size() && json[i] == ',') {
      i++;
      i = skipWs(json, i);
    } else {
      break;
    }
  }
  expectChar(json, i, '}');
  return g;
}

struct Weights {
  double alpha = 0.5;
  double beta = 0.5;
};

Weights defaultWeightsForMode(const std::string &mode) {
  if (mode == "eco") return Weights{0.30, 0.70};
  if (mode == "balanced") return Weights{0.50, 0.50};
  if (mode == "fast") return Weights{0.70, 0.30};
  throw std::runtime_error("Invalid mode: " + mode);
}

std::string jsonEscape(const std::string &s) {
  std::ostringstream o;
  for (char c : s) {
    switch (c) {
    case '"': o << "\\\""; break;
    case '\\': o << "\\\\"; break;
    case '\b': o << "\\b"; break;
    case '\f': o << "\\f"; break;
    case '\n': o << "\\n"; break;
    case '\r': o << "\\r"; break;
    case '\t': o << "\\t"; break;
    default: o << c; break;
    }
  }
  return o.str();
}

void printErrorJson(const std::string &message) {
  std::cerr << "{\"error\":\"" << jsonEscape(message) << "\"}\n";
}

struct RouteResult {
  std::vector<std::string> path;
  double latency = 0.0;
  double carbon = 0.0;
  double cost = 0.0;
};

RouteResult dijkstra(const Graph &g, const std::string &source, const std::string &dest, double alpha, double beta) {
  struct State {
    std::string node;
    double cost;
  };
  struct Cmp {
    bool operator()(const State &a, const State &b) const { return a.cost > b.cost; }
  };

  const double INF = std::numeric_limits<double>::infinity();
  std::unordered_map<std::string, double> dist;
  std::unordered_map<std::string, std::string> prev;
  std::unordered_map<std::string, double> bestLatency;
  std::unordered_map<std::string, double> bestCarbon;

  for (const auto &n : g.nodes) {
    dist[n] = INF;
    bestLatency[n] = INF;
    bestCarbon[n] = INF;
  }

  dist[source] = 0.0;
  bestLatency[source] = 0.0;
  bestCarbon[source] = 0.0;

  std::priority_queue<State, std::vector<State>, Cmp> pq;
  pq.push(State{source, 0.0});

  while (!pq.empty()) {
    State cur = pq.top();
    pq.pop();
    if (cur.cost != dist[cur.node]) continue;
    if (cur.node == dest) break;

    auto it = g.adj.find(cur.node);
    if (it == g.adj.end()) continue;

    for (const auto &e : it->second) {
      double candLatency = bestLatency[cur.node] + e.latency;
      double candCarbon = bestCarbon[cur.node] + e.carbon;
      double candCost = alpha * candLatency + beta * candCarbon;
      if (candCost < dist[e.to]) {
        dist[e.to] = candCost;
        bestLatency[e.to] = candLatency;
        bestCarbon[e.to] = candCarbon;
        prev[e.to] = cur.node;
        pq.push(State{e.to, candCost});
      }
    }
  }

  if (!std::isfinite(dist[dest])) throw std::runtime_error("No route found");

  std::vector<std::string> path;
  std::string cur = dest;
  path.push_back(cur);
  while (cur != source) {
    auto pit = prev.find(cur);
    if (pit == prev.end()) throw std::runtime_error("No route found");
    cur = pit->second;
    path.push_back(cur);
  }
  std::reverse(path.begin(), path.end());

  RouteResult r;
  r.path = path;
  r.latency = bestLatency[dest];
  r.carbon = bestCarbon[dest];
  r.cost = dist[dest];
  return r;
}

// Very small CLI parser: --key value
std::unordered_map<std::string, std::string> parseArgs(int argc, char **argv) {
  std::unordered_map<std::string, std::string> out;
  for (int i = 1; i < argc; i++) {
    std::string k = argv[i];
    if (k.rfind("--", 0) != 0) continue;
    if (i + 1 >= argc) throw std::runtime_error("Missing value for " + k);
    out[k.substr(2)] = argv[++i];
  }
  return out;
}

} // namespace

int main(int argc, char **argv) {
  try {
    auto args = parseArgs(argc, argv);
    if (!args.count("graph") || !args.count("source") || !args.count("destination") || !args.count("mode")) {
      printErrorJson("Missing required args: --graph --source --destination --mode");
      return 2;
    }

    std::string graphPath = args["graph"];
    std::string source = args["source"];
    std::string dest = args["destination"];
    std::string mode = args["mode"];

    Weights w = defaultWeightsForMode(mode);
    if (args.count("alpha")) w.alpha = std::stod(args["alpha"]);
    if (args.count("beta")) w.beta = std::stod(args["beta"]);
    if (!(w.alpha >= 0.0 && w.beta >= 0.0) || (w.alpha + w.beta) <= 0.0) {
      printErrorJson("alpha and beta must be non-negative and not both zero");
      return 2;
    }

    Graph g = parseGraphJson(readFile(graphPath));
    if (!g.nodes.count(source) || !g.nodes.count(dest)) {
      printErrorJson("Invalid node selection");
      return 2;
    }

    if (source == dest) {
      std::cout << "{\"path\":[\"" << jsonEscape(source) << "\"],\"latency\":0,\"carbon\":0,\"cost\":0}\n";
      return 0;
    }

    RouteResult r = dijkstra(g, source, dest, w.alpha, w.beta);

    std::cout << "{\"path\":[";
    for (size_t i = 0; i < r.path.size(); i++) {
      if (i) std::cout << ",";
      std::cout << "\"" << jsonEscape(r.path[i]) << "\"";
    }
    std::cout << "],\"latency\":" << static_cast<int>(std::round(r.latency))
              << ",\"carbon\":" << static_cast<int>(std::round(r.carbon))
              << ",\"cost\":" << static_cast<int>(std::round(r.cost)) << "}\n";
    return 0;
  } catch (const std::exception &e) {
    printErrorJson(std::string("Routing engine error: ") + e.what());
    return 1;
  }
}

